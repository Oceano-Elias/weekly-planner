/**
 * FocusMode Component - Manages the high-intensity execution modal
 */

import { Store } from '../store.js';
import { Departments } from '../departments.js';
import { PlannerService } from '../services/PlannerService.js';

export const FocusMode = {
    isOpen: false,
    activeTaskId: null,
    activeKeyHandler: null,

    // Pomodoro Timer State
    pomodoroTimer: null,
    pomodoroSeconds: 25 * 60, // 25 minutes default
    pomodoroRunning: false,
    pomodoroMode: 'work', // 'work' or 'break'
    workDuration: 25 * 60,
    breakDuration: 5 * 60,

    /**
     * Count the number of steps in the notes
     */
    getStepCount(notes) {
        if (!notes) return 0;
        const lines = notes.split('\n').filter(l => l.trim() !== '');
        return lines.length;
    },

    /**
     * Open Focus Mode for a specific task
     */
    open(taskId) {
        const task = Store.getTask(taskId);
        if (!task) return;

        this.activeTaskId = taskId;
        this.isOpen = true;
        this.render(task);
        document.body.style.overflow = 'hidden';
    },

    /**
     * Close Focus Mode
     */
    close() {
        this.isOpen = false;
        this.activeTaskId = null;

        // Stop the pomodoro timer
        this.stopTimer();

        // Remove the keyboard listener to prevent leaks
        if (this.activeKeyHandler) {
            document.removeEventListener('keydown', this.activeKeyHandler);
            this.activeKeyHandler = null;
        }

        const container = document.getElementById('focusModeContainer');
        container.innerHTML = '';
        document.body.style.overflow = '';
    },

    /**
     * Render the focus overlay
     */
    render(task) {
        const container = document.getElementById('focusModeContainer');
        const color = Departments.getColor(task.hierarchy);

        // Reset timer state when opening
        this.pomodoroSeconds = this.workDuration;
        this.pomodoroRunning = false;
        this.pomodoroMode = 'work';

        container.innerHTML = `
            <div class="focus-overlay" id="focusOverlay">
                <div class="focus-card" style="--task-color: ${color}">
                    <button class="focus-close" id="closeFocus">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M18 6L6 18M6 6l12 12"/>
                        </svg>
                    </button>
                    
                    <div class="focus-header">
                        <span class="focus-title">${PlannerService.escapeHtml(task.title)}</span>
                        <h1 class="focus-goal">Break this task into steps</h1>
                    </div>

                    <!-- Pomodoro Timer Section -->
                    <div class="pomodoro-section">
                        <div class="pomodoro-timer-container">
                            <div class="pomodoro-ring">
                                <svg viewBox="0 0 120 120">
                                    <circle class="pomodoro-ring-bg" cx="60" cy="60" r="52"/>
                                    <circle class="pomodoro-ring-fill" id="pomodoroRing" cx="60" cy="60" r="52"/>
                                </svg>
                                <div class="pomodoro-time" id="pomodoroTime">${this.formatTime(this.pomodoroSeconds)}</div>
                            </div>
                            <div class="pomodoro-mode" id="pomodoroModeLabel">🎯 Focus Mode</div>
                        </div>
                        <div class="pomodoro-controls">
                            <button class="pomodoro-btn" id="pomodoroStartPause" title="Start/Pause">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                    <polygon points="5,3 19,12 5,21"/>
                                </svg>
                            </button>
                            <button class="pomodoro-btn pomodoro-reset" id="pomodoroReset" title="Reset">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                                    <path d="M3 3v5h5"/>
                                </svg>
                            </button>
                        </div>
                    </div>

                    <div class="focus-section">
                        <ul class="focus-checklist">
                            ${this.renderChecklist(task.notes || '')}
                        </ul>
                        <div class="add-minitask-container">
                            <button class="add-minitask-btn" id="addMiniTaskBtn">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M12 5v14M5 12h14"/>
                                </svg>
                                Add Step ${this.getStepCount(task.notes) + 1}
                            </button>
                            <div class="add-minitask-input-wrap" id="addMiniTaskInput" style="display: none;">
                                <input type="text" class="add-minitask-input" id="miniTaskInput" placeholder="What needs to be done?">
                                <button class="add-minitask-confirm" id="confirmMiniTask">Add</button>
                            </div>
                        </div>
                    </div>

                    <div class="focus-footer">
                        <button class="btn btn-primary focus-complete-btn" id="focusDoneBtn">
                            ${task.completed ? 'Re-open Task' : 'Mark as Complete'}
                        </button>
                    </div>
                </div>
            </div>
        `;

        this.setupListeners();
        this.updateTimerDisplay();
    },

    /**
     * Update only the checklist without re-rendering the entire modal
     */
    updateChecklist() {
        const task = Store.getTask(this.activeTaskId);
        if (!task) return;

        const checklist = document.querySelector('.focus-checklist');
        if (!checklist) return;

        checklist.innerHTML = this.renderChecklist(task.notes || '');

        // Re-attach checklist item listeners
        const checklistItems = document.querySelectorAll('.checklist-item');
        const deleteButtons = document.querySelectorAll('.delete-minitask');

        checklistItems.forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.closest('.delete-minitask')) return;
                const index = parseInt(item.dataset.index);
                this.toggleMiniTask(index);
            });
        });

        deleteButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(btn.dataset.index);
                this.deleteMiniTask(index);
            });
        });

        // Reset the add mini-task UI and update button text
        const addBtn = document.getElementById('addMiniTaskBtn');
        const addInput = document.getElementById('addMiniTaskInput');
        const miniTaskInput = document.getElementById('miniTaskInput');

        if (addBtn && addInput && miniTaskInput) {
            addBtn.style.display = 'flex';
            addInput.style.display = 'none';
            miniTaskInput.value = '';
            // Update button text to show next step number
            const stepCount = this.getStepCount(task.notes);
            addBtn.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 5v14M5 12h14"/>
                </svg>
                Add Step ${stepCount + 1}
            `;
        }
    },

    /**
     * Parse notes into an interactive checklist
     */
    renderChecklist(notes) {
        if (!notes) return '<li class="checklist-empty">No mini-tasks yet. Add one below!</li>';

        const lines = notes.split('\n').filter(l => l.trim() !== '');
        if (lines.length === 0) return '<li class="checklist-empty">No mini-tasks yet. Add one below!</li>';

        return lines.map((line, index) => {
            const isCompleted = line.includes('[x]');
            const cleanText = line.replace(/\[[ x]\]\s*/, '').trim();

            return `
                <li class="checklist-item ${isCompleted ? 'done' : ''}" data-index="${index}">
                    <div class="checkbox ${isCompleted ? 'checked' : ''}">
                        ${isCompleted ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 13l4 4L19 7"/></svg>' : ''}
                    </div>
                    <span class="step-text">${PlannerService.escapeHtml(cleanText)}</span>
                    <button class="delete-minitask" data-index="${index}" title="Delete">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M18 6L6 18M6 6l12 12"/>
                        </svg>
                    </button>
                </li>
            `;
        }).join('');
    },

    /**
     * Setup event listeners
     */
    setupListeners() {
        const overlay = document.getElementById('focusOverlay');
        const closeBtn = document.getElementById('closeFocus');
        const doneBtn = document.getElementById('focusDoneBtn');
        const checklistItems = document.querySelectorAll('.checklist-item');
        const addBtn = document.getElementById('addMiniTaskBtn');
        const addInput = document.getElementById('addMiniTaskInput');
        const miniTaskInput = document.getElementById('miniTaskInput');
        const confirmBtn = document.getElementById('confirmMiniTask');
        const deleteButtons = document.querySelectorAll('.delete-minitask');

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) this.close();
        });

        closeBtn.addEventListener('click', () => this.close());

        doneBtn.addEventListener('click', () => {
            const task = Store.getTask(this.activeTaskId);
            const wasCompleted = task && task.completed;

            Store.toggleCompleteForWeek(this.activeTaskId);

            // Check for daily celebration if we just completed the task
            if (!wasCompleted && task && window.Calendar) {
                window.Calendar.checkDailyCelebration(task.scheduledDay);
            }

            if (window.Calendar) window.Calendar.refresh();
            if (window.TaskQueue) window.TaskQueue.refresh();
            this.close();
        });

        // Pomodoro Timer Controls
        const startPauseBtn = document.getElementById('pomodoroStartPause');
        const resetBtn = document.getElementById('pomodoroReset');

        if (startPauseBtn) {
            startPauseBtn.addEventListener('click', () => this.startPauseTimer());
        }
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.resetTimer());
        }

        checklistItems.forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.closest('.delete-minitask')) return;
                const index = parseInt(item.dataset.index);
                this.toggleMiniTask(index);
            });
        });

        // Add Mini-Task button
        addBtn.addEventListener('click', () => {
            addBtn.style.display = 'none';
            addInput.style.display = 'flex';
            miniTaskInput.focus();
        });

        // Confirm add
        confirmBtn.addEventListener('click', () => {
            this.addMiniTask(miniTaskInput.value);
        });

        // Enter to add, ESC to cancel
        miniTaskInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.addMiniTask(miniTaskInput.value);
            } else if (e.key === 'Escape') {
                e.stopPropagation();
                addBtn.style.display = 'flex';
                addInput.style.display = 'none';
                miniTaskInput.value = '';
            }
        });

        // Delete mini-task
        deleteButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(btn.dataset.index);
                this.deleteMiniTask(index);
            });
        });

        // ESC or F to close
        // Remove any existing listener first to prevent duplicates
        if (this.activeKeyHandler) {
            document.removeEventListener('keydown', this.activeKeyHandler);
        }

        this.activeKeyHandler = (e) => {
            if (e.key === 'Escape' || e.key.toLowerCase() === 'f') {
                // Don't close if typing in an input
                if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
                this.close();
            }
        };
        document.addEventListener('keydown', this.activeKeyHandler);
    },

    /**
     * Add a new mini-task
     */
    addMiniTask(text) {
        if (!text.trim()) return;

        const task = Store.getTask(this.activeTaskId);
        const notes = task.notes || '';
        const newLine = `[ ] ${text.trim()}`;
        const updatedNotes = notes ? `${notes}\n${newLine}` : newLine;

        Store.updateTaskNotesForWeek(this.activeTaskId, updatedNotes);
        this.updateChecklist();
        if (window.Calendar) window.Calendar.refresh();
    },

    /**
     * Delete a mini-task
     */
    deleteMiniTask(index) {
        const task = Store.getTask(this.activeTaskId);
        const lines = task.notes.split('\n');
        lines.splice(index, 1);

        Store.updateTaskNotesForWeek(this.activeTaskId, lines.join('\n'));
        this.updateChecklist();
        if (window.Calendar) window.Calendar.refresh();
    },

    /**
     * Toggle a mini-task in notes
     */
    toggleMiniTask(index) {
        const task = Store.getTask(this.activeTaskId);
        const lines = task.notes.split('\n');
        const line = lines[index];

        if (line.includes('[x]')) {
            lines[index] = line.replace('[x]', '[ ]');
        } else if (line.includes('[ ]')) {
            lines[index] = line.replace('[ ]', '[x]');
        } else {
            lines[index] = `[x] ${line}`;
        }

        Store.updateTaskNotesForWeek(this.activeTaskId, lines.join('\n'));
        this.updateChecklist();
        if (window.Calendar) window.Calendar.refresh();
    },

    // =========================================
    // POMODORO TIMER METHODS
    // =========================================

    /**
     * Format seconds to MM:SS
     */
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    },

    /**
     * Update timer display
     */
    updateTimerDisplay() {
        const timeEl = document.getElementById('pomodoroTime');
        const ringEl = document.getElementById('pomodoroRing');
        const modeEl = document.getElementById('pomodoroModeLabel');

        if (!timeEl || !ringEl) return;

        timeEl.textContent = this.formatTime(this.pomodoroSeconds);

        // Update ring progress (circumference = 2 * PI * 52 ≈ 327)
        const circumference = 327;
        const totalSeconds = this.pomodoroMode === 'work' ? this.workDuration : this.breakDuration;
        const progress = this.pomodoroSeconds / totalSeconds;
        const offset = circumference * (1 - progress);
        ringEl.style.strokeDasharray = circumference;
        ringEl.style.strokeDashoffset = offset;

        // Update mode label and color
        if (this.pomodoroMode === 'work') {
            modeEl.textContent = '🎯 Focus Mode';
            ringEl.style.stroke = '#3b82f6';
        } else {
            modeEl.textContent = '☕ Break Time';
            ringEl.style.stroke = '#10b981';
        }
    },

    /**
     * Start/Pause timer
     */
    startPauseTimer() {
        const btn = document.getElementById('pomodoroStartPause');

        if (this.pomodoroRunning) {
            // Pause
            clearInterval(this.pomodoroTimer);
            this.pomodoroRunning = false;
            btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5,3 19,12 5,21"/>
            </svg>`;
        } else {
            // Start
            this.pomodoroRunning = true;
            btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <rect x="5" y="4" width="4" height="16"/>
                <rect x="15" y="4" width="4" height="16"/>
            </svg>`;

            this.pomodoroTimer = setInterval(() => {
                if (this.pomodoroSeconds > 0) {
                    this.pomodoroSeconds--;
                    this.updateTimerDisplay();
                } else {
                    // Timer complete - switch mode
                    this.switchMode();
                }
            }, 1000);
        }
    },

    /**
     * Reset timer
     */
    resetTimer() {
        clearInterval(this.pomodoroTimer);
        this.pomodoroRunning = false;
        this.pomodoroMode = 'work';
        this.pomodoroSeconds = this.workDuration;

        const btn = document.getElementById('pomodoroStartPause');
        if (btn) {
            btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5,3 19,12 5,21"/>
            </svg>`;
        }

        this.updateTimerDisplay();
    },

    /**
     * Switch between work and break mode
     */
    switchMode() {
        clearInterval(this.pomodoroTimer);
        this.pomodoroRunning = false;

        if (this.pomodoroMode === 'work') {
            this.pomodoroMode = 'break';
            this.pomodoroSeconds = this.breakDuration;
            // Play notification sound or show notification
            if (Notification.permission === 'granted') {
                new Notification('🎉 Focus session complete!', { body: 'Time for a break.' });
            }
        } else {
            this.pomodoroMode = 'work';
            this.pomodoroSeconds = this.workDuration;
            if (Notification.permission === 'granted') {
                new Notification('💪 Break over!', { body: 'Ready to focus again?' });
            }
        }

        const btn = document.getElementById('pomodoroStartPause');
        if (btn) {
            btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5,3 19,12 5,21"/>
            </svg>`;
        }

        this.updateTimerDisplay();
    },

    /**
     * Stop timer when closing modal
     */
    stopTimer() {
        if (this.pomodoroTimer) {
            clearInterval(this.pomodoroTimer);
            this.pomodoroTimer = null;
        }
        this.pomodoroRunning = false;
    },

};

window.FocusMode = FocusMode;
