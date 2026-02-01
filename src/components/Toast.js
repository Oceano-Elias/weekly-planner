import { DevLog } from '../utils/DevLog.js';
import { DOMUtils } from '../utils/DOMUtils.js';

/**
 * Toast - Centralized notification system
 */
DevLog.log('[Toast] Module loading...');
export const Toast = {
    container: null,
    toasts: [],
    maxToasts: 3,
    defaultDuration: 3500,

    init() {
        if (this.container) return;
        if (!document.body) {
            console.error('[Toast] document.body not found! Postponing init.');
            setTimeout(() => this.init(), 100);
            return;
        }
        this.container = DOMUtils.createElement('div', { className: 'toast-container' });
        document.body.appendChild(this.container);
    },

    /**
     * Show a success toast
     */
    success(message, title = 'Success') {
        this.add('success', message, title);
    },

    /**
     * Show an error toast
     */
    error(message, title = 'Error') {
        this.add('error', message, title);
    },

    /**
     * Show a warning toast
     */
    warning(message, title = 'Warning') {
        this.add('warning', message, title);
    },

    /**
     * Show an info toast
     */
    info(message, title = 'Info') {
        DevLog.log('[Toast] Info notification:', message);
        this.add('info', message, title);
    },

    /**
     * Core add method
     */
    add(type, message, title) {
        DevLog.log(`[Toast] Adding toast: ${type} - ${message}`);
        this.init();

        // Enforce max toasts
        if (this.toasts.length >= this.maxToasts) {
            this.dismiss(this.toasts[0].id);
        }

        const id = Date.now() + Math.random();
        const toastEl = this.createToastElement(id, type, message, title);

        const toastObj = {
            id,
            el: toastEl,
            timeout: null,
            duration: this.defaultDuration,
        };

        this.toasts.push(toastObj);
        this.container.appendChild(toastEl);

        // Auto-dismissal
        this.startTimer(toastObj);
    },

    createToastElement(id, type, message, title) {
        const icon = this.getIconForType(type);

        const toast = DOMUtils.createElement('div', {
            className: `toast toast-${type}`,
            onMouseEnter: () => this.pauseTimer(id),
            onMouseLeave: () => this.resumeTimer(id),
        });

        const iconEl = DOMUtils.createElement('div', { className: 'toast-icon' }, [icon]);

        const content = DOMUtils.createElement('div', { className: 'toast-content' }, [
            DOMUtils.createElement('div', { className: 'toast-title', textContent: title }),
            DOMUtils.createElement('div', { className: 'toast-message', textContent: message }),
        ]);

        const closeBtn = DOMUtils.createElement('button', {
            className: 'toast-close',
            innerHTML:
                '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>',
            onClick: () => this.dismiss(id),
        });

        // Progress bar for visual feedback of time remaining
        const progress = DOMUtils.createElement('div', {
            className: 'toast-progress',
            style: { animationDuration: `${this.defaultDuration}ms` },
        });

        toast.appendChild(iconEl);
        toast.appendChild(content);
        toast.appendChild(closeBtn);
        toast.appendChild(progress);

        return toast;
    },

    getIconForType(type) {
        const strokeWidth = 2.5;
        switch (type) {
            case 'success':
                return DOMUtils.createSVG(
                    'svg',
                    {
                        width: 18,
                        height: 18,
                        viewBox: '0 0 24 24',
                        fill: 'none',
                        stroke: 'currentColor',
                        'stroke-width': strokeWidth,
                    },
                    [DOMUtils.createSVG('path', { d: 'M20 6L9 17L4 12' })]
                );
            case 'error':
                return DOMUtils.createSVG(
                    'svg',
                    {
                        width: 18,
                        height: 18,
                        viewBox: '0 0 24 24',
                        fill: 'none',
                        stroke: 'currentColor',
                        'stroke-width': strokeWidth,
                    },
                    [
                        DOMUtils.createSVG('circle', { cx: 12, cy: 12, r: 10 }),
                        DOMUtils.createSVG('line', { x1: 15, y1: 9, x2: 9, y2: 15 }),
                        DOMUtils.createSVG('line', { x1: 9, y1: 9, x2: 15, y2: 15 }),
                    ]
                );
            case 'warning':
                return DOMUtils.createSVG(
                    'svg',
                    {
                        width: 18,
                        height: 18,
                        viewBox: '0 0 24 24',
                        fill: 'none',
                        stroke: 'currentColor',
                        'stroke-width': strokeWidth,
                    },
                    [
                        DOMUtils.createSVG('path', {
                            d: 'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z',
                        }),
                        DOMUtils.createSVG('line', { x1: 12, y1: 9, x2: 12, y2: 13 }),
                        DOMUtils.createSVG('line', { x1: 12, y1: 17, x2: 12.01, y2: 17 }),
                    ]
                );
            case 'info':
            default:
                return DOMUtils.createSVG(
                    'svg',
                    {
                        width: 18,
                        height: 18,
                        viewBox: '0 0 24 24',
                        fill: 'none',
                        stroke: 'currentColor',
                        'stroke-width': strokeWidth,
                    },
                    [
                        DOMUtils.createSVG('circle', { cx: 12, cy: 12, r: 10 }),
                        DOMUtils.createSVG('line', { x1: 12, y1: 16, x2: 12, y2: 12 }),
                        DOMUtils.createSVG('line', { x1: 12, y1: 8, x2: 12.01, y2: 8 }),
                    ]
                );
        }
    },

    startTimer(toast) {
        toast.timeout = setTimeout(() => this.dismiss(toast.id), toast.duration);
    },

    pauseTimer(id) {
        const toast = this.toasts.find((t) => t.id === id);
        if (toast) {
            clearTimeout(toast.timeout);
            // Pause the progress bar animation
            const progress = toast.el.querySelector('.toast-progress');
            if (progress) progress.style.animationPlayState = 'paused';
        }
    },

    resumeTimer(id) {
        const toast = this.toasts.find((t) => t.id === id);
        if (toast) {
            // Approximate remaining time would be better, but for simplicity we restart
            // In a production app you'd track elapsed time.
            // Here we just restart the dismiss timer for now as it's a "bonus" feature.
            this.startTimer(toast);
            const progress = toast.el.querySelector('.toast-progress');
            if (progress) progress.style.animationPlayState = 'running';
        }
    },

    dismiss(id) {
        const index = this.toasts.findIndex((t) => t.id === id);
        if (index === -1) return;

        const toast = this.toasts[index];
        toast.el.classList.add('hiding');

        // Remove from internal tracking immediately
        this.toasts.splice(index, 1);

        setTimeout(() => {
            if (toast.el.parentNode) {
                toast.el.parentNode.removeChild(toast.el);
            }
        }, 310); // Match CSS transition + buffer
    },
};
