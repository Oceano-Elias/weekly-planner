/**
 * Confirm Modal - Custom confirmation dialog for Tauri compatibility
 */

export const ConfirmModal = {
    /**
     * Show confirmation dialog
     * @param {string} message - The confirmation message
     * @param {function} onConfirm - Optional callback when confirmed
     * @param {string} confirmText - Optional confirm button text (default: "Confirm")
     * @returns {Promise<boolean>} - True if confirmed, false if canceled
     */
    show(message, onConfirm = null, confirmText = 'Confirm') {
        return new Promise((resolve) => {
            // Create overlay
            const overlay = document.createElement('div');
            overlay.className = 'confirm-overlay';

            // Create modal with ARIA attributes
            const modal = document.createElement('div');
            modal.className = 'confirm-modal';
            modal.setAttribute('role', 'alertdialog');
            modal.setAttribute('aria-modal', 'true');
            modal.setAttribute('aria-labelledby', 'confirmMessage');

            // Use danger styling for delete actions
            const isDelete = confirmText.toLowerCase() === 'delete';
            const okBtnClass = isDelete ? 'confirm-btn confirm-delete' : 'confirm-btn confirm-ok';

            modal.innerHTML = `
                <div class="confirm-content">
                    <p class="confirm-message" id="confirmMessage">${message}</p>
                    <div class="confirm-buttons">
                        <button class="confirm-btn confirm-cancel">Cancel</button>
                        <button class="${okBtnClass}">${confirmText}</button>
                    </div>
                </div>
            `;

            overlay.appendChild(modal);
            document.body.appendChild(overlay);

            // Focus on confirm button after a short delay
            setTimeout(() => {
                const okBtn = modal.querySelector('.confirm-ok, .confirm-delete');
                if (okBtn) okBtn.focus();
            }, 100);

            // Handle cancel
            const cancelBtn = modal.querySelector('.confirm-cancel');
            const handleCancel = () => {
                document.body.removeChild(overlay);
                document.removeEventListener('keydown', handleEscape);
                resolve(false);
            };

            cancelBtn.addEventListener('click', handleCancel);
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) handleCancel();
            });

            // Handle confirm
            const okBtn = modal.querySelector('.confirm-ok, .confirm-delete');
            okBtn.addEventListener('click', () => {
                document.body.removeChild(overlay);
                document.removeEventListener('keydown', handleEscape);
                if (onConfirm) onConfirm();
                resolve(true);
            });

            // Handle escape key
            const handleEscape = (e) => {
                if (e.key === 'Escape') {
                    handleCancel();
                }
            };
            document.addEventListener('keydown', handleEscape);

            // Focus trap - Tab cycles within modal
            const handleTab = (e) => {
                if (e.key !== 'Tab') return;
                const focusables = [cancelBtn, okBtn];
                const first = focusables[0];
                const last = focusables[focusables.length - 1];

                if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            };
            modal.addEventListener('keydown', handleTab);
        });
    }
};
