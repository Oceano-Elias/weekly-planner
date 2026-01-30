import { Store } from '../store.js';
import { Calendar } from '../components/Calendar.js';
import FocusTrap from '../utils/FocusTrap.js';
import { ModalService } from './ModalService.js';

/**
 * KeyboardService - Handles global keyboard shortcuts
 */
console.log('[KeyboardService] Module loading...');
export const KeyboardService = {
    init() {
        console.log('[KeyboardService] Initializing...');
        this.setupKeyboardShortcuts();
        this.setupShortcutsModal();
    },

    setupKeyboardShortcuts() {
        console.log("[KeyboardService] setupKeyboardShortcuts entered");

        // Use document for compatibility
        document.addEventListener('keydown', (e) => {
            try {
                // Direct DOM checks are safer if modules have initialization races
                const taskModal = document.getElementById('taskModal');
                const shortcutsModal = document.getElementById('shortcutsModal');

                const isTaskModalOpen = taskModal && taskModal.classList.contains('active');
                const isShortcutsOpen = shortcutsModal && shortcutsModal.classList.contains('active');

                // Fallback to ModalService if possible, but DOM is source of truth
                const isModalOpen = isTaskModalOpen || isShortcutsOpen;

                const activeEl = document.activeElement;
                const activeTag = activeEl ? activeEl.tagName.toUpperCase() : 'NONE';
                const isInputFocused = activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT' || (activeEl && activeEl.isContentEditable);

                // 1. Global Command Palette (Cmd+K / Ctrl+K) - ALWAYS ALLOW
                if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
                    console.log('[KeyboardService] Cmd+K detected (Global)');
                    e.preventDefault();
                    if (window.CommandPalette) {
                        window.CommandPalette.toggle();
                    }
                    return;
                }

                // LOG EVERY SINGLE KEYDOWN IN TAURI
                console.log(`[KeyboardService] KEYDOWN: "${e.key}" | Focus: ${activeTag} | Modal: ${isModalOpen} | Inputs: ${isInputFocused}`);

                // 2. Toggles that work even if a modal is open (as long as not typing)
                if (!isInputFocused && e.key.toLowerCase() === 'f' && !e.metaKey && !e.ctrlKey && !e.altKey) {
                    console.log('[KeyboardService] Allowing "f" shortcut to bypass modal check');
                    e.preventDefault();
                    e.stopPropagation();
                    this.handleFocusModeShortcut();
                    return;
                }

                if (isModalOpen || isInputFocused) {
                    // Essential escape hatch for modals
                    if (e.key === 'Escape') {
                        if (isShortcutsOpen) {
                            console.log('[KeyboardService] ESC: closing shortcuts modal');
                            e.preventDefault();
                            this.closeShortcutsModal();
                        } else if (isTaskModalOpen) {
                            console.log('[KeyboardService] ESC: task modal is open, letting ModalService handle it');
                        }
                    }

                    // Essential save hatch for modals
                    if (isTaskModalOpen && e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                        console.log('[KeyboardService] Saving task modal via Cmd+Enter');
                        e.preventDefault();
                        document.dispatchEvent(new CustomEvent('modal:save'));
                    }
                    return;
                }

                // Single-key shortcuts
                if (e.metaKey || e.ctrlKey || e.altKey) return;

                const key = e.key.toLowerCase();
                console.log(`[KeyboardService] Executing shortcut action for: ${key}`);

                switch (key) {
                    case 'n':
                        e.preventDefault();
                        document.getElementById('newTaskBtn')?.click();
                        break;
                    case 't':
                        e.preventDefault();
                        document.getElementById('todayBtn')?.click();
                        break;
                    case 'w':
                        e.preventDefault();
                        if (window.Calendar) window.Calendar.setViewMode('week');
                        break;
                    case 'd':
                        e.preventDefault();
                        if (window.Calendar) window.Calendar.setViewMode('day');
                        break;
                    case 'f':
                        // Focus Mode shortcut
                        if (window.FocusMode && window.FocusMode.isOpen) {
                            console.log('[KeyboardService] FocusMode is already open');
                            return;
                        }
                        e.preventDefault();
                        e.stopPropagation(); // Stop propagation to FocusMode.js
                        this.handleFocusModeShortcut();
                        break;
                    case 'arrowleft':
                        e.preventDefault();
                        document.getElementById('prevWeek')?.click();
                        break;
                    case 'arrowright':
                        e.preventDefault();
                        document.getElementById('nextWeek')?.click();
                        break;
                    case '?':
                        e.preventDefault();
                        this.toggleShortcutsModal();
                        break;
                }
            } catch (err) {
                console.error('[KeyboardService] CRITICAL LISTENER ERROR:', err);
            }
        }, true); // Use capture phase
    },

    updateViewButtons(mode) {
        document.querySelectorAll('.view-btn').forEach((b) => b.classList.remove('active'));
        document.querySelector(`.view-btn[data-view="${mode}"]`)?.classList.add('active');
    },

    handleFocusModeShortcut() {
        console.log('[KeyboardService] Attempting to find task for Focus Mode...');

        // 1. Hovered task (either in calendar or queue)
        let targetTaskEl = document.querySelector('.calendar-task:hover .task-block, .task-block:hover');

        // 2. Fallback: Currently active/paused task in Store
        if (!targetTaskEl) {
            const activeExec = Store.getActiveExecution();
            if (activeExec && activeExec.taskId) {
                targetTaskEl = document.querySelector(`[data-task-id="${activeExec.taskId}"]`);
                console.log('[KeyboardService] Fallback to active execution:', activeExec.taskId);
            }
        }

        // 3. Fallback: Last clicked task
        if (!targetTaskEl && window.lastClickedTaskId) {
            targetTaskEl = document.querySelector(`[data-task-id="${window.lastClickedTaskId}"]`);
            console.log('[KeyboardService] Fallback to last clicked task:', window.lastClickedTaskId);
        }

        // 4. Fallback: Find literally any visible task block
        if (!targetTaskEl) {
            targetTaskEl = document.querySelector('.task-block');
            if (targetTaskEl) console.log('[KeyboardService] Fallback to first available task block');
        }

        if (targetTaskEl && targetTaskEl.dataset.taskId) {
            const taskId = targetTaskEl.dataset.taskId;
            console.log('[KeyboardService] Success! Opening Focus Mode for:', taskId);
            if (window.FocusMode) {
                window.FocusMode.open(taskId);
            } else {
                console.error('[KeyboardService] window.FocusMode is not available');
            }
        } else {
            console.warn('[KeyboardService] No task found to focus.');
            if (window.Toast) {
                window.Toast.info('No task selected. Hover over a task or click one first.');
            }
        }
    },

    setupShortcutsModal() {
        const overlay = document.getElementById('shortcutsOverlay');
        const closeBtn = document.getElementById('closeShortcuts');
        const openBtn = document.getElementById('shortcutsBtn');

        if (openBtn) openBtn.addEventListener('click', () => this.toggleShortcutsModal());
        if (overlay) overlay.addEventListener('click', () => this.closeShortcutsModal());
        if (closeBtn) closeBtn.addEventListener('click', () => this.closeShortcutsModal());
    },

    toggleShortcutsModal() {
        const modal = document.getElementById('shortcutsModal');
        if (modal) {
            const isOpen = modal.classList.contains('active');
            modal.classList.toggle('active');
            if (!isOpen) FocusTrap.activate(modal);
            else FocusTrap.deactivate();
        }
    },

    closeShortcutsModal() {
        const modal = document.getElementById('shortcutsModal');
        if (modal) {
            modal.classList.remove('active');
            FocusTrap.deactivate();
        }
    },
};
