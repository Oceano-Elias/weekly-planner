import FocusTrap from '../utils/FocusTrap.js';

/**
 * ModalService - Handles task modal open/close interactions
 */
export const ModalService = {
    modal: null,
    onCloseCallback: null,

    init() {
        this.modal = document.getElementById('taskModal');
        this.setupListeners();
    },

    /**
     * Setup modal listeners
     */
    setupListeners() {
        const openBtn = document.getElementById('newTaskBtn');
        const closeBtn = document.getElementById('closeModal');
        const cancelBtn = document.getElementById('cancelTask');

        // Add ARIA attributes
        if (this.modal) {
            this.modal.setAttribute('role', 'dialog');
            this.modal.setAttribute('aria-modal', 'true');
            this.modal.setAttribute('aria-labelledby', 'modalTitle');

            this.modal.addEventListener('click', (e) => {
                if (e.target === this.modal) {
                    this.close();
                }
            });
        }

        if (openBtn) {
            openBtn.addEventListener('click', () => {
                // We dispatch a custom event so FormHandler can reset the form
                document.dispatchEvent(new CustomEvent('modal:open'));
                this.open();
            });
        }

        if (closeBtn) closeBtn.addEventListener('click', () => this.close());
        if (cancelBtn) cancelBtn.addEventListener('click', () => this.close());

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen()) {
                this.close();
            }
        });
    },

    /**
     * Open the modal
     */
    open() {
        if (!this.modal) return;
        this.modal.classList.add('active');
        FocusTrap.activate(this.modal);
    },

    /**
     * Close the modal
     */
    close() {
        if (!this.modal) return;

        // Force blur if focus is inside modal to prevent shortcuts from being blocked
        if (this.modal.contains(document.activeElement)) {
            document.activeElement.blur();
        }

        this.modal.classList.remove('active');
        FocusTrap.deactivate();

        // Dispatch close event so FormHandler can clean up
        document.dispatchEvent(new CustomEvent('modal:close'));
    },

    /**
     * Check if modal is open
     */
    isOpen() {
        return this.modal && this.modal.classList.contains('active');
    },
};
