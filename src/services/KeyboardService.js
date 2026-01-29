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
        document.addEventListener('keydown', (e) => {
            const shortcutsModal = document.getElementById('shortcutsModal');
            const isModalOpen = ModalService.isOpen();
            const isShortcutsOpen = shortcutsModal && shortcutsModal.classList.contains('active');
            const isInputFocused =
                document.activeElement.tagName === 'INPUT' ||
                document.activeElement.tagName === 'TEXTAREA' ||
                document.activeElement.tagName === 'SELECT';

            // Close shortcuts modal with Escape
            if (isShortcutsOpen && e.key === 'Escape') {
                e.preventDefault();
                this.closeShortcutsModal();
                return;
            }

            // Modal shortcuts (Ctrl/Cmd + Enter to save)
            if (isModalOpen) {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    document.dispatchEvent(new CustomEvent('modal:save'));
                }
                return;
            }

            // Don't trigger shortcuts when typing in inputs or shortcuts modal is open
            if (isInputFocused || isShortcutsOpen) return;

            // Command Palette (Cmd/Ctrl + K)
            if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                if (window.CommandPalette) window.CommandPalette.toggle();
                return;
            }

            switch (e.key.toLowerCase()) {
                case 'n':
                    e.preventDefault();
                    // Dispatch event to open modal
                    document.getElementById('newTaskBtn')?.click();
                    break;
                case 't':
                    e.preventDefault();
                    Calendar.setCurrentWeek(new Date());
                    break;
                case 'arrowleft':
                    e.preventDefault();
                    Calendar.currentWeekStart.setDate(Calendar.currentWeekStart.getDate() - 7);
                    Store.setCurrentWeek(Calendar.currentWeekStart);
                    break;
                case 'arrowright':
                    e.preventDefault();
                    Calendar.currentWeekStart.setDate(Calendar.currentWeekStart.getDate() + 7);
                    Store.setCurrentWeek(Calendar.currentWeekStart);
                    break;
                case 'w':
                    e.preventDefault();
                    Calendar.setViewMode('week');
                    this.updateViewButtons('week');
                    break;
                case 'd':
                    e.preventDefault();
                    Calendar.setViewMode('day');
                    this.updateViewButtons('day');
                    break;
                case ' ':
                    if (e.shiftKey) {
                        // Focus Mode shortcut (Shift + Space)
                        const hoveredTask = document.querySelector(
                            '.calendar-task:hover .task-block'
                        );
                        if (hoveredTask) {
                            e.preventDefault();
                            const taskId = hoveredTask.dataset.taskId;
                            if (window.FocusMode) window.FocusMode.open(taskId);
                        }
                    }
                    break;
                case 'f': {
                    // Focus Mode shortcut (F)
                    if (window.FocusMode && window.FocusMode.isOpen) {
                        // If already open, let the FocusMode internal handler take care of it (likely closing)
                        return;
                    }

                    e.preventDefault();
                    this.handleFocusModeShortcut();
                    break;
                }
                case '?':
                    e.preventDefault();
                    this.toggleShortcutsModal();
                    break;
            }
        });
    },

    updateViewButtons(mode) {
        document.querySelectorAll('.view-btn').forEach((b) => b.classList.remove('active'));
        document.querySelector(`.view-btn[data-view="${mode}"]`)?.classList.add('active');
    },

    handleFocusModeShortcut() {
        // Try to find hovered task first
        let hoveredTask = document.querySelector('.calendar-task:hover .task-block');

        // Fallback: find the most recently clicked task
        if (!hoveredTask && window.lastClickedTaskId) {
            hoveredTask = document.querySelector(
                `.task-block[data-task-id="${window.lastClickedTaskId}"]`
            );
        }

        // Fallback: find any visible scheduled task
        if (!hoveredTask) {
            hoveredTask = document.querySelector('.calendar-task .task-block');
        }

        if (hoveredTask) {
            const taskId = hoveredTask.dataset.taskId;
            if (window.FocusMode) window.FocusMode.open(taskId);
        } else {
            console.log('No task found to focus on.');
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
