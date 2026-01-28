/**
 * App - Main application initialization
 */

import iconUrl from '/icon.png';

import { Store } from './store.js';
import { Calendar } from './components/Calendar.js';
import { TaskQueue } from './components/TaskQueue.js';
import { Filters } from './components/Filters.js';
import { Analytics } from './components/Analytics.js';
import { FocusMode } from './components/FocusMode.js';
import { ConfirmModal } from './components/ConfirmModal.js';
import { UpdateNotification } from './components/UpdateNotification.js';
import { DepartmentSettings } from './components/DepartmentSettings.js';
import { Confetti } from './components/Confetti.js';
import { WeeklySummary } from './components/WeeklySummary.js';
import { QuickPalette } from './components/QuickPalette.js';
import { APP_VERSION } from './version.js';

// Services
import { ModalService } from './services/ModalService.js';
import { KeyboardService } from './services/KeyboardService.js';
import { FormHandler } from './services/FormHandler.js';
import { DragDropService } from './services/DragDropService.js';

// Import styles
import './styles/reset.css';
import './styles/variables.css';
import './styles/update-notification.css';
import './styles/layout.css';
import './styles/buttons.css';
import './styles/tasks.css';
import './styles/focus-mode.css';
import './styles/filters.css';
import './styles/analytics.css';
import './styles/utilities.css';
import './styles/modal.css';
import './styles/confirm-modal.css';
import './styles/settings.css';
import './styles/palette.css';

// Export modules for use in other components without window pollution
export { App };

const App = {
    /**
     * Initialize the application with Error Boundary
     */
    init() {


        // [NEW] Check for PiP mode immediately
        if (new URLSearchParams(window.location.search).get('mode') === 'pip') {
            this.initPipMode();
            return;
        }

        try {
            // Expose for debugging
            window.App = this;
            window.Store = Store;
            window.Calendar = Calendar;
            window.DragDropService = DragDropService;
            window.Filters = Filters;
            window.FocusMode = FocusMode;
            window.Confetti = Confetti;

            console.log('App initialized successfully');
            Store.init();

            // Wire up callbacks
            this.setupCallbacks();

            // Initialize Components
            Calendar.init();
            TaskQueue.init();
            Filters.init();
            Analytics.init();

            // Initialize Services
            DragDropService.init();
            ModalService.init();
            FormHandler.init();
            QuickPalette.init();
            KeyboardService.init();

            this.setupUI();

            // Initialize Update Notification
            UpdateNotification.init();

            // Restore Focus Mode State
            if (FocusMode && typeof FocusMode.restoreTimerState === 'function') {
                FocusMode.restoreTimerState();
                if (FocusMode.pomodoroRunning && !FocusMode.isOpen) {
                    FocusMode.showBadge();
                }
            }

            console.log('[App] Initialization complete');
        } catch (error) {
            console.error('[App] CRITICAL ERROR DURING INIT:', error);
            this.handleCriticalError(error);
        }
    },

    setupCallbacks() {
        // Use custom events for decoupling where possible, or direct callbacks
        Calendar.onEditTask = (id) =>
            window.dispatchEvent(new CustomEvent('edit-task', { detail: { taskId: id } }));

        Calendar.onOpenModalWithSchedule = (d, t, m) =>
            window.dispatchEvent(
                new CustomEvent('open-schedule-modal', {
                    detail: { day: d, time: t, maxDuration: m },
                })
            );

        Calendar.onPlayCompletionAnimation = (el) => this.playCompletionAnimation(el);

        TaskQueue.onEditTask = (id) =>
            window.dispatchEvent(new CustomEvent('edit-task', { detail: { taskId: id } }));

        Filters.onFilterChange = () => {
            Calendar.refresh();
            TaskQueue.refresh();
        };

        FocusMode.onCelebration = () => {
            const width = window.innerWidth;
            const height = window.innerHeight;
            Confetti.burst(width / 2, height / 2, 60);
        };
        FocusMode.onDailyCelebration = (day) => Calendar.checkDailyCelebration(day);
        FocusMode.onRefresh = () => Calendar.refresh();

        // Listen for drag-drop completion to refresh UI
        window.addEventListener('drag-drop:finish', () => {
            Calendar.refresh();
            TaskQueue.refresh();
            Analytics.render();
        });
    },

    setupUI() {
        this.setupSidebar();
        this.setupTemplateActions();
        this.setupPrintActions();
        this.setupSettings();
        this.setupDropdowns();
        this.updateBadgeCounts();
        this.setupFavicon();
        this.displayVersion();

        // Listen for badge updates from other services
        document.addEventListener('ui:update-badges', () => this.updateBadgeCounts());
    },

    /**
     * Fallback UI for critical failures
     */
    handleCriticalError(error) {
        document.body.innerHTML = `
            <div style="height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #0f172a; color: white; font-family: sans-serif; text-align: center; padding: 2rem;">
                <h1 style="color: #ef4444; font-size: 2rem; margin-bottom: 1rem;">System Error</h1>
                <p style="color: #94a3b8; max-width: 500px; line-height: 1.6;">The Weekly Planner failed to start. This might be due to corrupted data in your browser's storage.</p>
                <div style="margin: 2rem 0; padding: 1rem; background: #1e293b; border-radius: 8px; text-align: left; font-family: monospace; font-size: 0.8rem; width: 100%; max-width: 600px; overflow: auto; border: 1px solid #334155;">
                    ${error.stack || error.message}
                </div>
                <div style="display: flex; gap: 1rem;">
                    <button onclick="localStorage.clear(); location.reload();" style="background: #ef4444; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 6px; cursor: pointer; font-weight: 600;">Clear Data & Reset App</button>
                    <button onclick="location.reload();" style="background: #334155; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 6px; cursor: pointer; font-weight: 600;">Try Reloading</button>
                </div>
            </div>
        `;
    },

    displayVersion() {
        const badge = document.getElementById('versionBadge');
        if (badge) {
            badge.textContent = `v${APP_VERSION}`;
        }
        console.log(`[App] Weekly Planner v${APP_VERSION}`);
    },

    setupFavicon() {
        const link = document.querySelector("link[rel~='icon']");
        if (link) link.href = iconUrl;
        const appleLink = document.querySelector("link[rel='apple-touch-icon']");
        if (appleLink) appleLink.href = iconUrl;
    },

    setupSidebar() {
        const sidebar = document.getElementById('sidebar');
        const toggle = document.getElementById('sidebarToggle');

        const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
        if (isCollapsed) {
            sidebar.classList.add('collapsed');
        }

        toggle.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed'));
        });
    },

    setupTemplateActions() {
        const setTemplateBtn = document.getElementById('setTemplateBtn');
        const resetWeekBtn = document.getElementById('resetWeekBtn');

        if (setTemplateBtn) {
            setTemplateBtn.addEventListener('click', () => {
                ConfirmModal.show(
                    "Set the current week's schedule as the template for all future weeks?",
                    () => {
                        Store.setTemplateFromCurrentWeek();
                        const count = Store.getTemplateCount();
                        alert(`Template updated! ${count} tasks will appear in all future weeks.`);
                    }
                );
            });
        }

        if (resetWeekBtn) {
            resetWeekBtn.addEventListener('click', () => {
                ConfirmModal.show(
                    'Reset this week to the Default Template? Any changes will be lost.',
                    () => {
                        Store.resetWeekToTemplate();
                        Calendar.refresh();
                        TaskQueue.refresh();
                        alert('Week reset to template.');
                    }
                );
            });
        }
    },

    setupPrintActions() {
        const printBtn = document.getElementById('printPdfBtn');
        if (printBtn) {
            printBtn.addEventListener('click', () => {
                window.print();
            });
        }
    },

    setupSettings() {
        const settingsBtn = document.getElementById('settingsBtn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                DepartmentSettings.open();
            });
        }

        // Export/Import/Summary handlers
        const exportBtn = document.getElementById('exportDataBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => Store.downloadExport());
        }

        const importBtn = document.getElementById('importDataBtn');
        const importInput = document.getElementById('importFileInput');
        if (importBtn && importInput) {
            importBtn.addEventListener('click', () => importInput.click());

            importInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) return;

                const confirmed = await ConfirmModal.show(
                    'Import will replace ALL existing data. Are you sure you want to continue?'
                );

                if (confirmed) {
                    const success = await Store.importFromFile(file, false);
                    if (success) {
                        alert('Data imported successfully!');
                        Calendar.refresh();
                        TaskQueue.refresh();
                        Filters.refresh();
                    } else {
                        alert('Failed to import data. Please check the file format.');
                    }
                }
                importInput.value = '';
            });
        }

        const summaryBtn = document.getElementById('weeklySummaryBtn');
        if (summaryBtn) {
            summaryBtn.addEventListener('click', () => WeeklySummary.open());
        }
    },

    /**
     * Set up all dropdown menus in the header
     */
    setupDropdowns() {
        const dropdownConfigs = [
            { id: 'moreActionsDropdown', btnId: 'moreActionsBtn', menuId: 'moreActionsMenu' }
        ];

        dropdownConfigs.forEach(config => {
            const dropdown = document.getElementById(config.id);
            const toggleBtn = document.getElementById(config.btnId);
            const menu = document.getElementById(config.menuId);

            if (!dropdown || !toggleBtn || !menu) return;

            // Toggle menu on button click
            toggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();

                // Close other open dropdowns first
                dropdownConfigs.forEach(other => {
                    if (other.id !== config.id) {
                        const otherEl = document.getElementById(other.id);
                        const otherBtn = document.getElementById(other.btnId);
                        if (otherEl) otherEl.classList.remove('open');
                        if (otherBtn) otherBtn.setAttribute('aria-expanded', 'false');
                    }
                });

                const isOpen = dropdown.classList.contains('open');
                dropdown.classList.toggle('open');
                toggleBtn.setAttribute('aria-expanded', !isOpen);
            });

            // Close menu on item click
            menu.querySelectorAll('.dropdown-item').forEach((item) => {
                item.addEventListener('click', () => {
                    dropdown.classList.remove('open');
                    toggleBtn.setAttribute('aria-expanded', 'false');
                });
            });

            // Close when clicking outside
            document.addEventListener('click', (e) => {
                if (!dropdown.contains(e.target)) {
                    dropdown.classList.remove('open');
                    toggleBtn.setAttribute('aria-expanded', 'false');
                }
            });

            // Keyboard support (Escape to close)
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && dropdown.classList.contains('open')) {
                    dropdown.classList.remove('open');
                    toggleBtn.setAttribute('aria-expanded', 'false');
                    toggleBtn.focus();
                }
            });
        });
    }
    ,

    updateBadgeCounts() {
        const queueCount = Store.getQueueTasks().length;
        const queueTab = document.querySelector('.sidebar-tab[data-tab="queue"]');
        if (queueTab) {
            const existingBadge = queueTab.querySelector('.tab-badge');
            if (existingBadge) existingBadge.remove();

            if (queueCount > 0) {
                const badge = document.createElement('span');
                badge.className = 'tab-badge';
                badge.textContent = queueCount;
                queueTab.appendChild(badge);
            }
        }
    },

    playCompletionAnimation(taskEl) {
        taskEl.classList.add('completing');
        const overlay = document.createElement('div');
        overlay.className = 'completion-overlay';
        overlay.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                <path d="M5 13l4 4L19 7"/>
            </svg>
        `;
        taskEl.appendChild(overlay);

        setTimeout(() => {
            overlay.remove();
            taskEl.classList.remove('completing');
        }, 600);
    },
    /**
     * Initialize simplified PiP mode for Tauri
     */
    initPipMode() {
        console.log('[App] Initializing PiP Mode (Event-Driven)');

        // CRITICAL: Force transparency on EVERYTHING to prevent white corners
        document.documentElement.style.setProperty('background', 'transparent', 'important');
        document.body.style.setProperty('background', 'transparent', 'important');
        document.documentElement.style.overflow = 'hidden';
        document.body.style.overflow = 'hidden';
        document.body.innerHTML = ''; // Wipe everything


        // 1. Initial Render (Static Structure)
        const container = document.createElement('div');
        container.id = 'pip-container';
        container.style.width = '100vw';
        container.style.height = '100vh';
        container.style.display = 'flex';
        container.style.alignItems = 'center';
        container.style.justifyContent = 'center';
        container.style.background = 'transparent'; // Let ring handle background

        // Circular Design
        const radius = 54;
        const circumference = 2 * Math.PI * radius;

        container.innerHTML = `
           <div style="
                width: calc(100% - 16px); height: calc(100% - 16px);
                margin: 8px; /* Increased margin to prevent clipping artifacts */
                background: rgba(18, 20, 28, 0.96); /* Solid semi-transparent (No Blur = No Blink) */
                display: flex; flex-direction: column; align-items: center; justify-content: center;
                color: white; font-family: 'Outfit', system-ui, -apple-system, sans-serif;
                user-select: none;
                position: relative;
                overflow: hidden;
                border-radius: 24px;
                border: 1px solid rgba(255, 255, 255, 0.1);
                box-shadow: 
                    0 10px 25px rgba(0, 0, 0, 0.6), 
                    0 0 0 1px rgba(0,0,0,0.1);
                transition: transform 0.2s ease;
           " data-tauri-drag-region>
                
                <!-- Progress Ring Container -->
                <div style="position: relative; display: flex; align-items: center; justify-content: center; pointer-events: none; margin-top: -6px;">
                    <!-- Track Circle -->
                    <svg width="124" height="124" viewBox="0 0 120 120" style="transform: rotate(-90deg); filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));">
                        <circle cx="60" cy="60" r="54" stroke="rgba(255,255,255,0.08)" stroke-width="4" fill="none"></circle>
                        <!-- Progress Circle -->
                        <circle id="pip-ring" cx="60" cy="60" r="54" stroke="#6366f1" stroke-width="4" fill="none" stroke-linecap="round"
                            style="stroke-dasharray: ${circumference}; stroke-dashoffset: 0; transition: stroke-dashoffset 0.5s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.3s ease;">
                        </circle>
                    </svg>
                    
                    <!-- Time Display -->
                    <div id="pip-time" style="
                        position: absolute; 
                        font-size: 28px; 
                        font-weight: 600; 
                        letter-spacing: -0.5px; 
                        text-shadow: 0 2px 10px rgba(0,0,0,0.3);
                        font-variant-numeric: tabular-nums;
                    ">
                        00:00
                    </div>
                </div>

                <!-- Close Button (Top Right) -->
                <div id="pip-close-wrapper" style="
                    position: absolute; 
                    top: 8px; 
                    right: 8px; 
                    opacity: 0.2; /* Faintly visible by default */
                    transition: opacity 0.2s ease;
                    -webkit-app-region: no-drag;
                    z-index: 20;
                ">
                    <button id="pip-close-btn" style="
                        width: 20px; height: 20px; 
                        border: none; 
                        border-radius: 50%; 
                        background: rgba(255,255,255,0.1); 
                        color: rgba(255,255,255,0.8); 
                        display: flex; align-items: center; justify-content: center; 
                        cursor: pointer; 
                        backdrop-filter: blur(4px);
                        transition: all 0.2s ease;
                    ">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                    <style>
                        /* Show close button when hovering the container */
                        [data-tauri-drag-region]:hover #pip-close-wrapper { opacity: 1; }
                        #pip-close-btn:hover { background: rgba(239, 68, 68, 0.8) !important; color: white !important; }
                    </style>
                </div>

                <!-- Restore Button (Micro Interaction) -->
                <div id="pip-controls" style="
                    position: absolute; 
                    bottom: 8px; 
                    right: 8px; 
                    opacity: 0.2; /* Faintly visible by default */
                    transition: opacity 0.3s ease;
                    -webkit-app-region: no-drag;
                ">
                    <button id="pip-restore-btn" style="
                        width: 24px; height: 24px; 
                        border: none; 
                        border-radius: 50%; 
                        background: rgba(255,255,255,0.08); 
                        color: white; 
                        display: flex; align-items: center; justify-content: center; 
                        cursor: pointer; 
                        backdrop-filter: blur(4px);
                        transition: all 0.2s ease;
                    ">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="15 3 21 3 21 9"></polyline>
                            <polyline points="9 21 3 21 3 15"></polyline>
                            <line x1="21" y1="3" x2="14" y2="10"></line>
                            <line x1="3" y1="21" x2="10" y2="14"></line>
                        </svg>
                    </button>
                    <style>
                        [data-tauri-drag-region]:hover #pip-controls { opacity: 0.8; }
                        #pip-controls:hover { opacity: 1 !important; }
                        #pip-restore-btn:hover { background: rgba(99, 102, 241, 0.8) !important; box-shadow: 0 2px 8px rgba(99,102,241,0.4); }
                    </style>
                </div>
           </div>
        `;
        document.body.appendChild(container);

        // 2. Element References
        const timeEl = document.getElementById('pip-time');
        const ringEl = document.getElementById('pip-ring');
        const controlsEl = document.getElementById('pip-controls');

        // 3. Setup Listeners
        if (window.__TAURI__) {
            const { event, window: tauriWindow } = window.__TAURI__;

            // Explicit Drag Handler (Fix for undecorated windows)
            container.addEventListener('mousedown', (e) => {
                if (e.button !== 0) return;
                // Ignore if clicking a button
                if (e.target.closest('button') || e.target.closest('#pip-controls')) return;

                // Start dragging
                // Tauri v2 uses getCurrentWindow(), v1 uses getCurrent() or appWindow
                const tauriWin = window.__TAURI__.window;
                const getWin = tauriWin.getCurrentWindow || tauriWin.getCurrent || (() => tauriWin.appWindow);
                const current = getWin();

                if (current && current.startDragging) {
                    current.startDragging().catch(e => console.error('Drag failed:', e));
                } else {
                    console.warn('Could not find startDragging function', current);
                }
            });

            // Listen for State Updates from Main Window
            event.listen('pip-update', (e) => {
                const state = e.payload;
                if (!state) return;

                // Update Time
                const m = Math.floor(state.seconds / 60);
                const s = state.seconds % 60;
                timeEl.textContent = `${m}:${s.toString().padStart(2, '0')}`;

                // Update Ring
                const progress = state.seconds / state.total;
                const offset = circumference * (1 - progress);
                ringEl.style.strokeDashoffset = offset;

                // Update Color & Icon
                const isWork = state.mode === 'work';
                const color = isWork ? '#6366f1' : '#22c55e'; // Indigo vs Green
                ringEl.style.stroke = color;
            });

            // Helper to send to main window specifically
            const sendToMain = async (action) => {
                try {
                    const tauriWin = window.__TAURI__.window;
                    const getAllWins = tauriWin.getAllWindows || tauriWin.getAll;
                    const all = await getAllWins();
                    const mainWin = all.find((w) => w.label !== 'focus-pip');
                    const targetLabel = mainWin?.label || 'main';

                    await window.__TAURI__.event.emitTo(targetLabel, 'pip-action', { action });
                } catch (e) {
                    console.error('[PiP] Failed to send to main:', e);
                }
            };

            // Emit Commands to Main Window
            const restoreToMain = async () => {
                try {
                    const tauriWin = window.__TAURI__.window;
                    const getAllWins = tauriWin.getAllWindows || tauriWin.getAll;
                    const getWin =
                        tauriWin.getCurrentWindow || tauriWin.getCurrent || (() => tauriWin.appWindow);

                    const current = getWin();
                    const all = await getAllWins();

                    const mainWin = all.find((w) => w.label !== 'focus-pip');
                    if (mainWin) {
                        await mainWin.unminimize();
                        await mainWin.setFocus();
                    }
                    await current.close();
                } catch (e) {
                    console.error('Failed to restore main window:', e);
                }
            };

            document.getElementById('pip-restore-btn').addEventListener('pointerdown', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                await restoreToMain();
            });

            const closeBtn = document.getElementById('pip-close-btn');
            if (closeBtn) {
                closeBtn.addEventListener('pointerdown', async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    await restoreToMain();
                });
            }

            container.addEventListener('dblclick', async (e) => {
                if (e.target.closest('button') || e.target.closest('#pip-controls') || e.target.closest('#pip-close-wrapper')) return;
                await restoreToMain();
            });

            // Request initial state
            sendToMain('request-state');
        }
    },

};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();

    // Service Worker Registration
    if (import.meta.env.PROD && 'serviceWorker' in navigator) {
        const isLocalhost =
            window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const isHttps = window.location.protocol === 'https:';

        if (isHttps || isLocalhost) {
            window.addEventListener('load', () => {
                const basePath = window.location.pathname.replace(new RegExp('/[^/]*$'), '/');
                const swPath = basePath + 'sw.js';

                navigator.serviceWorker
                    .register(swPath)
                    .then((registration) => {
                        console.log('[App] Service Worker registered at:', swPath);
                        setInterval(() => {
                            if (navigator.onLine) registration.update();
                        }, 60000);
                    })
                    .catch((err) => console.log('[App] SW registration failed:', err));
            });
        }
    }
});
