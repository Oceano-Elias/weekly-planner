import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QuestStackController } from '../services/QuestStackController';
import { Store } from '../store';

vi.mock('../components/FocusModeUI', () => ({
    FocusModeUI: {
        animateForwardRoll: vi.fn(),
        animateBackwardRoll: vi.fn(),
        updateQuestStack: vi.fn(),
    },
}));

vi.mock('../services/Rewards', () => ({
    Rewards: {
        show: vi.fn(),
    },
}));

describe('QuestStackController', () => {
    let mockTask;

    beforeEach(() => {
        vi.clearAllMocks();
        Store.reset();
        localStorage.clear();

        mockTask = {
            id: 'test-task',
            notes: '[ ] Step 1\n[ ] Step 2',
            completed: false,
        };

        // Mock Store.getTask to return our mock task
        vi.spyOn(Store, 'getTask').mockImplementation((id) => {
            if (id === 'test-task') return mockTask;
            return null;
        });

        // Mock Store.updateTaskNotesForWeek to update our mock task
        vi.spyOn(Store, 'updateTaskNotesForWeek').mockImplementation((id, notes) => {
            if (id === 'test-task') mockTask.notes = notes;
        });

        QuestStackController.init('test-task');
    });

    it('should initialize with correct task index', () => {
        expect(QuestStackController.activeTaskId).toBe('test-task');
    });

    it('should toggle mini task completion', () => {
        QuestStackController.toggleMiniTask(0);
        expect(mockTask.notes).toContain('[x] Step 1');
    });

    it('should record step completion in execution state', () => {
        const steps = ['Step 1', 'Step 2'];
        QuestStackController.startStepTimer(0, steps);

        let exec = Store.getActiveExecution();
        expect(exec.stepTimings).toHaveLength(1);
        expect(exec.stepTimings[0].status).toBe('active');

        QuestStackController.recordStepCompletion(0, 'completed');
        exec = Store.getActiveExecution();
        expect(exec.stepTimings[0].status).toBe('completed');
    });
});
