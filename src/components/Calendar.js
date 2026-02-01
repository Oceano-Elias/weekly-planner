import { DevLog } from '../utils/DevLog.js';
/**
 * Calendar Grid - Renders and manages the weekly and daily calendar views
 */

import { Store } from '../store.js';
import { PlannerService } from '../services/PlannerService.js';
import { TaskCard } from './TaskCard.js';
import { ConfirmModal } from './ConfirmModal.js';
import { DOMUtils } from '../utils/DOMUtils.js';
import { Rewards } from '../services/Rewards.js';
import { DateTimeService } from '../services/DateTimeService.js';

export const Calendar = {
    currentWeekStart: null,
    // Use shared constants from PlannerService
    get days() {
        return PlannerService.DAYS;
    },
    get dayLabels() {
        return PlannerService.DAY_LABELS;
    },
    get startHour() {
        return PlannerService.START_HOUR;
    },
    get endHour() {
        return PlannerService.END_HOUR;
    },
    viewMode: 'week',
    selectedDayIndex: 0,
    progressTimer: null,
    gridClickHandler: null,
    columnCache: {}, // Cache for day columns
    onEditTask: null,
    onOpenModalWithSchedule: null,
    onPlayCompletionAnimation: null,

    /**
     * Set the view mode
     */
    setViewMode(mode) {
        this.viewMode = mode;
        // Only set today if index is null OR we want to reset to today
        if (
            mode === 'day' &&
            (this.selectedDayIndex === null || this.selectedDayIndex === undefined)
        ) {
            const weekDates = this.getWeekDates();
            const todayIndex = weekDates.findIndex((d) => this.isToday(d));
            this.selectedDayIndex = todayIndex !== -1 ? todayIndex : 0;
        }
        this.renderHeader();
        this.renderGrid();
    },

    /**
     * Initialize the calendar
     */
    init() {
        this.setCurrentWeek(new Date());
        this.renderHeader();
        this.renderGrid();
        this.setupNavigation();
        this.setupViewToggle();
        this.setupProgressTimer();
        this.setupResizeInteraction();

        // Subscribe to store changes
        Store.subscribe(() => {
            DevLog.log('Calendar: Store updated, refreshing tasks...');
            this.renderScheduledTasks();
        });
    },

    /**
     * Set the current week
     */
    setCurrentWeek(date) {
        this.currentWeekStart = PlannerService.getWeekStart(date);
        Store.setCurrentWeek(this.currentWeekStart);

        // Auto-generate week instances from template if they don't exist
        const weekId = Store.getWeekIdentifier(this.currentWeekStart);
        if (!Store.hasWeekInstances(weekId)) {
            DevLog.log(`Auto-generating week ${weekId} from template...`);
            Store.createWeekFromTemplate(weekId);
        }
    },

    /**
     * Get dates for the current week
     */
    getWeekDates() {
        const dates = [];
        for (let i = 0; i < 7; i++) {
            const date = new Date(this.currentWeekStart);
            date.setDate(date.getDate() + i);
            dates.push(date);
        }
        return dates;
    },

    /**
     * Format the week/day display string
     */
    formatWeekDisplay() {
        const dates = this.getWeekDates();

        if (this.viewMode === 'day') {
            // Show just the selected day
            const date = dates[this.selectedDayIndex];
            return DateTimeService.formatFullDate(date);
        }

        // Week view - show range
        const start = dates[0];
        const end = dates[6];

        return DateTimeService.formatWeekRange(start, end);
    },

    /**
     * Check if a date is today
     */
    isToday(date) {
        const today = new Date();
        return date.toDateString() === today.toDateString();
    },

    /**
     * Render the calendar header (days)
     */
    renderHeader() {
        const header = document.getElementById('calendarHeader');
        DOMUtils.clear(header);
        const dates = this.getWeekDates();
        const goals = Store.getGoals();

        // Empty corner cell
        // Empty corner cell (aligns with time column)
        header.appendChild(DOMUtils.createElement('div', { className: 'calendar-header-cell' }));

        if (this.viewMode === 'week') {
            dates.forEach((date, index) => {
                const isToday = this.isToday(date);
                const dayName = this.days[index];
                const goal = goals[dayName] || '';

                const cell = DOMUtils.createElement(
                    'div',
                    {
                        className: 'calendar-header-cell day-header-nav',
                        dataset: { index },
                    },
                    [
                        DOMUtils.createElement('div', {
                            className: 'calendar-day-name',
                            textContent: this.dayLabels[index],
                        }),
                        DOMUtils.createElement('div', {
                            className: `calendar-day-date ${isToday ? 'today' : ''}`,
                            textContent: date.getDate().toString(),
                        }),
                        DOMUtils.createElement('input', {
                            type: 'text',
                            className: 'calendar-day-goal',
                            placeholder: 'Add goal...',
                            dataset: { day: dayName },
                            value: goal,
                        }),
                    ]
                );
                header.appendChild(cell);
            });
            header.style.gridTemplateColumns = `var(--calendar-time-col, 60px) repeat(7, 1fr)`;
        } else {
            const index = this.selectedDayIndex;
            const date = dates[index];
            const isToday = this.isToday(date);
            const dayName = this.days[index];
            const goal = goals[dayName] || '';

            // Format date nicely
            const dateStr = DateTimeService.formatDayHeader(date);

            // Current time for initial render (will be updated by timer)
            const now = new Date();
            const timeStr = DateTimeService.formatCurrentTime(now);

            const headerCell = DOMUtils.createElement('div', { className: 'day-view-header-new' }, [
                DOMUtils.createElement('div', { className: 'day-header-left' }, [
                    DOMUtils.createElement('span', {
                        className: `day-header-date ${isToday ? 'today' : ''}`,
                        textContent: dateStr,
                    }),
                ]),
                DOMUtils.createElement('div', { className: 'day-header-center' }, [
                    DOMUtils.createElement('input', {
                        type: 'text',
                        className: 'day-header-goal',
                        placeholder: "🎯 Set today's goal...",
                        dataset: { day: dayName },
                        value: goal,
                    }),
                ]),
                DOMUtils.createElement('div', { className: 'day-header-right' }, [
                    DOMUtils.createElement('span', {
                        className: 'day-header-clock',
                        id: 'dayHeaderClock',
                        textContent: timeStr,
                    }),
                ]),
            ]);
            header.appendChild(headerCell);
            header.style.gridTemplateColumns = `var(--calendar-time-col, 60px) 1fr`;

            // Start clock update timer
            this.startDayClockTimer();
        }

        document.getElementById('weekDisplay').textContent = this.formatWeekDisplay();
        this.setupGoalListeners();
        this.setupHeaderNavigation();
    },

    /**
     * Setup navigation when clicking day headers
     */
    setupHeaderNavigation() {
        const header = document.getElementById('calendarHeader');
        header.querySelectorAll('.day-header-nav').forEach((cell) => {
            cell.addEventListener('click', (e) => {
                // Don't trigger if clicking the goal input
                if (e.target.tagName === 'INPUT') return;

                const index = parseInt(cell.dataset.index);
                this.selectedDayIndex = index;
                this.setViewMode('day');

                // Update UI buttons
                document.querySelectorAll('.view-btn').forEach((btn) => {
                    btn.classList.toggle('active', btn.dataset.view === 'day');
                });
            });
        });
    },

    /**
     * Setup listeners for daily goal inputs
     */
    setupGoalListeners() {
        // Select both week view and day view goal inputs
        const inputs = document.querySelectorAll('.calendar-day-goal, .day-header-goal');
        inputs.forEach((input) => {
            input.addEventListener('change', (e) => {
                const day = e.target.dataset.day;
                const goal = e.target.value;
                Store.saveGoal(day, goal);
            });
        });
    },

    /**
     * Generate time slots
     */
    getTimeSlots() {
        const slots = [];
        for (let hour = this.startHour; hour < this.endHour; hour++) {
            slots.push({ hour, minute: 0, label: this.formatTime(hour, 0) });
            slots.push({ hour, minute: 30, label: '' });
        }
        return slots;
    },

    /**
     * Format time for display
     */
    formatTime(hour, minute) {
        const h = hour.toString().padStart(2, '0');
        const m = minute.toString().padStart(2, '0');
        return `${h}:${m}`;
    },

    /**
     * Render the calendar grid
     */
    renderGrid() {
        const grid = document.getElementById('calendarGrid');
        const currentMode = grid.dataset.viewMode;
        const needsStructuralRefresh = currentMode !== this.viewMode;

        if (needsStructuralRefresh) {
            DevLog.log(`Calendar: Structural refresh for ${this.viewMode} view`);
            DOMUtils.clear(grid);
            grid.dataset.viewMode = this.viewMode;
            this.columnCache = {}; // Reset cache on new grid render
            const slots = this.getTimeSlots();

            // Render time column
            const timeColumn = DOMUtils.createElement('div', { className: 'time-column' });
            slots.forEach((slot) => {
                timeColumn.appendChild(
                    DOMUtils.createElement('div', {
                        className: 'time-slot-label',
                        textContent: slot.label,
                    })
                );
            });
            grid.appendChild(timeColumn);

            // Render day columns
            const daysToRender =
                this.viewMode === 'week' ? this.days : [this.days[this.selectedDayIndex]];
            const weekDates = this.getWeekDates();

            daysToRender.forEach((day, index) => {
                const dayIndex = this.viewMode === 'week' ? index : this.selectedDayIndex;
                const isToday = weekDates[dayIndex] && this.isToday(weekDates[dayIndex]);

                const dayColumn = DOMUtils.createElement('div', {
                    className: `day-column ${isToday ? 'today' : ''}`,
                    dataset: { day },
                });

                slots.forEach((slot) => {
                    const time = this.formatTime(slot.hour, slot.minute);
                    dayColumn.appendChild(
                        DOMUtils.createElement('div', {
                            className: 'calendar-cell',
                            dataset: { day, time },
                        })
                    );
                });
                grid.appendChild(dayColumn);
                this.columnCache[day] = dayColumn; // Cache the column element
            });

            if (this.viewMode === 'week') {
                grid.style.gridTemplateColumns = `var(--calendar-time-col, 60px) repeat(7, 1fr)`;
            } else {
                grid.style.gridTemplateColumns = `var(--calendar-time-col, 60px) 1fr`;
            }
        } else {
            // Re-sync columnCache if reusing existing structure
            document.querySelectorAll('.day-column').forEach((col) => {
                const day = col.dataset.day;
                this.columnCache[day] = col;
                // Clear existing tasks but KEEP the slots
                col.querySelectorAll('.calendar-task').forEach((t) => t.remove());
            });
        }

        this.renderScheduledTasks();
        this.setupCellClick();
        this.updateTimeMarker();
    },

    /**
     * Render all scheduled tasks on the calendar
     */
    renderScheduledTasks() {
        // Clear all existing tasks first to avoid accumulation
        document.querySelectorAll('.calendar-task').forEach((t) => t.remove());

        // Get tasks for the current week (auto-creates if needed)
        const weekId = Store.getWeekIdentifier(this.currentWeekStart);
        let tasks = Store.getTasksForWeek(weekId);

        // Filter tasks
        if (window.Filters) {
            tasks = tasks.filter((task) => {
                if (window.Filters.selectedPaths.length === 0) return true;
                if (!task.hierarchy || task.hierarchy.length === 0) return true;
                return window.Filters.selectedPaths.some((filterPath) => {
                    if (filterPath.length > task.hierarchy.length) return false;
                    return filterPath.every((item, index) => task.hierarchy[index] === item);
                });
            });
        }

        // Group tasks by day for batched insertion
        const tasksByDay = {};
        tasks.forEach((task) => {
            if (!task.scheduledDay) return;
            if (!tasksByDay[task.scheduledDay]) tasksByDay[task.scheduledDay] = [];
            tasksByDay[task.scheduledDay].push(task);
        });

        // Use fragments to append tasks to each column
        Object.keys(this.columnCache).forEach((day) => {
            const column = this.columnCache[day];
            const tasksToRender = tasksByDay[day] || [];

            // Build a fragment for this column
            const fragment = document.createDocumentFragment();
            tasksToRender.forEach((task) => {
                const taskEl = this.renderTask(task);
                if (taskEl) fragment.appendChild(taskEl);
            });

            column.appendChild(fragment);
        });
    },

    /**
     * Render a single task on the calendar
     */
    renderTask(task) {
        if (!task.scheduledDay || !task.scheduledTime) return;
        const column = this.columnCache[task.scheduledDay];
        if (!column) return;

        const [hours, minutes] = task.scheduledTime.split(':').map(Number);
        const slotIndex =
            (hours - this.startHour) * 2 + (minutes >= PlannerService.SLOT_DURATION ? 1 : 0);
        const slotsCount = task.duration / PlannerService.SLOT_DURATION;

        const cellHeight = PlannerService.CELL_HEIGHT;
        const top = slotIndex * cellHeight;
        const height = slotsCount * cellHeight;

        const isCompact = task.duration <= PlannerService.SLOT_DURATION;
        const activeExec = Store.getState().activeExecution;
        const isActive = activeExec && activeExec.taskId === task.id && activeExec.running;

        const taskEl = DOMUtils.createElement('div', {
            className: `calendar-task ${task.completed ? 'completed' : ''} ${isCompact ? 'compact' : ''} ${isActive ? 'active-focus' : ''}`,
            style: {
                top: `${top}px`,
                height: `${height}px`,
            },
            dataset: { taskId: task.id }, // For event delegation
        });

        const card = new TaskCard(task);
        const taskBlockEl = card.render({
            isDayView: this.viewMode === 'day',
            isCompact,
            isActive,
        });
        taskBlockEl.draggable = false;
        taskEl.appendChild(taskBlockEl);

        // Add progress overlay (Always add for consistency, even if height 0)
        const progressOverlay = DOMUtils.createElement('div', {
            className: 'task-progress-overlay',
        });
        taskEl.appendChild(progressOverlay);

        column.appendChild(taskEl);
        this.updateTaskProgress(taskEl, task);

        return taskEl;
    },

    /**
     * Update visual progress for a task (grey wash for past portion)
     */
    updateTaskProgress(taskEl, task) {
        const overlay = taskEl.querySelector('.task-progress-overlay');
        const { timeProgress, completionProgress } = this.calculateTaskProgress(task);

        // Classify as "passed" ONLY if the actual time slot has elapsed
        const isTimePassed = timeProgress >= 1;

        // Visual progress is the higher of time or actual task completion
        const visualProgress = Math.max(timeProgress, completionProgress);

        // Remove old classes to reset state
        if (overlay) overlay.classList.remove('in-progress', 'expired');
        taskEl.classList.remove('time-passed');

        if (isTimePassed) {
            taskEl.classList.add('time-passed');
            if (overlay) {
                overlay.style.height = '100%';
                overlay.classList.add('expired');
            }
        } else if (visualProgress > 0) {
            // In progress or part-complete
            if (overlay) {
                overlay.classList.add('in-progress');
                const passedHeight = Math.min(1, visualProgress) * 100;
                overlay.style.height = `${passedHeight.toFixed(1)}%`;
            }
        } else {
            // Not started yet
            if (overlay) {
                overlay.style.height = '0%';
            }
        }
    },

    /**
     * Calculate both time-based and completion-based progress
     */
    calculateTaskProgress(task) {
        if (!task.scheduledDay || !task.scheduledTime)
            return { timeProgress: 0, completionProgress: 0 };

        // 1. Calculate time-based progress
        const weekDates = this.getWeekDates();
        const dayIndex = this.days.indexOf(task.scheduledDay?.toLowerCase());
        if (dayIndex === -1) return { timeProgress: 0, completionProgress: 0 };
        const taskDate = weekDates[dayIndex];
        if (!taskDate) return { timeProgress: 0, completionProgress: 0 };

        const now = new Date();
        const taskDateOnly = new Date(
            taskDate.getFullYear(),
            taskDate.getMonth(),
            taskDate.getDate()
        );
        const nowDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        let timeProgress = 0;
        if (taskDateOnly < nowDateOnly) {
            timeProgress = 1;
        } else if (taskDateOnly > nowDateOnly) {
            timeProgress = 0;
        } else {
            const [startHours, startMinutes] = task.scheduledTime.split(':').map(Number);
            const start = new Date(now);
            start.setHours(startHours, startMinutes, 0, 0);
            const duration = task.duration || 30;
            const end = new Date(start.getTime() + duration * 60 * 1000);

            if (now < start) timeProgress = 0;
            else if (now > end) timeProgress = 1;
            else timeProgress = (now - start) / (duration * 60 * 1000);
        }

        // 2. Calculate completion progress
        let completionProgress = task.completed ? 1 : 0;
        const activeExec = Store.getState().activeExecution;
        const isActive = activeExec && activeExec.taskId === task.id && activeExec.running;

        if (!isActive && !task.completed && task.notes) {
            const lines = task.notes.split('\n').filter((line) => line.trim());
            const miniTasks = lines.filter((line) => line.includes('[ ]') || line.includes('[x]'));
            if (miniTasks.length > 0) {
                const completedCount = miniTasks.filter((line) => line.includes('[x]')).length;
                completionProgress = completedCount / miniTasks.length;
            }
        }

        return { timeProgress, completionProgress };
    },

    /**
     * Setup progress timer
     */
    setupProgressTimer() {
        if (this.progressTimer) clearInterval(this.progressTimer);

        this.updateTimeMarker();

        this.progressTimer = setInterval(() => {
            document.querySelectorAll('.calendar-task').forEach((taskEl) => {
                const taskBlock = taskEl.querySelector('.task-block');
                if (!taskBlock) return;
                const taskId = taskBlock.dataset.taskId;
                const task = Store.getTask(taskId);
                if (task) this.updateTaskProgress(taskEl, task);
            });
            this.updateTimeMarker();
        }, 10000);
    },

    /**
     * Update the red line indicating current time
     */
    updateTimeMarker() {
        const grid = document.getElementById('calendarGrid');
        if (!grid) return;

        let marker = document.getElementById('currentTimeMarker');

        const now = new Date();
        const currentHour = now.getHours();

        if (currentHour < this.startHour || currentHour >= this.endHour) {
            if (marker) marker.style.display = 'none';
            return;
        }

        const weekDates = this.getWeekDates();
        const todayDateStr = now.toDateString();
        let showToday = false;

        if (this.viewMode === 'week') {
            showToday = weekDates.some((d) => d.toDateString() === todayDateStr);
        } else {
            showToday = weekDates[this.selectedDayIndex].toDateString() === todayDateStr;
        }

        if (!showToday) {
            if (marker) marker.style.display = 'none';
            return;
        }

        if (!marker) {
            marker = DOMUtils.createElement('div', {
                id: 'currentTimeMarker',
                className: 'current-time-line',
            });
            grid.appendChild(marker);
        }

        // Get actual cell height from DOM (each cell is 30 minutes)
        const cell = grid.querySelector('.calendar-cell');
        const cellHeight = cell ? cell.offsetHeight : 50;

        // Calculate position: each cell is 30 minutes
        const totalMinutes = (currentHour - this.startHour) * 60 + now.getMinutes();
        const top = (totalMinutes / 30) * cellHeight;

        // Format current time for display (e.g., "10:45 AM")
        const timeStr = DateTimeService.formatCurrentTime(now);

        marker.style.display = 'block';
        marker.style.top = `${top}px`;
        marker.setAttribute('data-time', timeStr);
    },

    /**
     * Setup view switcher listeners
     */
    setupViewToggle() {
        const viewBtns = document.querySelectorAll('.view-btn');
        viewBtns.forEach((btn) => {
            btn.addEventListener('click', () => {
                viewBtns.forEach((b) => b.classList.remove('active'));
                btn.classList.add('active');
                this.setViewMode(btn.dataset.view);
            });
        });
    },

    /**
     * Setup navigation listeners
     */
    setupNavigation() {
        document.getElementById('prevWeek').addEventListener('click', () => {
            if (this.viewMode === 'day') {
                // Move one day back
                if (this.selectedDayIndex > 0) {
                    this.selectedDayIndex--;
                } else {
                    // Go to previous week's Sunday
                    this.currentWeekStart.setDate(this.currentWeekStart.getDate() - 7);
                    Store.setCurrentWeek(this.currentWeekStart);
                    this.selectedDayIndex = 6;
                }
            } else {
                // Move one week back
                this.currentWeekStart.setDate(this.currentWeekStart.getDate() - 7);
                Store.setCurrentWeek(this.currentWeekStart);
            }
            this.renderHeader();
            this.renderGrid();
            if (window.TaskQueue) window.TaskQueue.refresh();
        });
        document.getElementById('nextWeek').addEventListener('click', () => {
            if (this.viewMode === 'day') {
                // Move one day forward
                if (this.selectedDayIndex < 6) {
                    this.selectedDayIndex++;
                } else {
                    // Go to next week's Monday
                    this.currentWeekStart.setDate(this.currentWeekStart.getDate() + 7);
                    Store.setCurrentWeek(this.currentWeekStart);
                    this.selectedDayIndex = 0;
                }
            } else {
                // Move one week forward
                this.currentWeekStart.setDate(this.currentWeekStart.getDate() + 7);
                Store.setCurrentWeek(this.currentWeekStart);
            }
            this.renderHeader();
            this.renderGrid();
            if (window.TaskQueue) window.TaskQueue.refresh();
        });
        document.getElementById('todayBtn').addEventListener('click', () => {
            this.setCurrentWeek(new Date());
            if (this.viewMode === 'day') {
                const weekDates = this.getWeekDates();
                const todayIndex = weekDates.findIndex((d) => this.isToday(d));
                this.selectedDayIndex = todayIndex !== -1 ? todayIndex : 0;
            }
            this.renderHeader();
            this.renderGrid();
            if (window.TaskQueue) window.TaskQueue.refresh();
        });
    },

    /**
     * Setup cell click to open form
     */
    setupCellClick() {
        const grid = document.getElementById('calendarGrid');
        if (!grid) return;
        if (this.gridClickHandler) {
            grid.removeEventListener('click', this.gridClickHandler);
            grid.removeEventListener('keydown', this.gridKeyHandler);
        }

        this.gridClickHandler = (e) => {
            const cell = e.target.closest('.calendar-cell');
            if (!cell) return;
            if (e.target.closest('.calendar-task') || e.target.closest('.task-block')) return;
            this.handleCellInteraction(cell);
        };

        this.gridKeyHandler = (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                const cell = e.target.closest('.calendar-cell');
                if (cell && !e.target.closest('.calendar-task')) {
                    e.preventDefault();
                    this.handleCellInteraction(cell);
                }
            }
        };

        grid.addEventListener('click', this.gridClickHandler);
        grid.addEventListener('keydown', this.gridKeyHandler);

        // [NEW] Centralized Delegated Task Listeners
        this.setupDelegatedTaskListeners(grid);
    },

    /**
     * Centralized event delegation for all task interactions
     */
    /**
     * Centralized event delegation for all task interactions
     */
    setupDelegatedTaskListeners(grid) {
        // Cleanup existing listeners to ensure no duplicates
        if (this.taskDelegationCleanup) {
            this.taskDelegationCleanup();
            this.taskDelegationCleanup = null;
        }

        // Define named handlers
        const onDblClick = (e) => {
            const taskEl = e.target.closest('.calendar-task');
            if (taskEl && taskEl.dataset.taskId) {
                e.stopPropagation();
                const taskId = taskEl.dataset.taskId;
                if (this.onEditTask) this.onEditTask(taskId);
                else if (window.App && window.App.editTask) window.App.editTask(taskId);
            }
        };

        const onContextMenu = (e) => {
            const taskEl = e.target.closest('.calendar-task');
            if (!taskEl || !taskEl.dataset.taskId) return;

            e.preventDefault();
            e.stopPropagation();

            const taskId = taskEl.dataset.taskId;
            const block = taskEl.querySelector('.task-block');
            const taskState = Store.getTask(taskId);

            if (!taskState) return;

            const wasCompleted = taskState.completed;
            const hasSteps = taskState.notes && taskState.notes.includes('[ ]');

            // Play animation for completion
            if (!wasCompleted && !hasSteps) {
                if (window.App && window.App.playCompletionAnimation) {
                    window.App.playCompletionAnimation(taskEl);
                }
            }

            const result = Store.advanceTaskProgress(taskId);
            const updatedTask = result ? result.task : null;

            // Celebrations
            if (!wasCompleted && updatedTask && updatedTask.completed) {
                if (window.Confetti && block) {
                    const rect = block.getBoundingClientRect();
                    Rewards.show(e.clientX, e.clientY, 'huge');
                    window.Confetti.burst(
                        rect.left + rect.width / 2,
                        rect.top + rect.height / 2,
                        40
                    );
                }
                this.checkDailyCelebration(updatedTask.scheduledDay);
            } else if (updatedTask && !updatedTask.completed && hasSteps) {
                Rewards.show(e.clientX, e.clientY);
            }
        };

        const onClick = (e) => {
            const taskEl = e.target.closest('.calendar-task');
            const deleteBtn = e.target.closest('.task-delete');

            if (deleteBtn && taskEl && taskEl.dataset.taskId) {
                e.preventDefault();
                e.stopPropagation();
                this.handleDeleteTask(taskEl.dataset.taskId);
                return;
            }

            if (taskEl && taskEl.dataset.taskId) {
                window.lastClickedTaskId = taskEl.dataset.taskId;
            }
        };

        // Add listeners
        grid.addEventListener('dblclick', onDblClick);
        grid.addEventListener('contextmenu', onContextMenu);
        grid.addEventListener('click', onClick);

        // Save cleanup function
        this.taskDelegationCleanup = () => {
            grid.removeEventListener('dblclick', onDblClick);
            grid.removeEventListener('contextmenu', onContextMenu);
            grid.removeEventListener('click', onClick);
        };
    },

    /**
     * Handle task deletion via delegation
     */
    async handleDeleteTask(taskId) {
        const confirmed = await ConfirmModal.show('Are you sure you want to delete this task?');
        if (confirmed) {
            Store.deleteTask(taskId);
            // Re-render grid to reflect deletion (or we could surgerically remove the El)
            this.renderGrid();
            if (window.TaskQueue) window.TaskQueue.refresh();
            if (window.Filters) window.Filters.refresh();
        }
    },

    /**
     * Handle interaction with a grid cell (click or keyboard)
     */
    handleCellInteraction(cell) {
        const day = cell.dataset.day;
        const time = cell.dataset.time;
        const maxDuration = this.getMaxDurationForSlot(day, time);
        if (this.onOpenModalWithSchedule) this.onOpenModalWithSchedule(day, time, maxDuration);
        else if (window.App && window.App.openModalWithSchedule)
            window.App.openModalWithSchedule(day, time, maxDuration);
    },

    /**
     * Get max duration for a slot
     */
    getMaxDurationForSlot(day, time) {
        const [startHour, startMin] = time.split(':').map(Number);
        const startTotalMins = startHour * 60 + startMin;
        const endOfDayMins = this.endHour * 60;
        if (startTotalMins >= endOfDayMins) return 0;
        const dayTasks = Store.getTasksForDay(day);
        let nextTaskStart = endOfDayMins;
        dayTasks.forEach((task) => {
            if (!task.scheduledTime) return;
            const [taskHour, taskMin] = task.scheduledTime.split(':').map(Number);
            const taskStart = taskHour * 60 + taskMin;
            const taskEnd = taskStart + (task.duration || 0);
            if (taskStart <= startTotalMins && taskEnd > startTotalMins) {
                nextTaskStart = startTotalMins;
                return;
            }
            if (taskStart > startTotalMins && taskStart < nextTaskStart) nextTaskStart = taskStart;
        });
        return Math.max(0, nextTaskStart - startTotalMins);
    },

    /**
     * Refresh the grid
     */
    refresh() {
        this.renderScheduledTasks();
        this.setupCellClick();
    },

    /**
     * Start/update the clock timer for day view header
     */
    dayClockTimer: null,

    startDayClockTimer() {
        // Clear any existing timer
        if (this.dayClockTimer) {
            clearInterval(this.dayClockTimer);
        }

        // Update clock every second
        this.dayClockTimer = setInterval(() => {
            const clockEl = document.getElementById('dayHeaderClock');
            if (clockEl) {
                const now = new Date();
                const timeStr = DateTimeService.formatCurrentTime(now);
                clockEl.textContent = timeStr;
            } else {
                // Clock element not found, stop timer (probably switched to week view)
                clearInterval(this.dayClockTimer);
                this.dayClockTimer = null;
            }
        }, 1000);
    },

    /**
     * Check if all tasks for a day are complete and trigger celebration
     */
    checkDailyCelebration(day) {
        const weekId = Store.getWeekIdentifier(this.currentWeekStart);
        const dayTasks = Store.getTasksForWeek(weekId).filter((t) => t.scheduledDay === day);

        DevLog.log(
            'Checking celebration for',
            day,
            '- Tasks:',
            dayTasks.length,
            'Completed:',
            dayTasks.filter((t) => t.completed).length
        );

        if (dayTasks.length === 0) return;

        const allComplete = dayTasks.every((t) => t.completed);

        DevLog.log('All complete?', allComplete);

        if (allComplete && window.Confetti) {
            DevLog.log('🎊 Triggering confetti celebration!');
            // Small delay to let the completion animation finish
            setTimeout(() => {
                window.Confetti.celebrate();
            }, 600);
        }
    },

    /**
     * Setup Visual Resizing Interaction
     */
    setupResizeInteraction() {
        let resizingTask = null;
        let startY = 0;
        let startHeight = 0;
        let currentTaskEl = null;
        let cellHeight = 0;

        const onPointerMove = (e) => {
            if (!resizingTask || !currentTaskEl) return;

            const deltaY = e.clientY - startY;
            const newHeight = Math.max(cellHeight, startHeight + deltaY);

            // Snap to grid (full-cell for 30m slots)
            const snappedHeight = Math.round(newHeight / cellHeight) * cellHeight;

            currentTaskEl.style.height = `${snappedHeight - 2}px`;

            // Highlight the card while resizing
            currentTaskEl.classList.add('resizing');
        };

        const onPointerUp = () => {
            if (!resizingTask) return;

            const finalHeight = parseInt(currentTaskEl.style.height) + 2;
            const newDuration = (finalHeight / cellHeight) * PlannerService.SLOT_DURATION;

            if (newDuration !== resizingTask.duration) {
                Store.updateTask(resizingTask.id, { duration: newDuration });
                this.renderScheduledTasks();
                if (window.TaskQueue) window.TaskQueue.refresh();
                if (window.Analytics) window.Analytics.render();
            }

            document.body.classList.remove('resizing');
            if (currentTaskEl) currentTaskEl.classList.remove('resizing');

            resizingTask = null;
            currentTaskEl = null;

            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);
        };

        document.addEventListener('pointerdown', (e) => {
            const handle = e.target.closest('.task-resize-handle');
            if (!handle) return;

            e.preventDefault();
            e.stopPropagation();

            const taskEl = handle.closest('.calendar-task');
            const taskBlock = taskEl.querySelector('.task-block');
            const taskId = taskBlock.dataset.taskId;

            resizingTask = Store.getTask(taskId);
            currentTaskEl = taskEl;
            startY = e.clientY;
            startHeight = taskEl.offsetHeight;

            const firstCell = document.querySelector('.calendar-cell');
            cellHeight = firstCell ? firstCell.offsetHeight : PlannerService.CELL_HEIGHT;

            document.body.classList.add('resizing');

            window.addEventListener('pointermove', onPointerMove);
            window.addEventListener('pointerup', onPointerUp);
        });
    },
};
