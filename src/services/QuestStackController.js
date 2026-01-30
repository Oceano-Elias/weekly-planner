/**
 * QuestStackController - Manages carousel navigation and mini-task step logic
 */

import { Store } from '../store.js';
import { FocusModeUI } from '../components/FocusModeUI.js';
import { FocusAudio } from '../utils/FocusAudio.js';
import { Rewards } from './Rewards.js';

export const QuestStackController = {
    activeTaskId: null,
    carouselAnimating: false,
    lastDoneStepIndex: null,

    callbacks: {
        onStepComplete: null,
        onNavigate: null,
        showSuccessVisuals: null,
        startStepTimer: null
    },

    init(taskId, callbacks = {}) {
        this.activeTaskId = taskId;
        this.callbacks = { ...this.callbacks, ...callbacks };
        this.carouselAnimating = false;
        this.lastDoneStepIndex = null;
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
                    // Show Reward (Centered)
                    Rewards.show(window.innerWidth / 2, window.innerHeight * 0.35);
                    if (this.callbacks.showSuccessVisuals) this.callbacks.showSuccessVisuals();
                }
                : () => {
                    this.recordStepCompletion(fromIndex, 'skipped');
                },
            onFinish: () => {
                this.lastDoneStepIndex = fromIndex;
                this.carouselAnimating = false;
                Store.updateActiveExecution({ currentStepIndex: toIndex });
                if (this.callbacks.startStepTimer) this.callbacks.startStepTimer(toIndex, steps);
                if (this.callbacks.onNavigate) this.callbacks.onNavigate(toIndex);
            }
        });
    },

    animateCarouselRollReverse(toIndex) {
        if (this.carouselAnimating) return;
        const state = Store.getActiveExecution();
        const fromIndex = state.currentStepIndex;
        if (toIndex === -1 || toIndex === fromIndex) return;

        this.carouselAnimating = true;

        const task = Store.getTask(this.activeTaskId);
        const steps = (task?.notes || '').split('\n').filter((l) => l.trim() !== '');

        FocusModeUI.animateBackwardRoll({
            fromIndex,
            toIndex,
            task,
            onFinish: () => {
                this.carouselAnimating = false;
                Store.updateActiveExecution({ currentStepIndex: toIndex });
                if (this.callbacks.startStepTimer) this.callbacks.startStepTimer(toIndex, steps);
                if (this.callbacks.onNavigate) this.callbacks.onNavigate(toIndex);
            }
        });
    },

    toggleMiniTask(index, skipUpdate = false) {
        const task = Store.getTask(this.activeTaskId);
        if (!task || !task.notes) return;

        const lines = task.notes.split('\n');
        let counter = 0;
        let lineIndex = -1;

        for (let i = 0; i < lines.length; i++) {
            if (lines[i].trim() !== '') {
                if (counter === index) {
                    lineIndex = i;
                    break;
                }
                counter++;
            }
        }

        if (lineIndex !== -1) {
            const line = lines[lineIndex];
            if (line.includes('[ ]')) {
                lines[lineIndex] = line.replace('[ ]', '[x]');
            } else if (line.includes('[x]')) {
                lines[lineIndex] = line.replace('[x]', '[ ]');
            }

            Store.updateTaskNotesForWeek(this.activeTaskId, lines.join('\n'));
            if (!skipUpdate && this.callbacks.onNavigate) {
                this.callbacks.onNavigate(Store.getActiveExecution().currentStepIndex);
            }
        }
    },

    startStepTimer(index, steps) {
        if (index < 0 || index >= steps.length) return;

        const state = Store.getActiveExecution();
        const stepTimings = [...(state.stepTimings || [])];

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
    }
};
