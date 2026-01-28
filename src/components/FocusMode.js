/**
 * FocusMode Component - Manages the high-intensity execution modal
 */

import { Store } from '../store.js';
import { FocusAudio } from '../utils/FocusAudio.js';
import { FocusModeUI } from './FocusModeUI.js';
import { DOMUtils } from '../utils/DOMUtils.js';

export const FocusMode = {
    isOpen: false,
    activeTaskId: null,
    activeKeyHandler: null,
    sessionInterval: null,
    resizeHandler: null,
    positionRaf: null,
    carouselAnimating: false,
    lastDoneStepIndex: null,

    // Core session settings
    sessionDuration: 25 * 60, // 25 minutes default
    breakDuration: 5 * 60, // 5 minutes break
    closureThreshold: 5 * 60, // 5 minutes before end

    // Pomodoro settings
    workDuration: 25 * 60,
    pomodoroSeconds: 25 * 60,
    pomodoroMode: 'work',
    pomodoroRunning: false,
    pomodoroTimer: null,
    pomodoroTargetEpoch: null,
    pipWindow: null,

    // Long break cycle settings
    longBreakDuration: 20 * 60, // 20-minute long break
    pomodorosBeforeLongBreak: 4, // Cycle length
    completedPomodoros: 0, // Counter (0-3, resets after long break)
    totalPomodorosToday: 0, // Daily total
    pomodoroSessionDate: null, // Date for daily reset

    /**
     * Open Focus Mode for a specific task
     */
    open(taskId) {
        const task = Store.getTask(taskId);
        if (!task) return;

        this.activeTaskId = taskId;
        this.isOpen = true;
        this.closeFloatingTimer();
        this.hideBadge();

        // Restore Pomodoro counter state from localStorage
        this.restoreTimerState();

        // Initialize or restore execution state
        this.initializeExecutionState(task);

        this.render(task);
        FocusModeUI.setPageOverflow(true);
    },

    /**
     * Initialize or restore state from Store
     */
    initializeExecutionState(task) {
        const state = Store.getActiveExecution();

        // 1. Check if the TASK itself has a saved session result (Per-Task Persistence)
        if (task.sessionResult) {
            console.log('[Focus] Restoring session results from task metadata');
            Store.updateActiveExecution({
                ...task.sessionResult,
                taskId: this.activeTaskId,
                running: false,
            });
            this.lastDoneStepIndex = null;
            return;
        }

        // 2. Fallback to global activeExecution if it matches the current task
        // (Used for sessions in progress)
        if (state.taskId === this.activeTaskId) {
            return;
        }

        // 3. New: If the task is already completed, jump to results phase
        if (task.completed) {
            Store.updateActiveExecution({
                taskId: this.activeTaskId,
                running: false,
                phase: 'completed',
            });
            this.lastDoneStepIndex = null;
            return;
        }

        // 4. Otherwise, reset to orientation for a fresh start
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
            // Reset step timing for new task
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
        this.lastDoneStepIndex = null;
    },

    /**
     * Close Focus Mode
     */
    close() {
        this.isOpen = false;

        const state = Store.getActiveExecution();
        // Check if session is "active" (accumulation > 0 or in break, even if paused)
        const isActive = state.running || state.mode === 'break' || (state.mode === 'work' && state.accumulatedTime > 0);

        // Default to PiP enabled (disablePip = false) since settings are not implemented yet
        const disablePip = false;

        if (!isActive && state.phase !== 'completed') {
            this.stopSession(true);
            this.activeTaskId = null;
        } else if (isActive && !disablePip) {
            // Keep running in background/floating mode
            this.openFloatingTimer();
        }


        // Remove the keyboard listener
        if (this.activeKeyHandler) {
            document.removeEventListener('keydown', this.activeKeyHandler);
            this.activeKeyHandler = null;
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
        this.startSessionInterval();
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
            this.completedPomodoros,
            this.pomodorosBeforeLongBreak,
            this.totalPomodorosToday
        );
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
        if (this.carouselAnimating) return;
        const state = Store.getActiveExecution();
        const fromIndex = state.currentStepIndex;
        if (toIndex === -1 || toIndex === fromIndex) return;

        this.carouselAnimating = true;

        const task = Store.getTask(this.activeTaskId);
        const steps = (task?.notes || '').split('\n').filter((l) => l.trim() !== '');

        FocusModeUI.animateForwardRoll({
            fromIndex,
            toIndex,
            task,
            onStepComplete: markComplete
                ? () => {
                    this.toggleMiniTask(fromIndex, true);
                    this.recordStepCompletion(fromIndex, 'completed');
                    FocusAudio.playStepComplete();
                    this.showSuccessVisuals();
                }
                : () => {
                    // If not markComplete, it's a skip or manual navigaton
                    this.recordStepCompletion(fromIndex, 'skipped');
                },
            onFinish: () => {
                this.lastDoneStepIndex = fromIndex;
                Store.updateActiveExecution({ currentStepIndex: toIndex });
                this.startStepTimer(toIndex, steps);
                this.updateUI();
                this.carouselAnimating = false;
                this.schedulePositionCarouselCompleteButton();
            },
        });
    },

    /**
     * Start timing a step
     */
    startStepTimer(index, steps) {
        if (index < 0 || index >= steps.length) return;

        const state = Store.getActiveExecution();
        const stepTimings = [...(state.stepTimings || [])];

        // If timing already exists for this index and is skipped, we might be returning to it
        // For now, let's only start IF it doesn't have a startedAt or was skipped
        let timing = stepTimings.find((t) => t.stepIndex === index);

        if (!timing) {
            timing = {
                stepIndex: index,
                stepText: steps[index].replace(/\[[ x]\]/, '').trim(),
                startedAt: Date.now(),
                completedAt: null,
                duration: 0,
                status: 'active',
            };
            stepTimings.push(timing);
        } else if (timing.status === 'skipped' || timing.status === 'active') {
            timing.startedAt = Date.now();
            timing.status = 'active';
        }

        Store.updateActiveExecution({ stepTimings });
    },

    /**
     * Record step completion or skip
     */
    recordStepCompletion(index, status = 'completed') {
        const state = Store.getActiveExecution();
        const stepTimings = [...(state.stepTimings || [])];
        const timing = stepTimings.find((t) => t.stepIndex === index);

        if (timing && timing.status === 'active') {
            timing.completedAt = Date.now();
            timing.duration += timing.completedAt - timing.startedAt;
            timing.status = status;
            Store.updateActiveExecution({ stepTimings });
        }
    },

    animateCarouselRollReverse(toIndex) {
        if (this.carouselAnimating) return;
        const state = Store.getActiveExecution();
        const fromIndex = state.currentStepIndex;
        if (toIndex === -1 || toIndex === fromIndex) return;

        this.carouselAnimating = true;

        FocusModeUI.animateBackwardRoll({
            fromIndex,
            toIndex,
            task: Store.getTask(this.activeTaskId),
            onFinish: () => {
                Store.updateActiveExecution({ currentStepIndex: toIndex });
                this.lastDoneStepIndex = null;
                this.updateUI();
                this.carouselAnimating = false;
                this.schedulePositionCarouselCompleteButton();
            },
        });
    },

    /**
     * Setup event listeners
     */
    setupListeners() {
        // Listen for Tauri PiP Actions
        if (window.__TAURI__) {
            try {
                console.log('[FocusMode] Setting up Tauri event listeners...');
                window.__TAURI__.event.listen('pip-action', (event) => {
                    console.log('[FocusMode] Received pip-action:', event);
                    const action = event.payload?.action;
                    if (action === 'toggle') this.toggleSession();
                    if (action === 'reset') this.resetTimer();
                    if (action === 'request-state') this.updateFloatingTimer();
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
                        console.log('[FocusMode] Received command:', cmd.action);
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
            // Skip if typing in an input field
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            // Enter: Complete current step
            if (e.key === 'Enter') {
                if (e.metaKey || e.ctrlKey || e.altKey) return;
                this.completeCurrentStep();
                return;
            }

            // Space: Toggle pause/resume
            if (e.key === ' ' || e.code === 'Space') {
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
                e.preventDefault();
                this.navigateToPrevVisibleStep();
                return;
            }

            // Arrow Down: Navigate to next step (skip)
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.skipToNextStep();
                return;
            }

            // S: Skip current step
            if (e.key.toLowerCase() === 's') {
                this.skipToNextStep();
                return;
            }

            // Escape or F: Close Focus Mode
            if (e.key === 'Escape' || e.key.toLowerCase() === 'f') {
                this.close();
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
                Store.recordFocusSession({
                    taskId: this.activeTaskId,
                    duration: this.sessionDuration,
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
            FocusAudio.playStepComplete();
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
        console.log(`[Focus] Checking achievement: ${completedCount}/${taskLines.length}`);

        const state = Store.getActiveExecution();
        const allCompleted =
            (taskLines.length > 0 && taskLines.every((l) => l.includes('[x]'))) ||
            state.phase === 'completed';
        const alreadyTransitioning = state.phase === 'completion';

        if (allCompleted && !alreadyTransitioning) {
            console.log('[Focus] SUCCESS! All tasks completed. Celebrating...');
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
        FocusModeUI.spawnConfetti();
    },

    notifyPhaseChange(phase) {
        FocusModeUI.showPhaseNotification(phase);
        console.log(`[Focus] Phase changed to: ${phase}`);
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
     * Update timer display
     */
    updateTimerDisplay() {
        const totalSeconds = this.pomodoroMode === 'work' ? this.workDuration : this.breakDuration;
        FocusModeUI.updatePomodoroTimer(this.pomodoroSeconds, totalSeconds, this.pomodoroMode);
    },

    /**
     * Start/Pause timer
     */
    startPauseTimer() {
        if (this.pomodoroRunning) {
            // Pause
            clearInterval(this.pomodoroTimer);
            this.pomodoroRunning = false;
            FocusModeUI.updatePomodoroStartPauseButton(false);
            this.pomodoroTargetEpoch = null;
            this.persistTimerState();
            this.updateFloatingTimer();
        } else {
            // Start
            this.pomodoroRunning = true;
            FocusModeUI.updatePomodoroStartPauseButton(true);
            this.pomodoroTargetEpoch = Date.now() + this.pomodoroSeconds * 1000;
            this.pomodoroTimer = setInterval(() => {
                const remaining = Math.max(
                    0,
                    Math.round((this.pomodoroTargetEpoch - Date.now()) / 1000)
                );
                this.pomodoroSeconds = remaining;
                this.updateTimerDisplay();
                this.updateFloatingTimer();
                if (remaining <= 0) {
                    this.switchMode();
                }
            }, 1000);
            this.persistTimerState();
            this.updateFloatingTimer();
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

        FocusModeUI.updatePomodoroStartPauseButton(false);

        this.updateTimerDisplay();
        this.persistTimerState();
        this.updateFloatingTimer();
    },

    /**
     * Switch between work and break mode
     */
    switchMode() {
        clearInterval(this.pomodoroTimer);
        this.pomodoroRunning = false;

        if (this.pomodoroMode === 'work') {
            // Completed a Pomodoro! Increment counters
            this.completedPomodoros++;
            this.totalPomodorosToday++;

            // Track session stats
            const state = Store.getActiveExecution();
            const sessionStats = { ...(state.sessionStats || {}) };
            sessionStats.pomodorosUsed = (sessionStats.pomodorosUsed || 0) + 1;
            Store.updateActiveExecution({ sessionStats });

            this.pomodoroMode = 'break';

            // Check if this is time for a long break (every 4 Pomodoros)
            const isLongBreak = this.completedPomodoros >= this.pomodorosBeforeLongBreak;

            if (isLongBreak) {
                this.pomodoroSeconds = this.longBreakDuration;
                this.completedPomodoros = 0; // Reset cycle counter
                if (Notification.permission === 'granted') {
                    new Notification('🎉 Great work! Long break time!', {
                        body: `You completed ${this.pomodorosBeforeLongBreak} Pomodoros! Enjoy a 20-min break.`,
                    });
                }
            } else {
                this.pomodoroSeconds = this.breakDuration;
                if (Notification.permission === 'granted') {
                    new Notification('🎉 Focus session complete!', {
                        body: `Pomodoro ${this.completedPomodoros}/${this.pomodorosBeforeLongBreak} done. Short break time!`,
                    });
                }
            }
        } else {
            this.pomodoroMode = 'work';
            this.pomodoroSeconds = this.workDuration;
            if (Notification.permission === 'granted') {
                new Notification('💪 Break over!', {
                    body: `Ready for Pomodoro ${this.completedPomodoros + 1}/${this.pomodorosBeforeLongBreak}?`,
                });
            }
        }

        FocusModeUI.updatePomodoroStartPauseButton(false);
        FocusModeUI.updatePomodoroCounter(
            this.completedPomodoros,
            this.pomodorosBeforeLongBreak,
            this.totalPomodorosToday
        );

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
        const today = new Date().toDateString();
        const state = {
            mode: this.pomodoroMode,
            running: this.pomodoroRunning,
            remaining: this.pomodoroSeconds,
            targetEpoch: this.pomodoroTargetEpoch,
            work: this.workDuration,
            break: this.breakDuration,
            // Pomodoro cycle tracking
            completedPomodoros: this.completedPomodoros,
            totalPomodorosToday: this.totalPomodorosToday,
            pomodoroSessionDate: today,
            updatedAt: Date.now(),
        };
        try {
            localStorage.setItem('focusModeTimerState', JSON.stringify(state));
        } catch {
            // Ignore storage errors
        }
    },

    restoreTimerState() {
        let state = null;
        try {
            state = JSON.parse(localStorage.getItem('focusModeTimerState') || 'null');
        } catch {
            // Ignore parse errors
        }
        if (!state) {
            this.pomodoroMode = 'work';
            this.pomodoroSeconds = this.workDuration;
            this.pomodoroRunning = false;
            this.pomodoroTargetEpoch = null;
            this.completedPomodoros = 0;
            this.totalPomodorosToday = 0;
            this.pomodoroSessionDate = new Date().toDateString();
            return;
        }
        this.workDuration = state.work || this.workDuration;
        this.breakDuration = state.break || this.breakDuration;
        this.pomodoroMode = state.mode || 'work';

        // Restore Pomodoro counters
        const today = new Date().toDateString();
        if (state.pomodoroSessionDate === today) {
            // Same day - restore all counts
            this.completedPomodoros = state.completedPomodoros || 0;
            this.totalPomodorosToday = state.totalPomodorosToday || 0;
        } else {
            // New day - reset daily total, keep cycle position
            this.completedPomodoros = state.completedPomodoros || 0;
            this.totalPomodorosToday = 0;
        }
        this.pomodoroSessionDate = today;

        if (state.targetEpoch && state.running) {
            const remaining = Math.max(0, Math.round((state.targetEpoch - Date.now()) / 1000));
            this.pomodoroSeconds = remaining;
            this.pomodoroRunning = remaining > 0;
            this.pomodoroTargetEpoch = state.targetEpoch;
            if (this.pomodoroRunning && !this.pomodoroTimer) {
                this.pomodoroTimer = setInterval(() => {
                    const r = Math.max(
                        0,
                        Math.round((this.pomodoroTargetEpoch - Date.now()) / 1000)
                    );
                    this.pomodoroSeconds = r;
                    this.updateTimerDisplay();
                    this.updateFloatingTimer();
                    if (r <= 0) {
                        this.switchMode();
                    }
                }, 1000);
            }
        } else {
            this.pomodoroSeconds =
                state.remaining ||
                (this.pomodoroMode === 'work' ? this.workDuration : this.breakDuration);
            this.pomodoroRunning = false;
            this.pomodoroTargetEpoch = null;
        }
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

                // Improved Tauri detection
                const tauri = window.__TAURI__;

                // Tauri v2 often puts WebviewWindow in `webviewWindow` namespace
                const WebviewWindow =
                    (tauri.webviewWindow && tauri.webviewWindow.WebviewWindow) ||
                    (tauri.window && tauri.window.WebviewWindow) ||
                    (tauri.window && tauri.window.Window) ||
                    tauri.WebviewWindow;

                if (!WebviewWindow) {
                    alert('Error: Tauri WebviewWindow constructor NOT found');
                    throw new Error('Tauri WebviewWindow constructor not found');
                }

                // STATIC STRATEGY: Get existing window by label
                // In Setup, we defined "focus-pip" in tauri.conf.json
                let pipWin = null;
                try {
                    // Try standard getByLabel (v2) or getAll (v1)
                    if (WebviewWindow.getByLabel) {
                        pipWin = await WebviewWindow.getByLabel('focus-pip');
                    } else {
                        // Fallback for some v1/v2 bridges
                        // We might need to handle this if getByLabel isn't async or exists
                        // Usually it returns null if not found
                    }
                } catch (err) {
                    alert('Error getting pip window by label: ' + err.message);
                    console.error('Error getting pip window by label', err);
                }

                if (pipWin) {
                    await pipWin.show();
                    await pipWin.setFocus();
                    this.pipWindow = pipWin;
                } else {
                    console.log('[FocusMode] Static PiP window not found, creating new one...');
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
                        console.log('[FocusMode] Dynamic PiP window created');
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
                if (this.pipWindow && this.pipWindow.onCloseRequested) {
                    this.pipWindow.onCloseRequested(async (event) => {
                        // Optional: Handle close event
                    });
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
        if (this.isOpen) {
            this.hideBadge();
            return;
        }
        const state = Store.getActiveExecution();
        if (state.running || state.mode === 'break') {
            const totalSeconds = state.mode === 'work' ? this.sessionDuration : this.breakDuration;
            let secondsRemaining = 0;
            if (state.mode === 'work') {
                const currentSessionElapsed = state.sessionStartTime
                    ? Date.now() - state.sessionStartTime
                    : 0;
                const totalElapsedMs = (state.accumulatedTime || 0) + currentSessionElapsed;
                secondsRemaining = Math.max(0, totalSeconds - Math.floor(totalElapsedMs / 1000));
            } else {
                const breakElapsed = state.breakStartTime
                    ? Math.floor((Date.now() - state.breakStartTime) / 1000)
                    : 0;
                secondsRemaining = Math.max(0, totalSeconds - breakElapsed);
            }
            // Tauri Event-Based Update
            if (window.__TAURI__) {
                try {
                    window.__TAURI__.event.emit('pip-update', {
                        seconds: secondsRemaining,
                        total: totalSeconds,
                        mode: state.mode,
                        running: state.running
                    });
                } catch (e) {
                    console.error('Failed to emit pip-update', e);
                }
            } else {
                // Browser Fallback
                FocusModeUI.updatePipUI(
                    this.pipWindow,
                    secondsRemaining,
                    state.mode,
                    state.running,
                    totalSeconds
                );
            }
            FocusModeUI.updateBadge(secondsRemaining, state.mode, state.running);
            return;
        }

        const totalSeconds = this.pomodoroMode === 'work' ? this.workDuration : this.breakDuration;
        FocusModeUI.updatePipUI(
            this.pipWindow,
            this.pomodoroSeconds,
            this.pomodoroMode,
            this.pomodoroRunning,
            totalSeconds
        );
        this.updateBadge();
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
            this.pomodoroSeconds,
            this.pomodoroMode,
            this.pomodoroRunning,
            () => this.startPauseTimer(),
            () => this.resetTimer(),
            () => this.open(this.currentTaskId) // Open Focus Mode on click
        );
    },

    updateBadge() {
        FocusModeUI.updateBadge(this.pomodoroSeconds, this.pomodoroMode, this.pomodoroRunning);
    },

    hideBadge() {
        FocusModeUI.hideBadge();
    },
};

window.FocusMode = FocusMode;
