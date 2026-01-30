import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TimerService } from '../services/TimerService';
import { Store } from '../store';

vi.mock('../components/FocusModeUI', () => ({
    FocusModeUI: {
        updatePomodoroTimer: vi.fn(),
        updatePomodoroStartPauseButton: vi.fn(),
        updatePomodoroCounter: vi.fn(),
    }
}));

describe('TimerService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        Store.reset();
        localStorage.clear();
        TimerService.cleanup();
        TimerService.init();
    });

    it('should start and pause correctly', () => {
        TimerService.start();
        expect(TimerService.pomodoroRunning).toBe(true);

        TimerService.pause();
        expect(TimerService.pomodoroRunning).toBe(false);
    });

    it('should decrement seconds on tick', () => {
        TimerService.pomodoroSeconds = 100;
        TimerService.tick();
        expect(TimerService.pomodoroSeconds).toBe(99);
    });

    it('should switch mode when timer reaches zero', () => {
        TimerService.pomodoroSeconds = 1;
        TimerService.pomodoroMode = 'work';

        TimerService.tick();

        expect(TimerService.pomodoroMode).toBe('break');
        expect(TimerService.completedPomodoros).toBe(1);
    });

    it('should trigger long break after set number of pomodoros', () => {
        TimerService.pomodorosBeforeLongBreak = 2;
        TimerService.completedPomodoros = 1;
        TimerService.pomodoroMode = 'work';
        TimerService.pomodoroSeconds = 1;

        TimerService.tick();

        expect(TimerService.pomodoroMode).toBe('break');
        expect(TimerService.pomodoroSeconds).toBe(TimerService.longBreakDuration);
        expect(TimerService.completedPomodoros).toBe(0);
    });

    it('should persist and restore state from localStorage', () => {
        TimerService.completedPomodoros = 3;
        TimerService.persistState();

        TimerService.completedPomodoros = 0;
        TimerService.restoreState();

        expect(TimerService.completedPomodoros).toBe(3);
    });
});
