/**
 * Calendar Grid - Renders and manages the weekly and daily calendar views
 */

import { Store } from '../store.js';
import { Departments } from '../departments.js';
import { PlannerService } from '../services/PlannerService.js';
import { TaskCard } from './TaskCard.js';
import { ConfirmModal } from './ConfirmModal.js';

export const Calendar = {
    currentWeekStart: null,
    // Use shared constants from PlannerService
    get days() { return PlannerService.DAYS; },
    get dayLabels() { return PlannerService.DAY_LABELS; },
    get startHour() { return PlannerService.START_HOUR; },
    get endHour() { return PlannerService.END_HOUR; },
    viewMode: 'week',
    selectedDayIndex: 0,
    progressTimer: null,
    gridClickHandler: null,

    /**
     * Set the view mode
     */
    setViewMode(mode, index = null) {
        this.viewMode = mode;
        if (mode === 'day') {
            if (index !== null) {
                this.selectedDayIndex = index;
            } else if (this.selectedDayIndex === undefined || this.selectedDayIndex === null) {
                const weekDates = this.getWeekDates();
                const todayIndex = weekDates.findIndex(d => this.isToday(d));
                this.selectedDayIndex = todayIndex !== -1 ? todayIndex : 0;
            }
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

        // Subscribe to store changes for automatic UI updates
        Store.subscribe(() => {
            console.log('Calendar: Store updated, refreshing UI...');
            this.refresh();
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
            console.log(`Auto-generating week ${weekId} from template...`);
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
            return date.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric'
            });
        }

        // Week view - show range
        const start = dates[0];
        const end = dates[6];

        const options = { month: 'long', day: 'numeric' };
        const startStr = start.toLocaleDateString('en-US', options);
        const endStr = end.toLocaleDateString('en-US', { ...options, year: 'numeric' });

        return `${startStr} - ${endStr}`;
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
        if (!header) return;

        const dates = this.getWeekDates();
        const goals = Store.getGoals();
        const weekId = Store.getWeekIdentifier(this.currentWeekStart);
        const weekTasks = Store.getTasksForWeek(weekId);

        let html = '<div class="calendar-header-cell"></div>';

        if (this.viewMode === 'week') {
            dates.forEach((date, index) => {
                const isToday = this.isToday(date);
                const dayName = this.days[index];
                const goal = goals[dayName] || '';

                // Calculate day progress
                const dayTasks = weekTasks.filter(t => t.scheduledDay === dayName);
                const total = dayTasks.length;
                const completed = dayTasks.filter(t => t.completed).length;
                const progress = total > 0 ? (completed / total) * 100 : 0;

                html += `
                    <div class="calendar-header-cell day-header-clickable" data-index="${index}">
                        <div class="calendar-day-name">${this.dayLabels[index]}</div>
                        <div class="calendar-day-date ${isToday ? 'today' : ''}">${date.getDate()}</div>
                        <div class="calendar-day-progress-container">
                            <div class="calendar-day-progress-bar" style="width: ${progress}%"></div>
                        </div>
                        <input type="text" class="calendar-day-goal" 
                               placeholder="Add goal..." 
                               data-day="${dayName}"
                               value="${goal.replace(/"/g, '&quot;')}">
                    </div>
                `;
            });
            header.style.gridTemplateColumns = `var(--calendar-time-col, 60px) repeat(7, 1fr)`;
        } else {
            const index = this.selectedDayIndex;
            const date = dates[index];
            const isToday = this.isToday(date);
            const dayName = this.days[index];
            const goal = goals[dayName] || '';

            // Calculate day progress
            const dayTasks = weekTasks.filter(t => t.scheduledDay === dayName);
            const total = dayTasks.length;
            const completed = dayTasks.filter(t => t.completed).length;
            const progress = total > 0 ? (completed / total) * 100 : 0;

            // Format date nicely
            const dateStr = date.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric'
            });

            // Current time for initial render (will be updated by timer)
            const now = new Date();
            const timeStr = now.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            });

            html += `
                <div class="calendar-header-cell day-view-header-new">
                    <div class="day-header-left">
                        <span class="day-header-date ${isToday ? 'today' : ''}">${dateStr}</span>
                        <div class="calendar-day-progress-container day-view-progress">
                            <div class="calendar-day-progress-bar" style="width: ${progress}%"></div>
                        </div>
                    </div>
                    <div class="day-header-center">
                        <input type="text" class="day-header-goal" 
                               placeholder="🎯 Set today's goal..." 
                               data-day="${dayName}"
                               value="${goal.replace(/"/g, '&quot;')}">
                    </div>
                    <div class="day-header-right">
                        <span class="day-header-clock" id="dayHeaderClock">${timeStr}</span>
                    </div>
                </div>
            `;
            header.style.gridTemplateColumns = `var(--calendar-time-col, 60px) 1fr`;

            // Start clock update timer
            this.startDayClockTimer();
        }

        header.innerHTML = html;
        const weekDisplay = document.getElementById('weekDisplay');
        if (weekDisplay) weekDisplay.textContent = this.formatWeekDisplay();
        this.setupGoalListeners();
        this.setupHeaderClickListeners();
    },

    /**
     * Setup click listeners for date headers in week view
     */
    setupHeaderClickListeners() {
        if (this.viewMode !== 'week') return;

        const headerCells = document.querySelectorAll('.day-header-clickable');
        headerCells.forEach(cell => {
            cell.addEventListener('click', (e) => {
                // Don't trigger if clicking the goal input
                if (e.target.classList.contains('calendar-day-goal')) return;

                const index = parseInt(cell.dataset.index);

                // Sync UI buttons
                const viewBtns = document.querySelectorAll('.view-btn');
                viewBtns.forEach(btn => {
                    btn.classList.toggle('active', btn.dataset.view === 'day');
                });

                this.setViewMode('day', index);
            });
        });
    },

    /**
     * Setup listeners for daily goal inputs
     */
    setupGoalListeners() {
        // Select both week view and day view goal inputs
        const inputs = document.querySelectorAll('.calendar-day-goal, .day-header-goal');
        inputs.forEach(input => {
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
        const slots = this.getTimeSlots();

        let timeColumnHtml = '<div class="time-column">';
        slots.forEach(slot => {
            timeColumnHtml += `<div class="time-slot-label">${slot.label}</div>`;
        });
        timeColumnHtml += '</div>';

        let dayColumnsHtml = '';
        const daysToRender = this.viewMode === 'week' ? this.days : [this.days[this.selectedDayIndex]];
        const weekDates = this.getWeekDates();
        const today = new Date();

        daysToRender.forEach((day, index) => {
            const dayIndex = this.viewMode === 'week' ? index : this.selectedDayIndex;
            const isToday = weekDates[dayIndex] && this.isToday(weekDates[dayIndex]);
            dayColumnsHtml += `<div class="day-column ${isToday ? 'today' : ''}" data-day="${day}">`;
            slots.forEach(slot => {
                const time = this.formatTime(slot.hour, slot.minute);
                dayColumnsHtml += `<div class="calendar-cell" data-day="${day}" data-time="${time}"></div>`;
            });
            dayColumnsHtml += '</div>';
        });

        grid.innerHTML = timeColumnHtml + dayColumnsHtml;

        if (this.viewMode === 'week') {
            grid.style.gridTemplateColumns = `var(--calendar-time-col, 60px) repeat(7, 1fr)`;
        } else {
            grid.style.gridTemplateColumns = `var(--calendar-time-col, 60px) 1fr`;
        }

        this.renderScheduledTasks();
        this.setupCellClick();
        this.updateTimeMarker();
    },

    /**
     * Render all scheduled tasks on the calendar
     */
    renderScheduledTasks() {
        // Get tasks for the current week (auto-creates if needed)
        const weekId = Store.getWeekIdentifier(this.currentWeekStart);
        let tasks = Store.getTasksForWeek(weekId);

        document.querySelectorAll('.calendar-task').forEach(el => el.remove());

        // Apply filter if any filters are selected
        if (window.Filters && window.Filters.selectedPaths.length > 0) {
            tasks = tasks.filter(task => {
                if (!task.hierarchy || task.hierarchy.length === 0) return false;
                return window.Filters.selectedPaths.some(filterPath => {
                    if (filterPath.length > task.hierarchy.length) return false;
                    return filterPath.every((item, index) => task.hierarchy[index] === item);
                });
            });
        }

        tasks.forEach(task => {
            this.renderTask(task);
        });

        // Also update the day progress bars in the header
        this.renderHeader();
    },

    /**
     * Render a single task on the calendar
     */
    renderTask(task) {
        if (!task.scheduledDay || !task.scheduledTime) return;

        const column = document.querySelector(`.day-column[data-day="${task.scheduledDay}"]`);
        if (!column) return;

        const [hours, minutes] = task.scheduledTime.split(':').map(Number);
        const slotIndex = (hours - this.startHour) * 2 + (minutes >= PlannerService.SLOT_DURATION ? 1 : 0);
        const slotsCount = task.duration / PlannerService.SLOT_DURATION;

        const cellHeight = PlannerService.CELL_HEIGHT;
        const top = slotIndex * cellHeight + 2;
        const height = slotsCount * cellHeight - 4;

        const taskEl = document.createElement('div');
        const isCompact = task.duration <= PlannerService.SLOT_DURATION;
        taskEl.className = `calendar-task ${task.completed ? 'completed' : ''} ${isCompact ? 'compact' : ''}`;
        taskEl.style.top = `${top}px`;
        taskEl.style.height = `${height}px`;

        const card = new TaskCard(task);
        taskEl.appendChild(card.render({ isDayView: this.viewMode === 'day', isCompact }));

        // Add progress overlay
        if (!task.completed) {
            const progressOverlay = document.createElement('div');
            progressOverlay.className = 'task-progress-overlay';
            taskEl.appendChild(progressOverlay);
        }

        column.appendChild(taskEl);
        this.updateTaskProgress(taskEl, task);

        // Event listeners
        const block = taskEl.querySelector('.task-block');
        const deleteBtn = taskEl.querySelector('.task-delete');

        // Track clicks for F key shortcut fallback
        block.addEventListener('click', () => {
            window.lastClickedTaskId = task.id;
        });

        block.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            if (window.App && window.App.editTask) {
                window.App.editTask(task.id);
            }
        });

        block.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();

            // Play animation before toggling
            const taskState = Store.getTask(task.id);
            if (taskState && !taskState.completed) {
                // About to complete - play animation
                if (window.App && window.App.playCompletionAnimation) {
                    window.App.playCompletionAnimation(taskEl);
                }
            }

            // Use per-week toggle method
            const updatedTask = Store.toggleCompleteForWeek(task.id);

            // Trigger individual task celebration
            if (updatedTask && updatedTask.completed && window.Confetti) {
                const rect = block.getBoundingClientRect();
                const x = rect.left + rect.width / 2;
                const y = rect.top + rect.height / 2;
                window.Confetti.burst(x, y, 40);
            }

            // Check if all tasks for the day are now complete
            if (updatedTask && updatedTask.completed) {
                this.checkDailyCelebration(task.scheduledDay);
            }

            setTimeout(() => {
                this.renderScheduledTasks();
            }, 500);
        });

        if (deleteBtn) {
            deleteBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const confirmed = await ConfirmModal.show('Are you sure you want to delete this task?');
                if (confirmed) {
                    Store.deleteTask(task.id);
                    this.renderScheduledTasks();
                }
            });
        }
    },

    /**
     * Update visual progress for a task (grey wash for past portion)
     */
    updateTaskProgress(taskEl, task) {
        if (task.completed) return;
        const overlay = taskEl.querySelector('.task-progress-overlay');
        if (!overlay) return;

        const progress = this.calculateProgress(task);

        // Remove old classes
        overlay.classList.remove('in-progress', 'expired');
        taskEl.classList.remove('time-passed');

        if (progress <= 0) {
            // Not started yet - no grey wash
            overlay.style.height = '0%';
        } else if (progress >= 1) {
            // Time has fully passed
            overlay.style.height = '100%';
            overlay.classList.add('expired');
            taskEl.classList.add('time-passed');
        } else {
            // In progress - grey wash grows from top down
            overlay.classList.add('in-progress');
            const passedHeight = progress * 100;
            overlay.style.height = `${passedHeight.toFixed(1)}%`;
        }
    },

    /**
     * Calculate progress (0 to 1) based on current time and mini-task completion
     */
    calculateProgress(task) {
        if (!task.scheduledDay || !task.scheduledTime) return 0;

        // 1. Calculate time-based progress
        const weekDates = this.getWeekDates();
        const dayIndex = this.days.indexOf(task.scheduledDay);
        const taskDate = weekDates[dayIndex];
        const now = new Date();
        const taskDateOnly = new Date(taskDate.getFullYear(), taskDate.getMonth(), taskDate.getDate());
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
            const end = new Date(start);
            end.setMinutes(end.getMinutes() + task.duration);

            if (now < start) timeProgress = 0;
            else if (now > end) timeProgress = 1;
            else timeProgress = (now - start) / (end - start);
        }

        // 2. Calculate mini-task progress if present
        let miniTaskProgress = 0;
        if (task.notes) {
            const lines = task.notes.split('\n').filter(line => line.trim());
            const miniTasks = lines.filter(line => line.includes('[ ]') || line.includes('[x]'));
            if (miniTasks.length > 0) {
                const completedCount = miniTasks.filter(line => line.includes('[x]')).length;
                miniTaskProgress = completedCount / miniTasks.length;
            }
        }

        // 3. Return the higher of the two (ensures visual urgency even if no tasks checked)
        return Math.max(timeProgress, miniTaskProgress);
    },

    /**
     * Setup progress timer
     */
    setupProgressTimer() {
        if (this.progressTimer) clearInterval(this.progressTimer);

        this.updateTimeMarker();

        this.progressTimer = setInterval(() => {
            document.querySelectorAll('.calendar-task').forEach(taskEl => {
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
            showToday = weekDates.some(d => d.toDateString() === todayDateStr);
        } else {
            showToday = weekDates[this.selectedDayIndex].toDateString() === todayDateStr;
        }

        if (!showToday) {
            if (marker) marker.style.display = 'none';
            return;
        }

        if (!marker) {
            marker = document.createElement('div');
            marker.id = 'currentTimeMarker';
            grid.appendChild(marker);
        }

        // Get actual cell height from DOM (each cell is 30 minutes)
        const cell = grid.querySelector('.calendar-cell');
        const cellHeight = cell ? cell.offsetHeight : 50;

        // Calculate position: each cell is 30 minutes
        const totalMinutes = (currentHour - this.startHour) * 60 + now.getMinutes();
        const top = (totalMinutes / 30) * cellHeight;

        // Format current time for display (e.g., "10:45 AM")
        const timeStr = now.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });

        marker.style.display = 'block';
        marker.style.top = `${top}px`;
        marker.setAttribute('data-time', timeStr);
    },

    /**
     * Setup view switcher listeners
     */
    setupViewToggle() {
        const viewBtns = document.querySelectorAll('.view-btn');
        viewBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                viewBtns.forEach(b => b.classList.remove('active'));
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
                const todayIndex = weekDates.findIndex(d => this.isToday(d));
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
        }
        this.gridClickHandler = (e) => {
            const cell = e.target.closest('.calendar-cell');
            if (!cell) return;
            if (e.target.closest('.calendar-task') || e.target.closest('.task-block')) return;
            const day = cell.dataset.day;
            const time = cell.dataset.time;
            const maxDuration = this.getMaxDurationForSlot(day, time);
            if (window.App && window.App.openModalWithSchedule) {
                window.App.openModalWithSchedule(day, time, maxDuration);
            }
        };
        grid.addEventListener('click', this.gridClickHandler);
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
        dayTasks.forEach(task => {
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
                const timeStr = now.toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                });
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
        const dayTasks = Store.getTasksForWeek(weekId).filter(t => t.scheduledDay === day);

        console.log('Checking celebration for', day, '- Tasks:', dayTasks.length, 'Completed:', dayTasks.filter(t => t.completed).length);

        if (dayTasks.length === 0) return;

        const allComplete = dayTasks.every(t => t.completed);

        console.log('All complete?', allComplete);

        if (allComplete && window.Confetti) {
            console.log('🎊 Triggering confetti celebration!');
            // Small delay to let the completion animation finish
            setTimeout(() => {
                window.Confetti.celebrate();
            }, 600);
        }
    }
};
