/**
 * TimerService - Manages Pomodoro cycles and session timing logic
 */

import { Store } from '../store.js';
import { FocusModeUI } from '../components/FocusModeUI.js';

export const TimerService = {
    // Basic settings (mirrored from FocusMode for now, can be made configurable)
    workDuration: 25 * 60,
    breakDuration: 5 * 60,
    longBreakDuration: 20 * 60,
    pomodorosBeforeLongBreak: 4,

    // Runtime state
    pomodoroSeconds: 25 * 60,
    pomodoroMode: 'work',
    pomodoroRunning: false,
    pomodoroTimer: null,
    pomodoroTargetEpoch: null,
    completedPomodoros: 0,
    totalPomodorosToday: 0,

    callbacks: {
        onTick: null,
        onModeSwitch: null,
        onStateChange: null,
        updateFloatingTimer: null
    },

    init(callbacks = {}) {
        this.callbacks = { ...this.callbacks, ...callbacks };
        this.restoreState();
    },

    startPause() {
        if (this.pomodoroRunning) {
            this.pause();
        } else {
            this.start();
        }
    },

    start() {
        this.pomodoroRunning = true;
        this.pomodoroTargetEpoch = Date.now() + this.pomodoroSeconds * 1000;

        FocusModeUI.updatePomodoroStartPauseButton(true);
        this.startInterval();
        this.persistState();

        if (this.callbacks.onStateChange) this.callbacks.onStateChange();
        if (this.callbacks.updateFloatingTimer) this.callbacks.updateFloatingTimer();
    },

    pause() {
        this.stopInterval();
        this.pomodoroRunning = false;
        this.pomodoroTargetEpoch = null;

        FocusModeUI.updatePomodoroStartPauseButton(false);
        this.persistState();

        if (this.callbacks.onStateChange) this.callbacks.onStateChange();
        if (this.callbacks.updateFloatingTimer) this.callbacks.updateFloatingTimer();
    },

    reset() {
        this.stopInterval();
        this.pomodoroRunning = false;
        this.pomodoroMode = 'work';
        this.pomodoroSeconds = this.workDuration;
        this.pomodoroTargetEpoch = null;

        FocusModeUI.updatePomodoroStartPauseButton(false);
        this.updateDisplay();
        this.persistState();

        if (this.callbacks.onStateChange) this.callbacks.onStateChange();
        if (this.callbacks.updateFloatingTimer) this.callbacks.updateFloatingTimer();
    },

    startInterval() {
        this.stopInterval();
        this.pomodoroTimer = setInterval(() => this.tick(), 1000);
    },

    stopInterval() {
        if (this.pomodoroTimer) {
            clearInterval(this.pomodoroTimer);
            this.pomodoroTimer = null;
        }
    },

    tick() {
        if (this.pomodoroTargetEpoch) {
            const diff = Math.max(0, Math.round((this.pomodoroTargetEpoch - Date.now()) / 1000));
            this.pomodoroSeconds = diff;
        } else {
            this.pomodoroSeconds--;
        }

        if (this.pomodoroSeconds <= 0) {
            this.switchMode();
        } else {
            this.updateDisplay();
        }

        if (this.callbacks.onTick) this.callbacks.onTick(this.pomodoroSeconds);
        if (this.callbacks.updateFloatingTimer) this.callbacks.updateFloatingTimer();
    },

    switchMode() {
        this.stopInterval();
        this.pomodoroRunning = false;

        if (this.pomodoroMode === 'work') {
            this.completedPomodoros++;
            this.totalPomodorosToday++;

            // Track session stats via Store
            const execState = Store.getActiveExecution();
            const sessionStats = { ...(execState.sessionStats || {}) };
            sessionStats.pomodorosUsed = (sessionStats.pomodorosUsed || 0) + 1;
            Store.updateActiveExecution({ sessionStats });

            this.pomodoroMode = 'break';
            const isLongBreak = this.completedPomodoros >= this.pomodorosBeforeLongBreak;

            if (isLongBreak) {
                this.pomodoroSeconds = this.longBreakDuration;
                this.completedPomodoros = 0; // Reset cycle
                this.notify('🎉 Great work! Long break time!', `You completed ${this.pomodorosBeforeLongBreak} Pomodoros! Enjoy a 20-min break.`);
            } else {
                this.pomodoroSeconds = this.breakDuration;
                this.notify('🎉 Focus session complete!', `Pomodoro ${this.completedPomodoros}/${this.pomodorosBeforeLongBreak} done. Short break time!`);
            }
        } else {
            this.pomodoroMode = 'work';
            this.pomodoroSeconds = this.workDuration;
            this.notify('💪 Break over!', `Ready for Pomodoro ${this.completedPomodoros + 1}/${this.pomodorosBeforeLongBreak}?`);
        }

        FocusModeUI.updatePomodoroStartPauseButton(false);
        FocusModeUI.updatePomodoroCounter(this.completedPomodoros, this.pomodorosBeforeLongBreak, this.totalPomodorosToday);

        this.updateDisplay();
        this.persistState();

        if (this.callbacks.onModeSwitch) this.callbacks.onModeSwitch(this.pomodoroMode);
        if (this.callbacks.updateFloatingTimer) this.callbacks.updateFloatingTimer();
    },

    updateDisplay() {
        const totalSeconds = this.pomodoroMode === 'work' ? this.workDuration : this.breakDuration;
        FocusModeUI.updatePomodoroTimer(this.pomodoroSeconds, totalSeconds, this.pomodoroMode);
    },

    notify(title, body) {
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            new Notification(title, { body });
        }
    },

    persistState() {
        const data = {
            completedPomodoros: this.completedPomodoros,
            totalPomodorosToday: this.totalPomodorosToday,
            pomodoroSeconds: this.pomodoroRunning ? Math.round((this.pomodoroTargetEpoch - Date.now()) / 1000) : this.pomodoroSeconds,
            pomodoroMode: this.pomodoroMode,
            pomodoroRunning: this.pomodoroRunning,
            lastUpdate: Date.now(),
            pomodoroSessionDate: new Date().toDateString()
        };
        localStorage.setItem('focus_pomodoro_state', JSON.stringify(data));
    },

    restoreState() {
        const saved = localStorage.getItem('focus_pomodoro_state');
        if (!saved) return;

        const data = JSON.parse(saved);

        // Handle daily reset
        if (data.pomodoroSessionDate !== new Date().toDateString()) {
            this.totalPomodorosToday = 0;
            return;
        }

        this.completedPomodoros = data.completedPomodoros || 0;
        this.totalPomodorosToday = data.totalPomodorosToday || 0;
        this.pomodoroMode = data.pomodoroMode || 'work';
        this.pomodoroRunning = data.pomodoroRunning || false;

        if (this.pomodoroRunning && data.lastUpdate) {
            const elapsed = Math.round((Date.now() - data.lastUpdate) / 1000);
            this.pomodoroSeconds = Math.max(0, data.pomodoroSeconds - elapsed);
            if (this.pomodoroSeconds > 0) {
                this.start();
            } else {
                this.pomodoroSeconds = 0;
                this.switchMode();
            }
        } else {
            this.pomodoroSeconds = data.pomodoroSeconds || this.workDuration;
            this.updateDisplay();
        }

        FocusModeUI.updatePomodoroCounter(this.completedPomodoros, this.pomodorosBeforeLongBreak, this.totalPomodorosToday);
    },

    cleanup() {
        this.stopInterval();
    }
};
