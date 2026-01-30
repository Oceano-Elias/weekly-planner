/**
 * PipComponent - Handles simplified PiP mode for Tauri
 */
export const PipComponent = {
    /**
     * Initialize the PiP UI and event listeners
     */
    init() {

        // 1. Force transparency on background
        document.documentElement.style.setProperty('background', 'transparent', 'important');
        document.body.style.setProperty('background', 'transparent', 'important');
        document.documentElement.style.overflow = 'hidden';
        document.body.style.overflow = 'hidden';
        document.body.innerHTML = '';

        // 2. Initial Render
        const radius = 54;
        const circumference = 2 * Math.PI * radius;

        const container = document.createElement('div');
        container.id = 'pip-container';
        container.innerHTML = `
           <div class="pip-window" data-tauri-drag-region>
                <!-- Progress Ring Container -->
            <!-- Progress Ring Container (Click to Toggle) -->
                <div class="pip-progress-container" id="pip-click-area">
                    <svg width="124" height="124" viewBox="0 0 120 120" class="pip-ring-svg">
                        <circle cx="60" cy="60" r="54" stroke="rgba(255,255,255,0.08)" stroke-width="4" fill="none"></circle>
                        <circle id="pip-ring" cx="60" cy="60" r="54" stroke="#6366f1" stroke-width="4" fill="none"
                            style="stroke-dasharray: ${circumference}; stroke-dashoffset: 0;">
                        </circle>
                    </svg>
                    
                    <div id="pip-time">00:00</div>
                </div>

                <!-- Close Button -->
                <div id="pip-close-wrapper">
                    <button id="pip-close-btn" title="Close">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>

                <!-- Restore Button -->
                <div id="pip-controls">
                    <button id="pip-restore-btn" title="Restore to Window">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="15 3 21 3 21 9"></polyline>
                            <polyline points="9 21 3 21 3 15"></polyline>
                            <line x1="21" y1="3" x2="14" y2="10"></line>
                            <line x1="3" y1="21" x2="10" y2="14"></line>
                        </svg>
                    </button>
                </div>
           </div>
        `;
        document.body.appendChild(container);

        // 3. Setup Listeners
        this.setupTauriListeners(circumference);
        this.setupUIListeners(container);

        // 4. Request Initial State
        this.sendToMain('request-state');
        setTimeout(() => this.sendToMain('request-state'), 500);
    },

    setupTauriListeners(circumference) {
        const tauriEvent = window.__TAURI__?.event;
        if (!tauriEvent) return;

        tauriEvent.listen('pip-update', (e) => {
            const state = e.payload;
            if (!state) return;

            // Update Time
            const timeEl = document.getElementById('pip-time');
            if (timeEl) {
                const m = Math.floor(state.seconds / 60);
                const s = state.seconds % 60;
                timeEl.textContent = `${m}:${s.toString().padStart(2, '0')}`;
            }

            // Update Ring
            const ringEl = document.getElementById('pip-ring');
            if (ringEl) {
                const progress = state.seconds / (state.total || 1);
                const offset = circumference * (1 - progress);
                ringEl.style.strokeDashoffset = offset;

                const isWork = state.mode === 'work';
                const color = isWork ? '#6366f1' : '#22c55e';
                ringEl.style.stroke = color;
            }
        });
    },

    setupUIListeners(container) {
        // Drag Handling
        container.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            if (e.target.closest('button')) return;
            if (e.target.closest('#pip-click-area')) return; // Allow click to pass through to toggle logic

            const tauriWin = window.__TAURI__?.window || window.__TAURI__?.webviewWindow;
            const current = tauriWin?.getCurrentWebviewWindow?.() ||
                tauriWin?.getCurrentWindow?.() ||
                tauriWin?.getCurrent?.() ||
                tauriWin?.appWindow;

            if (current && current.startDragging) {
                current.startDragging().catch(e => console.error('Drag failed:', e));
            }
        });

        const addControlListener = (id, callback) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                callback(e);
            });
        };

        // NEW: Click anywhere on ring/timer to toggle
        const clickArea = document.getElementById('pip-click-area');
        if (clickArea) {
            clickArea.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.sendToMain('toggle');
            });
        }

        addControlListener('pip-restore-btn', () => this.restoreToMain());
        addControlListener('pip-close-btn', () => this.restoreToMain());

        container.addEventListener('dblclick', (e) => {
            if (e.target.closest('button')) return;
            this.restoreToMain();
        });
    },

    async sendToMain(action) {
        const tauri = window.__TAURI__;
        if (!tauri) return;

        try {
            const webviewWin = tauri.webviewWindow || tauri.window;
            const getAllWins = webviewWin.getAllWebviewWindows || webviewWin.getAll || webviewWin.getAllWindows;
            const all = typeof getAllWins === 'function' ? await getAllWins() : [];
            const mainWin = all.find((w) => w.label !== 'focus-pip');
            const targetLabel = mainWin?.label || 'main';

            await tauri.event.emitTo(targetLabel, 'pip-action', { action });
        } catch (e) {
            console.error('[PiP] Failed to send to main:', e);
        }
    },

    async restoreToMain() {
        const tauri = window.__TAURI__;
        if (!tauri) {
            window.close();
            return;
        }

        try {
            const tauriWin = tauri.window || tauri.webviewWindow;
            const current = tauriWin?.getCurrentWebviewWindow?.() ||
                tauriWin?.getCurrentWindow?.() ||
                tauriWin?.getCurrent?.() ||
                tauriWin?.appWindow;

            // Attempt to focus main window
            const getAllWins = tauriWin.getAllWebviewWindows || tauriWin.getAll || tauriWin.getAllWindows;
            const all = typeof getAllWins === 'function' ? await getAllWins() : [];
            const mainWin = all.find((w) => w.label !== 'focus-pip');

            if (mainWin) {
                if (mainWin.unminimize) await mainWin.unminimize();
                if (mainWin.setFocus) await mainWin.setFocus();
            }

            if (current && current.close) {
                await current.close();
            } else {
                window.close();
            }
        } catch (e) {
            console.error('Failed to restore main window:', e);
            window.close();
        }
    }
};
