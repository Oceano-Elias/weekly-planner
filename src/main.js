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
import { CommandPalette } from './components/CommandPalette.js';
import { Toast } from './components/Toast.js';
import { PipComponent } from './components/PipComponent.js';
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
import './styles/command-palette.css';
import './styles/toast.css';
import './styles/rewards.css';
import './styles/pip.css';
import './styles/sidebar-queue.css';

// Export modules for use in other components without window pollution
export { App };

const App = {
    /**
     * Initialize the application with Error Boundary
     */
    init() {

        // Global error handling for deep debugging
        window.addEventListener('error', (event) => {
            console.error('[GLOBAL ERROR]:', event.error || event.message);
            if (window.Toast) window.Toast.error('A system error occurred: ' + (event.error?.message || event.message));
        });

        window.addEventListener('unhandledrejection', (event) => {
            console.error('[UNHANDLED REJECTION]:', event.reason);
            if (window.Toast) window.Toast.error('A background process failed.');
        });

        // Initialize PiP Mode if requested (Tauri-only)
        if (new URLSearchParams(window.location.search).get('mode') === 'pip') {
            PipComponent.init();
            return;
        }

        const safeInit = (name, fn) => {
            try {
                fn();
            } catch (err) {
                console.error(`[App] CRITICAL: ${name} failed to initialize:`, err);
                if (window.Toast && typeof window.Toast.error === 'function') {
                    window.Toast.error(`${name} initialization failed.`);
                }
            }
        };

        try {
            // Expose for debugging
            window.App = this;
            window.Store = Store;
            window.Calendar = Calendar;
            window.DragDropService = DragDropService;
            window.Filters = Filters;
            window.FocusMode = FocusMode;
            window.Confetti = Confetti;
            window.Toast = Toast;

            safeInit('Store', () => Store.init());
            safeInit('Callbacks', () => this.setupCallbacks());

            // Initialize Components
            safeInit('Calendar', () => Calendar.init());
            safeInit('TaskQueue', () => TaskQueue.init());
            safeInit('Filters', () => Filters.init());
            safeInit('Analytics', () => Analytics.init());

            // Initialize Services
            safeInit('DragDropService', () => DragDropService.init());
            safeInit('ModalService', () => ModalService.init());
            safeInit('FormHandler', () => FormHandler.init());
            safeInit('QuickPalette', () => QuickPalette.init());
            safeInit('CommandPalette', () => CommandPalette.init());
            safeInit('KeyboardService', () => KeyboardService.init());
            safeInit('Toast', () => Toast.init());

            safeInit('UI Setup', () => this.setupUI());
            safeInit('UpdateNotification', () => UpdateNotification.init());

            // Restore Focus Mode State
            if (FocusMode && typeof FocusMode.restoreTimerState === 'function') {
                safeInit('FocusMode Restore', () => {
                    FocusMode.restoreTimerState();
                    if (FocusMode.pomodoroRunning && !FocusMode.isOpen) {
                        FocusMode.showBadge();
                    }
                });
            }

        } catch (error) {
            console.error('[App] FATAL BOOT ERROR:', error);
            if (this.handleCriticalError) this.handleCriticalError(error);
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
                        Toast.success(`Template updated! ${count} tasks will appear in all future weeks.`);
                    }
                );
            });
        }

        const copyLastWeekBtn = document.getElementById('copyLastWeekBtn');
        if (copyLastWeekBtn) {
            copyLastWeekBtn.addEventListener('click', () => {
                const currentWeekId = Store.getWeekIdentifier(Calendar.currentWeekStart || new Date());
                ConfirmModal.show(
                    'Copy all tasks from the previous week into this week?',
                    () => {
                        const success = Store.copyFromPreviousWeek(currentWeekId);
                        if (success) {
                            Calendar.refresh();
                            TaskQueue.refresh();
                            Toast.success('Tasks copied from previous week!');
                        } else {
                            Toast.warning('No tasks found in previous week to copy.');
                        }
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
                        Toast.info('Week reset to template.');
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
                        Toast.success('Data imported successfully!');
                        Calendar.refresh();
                        TaskQueue.refresh();
                        Filters.refresh();
                    } else {
                        Toast.error('Failed to import data. Please check the file format.');
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
    }
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
                        setInterval(() => {
                            if (navigator.onLine) registration.update();
                        }, 60000);
                    })
            });
        }
    }
});
