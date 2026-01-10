/**
 * App - Main application initialization and task form handling
 */

import iconUrl from '../public/icon.png';

import { Store } from './store.js';
import { Departments } from './departments.js';
import { Calendar } from './components/Calendar.js';
import { TaskQueue } from './components/TaskQueue.js';
import { DragDrop } from './components/DragDrop.js';
import { Filters } from './components/Filters.js';
import { Analytics } from './components/Analytics.js';
import { FocusMode } from './components/FocusMode.js';
import { ConfirmModal } from './components/ConfirmModal.js';
import { PlannerService } from './services/PlannerService.js';
import { UpdateNotification } from './components/UpdateNotification.js';
import { DepartmentSettings } from './components/DepartmentSettings.js';
import { APP_VERSION } from './version.js';

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

// Make modules available globally for cross-module communication
window.Store = Store;
window.Calendar = Calendar;
window.TaskQueue = TaskQueue;
window.DragDrop = DragDrop;
window.Filters = Filters;
window.Analytics = Analytics;
window.Departments = Departments;
window.FocusMode = FocusMode;
window.DepartmentSettings = DepartmentSettings;

const App = {
    selectedDuration: 60,
    scheduledData: null,
    editingTaskId: null,
    pendingSteps: [],

    /**
     * Initialize the application
     */
    init() {
        Store.init();
        Calendar.init();
        TaskQueue.init();
        DragDrop.init();
        Filters.init();

        this.setupModal();
        this.setupForm();
        this.setupSidebar();
        this.setupTemplateActions();
        this.setupPrintActions();
        this.setupSettings();
        this.setupKeyboardShortcuts();
        this.updateBadgeCounts();
        this.setupFavicon();
        this.displayVersion();
    },

    /**
     * Display version number in header
     */
    displayVersion() {
        const badge = document.getElementById('versionBadge');
        if (badge) {
            badge.textContent = `v${APP_VERSION}`;
        }
        console.log(`[App] Weekly Planner v${APP_VERSION}`);
    },

    /**
     * Set the favicon dynamically (ensures inlining in production)
     */
    setupFavicon() {
        const link = document.querySelector("link[rel~='icon']");
        if (link) link.href = iconUrl;
        const appleLink = document.querySelector("link[rel='apple-touch-icon']");
        if (appleLink) appleLink.href = iconUrl;
    },

    /**
     * Setup sidebar toggle
     */
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

    /**
     * Setup modal open/close
     */
    setupModal() {
        const modal = document.getElementById('taskModal');
        const openBtn = document.getElementById('newTaskBtn');
        const closeBtn = document.getElementById('closeModal');
        const cancelBtn = document.getElementById('cancelTask');

        openBtn.addEventListener('click', () => this.openModal());
        closeBtn.addEventListener('click', () => this.closeModal());
        cancelBtn.addEventListener('click', () => this.closeModal());

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeModal();
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.classList.contains('active')) {
                this.closeModal();
            }
        });
    },

    /**
     * Open the task modal
     */
    openModal() {
        const modal = document.getElementById('taskModal');
        modal.classList.add('active');
        this.resetForm();
        document.getElementById('dept1').focus();
    },

    /**
     * Edit a task
     */
    editTask(taskId) {
        const task = Store.getTask(taskId);
        if (!task) return;

        this.openModal();
        this.editingTaskId = taskId;

        // Populate hierarchy
        this.populateDepartmentLevel(1, Departments.getTopLevel());
        task.hierarchy.forEach((dept, index) => {
            const level = index + 1;
            const select = document.getElementById(`dept${level}`);
            if (select) {
                select.value = dept;
                if (level < 4) {
                    const children = Departments.getChildren(task.hierarchy.slice(0, level));
                    this.populateDepartmentLevel(level + 1, children);
                }
            }
        });
        this.updateHierarchyPreview();

        // Set duration
        const durationStr = task.duration.toString();
        let found = false;
        document.querySelectorAll('.duration-option').forEach(btn => {
            if (btn.dataset.duration === durationStr) {
                this.onDurationSelect(btn);
                found = true;
            }
        });

        if (!found) {
            const customBtn = document.querySelector('.duration-option[data-duration="custom"]');
            this.onDurationSelect(customBtn);
            document.getElementById('customMinutes').value = task.duration;
        }

        document.querySelector('.modal-title').textContent = 'Edit Task';
        document.getElementById('saveTask').textContent = 'Update Task';
    },

    /**
     * Open modal with pre-filled schedule info (when clicking on calendar cell)
     */
    openModalWithSchedule(day, time, maxDuration) {
        const modal = document.getElementById('taskModal');
        modal.classList.add('active');
        this.resetForm();

        this.scheduledData = { day, time, maxDuration };

        document.getElementById('scheduleInfo').style.display = 'block';
        document.getElementById('scheduleDayDisplay').textContent = day;
        document.getElementById('scheduleTimeDisplay').textContent = time;
        document.getElementById('scheduleMaxInfo').textContent = `Max: ${PlannerService.formatDuration(maxDuration)}`;

        // Disable durations that exceed maxDuration
        document.querySelectorAll('.duration-option').forEach(btn => {
            const duration = btn.dataset.duration;
            if (duration === 'custom') return;

            const durValue = parseInt(duration);
            if (durValue > maxDuration) {
                btn.classList.add('disabled');
            }
        });

        // Default to safe duration
        if (maxDuration < 60) {
            const btn30 = document.querySelector('.duration-option[data-duration="30"]');
            if (btn30 && !btn30.classList.contains('disabled')) {
                this.onDurationSelect(btn30);
            }
        }

        document.getElementById('dept1').focus();
    },

    /**
     * Close the task modal
     */
    closeModal() {
        const modal = document.getElementById('taskModal');
        modal.classList.remove('active');
        this.resetForm();
    },

    /**
     * Setup form handling
     */
    setupForm() {
        this.populateDepartmentLevel(1, Departments.getTopLevel());

        for (let level = 1; level <= 4; level++) {
            const select = document.getElementById(`dept${level}`);
            select.addEventListener('change', () => this.onDepartmentChange(level));
        }

        document.querySelectorAll('.duration-option').forEach(btn => {
            btn.addEventListener('click', () => this.onDurationSelect(btn));
        });

        document.getElementById('saveTask').addEventListener('click', () => this.saveTask());

        // Setup steps input
        this.setupStepsInput();
    },

    /**
     * Setup steps input functionality
     */
    setupStepsInput() {
        const stepInput = document.getElementById('stepInput');
        const addBtn = document.getElementById('addStepBtn');

        if (!stepInput || !addBtn) return;

        const addStep = () => {
            const text = stepInput.value.trim();
            if (text) {
                this.pendingSteps.push(text);
                this.renderStepsList();
                stepInput.value = '';
                stepInput.focus();
            }
        };

        addBtn.addEventListener('click', addStep);
        stepInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                addStep();
            }
        });
    },

    /**
     * Render the steps list
     */
    renderStepsList() {
        const list = document.getElementById('stepsList');
        if (!list) return;

        list.innerHTML = this.pendingSteps.map((step, index) => `
            <li class="step-item">
                <span class="step-checkbox"></span>
                <span class="step-text">${PlannerService.escapeHtml(step)}</span>
                <button type="button" class="step-remove" data-index="${index}">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 6L6 18M6 6l12 12"/>
                    </svg>
                </button>
            </li>
        `).join('');

        // Add remove handlers
        list.querySelectorAll('.step-remove').forEach(btn => {
            btn.addEventListener('click', () => {
                const index = parseInt(btn.dataset.index);
                this.pendingSteps.splice(index, 1);
                this.renderStepsList();
            });
        });
    },

    /**
     * Populate a department level dropdown
     */
    populateDepartmentLevel(level, options) {
        const select = document.getElementById(`dept${level}`);
        const container = document.getElementById(`deptLevel${level}`);

        if (level > 1) {
            if (options.length > 0) {
                container.style.display = 'flex';
            } else {
                container.style.display = 'none';
                select.innerHTML = '<option value="">Select</option>';
                return;
            }
        }

        const placeholder = level === 1 ? 'Select Department' :
            level === 2 ? 'Select Sub-Department' :
                level === 3 ? 'Select Category' : 'Select Sub-Category';

        select.innerHTML = `<option value="">${placeholder}</option>` +
            options.map(opt => `<option value="${opt}">${opt}</option>`).join('');
    },

    /**
     * Handle department selection change
     */
    onDepartmentChange(level) {
        const hierarchy = [];
        for (let i = 1; i <= level; i++) {
            const value = document.getElementById(`dept${i}`).value;
            if (value) hierarchy.push(value);
        }

        for (let i = level + 1; i <= 4; i++) {
            document.getElementById(`deptLevel${i}`).style.display = 'none';
            document.getElementById(`dept${i}`).value = '';
        }

        if (level < 4) {
            const children = Departments.getChildren(hierarchy);
            this.populateDepartmentLevel(level + 1, children);
        }

        this.updateHierarchyPreview();
    },

    /**
     * Update hierarchy preview
     */
    updateHierarchyPreview() {
        const preview = document.getElementById('hierarchyPreview');
        const hierarchy = this.getSelectedHierarchy();

        if (hierarchy.length === 0) {
            preview.style.display = 'none';
            return;
        }

        preview.style.display = 'flex';
        const color = Departments.getColor(hierarchy);

        preview.innerHTML = hierarchy.map((item, index) => `
      <span class="hierarchy-path-item" ${index === 0 ? `style="color: ${color};"` : ''}>
        ${item}
      </span>
      ${index < hierarchy.length - 1 ? '<span class="hierarchy-path-separator">›</span>' : ''}
    `).join('');
    },

    /**
     * Get currently selected hierarchy
     */
    getSelectedHierarchy() {
        const hierarchy = [];
        for (let i = 1; i <= 4; i++) {
            const value = document.getElementById(`dept${i}`).value;
            if (value) hierarchy.push(value);
        }
        return hierarchy;
    },

    /**
     * Handle duration selection
     */
    onDurationSelect(btn) {
        document.querySelectorAll('.duration-option').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');

        const duration = btn.dataset.duration;
        const customContainer = document.getElementById('customDuration');

        if (duration === 'custom') {
            customContainer.style.display = 'flex';
            this.selectedDuration = null;
        } else {
            customContainer.style.display = 'none';
            this.selectedDuration = parseInt(duration);
        }
    },

    /**
     * Get selected duration
     */
    getSelectedDuration() {
        if (this.selectedDuration) {
            return this.selectedDuration;
        }

        const customInput = document.getElementById('customMinutes');
        const value = parseInt(customInput.value);
        return isNaN(value) ? 60 : Math.max(15, Math.min(480, value));
    },

    /**
     * Save the task
     */
    saveTask() {
        const hierarchy = this.getSelectedHierarchy();
        const duration = this.getSelectedDuration();

        if (hierarchy.length === 0) {
            alert('Please select at least one department level');
            document.getElementById('dept1').focus();
            return;
        }

        // Auto-generate title from deepest hierarchy level
        const title = hierarchy[hierarchy.length - 1];

        if (this.editingTaskId) {
            // Check for overlap if this is a scheduled task and duration changed
            const existingTask = Store.getTask(this.editingTaskId);
            if (existingTask && existingTask.scheduledDay && existingTask.scheduledTime && duration !== existingTask.duration) {
                // Get all tasks for the same day - use ISO week identifier format (e.g., "2026-W01")
                const weekId = Store.getWeekIdentifier(new Date());
                const allWeekTasks = Store.getTasksForWeek(weekId);
                const dayTasks = allWeekTasks.filter(t =>
                    t.scheduledDay === existingTask.scheduledDay &&
                    t.id !== this.editingTaskId
                );

                // Check if new duration would cause overlap
                if (!PlannerService.isSlotAvailable(existingTask.scheduledTime, duration, dayTasks, this.editingTaskId)) {
                    alert(`Cannot set duration to ${PlannerService.formatDuration(duration)} - it would overlap with another task. Please adjust your schedule first.`);
                    return;
                }
            }

            Store.updateTask(this.editingTaskId, { title, hierarchy, duration });
        } else {
            // Build notes from pending steps
            let notes = '';
            if (this.pendingSteps.length > 0) {
                notes = this.pendingSteps.map(step => `[ ] ${step}`).join('\n');
            }

            const task = Store.addTask({ title, hierarchy, duration, notes });

            if (this.scheduledData) {
                Store.scheduleTask(task.id, this.scheduledData.day, this.scheduledData.time);
                this.scheduledData = null;
            }
        }

        TaskQueue.refresh();
        Calendar.refresh();
        Filters.refresh();
        this.closeModal();
    },

    /**
     * Reset the form
     */
    resetForm() {
        document.getElementById('taskForm').reset();

        for (let i = 2; i <= 4; i++) {
            document.getElementById(`deptLevel${i}`).style.display = 'none';
        }

        document.querySelectorAll('.duration-option').forEach(btn => {
            btn.classList.toggle('selected', btn.dataset.duration === '60');
        });
        document.getElementById('customDuration').style.display = 'none';
        this.selectedDuration = 60;

        document.getElementById('hierarchyPreview').style.display = 'none';
        document.getElementById('scheduleInfo').style.display = 'none';
        this.scheduledData = null;
        document.querySelectorAll('.duration-option').forEach(btn => btn.classList.remove('disabled'));

        this.editingTaskId = null;
        document.querySelector('.modal-title').textContent = 'Create New Task';
        document.getElementById('saveTask').textContent = 'Create Task';

        // Clear pending steps
        this.pendingSteps = [];
        const stepsList = document.getElementById('stepsList');
        if (stepsList) stepsList.innerHTML = '';
    },

    /**
     * Setup template actions
     */
    setupTemplateActions() {
        const setTemplateBtn = document.getElementById('setTemplateBtn');
        const resetWeekBtn = document.getElementById('resetWeekBtn');

        if (setTemplateBtn) {
            setTemplateBtn.addEventListener('click', () => {
                ConfirmModal.show(
                    'Set the current week\'s schedule as the template for all future weeks?',
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

    /**
     * Setup print actions
     */
    setupPrintActions() {
        const printBtn = document.getElementById('printPdfBtn');
        if (printBtn) {
            printBtn.addEventListener('click', () => {
                window.print();
            });
        }
    },

    /**
     * Setup settings button
     */
    setupSettings() {
        const settingsBtn = document.getElementById('settingsBtn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                DepartmentSettings.open();
            });
        }
    },

    /**
     * Setup keyboard shortcuts
     */
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            const modal = document.getElementById('taskModal');
            const isModalOpen = modal.classList.contains('active');
            const isInputFocused = document.activeElement.tagName === 'INPUT' ||
                document.activeElement.tagName === 'TEXTAREA' ||
                document.activeElement.tagName === 'SELECT';

            // Modal shortcuts
            if (isModalOpen) {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    this.saveTask();
                }
                return;
            }

            // Don't trigger shortcuts when typing in inputs
            if (isInputFocused) return;

            switch (e.key.toLowerCase()) {
                case 'n':
                    e.preventDefault();
                    this.openModal();
                    break;
                case 't':
                    e.preventDefault();
                    Calendar.setCurrentWeek(new Date());
                    Calendar.renderHeader();
                    Calendar.renderGrid();
                    TaskQueue.refresh();
                    break;
                case 'arrowleft':
                    e.preventDefault();
                    Calendar.currentWeekStart.setDate(Calendar.currentWeekStart.getDate() - 7);
                    Store.setCurrentWeek(Calendar.currentWeekStart);
                    Calendar.renderHeader();
                    Calendar.renderGrid();
                    TaskQueue.refresh();
                    break;
                case 'arrowright':
                    e.preventDefault();
                    Calendar.currentWeekStart.setDate(Calendar.currentWeekStart.getDate() + 7);
                    Store.setCurrentWeek(Calendar.currentWeekStart);
                    Calendar.renderHeader();
                    Calendar.renderGrid();
                    TaskQueue.refresh();
                    break;
                case 'w':
                    e.preventDefault();
                    Calendar.setViewMode('week');
                    document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
                    document.querySelector('.view-btn[data-view="week"]')?.classList.add('active');
                    break;
                case 'd':
                    e.preventDefault();
                    Calendar.setViewMode('day');
                    document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
                    document.querySelector('.view-btn[data-view="day"]')?.classList.add('active');
                    break;
                case ' ':
                    if (e.shiftKey) {
                        // Focus Mode shortcut (Shift + Space)
                        const hoveredTask = document.querySelector('.calendar-task:hover .task-block');
                        if (hoveredTask) {
                            e.preventDefault();
                            const taskId = hoveredTask.dataset.taskId;
                            if (window.FocusMode) window.FocusMode.open(taskId);
                        }
                    }
                    break;
                case 'f':
                    // Focus Mode shortcut (F)
                    // If FocusMode is already open, let it handle the close
                    if (window.FocusMode && window.FocusMode.isOpen) {
                        return; // Don't prevent default, let FocusMode handle it
                    }

                    e.preventDefault();

                    // Try to find hovered task first
                    let hoveredTaskF = document.querySelector('.calendar-task:hover .task-block');

                    // Fallback: find the most recently clicked task (if any)
                    if (!hoveredTaskF && window.lastClickedTaskId) {
                        hoveredTaskF = document.querySelector(`.task-block[data-task-id="${window.lastClickedTaskId}"]`);
                    }

                    // Fallback: find any visible scheduled task in current view
                    if (!hoveredTaskF) {
                        hoveredTaskF = document.querySelector('.calendar-task .task-block');
                    }

                    if (hoveredTaskF) {
                        const taskId = hoveredTaskF.dataset.taskId;
                        if (window.FocusMode) {
                            console.log('Opening focus mode for task:', taskId);
                            window.FocusMode.open(taskId);
                        }
                    } else {
                        console.log('No task found to focus on. Try hovering over a task first.');
                    }
                    break;
            }
        });
    },

    /**
     * Update badge counts on sidebar tabs
     */
    updateBadgeCounts() {
        const queueCount = Store.getQueueTasks().length;
        const scheduledCount = Store.getScheduledTasks().length;

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

    /**
     * Play completion animation on a task
     */
    playCompletionAnimation(taskEl) {
        taskEl.classList.add('completing');

        // Create checkmark overlay
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

// Make App global
window.App = App;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();

    // Initialize Update Notification component
    UpdateNotification.init();

    // Register Service Worker (works on HTTPS and localhost)
    if ('serviceWorker' in navigator) {
        const isLocalhost = window.location.hostname === 'localhost' ||
            window.location.hostname === '127.0.0.1';
        const isHttps = window.location.protocol === 'https:';

        if (isHttps || isLocalhost) {
            window.addEventListener('load', () => {
                // Detect base path from current URL (works on GitHub Pages and localhost)
                const basePath = window.location.pathname.replace(/\/[^\/]*$/, '/');
                const swPath = basePath + 'sw.js';

                navigator.serviceWorker.register(swPath)
                    .then(registration => {
                        console.log('[App] Service Worker registered at:', swPath);

                        // Check for updates every 60 seconds when online
                        setInterval(() => {
                            if (navigator.onLine) {
                                registration.update();
                            }
                        }, 60000);
                    })
                    .catch(err => console.log('[App] SW registration failed:', err));
            });
        }
    }
});
