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

            // Create modal
            const modal = document.createElement('div');
            modal.className = 'confirm-modal';
            modal.innerHTML = `
                <div class="confirm-content">
                    <p class="confirm-message">${message}</p>
                    <div class="confirm-buttons">
                        <button class="confirm-btn confirm-cancel">Cancel</button>
                        <button class="confirm-btn confirm-ok">${confirmText}</button>
                    </div>
                </div>
            `;

            overlay.appendChild(modal);
            document.body.appendChild(overlay);

            // Focus on confirm button after a short delay
            setTimeout(() => {
                const okBtn = modal.querySelector('.confirm-ok');
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
            const okBtn = modal.querySelector('.confirm-ok');
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
        });
    }
};
