/**
 * FocusTrap - Accessibility utility for trapping focus within modals
 *
 * Usage:
 *   FocusTrap.activate(modalElement)  // Trap focus inside modal
 *   FocusTrap.deactivate()            // Release trap and restore focus
 */
const FocusTrap = {
    activeElement: null, // Element that triggered the modal
    trapElement: null, // The modal element containing the trap
    boundHandler: null, // Bound keydown handler for cleanup

    /**
     * Activate focus trap on an element
     * @param {HTMLElement} element - Modal or container to trap focus in
     */
    activate(element) {
        if (!element) return;

        // Store the element that had focus before opening
        this.activeElement = document.activeElement;
        this.trapElement = element;

        // Get all focusable elements
        const focusables = this.getFocusableElements(element);
        if (focusables.length === 0) return;

        // Focus the first focusable element
        setTimeout(() => {
            focusables[0]?.focus();
        }, 50);

        // Set up Tab trap handler
        this.boundHandler = (e) => this.handleKeydown(e);
        element.addEventListener('keydown', this.boundHandler);
    },

    /**
     * Deactivate focus trap and restore previous focus
     */
    deactivate() {
        if (this.trapElement && this.boundHandler) {
            this.trapElement.removeEventListener('keydown', this.boundHandler);
        }

        // Restore focus to the trigger element
        if (this.activeElement && typeof this.activeElement.focus === 'function') {
            const target = this.activeElement.isConnected ? this.activeElement : document.body;
            setTimeout(() => {
                target.focus();
            }, 50);
        }

        this.activeElement = null;
        this.trapElement = null;
        this.boundHandler = null;
    },

    /**
     * Handle Tab key to trap focus within the modal
     */
    handleKeydown(e) {
        if (e.key !== 'Tab') return;

        const focusables = this.getFocusableElements(this.trapElement);
        if (focusables.length === 0) return;

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey) {
            // Shift+Tab: if on first element, loop to last
            if (document.activeElement === first) {
                e.preventDefault();
                last.focus();
            }
        } else {
            // Tab: if on last element, loop to first
            if (document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }
    },

    /**
     * Get all focusable elements within a container
     */
    getFocusableElements(container) {
        const selector = [
            'button:not([disabled]):not([tabindex="-1"])',
            'input:not([disabled]):not([type="hidden"]):not([tabindex="-1"])',
            'select:not([disabled]):not([tabindex="-1"])',
            'textarea:not([disabled]):not([tabindex="-1"])',
            'a[href]:not([tabindex="-1"])',
            '[tabindex]:not([tabindex="-1"]):not([disabled])',
        ].join(', ');

        const elements = Array.from(container.querySelectorAll(selector));
        // Filter out invisible elements
        return elements.filter((el) => {
            return el.offsetWidth > 0 && el.offsetHeight > 0;
        });
    },
};

export default FocusTrap;
