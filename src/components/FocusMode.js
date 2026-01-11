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
    pomodoroTargetEpoch: null,
    pipWindow: null,
    badgeEl: null,

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
        if (this.pomodoroRunning) {
            this.openFloatingTimer();
        } else {
            this.stopTimer();
        }

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

        this.restoreTimerState();

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
                            <button class="pomodoro-btn" id="pomodoroFloat" title="Float Timer">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M4 4h10v10H4z"/>
                                    <path d="M14 10h6v10h-6z"/>
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
            if (!task) return;

            const wasCompleted = task.completed;
            const scheduledDay = task.scheduledDay;

            const updatedTask = Store.toggleCompleteForWeek(this.activeTaskId);

            // Trigger individual task celebration
            if (!wasCompleted && updatedTask && updatedTask.completed && window.Confetti) {
                const width = window.innerWidth;
                const height = window.innerHeight;
                window.Confetti.burst(width / 2, height / 2, 60);
            }

            // Check for daily celebration if we just completed the task
            if (!wasCompleted && updatedTask && updatedTask.completed && window.Calendar) {
                window.Calendar.checkDailyCelebration(scheduledDay);
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
        const floatBtn = document.getElementById('pomodoroFloat');
        if (floatBtn) {
            floatBtn.addEventListener('click', () => this.openFloatingTimer());
        }

        // Request notification permission if not yet decided
        if (Notification.permission === 'default') {
            Notification.requestPermission();
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
            } else if (e.key === ' ' || e.code === 'Space') {
                // Space to start/pause timer
                if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
                e.preventDefault();
                this.startPauseTimer();
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
            this.pomodoroTargetEpoch = null;
            this.persistTimerState();
            this.updateFloatingTimer();
        } else {
            // Start
            this.pomodoroRunning = true;
            btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <rect x="5" y="4" width="4" height="16"/>
                <rect x="15" y="4" width="4" height="16"/>
            </svg>`;
            this.pomodoroTargetEpoch = Date.now() + this.pomodoroSeconds * 1000;
            this.pomodoroTimer = setInterval(() => {
                const remaining = Math.max(0, Math.round((this.pomodoroTargetEpoch - Date.now()) / 1000));
                this.pomodoroSeconds = remaining;
                this.updateTimerDisplay();
                this.updateFloatingTimer();
                if (remaining <= 0) {
                    this.switchMode();
                }
                this.updateAppBadge();
            }, 1000);
            this.persistTimerState();
            this.updateFloatingTimer();
            this.updateAppBadge();
        }
    },

    /**
     * Update the App Badge (dock/taskbar icon) with remaining minutes
     */
    updateAppBadge() {
        if ('setAppBadge' in navigator) {
            if (this.pomodoroRunning && this.pomodoroSeconds > 0) {
                const mins = Math.ceil(this.pomodoroSeconds / 60);
                navigator.setAppBadge(mins).catch(() => { });
            } else {
                navigator.clearAppBadge().catch(() => { });
            }
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
        this.pomodoroTargetEpoch = null;

        const btn = document.getElementById('pomodoroStartPause');
        if (btn) {
            btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5,3 19,12 5,21"/>
            </svg>`;
        }

        this.updateTimerDisplay();
        this.persistTimerState();
        this.updateFloatingTimer();
        this.updateAppBadge();
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
            this.playTransitionSound();
            // Play notification sound or show notification
            if (Notification.permission === 'granted') {
                new Notification('🎉 Focus session complete!', {
                    body: 'Time for a break. Excellent work!',
                    icon: './icon.png'
                });
            }
        } else {
            this.pomodoroMode = 'work';
            this.pomodoroSeconds = this.workDuration;
            this.playTransitionSound();
            if (Notification.permission === 'granted') {
                new Notification('💪 Break over!', {
                    body: 'Ready to focus again? Your timer is reset.',
                    icon: './icon.png'
                });
            }
        }
        this.updateAppBadge();

        const btn = document.getElementById('pomodoroStartPause');
        if (btn) {
            btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5,3 19,12 5,21"/>
            </svg>`;
        }

        this.updateTimerDisplay();
        this.pomodoroTargetEpoch = null;
        this.persistTimerState();
        this.updateFloatingTimer();
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
        this.pomodoroTargetEpoch = null;
        this.persistTimerState();
        this.updateFloatingTimer();
    },

    persistTimerState() {
        const state = {
            mode: this.pomodoroMode,
            running: this.pomodoroRunning,
            remaining: this.pomodoroSeconds,
            targetEpoch: this.pomodoroTargetEpoch,
            work: this.workDuration,
            break: this.breakDuration,
            updatedAt: Date.now()
        };
        try {
            localStorage.setItem('focusModeTimerState', JSON.stringify(state));
        } catch { }
    },

    restoreTimerState() {
        let state = null;
        try {
            state = JSON.parse(localStorage.getItem('focusModeTimerState') || 'null');
        } catch { }
        if (!state) {
            this.pomodoroMode = 'work';
            this.pomodoroSeconds = this.workDuration;
            this.pomodoroRunning = false;
            this.pomodoroTargetEpoch = null;
            return;
        }
        this.workDuration = state.work || this.workDuration;
        this.breakDuration = state.break || this.breakDuration;
        this.pomodoroMode = state.mode || 'work';
        if (state.targetEpoch && state.running) {
            const remaining = Math.max(0, Math.round((state.targetEpoch - Date.now()) / 1000));
            this.pomodoroSeconds = remaining;
            this.pomodoroRunning = remaining > 0;
            this.pomodoroTargetEpoch = state.targetEpoch;
            if (this.pomodoroRunning && !this.pomodoroTimer) {
                this.pomodoroTimer = setInterval(() => {
                    const r = Math.max(0, Math.round((this.pomodoroTargetEpoch - Date.now()) / 1000));
                    this.pomodoroSeconds = r;
                    this.updateTimerDisplay();
                    this.updateFloatingTimer();
                    if (r <= 0) {
                        this.switchMode();
                    }
                }, 1000);
            }
        } else {
            this.pomodoroSeconds = state.remaining || (this.pomodoroMode === 'work' ? this.workDuration : this.breakDuration);
            this.pomodoroRunning = false;
            this.pomodoroTargetEpoch = null;
        }
    },

    async openFloatingTimer() {
        const api = document.documentPictureInPicture;
        if (this.pipWindow) return;
        try {
            if (!api) throw new Error('pip');
            const pip = await api.requestWindow({ initialWidth: 220, initialHeight: 160 });
            this.pipWindow = pip;
            const doc = pip.document;
            doc.body.style.margin = '0';
            doc.body.style.fontFamily = 'system-ui, -apple-system, Segoe UI, Roboto, Arial';
            doc.body.innerHTML = `
                <div id="pipRoot" style="display:flex;flex-direction:column;align-items:center;gap:8px;padding:12px;background:#111;color:#fff;height:100%;box-sizing:border-box;">
                    <div id="pipMode" style="font-size:12px;font-weight:600;opacity:0.8"></div>
                    <div id="pipTime" style="font-size:32px;font-weight:700;letter-spacing:-1px"></div>
                    <div style="display:flex;gap:8px;">
                        <button id="pipStartPause" style="padding:6px 10px;border:none;border-radius:8px;background:#2563eb;color:#fff">Start</button>
                        <button id="pipReset" style="padding:6px 10px;border:1px solid #333;border-radius:8px;background:#222;color:#ddd">Reset</button>
                    </div>
                </div>`;
            pip.startPause = () => this.startPauseTimer();
            pip.resetTimer = () => this.resetTimer();
            doc.getElementById('pipStartPause').addEventListener('click', () => pip.startPause());
            doc.getElementById('pipReset').addEventListener('click', () => pip.resetTimer());
            pip.addEventListener('pagehide', () => { this.pipWindow = null; });
            this.updateFloatingTimer();
            this.hideBadge();
        } catch {
            this.showBadge();
        }
    },

    updateFloatingTimer() {
        const pip = this.pipWindow;
        if (pip) {
            const doc = pip.document;
            const timeEl = doc.getElementById('pipTime');
            const modeEl = doc.getElementById('pipMode');
            const startPauseEl = doc.getElementById('pipStartPause');
            if (timeEl && modeEl && startPauseEl) {
                timeEl.textContent = this.formatTime(this.pomodoroSeconds);
                modeEl.textContent = this.pomodoroMode === 'work' ? 'Focus' : 'Break';
                startPauseEl.textContent = this.pomodoroRunning ? 'Pause' : 'Start';
            }
        }
        this.updateBadge();
    },

    closeFloatingTimer() {
        if (this.pipWindow) {
            try { this.pipWindow.close(); } catch { }
            this.pipWindow = null;
        }
    },

    showBadge() {
        if (this.badgeEl) return;
        const el = document.createElement('div');
        el.id = 'floatingPomodoroBadge';
        el.style.position = 'fixed';
        el.style.zIndex = '9999';
        el.style.background = '#111';
        el.style.color = '#fff';
        el.style.border = '1px solid #333';
        el.style.borderRadius = '12px';
        el.style.boxShadow = '0 6px 20px rgba(0,0,0,0.4)';
        el.style.padding = '10px 12px';
        el.style.display = 'flex';
        el.style.alignItems = 'center';
        el.style.gap = '10px';
        el.innerHTML = `
            <span id="badgeMode" style="font-size:12px;opacity:0.8"></span>
            <span id="badgeTime" style="font-size:18px;font-weight:700;letter-spacing:-0.5px"></span>
            <button id="badgeStartPause" style="padding:6px 10px;border:none;border-radius:8px;background:#2563eb;color:#fff;font-size:12px">Start</button>
            <button id="badgeReset" style="padding:6px 10px;border:1px solid #333;border-radius:8px;background:#222;color:#ddd;font-size:12px">Reset</button>
        `;
        document.body.appendChild(el);
        this.badgeEl = el;
        const savedPos = (() => { try { return JSON.parse(localStorage.getItem('floatingPomodoroBadgePos') || 'null'); } catch { return null; } })();
        if (savedPos && typeof savedPos.left === 'number' && typeof savedPos.top === 'number') {
            el.style.left = `${savedPos.left}px`;
            el.style.top = `${savedPos.top}px`;
        } else {
            const defaultLeft = Math.max(0, window.innerWidth - el.offsetWidth - 16);
            const defaultTop = Math.max(0, window.innerHeight - el.offsetHeight - 16);
            el.style.left = `${defaultLeft}px`;
            el.style.top = `${defaultTop}px`;
        }
        el.querySelector('#badgeStartPause').addEventListener('click', () => this.startPauseTimer());
        el.querySelector('#badgeReset').addEventListener('click', () => this.resetTimer());
        let dragging = false;
        let startX = 0, startY = 0, startLeft = 0, startTop = 0;
        const onMouseMove = (e) => {
            if (!dragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            const newLeft = Math.min(Math.max(0, startLeft + dx), window.innerWidth - el.offsetWidth);
            const newTop = Math.min(Math.max(0, startTop + dy), window.innerHeight - el.offsetHeight);
            el.style.left = `${newLeft}px`;
            el.style.top = `${newTop}px`;
        };
        const endDrag = () => {
            if (!dragging) return;
            dragging = false;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', endDrag);
            try {
                const rect = el.getBoundingClientRect();
                localStorage.setItem('floatingPomodoroBadgePos', JSON.stringify({ left: rect.left, top: rect.top }));
            } catch { }
        };
        el.addEventListener('mousedown', (e) => {
            if (e.target && e.target.tagName === 'BUTTON') return;
            dragging = true;
            startX = e.clientX;
            startY = e.clientY;
            const rect = el.getBoundingClientRect();
            startLeft = rect.left;
            startTop = rect.top;
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', endDrag);
        });
        this.updateBadge();
    },

    updateBadge() {
        if (!this.badgeEl) return;
        const timeEl = this.badgeEl.querySelector('#badgeTime');
        const modeEl = this.badgeEl.querySelector('#badgeMode');
        const spEl = this.badgeEl.querySelector('#badgeStartPause');
        if (!timeEl || !modeEl || !spEl) return;
        timeEl.textContent = this.formatTime(this.pomodoroSeconds);
        modeEl.textContent = this.pomodoroMode === 'work' ? 'Focus' : 'Break';
        spEl.textContent = this.pomodoroRunning ? 'Pause' : 'Start';
        if (!this.pomodoroRunning && this.pomodoroSeconds <= 0) {
            this.hideBadge();
        }
    },

    hideBadge() {
        if (this.badgeEl) {
            try { this.badgeEl.remove(); } catch { }
            this.badgeEl = null;
        }
    },

    /**
     * Play a gentle chime for session transitions
     */
    playTransitionSound() {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;

            const ctx = new AudioCtx();
            const masterGain = ctx.createGain();
            masterGain.connect(ctx.destination);
            masterGain.gain.setValueAtTime(0.3, ctx.currentTime);

            // Gentle Sine Wave Chime
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(masterGain);

            osc.type = 'sine';
            const freq = this.pomodoroMode === 'break' ? 880 : 1320; // A5 for break, E6 for work
            osc.frequency.setValueAtTime(freq, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(freq * 0.8, ctx.currentTime + 0.5);

            gain.gain.setValueAtTime(0, ctx.currentTime);
            gain.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);

            osc.start();
            osc.stop(ctx.currentTime + 1);
        } catch (e) { }
    },

};

window.FocusMode = FocusMode;
