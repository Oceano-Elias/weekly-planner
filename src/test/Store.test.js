import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Store } from '../store';

describe('Store', () => {
    beforeEach(() => {
        Store.reset();
        localStorage.clear();
    });

    it('should allow components to subscribe and receive notifications', () => {
        const callback = vi.fn();
        Store.subscribe(callback);

        Store.notify();
        expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should add a task and notify subscribers', () => {
        const callback = vi.fn();
        Store.subscribe(callback);

        const taskData = {
            title: 'Test Task',
            duration: 60,
            dept1: 'WORK'
        };

        Store.addTask(taskData);

        const state = Store.getState();
        expect(state.tasks).toHaveLength(1);
        expect(state.tasks[0].title).toBe('Test Task');
        expect(callback).toHaveBeenCalled();
    });

    it('should update a task and notify subscribers', () => {
        const taskData = { title: 'Old Title', duration: 60, dept1: 'WORK' };
        Store.addTask(taskData);
        const task = Store.getState().tasks[0];

        const callback = vi.fn();
        Store.subscribe(callback);

        Store.updateTask(task.id, { title: 'New Title' });

        expect(Store.getState().tasks[0].title).toBe('New Title');
        expect(callback).toHaveBeenCalled();
    });

    it('should delete a task and notify subscribers', () => {
        Store.addTask({ title: 'To Delete', duration: 30, dept1: 'PERSONAL' });
        const task = Store.getState().tasks[0];

        const callback = vi.fn();
        Store.subscribe(callback);

        Store.deleteTask(task.id);

        expect(Store.getState().tasks).toHaveLength(0);
        expect(callback).toHaveBeenCalled();
    });

    it('should set current week and notify subscribers', () => {
        const callback = vi.fn();
        Store.subscribe(callback);

        const newDate = new Date('2026-02-01');
        Store.setCurrentWeek(newDate);

        expect(Store.getState().currentWeekStart).toBeDefined();
        expect(callback).toHaveBeenCalled();
    });
});
