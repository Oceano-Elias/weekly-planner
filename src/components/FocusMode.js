/**
 * FocusMode Component - Manages the high-intensity execution modal
 */

import { Store } from '../store.js';
import { FocusAudio } from '../utils/FocusAudio.js';
import { FocusModeUI } from './FocusModeUI.js';

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
    breakDuration: 5 * 60,    // 5 minutes break
    closureThreshold: 5 * 60, // 5 minutes before end

    // Pomodoro settings
    workDuration: 25 * 60,
    pomodoroSeconds: 25 * 60,
    pomodoroMode: 'work',
    pomodoroRunning: false,
    pomodoroTimer: null,
    pomodoroTargetEpoch: null,
    pipWindow: null,

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

        // If we are opening a NEW task, or if no task is active, reset state
        if (state.taskId !== this.activeTaskId) {
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
                    const lines = (task.notes || '').split('\n').filter(l => l.trim() !== '');
                    const idx = lines.findIndex(l => l.includes('[ ]'));
                    return idx === -1 && lines.length > 0 ? 0 : idx;
                })()
            });
            this.lastDoneStepIndex = null;
        }
    },

    /**
     * Close Focus Mode
     */
    close() {
        this.isOpen = false;

        const state = Store.getActiveExecution();
        if (!state.running) {
            this.stopSession(true);
            this.activeTaskId = null;
        } else {
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
        const activeStepTitle = FocusModeUI.getActiveStepTitle(task, state.currentStepIndex);

        container.innerHTML = FocusModeUI.getMainTemplate(task, state, activeStepTitle);

        this.setupListeners();
        this.attachCarouselControls();
        this.updateUI();
        this.startSessionInterval();
        this.schedulePositionCarouselCompleteButton();
        requestAnimationFrame(() => {
            FocusModeUI.removeCarouselInitialTransition();
            this.schedulePositionCarouselCompleteButton();
        });
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

        const stackContainer = FocusModeUI.updateQuestStack(task, state.currentStepIndex, onCardClick);
        if (!stackContainer) return;

        this.attachCarouselControls();
        this.schedulePositionCarouselCompleteButton();
        this.updateUI();
    },


    animateCarouselRoll(toIndex, { markComplete }) {
        if (this.carouselAnimating) return;
        const state = Store.getActiveExecution();
        const fromIndex = state.currentStepIndex;
        if (toIndex === -1 || toIndex === fromIndex) return;

        this.carouselAnimating = true;

        FocusModeUI.animateForwardRoll({
            fromIndex,
            toIndex,
            task: Store.getTask(this.activeTaskId),
            onStepComplete: markComplete ? () => {
                this.toggleMiniTask(fromIndex, true);
                FocusAudio.playStepComplete();
                this.showSuccessVisuals();
            } : null,
            onFinish: () => {
                this.lastDoneStepIndex = fromIndex;
                Store.updateActiveExecution({ currentStepIndex: toIndex });
                this.updateUI();
                this.carouselAnimating = false;
                this.schedulePositionCarouselCompleteButton();
            }
        });
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
            }
        });
    },

    /**
     * Setup event listeners
     */
    setupListeners() {
        const els = FocusModeUI.getListenerElements();

        els.overlay?.addEventListener('click', (e) => {
            if (e.target === els.overlay) this.close();
        });

        els.closeBtn?.addEventListener('click', () => this.close());

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
        const steps = (task.notes || '').split('\n').filter(l => l.trim() !== '');
        if (steps.length === 0) {
            alert('Please define at least one step before starting.');
            return;
        }

        Store.updateActiveExecution({
            running: true,
            phase: 'execution',
            mode: 'work',
            sessionStartTime: Date.now(),
            breakStartTime: null,
            updatedAt: Date.now()
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
            breakStartTime: null
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
            const currentSessionElapsed = state.sessionStartTime ? (now - state.sessionStartTime) : 0;
            const totalElapsedMs = (state.accumulatedTime || 0) + currentSessionElapsed;
            const elapsedSeconds = Math.floor(totalElapsedMs / 1000);

            // Check for closure phase
            if (elapsedSeconds >= (this.sessionDuration - this.closureThreshold) && state.phase === 'execution') {
                Store.updateActiveExecution({ phase: 'closure' });
                FocusAudio.playClosureWarning();
                this.notifyPhaseChange('closure');
            }

            // Check for session completion
            if (elapsedSeconds >= this.sessionDuration) {
                // Count steps completed before recording
                const task = Store.getTask(this.activeTaskId);
                const lines = (task?.notes || '').split('\n').filter(l => l.trim() !== '');
                const stepsCompleted = lines.filter(l => l.includes('[x]')).length;

                // Record the session
                Store.recordFocusSession({
                    taskId: this.activeTaskId,
                    duration: this.sessionDuration,
                    stepsCompleted
                });

                Store.updateActiveExecution({
                    running: false,
                    mode: 'break',
                    breakStartTime: Date.now(),
                    phase: 'decision',
                    accumulatedTime: 0
                });
                FocusAudio.playSessionComplete();
                this.render(Store.getTask(this.activeTaskId));
            }
        } else if (state.mode === 'break') {
            // Break mode - count down
            const breakElapsed = state.breakStartTime ? Math.floor((Date.now() - state.breakStartTime) / 1000) : 0;
            if (breakElapsed >= this.breakDuration) {
                // Break finished
                // Keep in break mode but maybe pulse the timer or show a notification
            }
        }

        this.updateUI();
        this.updateFloatingTimer();
    },

    pauseSession() {
        const state = Store.getActiveExecution();

        if (!state.running) return;
        let newAccumulatedTime = state.accumulatedTime || 0;
        if (state.sessionStartTime) {
            newAccumulatedTime += (Date.now() - state.sessionStartTime);
        }

        Store.updateActiveExecution({
            running: false,
            sessionStartTime: null,
            accumulatedTime: newAccumulatedTime
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

        if (choice === 'complete') {
            this.toggleMiniTask(state.currentStepIndex);
            FocusAudio.playStepComplete();
            triggerCelebration = true;

            // Move to next step if available
            const lines = task.notes.split('\n').filter(l => l.trim() !== '');
            const nextIncomplete = lines.findIndex((l, i) => i > state.currentStepIndex && l.includes('[ ]'));
            if (nextIncomplete !== -1) {
                Store.updateActiveExecution({ currentStepIndex: nextIncomplete });
            }
        }

        if (choice === 'continue') {
            Store.updateActiveExecution({
                phase: 'execution',
                mode: 'work',
                running: true,
                sessionStartTime: Date.now(),
                accumulatedTime: 0,
                breakStartTime: null
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
                breakStartTime: state.breakStartTime || Date.now()
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
            breakStartTime: null
        });

        this.render(Store.getTask(this.activeTaskId));
        if (triggerCelebration) {
            this.showSuccessVisuals();
        }
    },


    /**
     * Show success visuals (flash/animation)
     */
    showSuccessVisuals() {
        FocusModeUI.showSuccessVisuals();

        // Check for total task achievement
        const task = Store.getTask(this.activeTaskId);
        const lines = (task.notes || '').split('\n').filter(l => l.trim() !== '');
        // Explicitly check for lines that are tasks
        const taskLines = lines.filter(l => l.includes('[ ]') || l.includes('[x]'));
        
        // Log for debugging
        const completedCount = taskLines.filter(l => l.includes('[x]')).length;
        console.log(`[Focus] Checking achievement: ${completedCount}/${taskLines.length}`);
        
        const allCompleted = taskLines.length > 0 && taskLines.every(l => l.includes('[x]'));

        if (allCompleted) {
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
        FocusModeUI.celebrateVisuals();

        // Stop the timer and fill everything
        Store.updateActiveExecution({
            running: false,
            sessionStartTime: null,
            accumulatedTime: 0,
            phase: 'completed' // New phase for total completion
        });

        // Final UI update
        this.updateUI();

        // Create confetti effect
        this.spawnConfetti();
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
        const lines = (task.notes || '').split('\n').filter(l => l.trim() !== '');
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

        const lines = (task?.notes || '').split('\n').filter(l => l.trim() !== '');
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
        const lines = (task.notes || '').split('\n').filter(l => l.trim() !== '');

        // Find next incomplete step
        const nextIndex = lines.findIndex((l, i) => i > state.currentStepIndex && l.includes('[ ]'));
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
        const lines = (task.notes || '').split('\n').filter(l => l.trim() !== '');
        const nextIndex = lines.findIndex((l, i) => i > state.currentStepIndex && l.includes('[ ]'));
        if (nextIndex !== -1) {
            this.animateCarouselRoll(nextIndex, { markComplete: true });
            return;
        }

        this.toggleMiniTask(previousIndex, true);
        FocusAudio.playStepComplete();
        this.lastDoneStepIndex = previousIndex;
        this.updateQuestStack();
        this.showSuccessVisuals();
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
                const remaining = Math.max(0, Math.round((this.pomodoroTargetEpoch - Date.now()) / 1000));
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

        FocusModeUI.updatePomodoroStartPauseButton(false);

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
            
            pip.startPause = () => this.startPauseTimer();
            pip.resetTimer = () => this.resetTimer();
            
            FocusModeUI.setupPipWindow(pip, pip.startPause, pip.resetTimer);
            
            pip.addEventListener('pagehide', () => { this.pipWindow = null; });
            
            this.updateFloatingTimer();
            this.hideBadge();
        } catch {
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
                const currentSessionElapsed = state.sessionStartTime ? (Date.now() - state.sessionStartTime) : 0;
                const totalElapsedMs = (state.accumulatedTime || 0) + currentSessionElapsed;
                secondsRemaining = Math.max(0, totalSeconds - Math.floor(totalElapsedMs / 1000));
            } else {
                const breakElapsed = state.breakStartTime ? Math.floor((Date.now() - state.breakStartTime) / 1000) : 0;
                secondsRemaining = Math.max(0, totalSeconds - breakElapsed);
            }
            FocusModeUI.updatePipUI(this.pipWindow, secondsRemaining, state.mode, state.running, totalSeconds);
            FocusModeUI.updateBadge(secondsRemaining, state.mode, state.running);
            return;
        }

        const totalSeconds = this.pomodoroMode === 'work' ? this.workDuration : this.breakDuration;
        FocusModeUI.updatePipUI(this.pipWindow, this.pomodoroSeconds, this.pomodoroMode, this.pomodoroRunning, totalSeconds);
        this.updateBadge();
    },

    closeFloatingTimer() {
        if (this.pipWindow) {
            try { this.pipWindow.close(); } catch { }
            this.pipWindow = null;
        }
    },

    showBadge() {
        FocusModeUI.showBadge(
            this.pomodoroSeconds,
            this.pomodoroMode,
            this.pomodoroRunning,
            () => this.startPauseTimer(),
            () => this.resetTimer()
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
