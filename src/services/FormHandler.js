import { Store } from '../store.js';
import { Departments } from '../departments.js';
import { PlannerService } from './PlannerService.js';
import { ConfirmModal } from '../components/ConfirmModal.js';
import { ModalService } from './ModalService.js';
import { Toast } from '../components/Toast.js';

/**
 * FormHandler - Manages task creation and editing logic
 */
export const FormHandler = {
    selectedDuration: 60,
    scheduledData: null,
    editingTaskId: null,
    pendingSteps: [],

    init() {
        this.setupForm();
        this.setupListeners();
    },

    setupListeners() {
        // Listen for modal events
        document.addEventListener('modal:open', () => this.resetForm());
        document.addEventListener('modal:close', () => this.resetForm());
        document.addEventListener('modal:save', () => this.saveTask());

        // External triggers
        window.addEventListener('edit-task', (e) => this.editTask(e.detail.taskId));
        window.addEventListener('open-schedule-modal', (e) =>
            this.openModalWithSchedule(e.detail.day, e.detail.time, e.detail.maxDuration)
        );
    },

    setupForm() {
        this.populateDepartmentLevel(1, Departments.getTopLevel());

        for (let level = 1; level <= 4; level++) {
            const select = document.getElementById(`dept${level}`);
            if (select) {
                select.addEventListener('change', () => this.onDepartmentChange(level));
            }
        }

        document.querySelectorAll('.duration-option').forEach((btn) => {
            btn.addEventListener('click', () => this.onDurationSelect(btn));
        });

        const saveBtn = document.getElementById('saveTask');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                const taskId = this.saveTask();
                if (taskId) window.lastClickedTaskId = taskId;
            });
        }

        const startFocusBtn = document.getElementById('startFocusBtn');
        if (startFocusBtn) {
            startFocusBtn.addEventListener('click', () => {
                const taskId = this.saveTask();
                if (taskId && window.FocusMode) {
                    // Small delay to allow modal close animation to start/finish cleanly
                    setTimeout(() => window.FocusMode.open(taskId), 100);
                }
            });
        }

        this.setupStepsInput();

        // Custom duration validation
        const customInput = document.getElementById('customMinutes');
        if (customInput) {
            customInput.addEventListener('input', () => {
                const val = parseInt(customInput.value || '0');
                const clamped = Math.max(15, Math.min(480, isNaN(val) ? 60 : val));
                if (val !== clamped) customInput.value = clamped;
                this.updateScheduleValidation();
            });
        }
    },

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

    renderStepsList() {
        const list = document.getElementById('stepsList');
        if (!list) return;

        list.innerHTML = this.pendingSteps
            .map((step, index) => {
                const isCompleted = step.startsWith('[x] ');
                const cleanText = step.replace(/^\[[ x]\]\s*/, '');
                return `
            <li class="step-item ${isCompleted ? 'completed' : ''}">
                <span class="step-checkbox ${isCompleted ? 'checked' : ''}">
                    ${isCompleted ? '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 13l4 4L19 7"/></svg>' : ''}
                </span>
                <span class="step-text">${PlannerService.escapeHtml(cleanText)}</span>
                <button type="button" class="step-remove" data-index="${index}">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 6L6 18M6 6l12 12"/>
                    </svg>
                </button>
            </li>`;
            })
            .join('');

        list.querySelectorAll('.step-remove').forEach((btn) => {
            btn.addEventListener('click', () => {
                this.pendingSteps.splice(parseInt(btn.dataset.index), 1);
                this.renderStepsList();
            });
        });
    },

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

        const placeholders = [
            'Select Department',
            'Select Sub-Department',
            'Select Category',
            'Select Sub-Category',
        ];

        select.innerHTML =
            `<option value="">${placeholders[level - 1]}</option>` +
            options.map((opt) => `<option value="${opt}">${opt}</option>`).join('');
    },

    onDepartmentChange(level) {
        const hierarchy = [];
        for (let i = 1; i <= level; i++) {
            const val = document.getElementById(`dept${i}`).value;
            if (val) hierarchy.push(val);
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
        const titleInput = document.getElementById('taskTitle');
        if (titleInput) {
            titleInput.value = hierarchy.length > 0 ? hierarchy[hierarchy.length - 1] : '';
        }
        this.updateTitleColor();
    },

    updateHierarchyPreview() {
        const preview = document.getElementById('hierarchyPreview');
        if (!preview) return;
        const hierarchy = this.getSelectedHierarchy();

        if (hierarchy.length === 0) {
            preview.style.display = 'none';
            return;
        }

        preview.style.display = 'flex';
        const color = Departments.getColor(hierarchy);
        preview.innerHTML = hierarchy
            .map(
                (item, index) => `
            <span class="hierarchy-path-item" ${index === 0 ? `style="color: ${color};"` : ''}>
                ${item}
            </span>
            ${index < hierarchy.length - 1 ? '<span class="hierarchy-path-separator">›</span>' : ''}`
            )
            .join('');
    },

    updateTitleColor() {
        const titleInput = document.getElementById('taskTitle');
        if (!titleInput) return;
        const hierarchy = this.getSelectedHierarchy();
        titleInput.style.color = hierarchy.length > 0 ? Departments.getColor(hierarchy) : '';
    },

    getSelectedHierarchy() {
        const hierarchy = [];
        for (let i = 1; i <= 4; i++) {
            const val = document.getElementById(`dept${i}`).value;
            if (val) hierarchy.push(val);
        }
        return hierarchy;
    },

    onDurationSelect(btn) {
        if (btn.classList.contains('disabled')) return;
        document
            .querySelectorAll('.duration-option')
            .forEach((b) => b.classList.remove('selected'));
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
        this.updateScheduleValidation();
    },

    getSelectedDuration() {
        if (this.selectedDuration) return this.selectedDuration;
        const customInput = document.getElementById('customMinutes');
        const value = parseInt(customInput.value);
        return isNaN(value) ? 60 : Math.max(15, Math.min(480, value));
    },

    updateScheduleValidation() {
        const saveBtn = document.getElementById('saveTask');
        const infoEl = document.getElementById('scheduleMaxInfo');
        const scheduleInfo = document.getElementById('scheduleInfo');
        if (!saveBtn) return;

        let day,
            time,
            maxDuration,
            isEdit = false;

        if (this.scheduledData) {
            ({ day, time, maxDuration } = this.scheduledData);
        } else if (this.editingTaskId) {
            const task = Store.getTask(this.editingTaskId);
            if (task && task.scheduledDay) {
                day = task.scheduledDay;
                time = task.scheduledTime;
                isEdit = true;
            }
        }

        if (!day) {
            saveBtn.disabled = false;
            saveBtn.classList.remove('btn-disabled');
            if (infoEl) infoEl.textContent = '';
            return;
        }

        const duration = this.getSelectedDuration();
        const weekId = Store.getWeekIdentifier(new Date());
        const allTasks = Store.getTasksForWeek(weekId);
        const dayTasks = allTasks.filter(
            (t) => t.scheduledDay === day && t.id !== this.editingTaskId
        );

        const available = PlannerService.isSlotAvailable(time, duration, dayTasks);

        if (isEdit && scheduleInfo) {
            scheduleInfo.style.display = 'block';
            document.getElementById('scheduleDayDisplay').textContent = day;
            document.getElementById('scheduleTimeDisplay').textContent = time;
        }

        if (!available) {
            saveBtn.disabled = true;
            saveBtn.classList.add('btn-disabled');
            if (infoEl) {
                infoEl.textContent = '⚠️ Overlaps with another task';
                infoEl.style.color = 'var(--danger)';
            }
        } else {
            saveBtn.disabled = false;
            saveBtn.classList.remove('btn-disabled');
            if (infoEl) {
                infoEl.textContent = maxDuration
                    ? `Max: ${PlannerService.formatDuration(maxDuration)}`
                    : 'Schedule valid';
                infoEl.style.color = 'var(--text-secondary)';
            }
        }
    },

    resetForm() {
        document.getElementById('taskForm').reset();
        for (let i = 2; i <= 4; i++) {
            document.getElementById(`deptLevel${i}`).style.display = 'none';
        }

        document.querySelectorAll('.duration-option').forEach((btn) => {
            btn.classList.toggle('selected', btn.dataset.duration === '60');
            btn.classList.remove('disabled');
        });
        document.getElementById('customDuration').style.display = 'none';
        this.selectedDuration = 60;

        const hierarchyPreview = document.getElementById('hierarchyPreview');
        if (hierarchyPreview) hierarchyPreview.style.display = 'none';
        document.getElementById('scheduleInfo').style.display = 'none';
        this.scheduledData = null;

        const saveBtn = document.getElementById('saveTask');
        if (saveBtn) saveBtn.disabled = false;

        const infoEl = document.getElementById('scheduleMaxInfo');
        if (infoEl) infoEl.textContent = '';

        this.editingTaskId = null;
        document.querySelector('.modal-title').textContent = 'Create New Task';
        document.getElementById('saveTask').textContent = 'Create Task';

        const startFocusBtn = document.getElementById('startFocusBtn');
        if (startFocusBtn) startFocusBtn.style.display = 'flex';

        this.pendingSteps = [];
        const stepsList = document.getElementById('stepsList');
        if (stepsList) stepsList.innerHTML = '';
        this.updateTitleColor();
    },

    saveTask() {
        // Capture editing ID before ModalService.close() resets it
        const currentEditingId = this.editingTaskId;

        // Capture unfinished step input
        const stepInput = document.getElementById('stepInput');
        if (stepInput && stepInput.value.trim()) {
            this.pendingSteps.push(stepInput.value.trim());
            stepInput.value = '';
        }

        const hierarchy = this.getSelectedHierarchy();
        const duration = this.getSelectedDuration();

        if (hierarchy.length === 0) {
            const dept1 = document.getElementById('dept1');
            dept1.style.borderColor = 'var(--accent-error)';
            dept1.classList.add('shake-animation');
            setTimeout(() => {
                dept1.classList.remove('shake-animation');
                dept1.style.borderColor = '';
            }, 500);

            dept1.focus();
            return;
        }

        const titleInput = document.getElementById('taskTitle');
        const title = titleInput.value.trim() || hierarchy[hierarchy.length - 1];

        let notes = '';
        if (this.pendingSteps.length > 0) {
            notes = this.pendingSteps
                .map((step) =>
                    step.startsWith('[ ] ') || step.startsWith('[x] ') ? step : `[ ] ${step}`
                )
                .join('\n');
        }

        let resultId;
        if (currentEditingId) {
            this.handleUpdateTask(currentEditingId, title, hierarchy, duration, notes);
            resultId = currentEditingId;
        } else {
            resultId = this.handleCreateTask(title, hierarchy, duration, notes);
        }

        ModalService.close();
        this.refreshUI();
        return resultId;
    },

    handleUpdateTask(taskId, title, hierarchy, duration, notes) {
        const existingTask = Store.getTask(taskId);
        // Check overlap logic if scheduled
        if (
            existingTask &&
            existingTask.scheduledDay &&
            existingTask.scheduledTime &&
            duration !== existingTask.duration
        ) {
            const weekId = Store.getWeekIdentifier(new Date());
            const allWeekTasks = Store.getTasksForWeek(weekId);
            const dayTasks = allWeekTasks.filter(
                (t) => t.scheduledDay === existingTask.scheduledDay && t.id !== taskId
            );

            if (
                !PlannerService.isSlotAvailable(
                    existingTask.scheduledTime,
                    duration,
                    dayTasks,
                    taskId
                )
            ) {
                Toast.error(
                    `Cannot set duration to ${PlannerService.formatDuration(duration)} - overlaps another task.`
                );
                return;
            }
        }
        Store.updateTask(taskId, { title, hierarchy, duration, notes });
    },

    handleCreateTask(title, hierarchy, duration, notes) {
        const task = Store.addTask({ title, hierarchy, duration, notes });

        if (this.scheduledData) {
            const dayTasks = Store.getTasksForDay(this.scheduledData.day);
            if (PlannerService.isSlotAvailable(this.scheduledData.time, duration, dayTasks)) {
                Store.scheduleTask(task.id, this.scheduledData.day, this.scheduledData.time);
            } else {
                Toast.error(`Cannot schedule at ${this.scheduledData.time} - overlaps another task.`);
            }
            this.scheduledData = null;
        }
        return task.id;
    },

    editTask(taskId) {
        const task = Store.getTask(taskId);
        if (!task) return;

        ModalService.open();
        this.editingTaskId = taskId;

        // Populate form fields
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

        const titleInput = document.getElementById('taskTitle');
        if (titleInput) titleInput.value = task.title;
        this.updateTitleColor();

        // Set duration
        let found = false;
        document.querySelectorAll('.duration-option').forEach((btn) => {
            if (btn.dataset.duration === task.duration.toString()) {
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

        const startFocusBtn = document.getElementById('startFocusBtn');
        if (startFocusBtn) startFocusBtn.style.display = 'flex';

        this.pendingSteps = [];
        if (task.notes) {
            this.pendingSteps = task.notes.split('\n').filter((line) => line.trim() !== '');
        }
        this.renderStepsList();
        this.updateScheduleValidation();
    },

    openModalWithSchedule(day, time, maxDuration) {
        ModalService.open();
        this.resetForm();

        this.scheduledData = { day, time, maxDuration };

        document.getElementById('scheduleInfo').style.display = 'block';
        document.getElementById('scheduleDayDisplay').textContent = day;
        document.getElementById('scheduleTimeDisplay').textContent = time;
        document.getElementById('scheduleMaxInfo').textContent =
            `Max: ${PlannerService.formatDuration(maxDuration)}`;

        // Disable invalid durations
        document.querySelectorAll('.duration-option').forEach((btn) => {
            if (btn.dataset.duration === 'custom') return;
            if (parseInt(btn.dataset.duration) > maxDuration) {
                btn.classList.add('disabled');
            }
        });

        if (maxDuration < 60) {
            const btn30 = document.querySelector('.duration-option[data-duration="30"]');
            if (btn30 && !btn30.classList.contains('disabled')) {
                this.onDurationSelect(btn30);
            }
        }

        document.getElementById('dept1').focus();
        this.updateScheduleValidation();
    },

    refreshUI() {
        if (window.Calendar) window.Calendar.refresh();
        if (window.TaskQueue) window.TaskQueue.refresh();
        if (window.Analytics) window.Analytics.render();
        // Trigger badge update
        document.dispatchEvent(new CustomEvent('ui:update-badges'));
    },
};
