/**
 * UpdateNotification - Shows update available banner
 */
export const UpdateNotification = {
    container: null,
    isVisible: false,

    /**
     * Initialize the notification component
     */
    init() {
        this.createContainer();
        if (import.meta.env.PROD) this.setupListeners();
    },

    /**
     * Create the notification container in DOM
     */
    createContainer() {
        const container = document.createElement('div');
        container.id = 'updateNotification';
        container.className = 'update-notification hidden';
        container.innerHTML = `
            <div class="update-content">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                <span>A new version is available!</span>
            </div>
            <div class="update-actions">
                <button class="update-btn update-btn-primary" id="updateNowBtn">Update Now</button>
                <button class="update-btn update-btn-secondary" id="dismissUpdateBtn">Later</button>
            </div>
        `;

        // Insert at top of body
        document.body.insertBefore(container, document.body.firstChild);
        this.container = container;

        // Setup button handlers
        document.getElementById('updateNowBtn').addEventListener('click', () => {
            this.applyUpdate();
        });

        document.getElementById('dismissUpdateBtn').addEventListener('click', () => {
            this.hide();
        });
    },

    /**
     * Setup service worker message listeners
     */
    setupListeners() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('message', (event) => {
                if (event.data && event.data.type === 'UPDATE_AVAILABLE') {
                    this.show();
                }
            });

            // Also check for waiting service worker on page load
            navigator.serviceWorker.ready.then(registration => {
                if (registration.waiting) {
                    this.show();
                }

                // Listen for new service worker becoming available
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            this.show();
                        }
                    });
                });
            });
        }
    },

    /**
     * Show the update notification
     */
    show() {
        if (this.isVisible) return;
        this.isVisible = true;
        this.container.classList.remove('hidden');

        // Play a subtle sound or vibration on mobile (if supported)
        if ('vibrate' in navigator) {
            navigator.vibrate(200);
        }

        // NO auto-dismiss - notification stays until user takes action
    },

    /**
     * Hide the update notification
     */
    hide() {
        this.isVisible = false;
        this.container.classList.add('hidden');
    },

    /**
     * Apply the update by reloading the page
     */
    applyUpdate() {
        // Tell the waiting service worker to take over
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.ready.then(registration => {
                if (registration.waiting) {
                    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
                }
            });
        }

        // Reload the page to get the new version
        window.location.reload();
    }
};
