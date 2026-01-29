import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Store } from '../store.js';

describe('Store Observer Pattern', () => {
    beforeEach(() => {
        Store.reset();
    });

    it('should allow components to subscribe to changes', () => {
        const callback = vi.fn();
        Store.subscribe(callback);

        // Trigger mutation
        Store.addTask({ title: 'Test Task' });

        expect(callback).toHaveBeenCalled();
    });

    it('should notify all subscribers', () => {
        const v1 = vi.fn();
        const v2 = vi.fn();

        Store.subscribe(v1);
        Store.subscribe(v2);

        Store.addTask({ title: 'Test Task' });

        expect(v1).toHaveBeenCalled();
        expect(v2).toHaveBeenCalled();
    });

    it('should allow unsubscribing', () => {
        const callback = vi.fn();
        const unsubscribe = Store.subscribe(callback);

        unsubscribe();
        Store.addTask({ title: 'Test Task' });

        expect(callback).not.toHaveBeenCalled();
    });

    it('should notify on task update', () => {
        const callback = vi.fn();
        const task = Store.addTask({ title: 'Test' });

        Store.subscribe(callback);
        Store.updateTask(task.id, { title: 'Updated' });

        expect(callback).toHaveBeenCalled();
    });

    it('should notify on task delete', () => {
        const callback = vi.fn();
        const task = Store.addTask({ title: 'Test' });

        Store.subscribe(callback);
        Store.deleteTask(task.id);

        expect(callback).toHaveBeenCalled();
    });

    it('should notify on task schedule', () => {
        const callback = vi.fn();
        const task = Store.addTask({ title: 'Test' });

        Store.subscribe(callback);
        Store.scheduleTask(task.id, 'monday', '09:00');

        expect(callback).toHaveBeenCalled();
    });
});
