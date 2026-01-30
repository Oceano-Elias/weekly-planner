/**
 * FocusMode Component - Manages the high-intensity execution modal
 */

import { Store } from '../store.js';
import { FocusAudio } from '../utils/FocusAudio.js';
import { FocusModeUI } from './FocusModeUI.js';
import { DOMUtils } from '../utils/DOMUtils.js';
import { Toast } from './Toast.js';
import { Rewards } from '../services/Rewards.js';
import { TimerService } from '../services/TimerService.js';
import { QuestStackController } from '../services/QuestStackController.js';

export const FocusMode = {
    isOpen: false,
    activeTaskId: null,
    activeKeyHandler: null,
    sessionInterval: null,
    resizeHandler: null,
    positionRaf: null,
    storeUnsubscribe: null,

    // Core session settings
    sessionDuration: 25 * 60, // 25 minutes default
    breakDuration: 5 * 60, // 5 minutes break
    closureThreshold: 5 * 60, // 5 minutes before end

    pipWindow: null,

    get pomodoroRunning() {
        return TimerService.pomodoroRunning;
    },

    get pomodoroSeconds() {
        return TimerService.pomodoroSeconds;
    },

    get pomodoroMode() {
        return TimerService.pomodoroMode;
    },

    get workDuration() {
        return TimerService.workDuration;
    },

    get breakDuration() {
        return TimerService.breakDuration;
    },

    open(taskId) {
        const task = Store.getTask(taskId);
        if (!task) return;

        this.activeTaskId = taskId;
        this.isOpen = true;
        this.closeFloatingTimer();
        this.hideBadge();

        // 1. Initialize Modular Services
        TimerService.init({
            onModeSwitch: () => this.updateUI(),
            updateFloatingTimer: () => this.updateFloatingTimer()
        });

        QuestStackController.init(taskId, {
            onNavigate: () => this.updateUI(),
            showSuccessVisuals: () => this.showSuccessVisuals(),
            startStepTimer: (idx, steps) => this.startStepTimer(idx, steps)
        });

        // 2. Initialize Task Execution state in Store
        this.initializeTaskExecution(task);

        this.render(task);
        FocusModeUI.setPageOverflow(true);

        // [Reactive Store] Subscribe to updates
        this.storeUnsubscribe = Store.subscribe(() => {
            if (this.isOpen && this.activeTaskId) {
                const updatedTask = Store.getTask(this.activeTaskId);
                if (updatedTask) {
                    this.updateUI();
                }
            }
        });
    },

    /**
     * Restore timer state from storage (called on App init)
     */
    async restoreTimerState() {
        const state = Store.getActiveExecution();
        this.activeTaskId = state.taskId || this.activeTaskId;

        TimerService.init({
            onModeSwitch: () => this.updateUI(),
            updateFloatingTimer: () => this.updateFloatingTimer()
        });

        await this.setupListeners();

        if (this.activeTaskId) {
            QuestStackController.init(this.activeTaskId);
        }
    },

    /**
     * Initialize task-specific execution state in Store
     */
    initializeTaskExecution(task) {
        const state = Store.getActiveExecution();

        // 1. Restore per-task persistence if it exists
        if (task.sessionResult) {
            Store.updateActiveExecution({
                ...task.sessionResult,
                taskId: this.activeTaskId,
                running: false,
            });
            return;
        }

        // 2. Avoid reset if we are already in session for this task
        if (state.taskId === this.activeTaskId) return;

        // 3. Reset to orientation/completed based on task status
        Store.updateActiveExecution({
            taskId: this.activeTaskId,
            running: false,
            phase: task.completed ? 'completed' : 'orientation',
            mode: 'work',
            sessionStartTime: null,
            accumulatedTime: 0,
            breakStartTime: null,
            returnAnchor: task.returnAnchor || '',
            currentStepIndex: (() => {
                const lines = (task.notes || '').split('\n').filter((l) => l.trim() !== '');
                const idx = lines.findIndex((l) => l.includes('[ ]'));
                return idx === -1 && lines.length > 0 ? 0 : idx;
            })(),
            stepTimings: [],
            pauseCount: 0,
            sessionStats: {
                startedAt: null,
                completedAt: null,
                totalFocusTime: 0,
                totalBreakTime: 0,
                pomodorosUsed: 0,
            },
        });
    },

    /**
     * Close Focus Mode
     */
    close() {
        this.isOpen = false;

        const state = Store.getActiveExecution();
        // Check if session is "active" (accumulation > 0 or in break, even if paused)
        const isActive = state.running || state.mode === 'break' || (state.mode === 'work' && state.accumulatedTime > 0) || this.pomodoroRunning;

        // Default to PiP enabled (disablePip = false) since settings are not implemented yet
        const disablePip = false;

        if (!isActive && state.phase !== 'completed') {
            this.stopSession(true);
            this.activeTaskId = null;
        } else if ((isActive || this.pomodoroRunning) && !disablePip) {
            // Keep running in background/floating mode
            this.openFloatingTimer();
        }


        // Remove the keyboard listener
        if (this.activeKeyHandler) {
            document.removeEventListener('keydown', this.activeKeyHandler);
            this.activeKeyHandler = null;
        }
        if (this.storeUnsubscribe) {
            this.storeUnsubscribe();
            this.storeUnsubscribe = null;
        }
        if (this.resizeHandler) {
            window.removeEventListener('resize', this.resizeHandler);
            this.resizeHandler = null;
        }

        FocusModeUI.clearContainer();
        FocusModeUI.setPageOverflow(false);

        if (window.Calendar) window.Calendar.renderScheduledTasks();
        if (window.TaskQueue) window.TaskQueue.refresh();
    },

    /**
     * Render the focus overlay
     */
    render(task) {
        const container = document.getElementById('focusModeContainer');
        const state = Store.getActiveExecution();
        const isBreak = state.mode === 'break';
        const activeStepTitle = FocusModeUI.getActiveStepTitle(task, state.currentStepIndex, isBreak);

        DOMUtils.clear(container);
        container.appendChild(FocusModeUI.getMainTemplate(task, state, activeStepTitle));

        this.setupListeners();
        this.attachCarouselControls();
        this.updateUI();
        this.schedulePositionCarouselCompleteButton();
        requestAnimationFrame(() => {
            FocusModeUI.removeCarouselInitialTransition();
            this.schedulePositionCarouselCompleteButton();
        });
        if (state.phase === 'completion' && state.celebrateOnNextRender) {
            Store.updateActiveExecution({ celebrateOnNextRender: false });
            requestAnimationFrame(() => {
                FocusModeUI.celebrateVisuals();
                this.spawnConfetti();
            });
        }
    },

    /**
     * Update all UI elements
     */
    updateUI() {
        const state = Store.getActiveExecution();
        const task = Store.getTask(this.activeTaskId);
        if (!task) return;

        FocusModeUI.updateRings(state, task, this.sessionDuration);
        FocusModeUI.updateTimeDisplay(state, this.sessionDuration, this.breakDuration);
        FocusModeUI.updateCarouselNavState(state, task);
        FocusModeUI.updateToggleButton(state, () => this.stopSession());
        FocusModeUI.updateSoundToggleButton();
        FocusModeUI.updateTimerVisualState(state);

        // Show Pomodoro counter
        FocusModeUI.updatePomodoroCounter(
            TimerService.completedPomodoros,
            TimerService.pomodorosBeforeLongBreak,
            TimerService.totalPomodorosToday
        );

        // Update Pomodoro Clock display
        TimerService.updateDisplay();
    },

    schedulePositionCarouselCompleteButton() {
        if (this.positionRaf) {
            cancelAnimationFrame(this.positionRaf);
        }
        this.positionRaf = requestAnimationFrame(() => {
            this.positionRaf = null;
            FocusModeUI.positionCarouselElements();
        });
    },

    /**
     * Update quest stack UI
     */
    updateQuestStack() {
        const task = Store.getTask(this.activeTaskId);
        const state = Store.getActiveExecution();
        if (!task) return;

        const onCardClick = (idx) => {
            if (state.phase === 'execution') return;
            Store.updateActiveExecution({ currentStepIndex: idx });
            this.lastDoneStepIndex = null;
            this.updateQuestStack();
        };

        const stackContainer = FocusModeUI.updateQuestStack(
            task,
            state.currentStepIndex,
            onCardClick
        );
        if (!stackContainer) return;

        this.attachCarouselControls();
        this.schedulePositionCarouselCompleteButton();
    },

    animateCarouselRoll(toIndex, { markComplete }) {
        QuestStackController.animateCarouselRoll(toIndex, { markComplete });
    },

    /**
     * Start timing a step
     */
    startStepTimer(index, steps) {
        QuestStackController.startStepTimer(index, steps);
    },

    /**
     * Record step completion or skip
     */
    recordStepCompletion(index, status = 'completed') {
        QuestStackController.recordStepCompletion(index, status);
    },

    animateCarouselRollReverse(toIndex) {
        QuestStackController.animateCarouselRollReverse(toIndex);
    },

    /**
     * Setup event listeners
     */
    async setupListeners() {
        // 1. Clean up existing listeners to prevent duplicates
        if (this.pipUnlisten) {
            try {
                this.pipUnlisten();
                this.pipUnlisten = null;
            } catch (e) {
                console.warn('Failed to unlisten pip-action', e);
            }
        }

        // 2. Listen for Tauri PiP Actions
        if (window.__TAURI__) {
            try {
                // event.listen returns a Promise that resolves to the unlisten function
                this.pipUnlisten = await window.__TAURI__.event.listen('pip-action', (event) => {
                    try {
                        const action = event?.payload?.action;
                        if (!action) return;


                        // Use specific methods for each action to ensure clean state
                        if (action === 'toggle') {
                            if (this.activeTaskId) {
                                this.toggleSession();
                            } else {
                                this.startPauseTimer();
                            }
                        }
                        if (action === 'reset') {
                            this.resetTimer();
                        }
                        if (action === 'request-state') {
                            this.updateFloatingTimer();
                        }
                    } catch (err) {
                        console.error('[FocusMode] Error handling pip-action:', err);
                    }
                });
            } catch (e) {
                console.error('Failed to setup Tauri event listeners', e);
            }
        }

        // Legacy/Browser Storage Listener
        window.addEventListener('storage', (e) => {
            if (e.key === 'focusModeCommand' && e.newValue) {
                try {
                    const cmd = JSON.parse(e.newValue);
                    if (Date.now() - cmd.ts < 2000) { // Only process recent commands
                        if (cmd.action === 'start') this.startSession();
                        if (cmd.action === 'pause') this.pauseSession();
                        if (cmd.action === 'reset') this.resetTimer();
                        this.updateUI();
                    }
                } catch (err) {
                    console.error('Invalid command', err);
                }
            }
        });

        const els = FocusModeUI.getListenerElements();

        els.overlay?.addEventListener('click', (e) => {
            if (e.target === els.overlay) {
                this.close();
            }
        });

        if (els.closeBtn) {
            els.closeBtn.addEventListener('click', () => {
                this.close();
            });
        }

        els.sessionToggleBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            const state = Store.getActiveExecution();
            if (state.running) {
                this.pauseSession();
            } else {
                this.startSession();
            }
            this.updateUI();
        });

        els.stopSessionBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.stopSession();
            this.updateUI();
        });

        els.decisionComplete?.addEventListener('click', () => this.handleDecision('complete'));
        els.decisionContinue?.addEventListener('click', () => this.handleDecision('continue'));
        els.decisionBreak?.addEventListener('click', () => this.handleDecision('break'));
        els.decisionStop?.addEventListener('click', () => this.handleDecision('stop'));

        els.soundToggle?.addEventListener('click', (e) => {
            e.stopPropagation();
            FocusAudio.toggle();
            this.updateUI();
        });

        // ESC or F to close
        if (this.activeKeyHandler) {
            document.removeEventListener('keydown', this.activeKeyHandler);
        }

        this.activeKeyHandler = (e) => {
            // ONLY handle keys if the Focus Mode modal is actually open
            if (!this.isOpen) return;

            // Skip if typing in an input field
            const activeTag = document.activeElement ? document.activeElement.tagName.toUpperCase() : '';
            if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;

            // Log for debugging

            // Enter: Complete current step
            if (e.key === 'Enter') {
                if (e.metaKey || e.ctrlKey || e.altKey) return;
                this.completeCurrentStep();
                return;
            }

            // Space: Toggle pause/resume
            if (e.key === ' ' || e.code === 'Space') {
                if (e.metaKey || e.ctrlKey || e.altKey) return;
                e.preventDefault(); // Prevent page scroll
                const state = Store.getActiveExecution();
                if (state.running) {
                    this.pauseSession();
                } else {
                    this.startSession();
                }
                this.updateUI();
                return;
            }

            // Arrow Up: Navigate to previous step
            if (e.key === 'ArrowUp') {
                if (e.metaKey || e.ctrlKey || e.altKey) return;
                e.preventDefault();
                this.navigateToPrevVisibleStep();
                return;
            }

            // Arrow Down: Navigate to next step (skip)
            if (e.key === 'ArrowDown') {
                if (e.metaKey || e.ctrlKey || e.altKey) return;
                e.preventDefault();
                this.skipToNextStep();
                return;
            }

            // S: Skip current step
            if (e.key.toLowerCase() === 's') {
                if (e.metaKey || e.ctrlKey || e.altKey) return;
                this.skipToNextStep();
                return;
            }

            // Escape or F: Close Focus Mode - must NOT have modifiers
            const isF = e.key.toLowerCase() === 'f' || e.code === 'KeyF';
            const isEsc = e.key === 'Escape' || e.code === 'Escape';

            if ((isEsc || isF) && !e.metaKey && !e.ctrlKey && !e.altKey) {
                e.preventDefault();
                this.close();
                return;
            }
        };
        document.addEventListener('keydown', this.activeKeyHandler);

        if (this.resizeHandler) {
            window.removeEventListener('resize', this.resizeHandler);
        }
        this.resizeHandler = () => this.schedulePositionCarouselCompleteButton();
        window.addEventListener('resize', this.resizeHandler);
    },

    attachCarouselControls() {
        const stackContainer = document.getElementById('questStack');
        if (!stackContainer) return;

        const navUp = stackContainer.querySelector('#carouselNavUpBtn');
        const navDown = stackContainer.querySelector('#carouselNavDownBtn');
        const completeBtn = stackContainer.querySelector('#carouselCompleteBtn');

        navUp?.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.navigateToPrevVisibleStep();
        });

        navDown?.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.navigateToNextVisibleStep();
        });

        completeBtn?.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.completeCurrentStep();
        });

        stackContainer.querySelector('#restartSessionBtn')?.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            const task = Store.getTask(this.activeTaskId);
            if (!task) return;

            // PERSISTENCE: Clear the saved session result from the task
            Store.updateTask(this.activeTaskId, { sessionResult: null });

            // Reset execution state to start fresh
            Store.updateActiveExecution({
                taskId: this.activeTaskId,
                running: false,
                phase: 'orientation',
                mode: 'work',
                sessionStartTime: null,
                accumulatedTime: 0,
                breakStartTime: null,
                returnAnchor: task.returnAnchor || '',
                currentStepIndex: (() => {
                    const lines = (task.notes || '').split('\n').filter((l) => l.trim() !== '');
                    const idx = lines.findIndex((l) => l.includes('[ ]'));
                    return idx === -1 && lines.length > 0 ? 0 : idx;
                })(),
                stepTimings: [],
                pauseCount: 0,
                sessionStats: {
                    startedAt: null,
                    completedAt: null,
                    totalFocusTime: 0,
                    totalBreakTime: 0,
                    pomodorosUsed: 0,
                },
            });

            this.render(task);
        });
    },

    /**
     * Toggle session state
     */
    toggleSession() {
        const state = Store.getActiveExecution();

        if (state.running) {
            this.stopSession();
        } else {
            this.startSession();
        }
        this.render(Store.getTask(this.activeTaskId));
    },

    /**
     * Start focus session
     */
    startSession() {
        // Cannot start without a step
        const task = Store.getTask(this.activeTaskId);
        const steps = (task.notes || '').split('\n').filter((l) => l.trim() !== '');
        if (steps.length === 0) {
            FocusModeUI.showMissingStepsModal(
                // onClose
                () => {
                    /* Just close modal, do nothing */
                },
                // onEdit - close Focus Mode so they can edit
                () => {
                    const taskId = this.activeTaskId;
                    this.close();
                    window.dispatchEvent(
                        new CustomEvent('edit-task', { detail: { taskId } })
                    );
                }
            );
            return;
        }

        const state = Store.getActiveExecution();
        const now = Date.now();

        // Initialize session stats if this is the first start
        const sessionStats = state.sessionStats || {};
        if (!sessionStats.startedAt) {
            sessionStats.startedAt = now;
        }

        // Start timing current step if not already started
        this.startStepTimer(state.currentStepIndex, steps);

        Store.updateActiveExecution({
            running: true,
            phase: 'execution',
            mode: 'work',
            sessionStartTime: now,
            breakStartTime: null,
            updatedAt: now,
            sessionStats,
        });

        this.startSessionInterval();

        // Zen Gong for deep focus start
        FocusAudio.playZenGong();

        // Update visual states
        this.updateUI();
    },

    /**
     * Stop focus session (Interruption) - with confirmation
     * Uses a two-step process: first call shows confirm, second call actually stops
     */
    stopSession(confirmed = false) {
        if (!confirmed) {
            // Show confirmation overlay
            this.showStopConfirmation();
            return;
        }

        // Actually stop the session
        Store.updateActiveExecution({
            running: false,
            phase: 'orientation',
            sessionStartTime: null,
            accumulatedTime: 0,
            mode: 'work',
            breakStartTime: null,
        });
        clearInterval(this.sessionInterval);
        this.sessionInterval = null;

        // Update visual states
        this.updateUI();
    },

    /**
     * Show stop confirmation overlay
     */
    showStopConfirmation() {
        FocusModeUI.showStopConfirmation(() => this.stopSession(true));
    },

    /**
     * Start/update session interval
     */
    startSessionInterval() {
        if (this.sessionInterval) clearInterval(this.sessionInterval);

        this.sessionInterval = setInterval(() => {
            if (!this.isOpen && !Store.getActiveExecution().running) {
                clearInterval(this.sessionInterval);
                return;
            }
            this.tick();
        }, 1000);
    },

    /**
     * Core logic tick (1s)
     */
    tick() {
        const state = Store.getActiveExecution();
        if (!state.running && state.mode !== 'break') return;

        const now = Date.now();

        if (state.mode === 'work') {
            const currentSessionElapsed = state.sessionStartTime ? now - state.sessionStartTime : 0;
            const totalElapsedMs = (state.accumulatedTime || 0) + currentSessionElapsed;
            const elapsedSeconds = Math.floor(totalElapsedMs / 1000);

            // Check for closure phase
            if (
                elapsedSeconds >= this.sessionDuration - this.closureThreshold &&
                state.phase === 'execution'
            ) {
                Store.updateActiveExecution({ phase: 'closure' });
                FocusAudio.playClosureWarning();
            }

            // Check for session completion -> MOVE TO BREAK
            if (elapsedSeconds >= this.sessionDuration) {
                // Count steps completed before recording
                const task = Store.getTask(this.activeTaskId);
                const lines = (task?.notes || '').split('\n').filter((l) => l.trim() !== '');
                const stepsCompleted = lines.filter((l) => l.includes('[x]')).length;

                // Record the session
                const durationMins = Math.floor(this.sessionDuration / 60);
                const scheduledDurationMins = task?.duration || 60;

                Store.recordFocusSession({
                    taskId: this.activeTaskId,
                    duration: durationMins,
                    scheduledDuration: scheduledDurationMins,
                    stepsCompleted,
                    interruptions: state.pauseCount || 0,
                });

                // Finalize current step timing
                this.recordStepCompletion(state.currentStepIndex);

                // AUTO-TRANSITION TO BREAK
                Store.updateActiveExecution({
                    running: true,
                    mode: 'break',
                    breakStartTime: Date.now(),
                    phase: 'execution',
                    accumulatedTime: 0,
                });

                FocusAudio.playSessionComplete();
                this.render(Store.getTask(this.activeTaskId));
                this.showSuccessVisuals();
            }
        } else if (state.mode === 'break') {
            // Break mode - count down
            const breakElapsed = state.breakStartTime
                ? Math.floor((Date.now() - state.breakStartTime) / 1000)
                : 0;

            // Check for break completion -> MOVE TO WORK
            if (breakElapsed >= this.breakDuration) {
                Store.updateActiveExecution({
                    running: true,
                    mode: 'work',
                    phase: 'execution',
                    sessionStartTime: Date.now(),
                    accumulatedTime: 0,
                    breakStartTime: null,
                });

                FocusAudio.playBreakComplete();
                this.render(Store.getTask(this.activeTaskId));
            }
        }

        this.updateUI();
        this.updateFloatingTimer();
    },

    pauseSession() {
        const state = Store.getActiveExecution();

        if (!state.running) return;
        let newAccumulatedTime = state.accumulatedTime || 0;
        const now = Date.now();
        if (state.sessionStartTime) {
            newAccumulatedTime += now - state.sessionStartTime;
        }

        // Also update the current step's duration
        const stepTimings = [...(state.stepTimings || [])];
        const timing = stepTimings.find((t) => t.stepIndex === state.currentStepIndex);
        if (timing && timing.status === 'active') {
            timing.duration += now - timing.startedAt;
            // We keep it 'active' but it's not currently accumulating until resumed
        }

        Store.updateActiveExecution({
            running: false,
            sessionStartTime: null,
            accumulatedTime: newAccumulatedTime,
            pauseCount: (state.pauseCount || 0) + 1,
            stepTimings,
        });

        // Update visual states
        this.updateUI();
    },

    /**
     * Handle decision after session
     */
    handleDecision(choice) {
        const state = Store.getActiveExecution();
        const task = Store.getTask(this.activeTaskId);
        let triggerCelebration = false;
        let shouldCelebrate = false;

        if (choice === 'complete') {
            this.recordStepCompletion(state.currentStepIndex);
            this.toggleMiniTask(state.currentStepIndex);
            // [NEW] Show Reward (Centered)
            Rewards.show(window.innerWidth / 2, window.innerHeight * 0.35);
            triggerCelebration = true;

            // Move to next step if available
            const lines = task.notes.split('\n').filter((l) => l.trim() !== '');
            const nextIncomplete = lines.findIndex(
                (l, i) => i > state.currentStepIndex && l.includes('[ ]')
            );
            if (nextIncomplete !== -1) {
                Store.updateActiveExecution({ currentStepIndex: nextIncomplete });
            }

            const updatedTask = Store.getTask(this.activeTaskId);
            const updatedLines = (updatedTask?.notes || '')
                .split('\n')
                .filter((l) => l.trim() !== '');
            const taskLines = updatedLines.filter((l) => l.includes('[ ]') || l.includes('[x]'));
            shouldCelebrate = taskLines.length > 0 && taskLines.every((l) => l.includes('[x]'));
            if (shouldCelebrate) {
                this.celebrateTaskAchieved();
                return;
            }
        }

        if (choice === 'continue') {
            Store.updateActiveExecution({
                phase: 'execution',
                mode: 'work',
                running: true,
                sessionStartTime: Date.now(),
                accumulatedTime: 0,
                breakStartTime: null,
            });
            this.render(Store.getTask(this.activeTaskId));
            this.startSessionInterval();
            return;
        }

        if (choice === 'break') {
            Store.updateActiveExecution({
                phase: 'orientation',
                mode: 'break',
                running: false,
                sessionStartTime: null,
                accumulatedTime: 0,
                breakStartTime: state.breakStartTime || Date.now(),
            });
            this.render(Store.getTask(this.activeTaskId));
            return;
        }

        if (choice === 'stop') {
            this.stopSession(true);
            this.render(Store.getTask(this.activeTaskId));
            return;
        }

        Store.updateActiveExecution({
            phase: 'orientation',
            mode: 'work',
            running: false,
            sessionStartTime: null,
            accumulatedTime: 0,
            breakStartTime: null,
        });

        this.render(Store.getTask(this.activeTaskId));
        if (triggerCelebration) {
            requestAnimationFrame(() => {
                setTimeout(() => {
                    this.showSuccessVisuals();
                }, 100);
            });
        }
    },

    /**
     * Show success visuals (flash/animation)
     */
    showSuccessVisuals() {
        FocusModeUI.showSuccessVisuals();

        // Check for total task achievement
        const task = Store.getTask(this.activeTaskId);
        const lines = (task.notes || '').split('\n').filter((l) => l.trim() !== '');
        // Explicitly check for lines that are tasks
        const taskLines = lines.filter((l) => l.includes('[ ]') || l.includes('[x]'));

        // Log for debugging
        const completedCount = taskLines.filter((l) => l.includes('[x]')).length;

        const state = Store.getActiveExecution();
        const allCompleted =
            (taskLines.length > 0 && taskLines.every((l) => l.includes('[x]'))) ||
            state.phase === 'completed';
        const alreadyTransitioning = state.phase === 'completion';

        if (allCompleted && !alreadyTransitioning) {
            this.celebrateTaskAchieved();
        } else {
            // Update UI even if not all complete (to show progress)
            this.updateUI();
        }
    },

    /**
     * Triumphant celebration for total task completion
     */
    celebrateTaskAchieved() {
        FocusAudio.playTaskAchieved();
        const state = Store.getActiveExecution();
        const sessionStats = { ...(state.sessionStats || {}) };
        if (!sessionStats.startedAt) {
            sessionStats.startedAt = state.updatedAt || Date.now();
        }
        if (!sessionStats.completedAt) {
            sessionStats.completedAt = Date.now();
        }

        const transitionState = {
            ...state,
            running: false,
            sessionStartTime: null,
            accumulatedTime: 0,
            phase: 'completion',
            sessionStats,
            celebrateOnNextRender: true,
        };

        const finalState = { ...transitionState, phase: 'completed', celebrateOnNextRender: false };

        Store.updateActiveExecution(transitionState);
        Store.updateTask(this.activeTaskId, { sessionResult: finalState });
        Store.save(true);

        const task = Store.getTask(this.activeTaskId);
        this.render(task);
        setTimeout(() => {
            const latest = Store.getActiveExecution();
            if (latest.phase === 'completion') {
                Store.updateActiveExecution({ phase: 'completed' });
                this.render(Store.getTask(this.activeTaskId));
            }
        }, 1200);
    },

    spawnConfetti() {
        if (window.celebrate) {
            window.celebrate();
        } else {
            FocusModeUI.spawnConfetti();
        }
    },

    notifyPhaseChange(phase) {
        FocusModeUI.showPhaseNotification(phase);
    },

    /**
     * Delete a mini-task
     */
    deleteMiniTask(index) {
        const task = Store.getTask(this.activeTaskId);
        const lines = task.notes.split('\n');
        lines.splice(index, 1);

        Store.updateTaskNotesForWeek(this.activeTaskId, lines.join('\n'));
        this.updateQuestStack();
        if (window.Calendar) window.Calendar.refresh();
    },

    /**
     * Toggle a mini-task in notes
     * @param {number} index - The step index to toggle
     * @param {boolean} skipUpdate - If true, don't call updateQuestStack (for chained operations)
     */
    toggleMiniTask(index, skipUpdate = false) {
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
        if (!skipUpdate) {
            this.updateQuestStack();
        }
        if (window.Calendar) window.Calendar.refresh();
    },

    /**
     * Navigate to previous step without marking completion
     */
    goToPreviousStep() {
        const state = Store.getActiveExecution();
        const task = Store.getTask(this.activeTaskId);
        const lines = (task.notes || '').split('\n').filter((l) => l.trim() !== '');
        if (lines.length === 0) return;

        for (let i = state.currentStepIndex - 1; i >= 0; i--) {
            if (lines[i] !== undefined) {
                Store.updateActiveExecution({ currentStepIndex: i });
                this.lastDoneStepIndex = null;
                this.updateQuestStack();
                return;
            }
        }
    },

    navigateToPrevVisibleStep() {
        if (this.carouselAnimating) return;
        const state = Store.getActiveExecution();

        const currentIndex = state.currentStepIndex || 0;

        // Logic: Simply go back one index if possible
        if (currentIndex > 0) {
            this.animateCarouselRollReverse(currentIndex - 1);
        }
    },

    navigateToNextVisibleStep() {
        if (this.carouselAnimating) return;
        const state = Store.getActiveExecution();
        const task = Store.getTask(this.activeTaskId);

        const lines = (task?.notes || '').split('\n').filter((l) => l.trim() !== '');
        const currentIndex = state.currentStepIndex || 0;

        if (currentIndex < lines.length - 1) {
            this.animateCarouselRoll(currentIndex + 1, { markComplete: false });
        }
    },

    /**
     * Skip to next incomplete step
     */
    skipToNextStep() {
        const state = Store.getActiveExecution();
        const task = Store.getTask(this.activeTaskId);
        const lines = (task.notes || '').split('\n').filter((l) => l.trim() !== '');

        // Find next incomplete step
        const nextIndex = lines.findIndex(
            (l, i) => i > state.currentStepIndex && l.includes('[ ]')
        );
        if (nextIndex !== -1) {
            this.animateCarouselRoll(nextIndex, { markComplete: false });
        }
    },

    /**
     * Complete current step and move to next
     */
    completeCurrentStep() {
        const state = Store.getActiveExecution();
        const task = Store.getTask(this.activeTaskId);
        const previousIndex = state.currentStepIndex;

        // Find the next incomplete step BEFORE we mark current as complete
        const lines = (task.notes || '').split('\n').filter((l) => l.trim() !== '');
        const nextIndex = lines.findIndex(
            (l, i) => i > state.currentStepIndex && l.includes('[ ]')
        );
        if (nextIndex !== -1) {
            this.animateCarouselRoll(nextIndex, { markComplete: true });
            return;
        }

        this.toggleMiniTask(previousIndex, true);
        this.recordStepCompletion(previousIndex, 'completed');

        FocusAudio.playStepComplete();
        this.lastDoneStepIndex = previousIndex;
        const updatedTask = Store.getTask(this.activeTaskId);
        const updatedLines = (updatedTask?.notes || '').split('\n').filter((l) => l.trim() !== '');
        const taskLines = updatedLines.filter((l) => l.includes('[ ]') || l.includes('[x]'));
        const shouldCelebrate = taskLines.length > 0 && taskLines.every((l) => l.includes('[x]'));

        if (shouldCelebrate) {
            this.celebrateTaskAchieved();
            return;
        }

        // Finish session
        const sessionStats = { ...(state.sessionStats || {}) };
        if (!sessionStats.startedAt) {
            sessionStats.startedAt = state.updatedAt || Date.now();
        }
        sessionStats.completedAt = Date.now();

        const finalState = {
            phase: 'completed',
            running: false, // Ensure session is stopped
            sessionStats,
            stepTimings: state.stepTimings,
            pauseCount: state.pauseCount,
        };

        Store.updateActiveExecution(finalState);

        // PERSISTENCE: Save result to the task itself so it survives task switching
        Store.updateTask(this.activeTaskId, { sessionResult: finalState });

        // Force immediate save for critical phase change
        Store.save(true);

        // Full re-render to update template structure (hide rings)
        this.render(updatedTask);

        // Yield to browser to ensure Results Card is in DOM before celebrating
        requestAnimationFrame(() => {
            setTimeout(() => {
                if (shouldCelebrate) {
                    this.celebrateTaskAchieved();
                } else {
                    this.showSuccessVisuals();
                }
            }, 100);
        });
    },

    // =========================================
    // POMODORO TIMER METHODS
    // =========================================



    /**
     * Start/Pause timer
     */
    startPauseTimer() {
        TimerService.startPause();
    },

    /**
     * Reset timer
     */
    resetTimer() {
        TimerService.reset();
    },

    /**
     * Switch between work and break mode
     */
    stopTimer() {
        TimerService.cleanup();
    },



    async openFloatingTimer() {
        const api = window.documentPictureInPicture;

        // [NEW] Tauri Native PiP Support
        if (window.__TAURI__) {
            try {
                // Try to create/open a separate window
                const { Window } = window.__TAURI__.window; // Tauri v2
                // Or WebviewWindow: const { WebviewWindow } = window.__TAURI__.window; // Tauri v1/v2 compatibility

                // We'll trust that withGlobalTauri exposes what we need, usually window.__TAURI__.window contains the constructors
                const winLabel = 'focus-pip';

                // Check if already open
                // In v2 we can't easily check existence without async, so we just try to create. 
                // If it exists, Tauri usually focuses it unless we handle it.
                // Let's rely on creating a NEW one or overwriting.

                // Improved Tauri detection for v1 and v2
                const tauri = window.__TAURI__;

                // Discovery of the WebviewWindow constructor
                const WebviewWindow =
                    (tauri.webviewWindow && tauri.webviewWindow.WebviewWindow) || // v2 modern
                    (tauri.window && tauri.window.WebviewWindow) ||              // v1/v2 compatibility
                    (tauri.window && tauri.window.Window) ||                     // v2 Window fallback
                    tauri.WebviewWindow;                                         // v1 top-level fallback

                if (typeof WebviewWindow !== 'function') {
                    Toast.error('Error: Tauri WebviewWindow constructor NOT found');
                    return;
                }

                // STATIC STRATEGY: Get existing window by label
                // In Setup, we defined "focus-pip" in tauri.conf.json
                let pipWin = null;
                try {
                    // Try standard getByLabel (v2) or getAll (v1)
                    if (WebviewWindow.getByLabel) {
                        pipWin = await WebviewWindow.getByLabel('focus-pip');
                    } else if (tauri.window && tauri.window.getCurrent) {
                        // v1 fallback to list all windows
                        const windows = await tauri.window.getAll();
                        pipWin = windows.find(w => w.label === 'focus-pip');
                    }
                } catch (err) {
                    Toast.error('Error getting pip window by label: ' + err.message);
                    console.error('Error getting pip window by label', err);
                }

                if (pipWin) {
                    await pipWin.show();
                    await pipWin.setFocus();
                    this.pipWindow = pipWin;
                } else {
                    // Create new window if static one is missing
                    pipWin = new WebviewWindow('focus-pip', {
                        url: 'index.html?mode=pip',
                        title: 'Focus Timer',
                        width: 170,
                        height: 200,
                        resizable: false,
                        decorations: false,
                        fullscreen: false,
                        center: false,
                        alwaysOnTop: true,
                        transparent: true,
                        skipTaskbar: true,
                        x: 20,
                        y: 20
                    });

                    // Wait for it to be created
                    pipWin.once('tauri://created', async () => {
                        await pipWin.show();
                        await pipWin.setFocus();
                        this.pipWindow = pipWin;
                    });

                    pipWin.once('tauri://error', (e) => {
                        console.error('[FocusMode] Error creating dynamic PiP window', e);
                        throw new Error('Failed to create dynamic PiP window');
                    });
                }

                // Add close listener if possible (depends on Tauri version)
                if (this.pipWindow) {
                    // Monitor window closing to clean up reference
                    // For v2, we might not have a direct 'close' event on the instance in all contexts
                    // but we can try to listen to the event globally if we wanted.
                    // For now, simpler is better: rely on user action or 'request-state' failing.

                    // However, we can listen for the specific window closing
                    const label = this.pipWindow.label;
                    if (label) {
                        // We don't want to add multiple listeners here either

                        // Note: We're not rigorously tracking close here because 
                        // re-opening will just find the existing one or create new.
                        // But cleaning up is good practice.
                        this.pipWindow.onCloseRequested(async (event) => {
                            this.pipWindow = null;
                        });
                    }
                }

                return;
            } catch (e) {
                console.error('Tauri PiP failed, falling back to badge', e);
                // Note: The below showBadge() fallback will run if this catch block is hit
            }
        }

        if (this.pipWindow) return;
        try {
            if (!api) throw new Error('pip');
            const pip = await api.requestWindow({ initialWidth: 160, initialHeight: 190 });
            this.pipWindow = pip;

            // Try to force resize (Chrome often caches user's last size, this might help)
            try {
                if (pip.resizeTo) pip.resizeTo(160, 190);
            } catch (e) {
                // Ignore resize errors
            }

            pip.startPause = () => this.startPauseTimer();
            pip.resetTimer = () => this.resetTimer();

            FocusModeUI.setupPipWindow(pip, pip.startPause, pip.resetTimer, () => {
                try {
                    pip.close(); // Force close
                } catch (e) {
                    // Ignore
                }
                window.focus(); // Try to bring main window to front
                if (this.activeTaskId) {
                    this.open(this.activeTaskId);
                }
            });

            pip.addEventListener('pagehide', () => {
                this.pipWindow = null;
            });

            this.updateFloatingTimer();
            this.hideBadge();
        } catch (error) {
            console.error('[FocusMode] PiP failed to open:', error);
            // Fallback to badge if PiP fails
            this.showBadge();
        }
    },

    updateFloatingTimer() {
        // [FIX] Allow updates even if open, so PiP stays in sync if visible
        // if (this.isOpen) {
        //     this.hideBadge();
        //     return;
        // }

        const state = Store.getActiveExecution();

        // [FIX] Prioritize Active Task Session over generic Pomodoro
        let seconds, total, mode, running;

        if (state.taskId && (state.running || state.accumulatedTime > 0 || state.mode === 'break')) {
            const now = Date.now();
            const currentSessionElapsed = (state.running && state.sessionStartTime) ? now - state.sessionStartTime : 0;
            const totalElapsedMs = (state.accumulatedTime || 0) + currentSessionElapsed;

            const duration = this.sessionDuration || 25 * 60;

            if (state.mode === 'work') {
                seconds = Math.max(0, duration - Math.floor(totalElapsedMs / 1000));
                total = duration;
            } else {
                // Break mode
                const breakElapsed = state.breakStartTime ? Math.floor((now - state.breakStartTime) / 1000) : 0;
                const breakDur = this.breakDuration || 5 * 60;
                seconds = Math.max(0, breakDur - breakElapsed);
                total = breakDur;
            }

            mode = state.mode;
            running = state.running;
        } else {
            // Fallback to generic Pomodoro
            seconds = TimerService.pomodoroSeconds;
            total = TimerService.pomodoroMode === 'work' ? TimerService.workDuration : TimerService.breakDuration;
            mode = TimerService.pomodoroMode;
            running = TimerService.pomodoroRunning;
        }

        // Tauri Event-Based Update
        if (window.__TAURI__) {
            try {
                window.__TAURI__.event.emit('pip-update', {
                    seconds: seconds,
                    total: total,
                    mode: mode,
                    running: running
                });
            } catch (e) {
                console.error('Failed to emit pip-update', e);
            }
        } else {
            // Browser Fallback
            FocusModeUI.updatePipUI(
                this.pipWindow,
                TimerService.pomodoroSeconds,
                TimerService.pomodoroMode,
                TimerService.pomodoroRunning,
                totalSeconds
            );
        }
        FocusModeUI.updateBadge(TimerService.pomodoroSeconds, TimerService.pomodoroMode, TimerService.pomodoroRunning);
    },

    closeFloatingTimer() {
        if (this.pipWindow) {
            try {
                this.pipWindow.close();
            } catch {
                // Ignore close errors
            }
            this.pipWindow = null;
        }
    },

    showBadge() {
        FocusModeUI.showBadge(
            TimerService.pomodoroSeconds,
            TimerService.pomodoroMode,
            TimerService.pomodoroRunning,
            () => this.startPauseTimer(),
            () => this.resetTimer(),
            () => this.open(this.activeTaskId) // Open Focus Mode on click
        );
    },

    updateBadge() {
        FocusModeUI.updateBadge(TimerService.pomodoroSeconds, TimerService.pomodoroMode, TimerService.pomodoroRunning);
    },

    hideBadge() {
        FocusModeUI.hideBadge();
    },
};

window.FocusMode = FocusMode;
