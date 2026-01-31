import { Store } from '../store.js';
import { Calendar } from '../components/Calendar.js';
import FocusTrap from '../utils/FocusTrap.js';
import { ModalService } from './ModalService.js';

/**
 * KeyboardService - Handles global keyboard shortcuts
 */

export const KeyboardService = {
    init() {
        this.setupKeyboardShortcuts();
        this.setupShortcutsModal();
    },

    setupKeyboardShortcuts() {
        // Use document for compatibility
        document.addEventListener(
            'keydown',
            (e) => {
                try {
                    // Direct DOM checks are safer if modules have initialization races
                    const taskModal = document.getElementById('taskModal');
                    const shortcutsModal = document.getElementById('shortcutsModal');

                    const isTaskModalOpen = taskModal && taskModal.classList.contains('active');
                    const isShortcutsOpen =
                        shortcutsModal && shortcutsModal.classList.contains('active');

                    // Fallback to ModalService if possible, but DOM is source of truth
                    const isModalOpen = isTaskModalOpen || isShortcutsOpen;

                    const activeEl = document.activeElement;
                    const activeTag = activeEl ? activeEl.tagName.toUpperCase() : 'NONE';
                    const isInputFocused =
                        activeTag === 'INPUT' ||
                        activeTag === 'TEXTAREA' ||
                        activeTag === 'SELECT' ||
                        (activeEl && activeEl.isContentEditable);

                    // 1. Global Command Palette (Cmd+K / Ctrl+K) - ALWAYS ALLOW
                    if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        if (window.CommandPalette) {
                            window.CommandPalette.toggle();
                        }
                        return;
                    }

                    // 2. Toggles that work even if a modal is open (as long as not typing)
                    if (
                        !isInputFocused &&
                        e.key.toLowerCase() === 'f' &&
                        !e.metaKey &&
                        !e.ctrlKey &&
                        !e.altKey
                    ) {
                        e.preventDefault();
                        e.stopPropagation();
                        this.handleFocusModeShortcut();
                        return;
                    }

                    if (isModalOpen || isInputFocused) {
                        // Essential escape hatch for modals
                        if (e.key === 'Escape') {
                            if (isShortcutsOpen) {
                                e.preventDefault();
                                this.closeShortcutsModal();
                            }
                            // Task modal Escape is handled by ModalService
                        }

                        // Essential save hatch for modals
                        if (isTaskModalOpen && e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                            e.preventDefault();
                            document.dispatchEvent(new CustomEvent('modal:save'));
                        }
                        return;
                    }

                    // Single-key shortcuts
                    if (e.metaKey || e.ctrlKey || e.altKey) return;

                    const key = e.key.toLowerCase();

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
                            // Focus Mode shortcut - handled below
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
            },
            true
        ); // Use capture phase
    },

    updateViewButtons(mode) {
        document.querySelectorAll('.view-btn').forEach((b) => b.classList.remove('active'));
        document.querySelector(`.view-btn[data-view="${mode}"]`)?.classList.add('active');
    },

    handleFocusModeShortcut() {
        // 1. Hovered task (either in calendar or queue)
        let targetTaskEl = document.querySelector(
            '.calendar-task:hover .task-block, .task-block:hover'
        );

        // 2. Fallback: Currently active/paused task in Store
        if (!targetTaskEl) {
            const activeExec = Store.getActiveExecution();
            if (activeExec && activeExec.taskId) {
                targetTaskEl = document.querySelector(`[data-task-id="${activeExec.taskId}"]`);
            }
        }

        // 3. Fallback: Last clicked task
        if (!targetTaskEl && window.lastClickedTaskId) {
            targetTaskEl = document.querySelector(`[data-task-id="${window.lastClickedTaskId}"]`);
        }

        // 4. Fallback: Find literally any visible task block
        if (!targetTaskEl) {
            targetTaskEl = document.querySelector('.task-block');
        }

        if (targetTaskEl && targetTaskEl.dataset.taskId) {
            const taskId = targetTaskEl.dataset.taskId;

            if (window.FocusMode) {
                window.FocusMode.open(taskId);
            } else {
                console.error('[KeyboardService] window.FocusMode is not available');
            }
        } else {
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
