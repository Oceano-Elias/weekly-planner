import { DOMUtils } from '../utils/DOMUtils.js';

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
        const container = DOMUtils.createElement('div', {
            id: 'updateNotification',
            className: 'update-notification hidden',
        });

        const content = DOMUtils.createElement('div', { className: 'update-content' });
        content.appendChild(
            DOMUtils.createSVG(
                'svg',
                {
                    width: '20',
                    height: '20',
                    viewBox: '0 0 24 24',
                    fill: 'none',
                    stroke: 'currentColor',
                    'stroke-width': '2',
                },
                [
                    DOMUtils.createSVG('path', { d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' }),
                    DOMUtils.createSVG('polyline', { points: '7 10 12 15 17 10' }),
                    DOMUtils.createSVG('line', { x1: '12', y1: '15', x2: '12', y2: '3' }),
                ]
            )
        );
        content.appendChild(
            DOMUtils.createElement('span', { textContent: 'A new version is available!' })
        );
        container.appendChild(content);

        const actions = DOMUtils.createElement('div', { className: 'update-actions' });
        const updateBtn = DOMUtils.createElement('button', {
            className: 'update-btn update-btn-primary',
            id: 'updateNowBtn',
            textContent: 'Update Now',
        });
        const dismissBtn = DOMUtils.createElement('button', {
            className: 'update-btn update-btn-secondary',
            id: 'dismissUpdateBtn',
            textContent: 'Later',
        });
        actions.appendChild(updateBtn);
        actions.appendChild(dismissBtn);
        container.appendChild(actions);

        // Insert at top of body
        document.body.insertBefore(container, document.body.firstChild);
        this.container = container;

        // Setup button handlers
        updateBtn.addEventListener('click', () => {
            this.applyUpdate();
        });

        dismissBtn.addEventListener('click', () => {
            this.hide();
        });
    },

    /**
     * Setup service worker message listeners
     */
    setupListeners() {
        // Skip in non-HTTP environments (Tauri uses tauri:// protocol)
        const isHttpProtocol = ['http:', 'https:'].includes(window.location.protocol);
        if (!isHttpProtocol) return;

        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('message', (event) => {
                if (event.data && event.data.type === 'UPDATE_AVAILABLE') {
                    this.show();
                }
            });

            // Also check for waiting service worker on page load
            navigator.serviceWorker.ready
                .then((registration) => {
                    if (registration.waiting) {
                        this.show();
                    }

                    // Listen for new service worker becoming available
                    registration.addEventListener('updatefound', () => {
                        const newWorker = registration.installing;
                        newWorker.addEventListener('statechange', () => {
                            if (
                                newWorker.state === 'installed' &&
                                navigator.serviceWorker.controller
                            ) {
                                this.show();
                            }
                        });
                    });
                })
                .catch(() => {
                    // Silently ignore - SW not supported in this context
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
            navigator.serviceWorker.ready.then((registration) => {
                if (registration.waiting) {
                    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
                }
            });
        }

        // Reload the page to get the new version
        window.location.reload();
    },
};
