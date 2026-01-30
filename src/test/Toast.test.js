/**
 * Toast Tests
 * Tests for the notification toast system
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Toast } from '../components/Toast.js';

describe('Toast', () => {
    beforeEach(() => {
        // Create a mock body and reset Toast state
        document.body.innerHTML = '';
        Toast.container = null;
        Toast.toasts = [];
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('init', () => {
        it('should create toast container on first init', () => {
            Toast.init();
            expect(Toast.container).toBeDefined();
            expect(Toast.container.classList.contains('toast-container')).toBe(true);
        });

        it('should not create multiple containers', () => {
            Toast.init();
            const firstContainer = Toast.container;
            Toast.init();
            expect(Toast.container).toBe(firstContainer);
        });
    });

    describe('add', () => {
        it('should add a toast to the list', () => {
            Toast.add('success', 'Test message', 'Test Title');
            expect(Toast.toasts).toHaveLength(1);
        });

        it('should create toast element in container', () => {
            Toast.add('info', 'Info message', 'Info');
            const toastEl = Toast.container.querySelector('.toast');
            expect(toastEl).not.toBeNull();
            expect(toastEl.classList.contains('toast-info')).toBe(true);
        });

        it('should enforce max toasts limit', () => {
            Toast.add('success', 'Toast 1', 'T1');
            Toast.add('success', 'Toast 2', 'T2');
            Toast.add('success', 'Toast 3', 'T3');
            Toast.add('success', 'Toast 4', 'T4'); // Should dismiss oldest

            // Should only have 3 toasts (maxToasts default)
            expect(Toast.toasts.length).toBeLessThanOrEqual(3);
        });
    });

    describe('convenience methods', () => {
        it('success should add success type toast', () => {
            Toast.success('Done!');
            expect(Toast.toasts[0].el.classList.contains('toast-success')).toBe(true);
        });

        it('error should add error type toast', () => {
            Toast.error('Failed!');
            expect(Toast.toasts[0].el.classList.contains('toast-error')).toBe(true);
        });

        it('warning should add warning type toast', () => {
            Toast.warning('Watch out!');
            expect(Toast.toasts[0].el.classList.contains('toast-warning')).toBe(true);
        });

        it('info should add info type toast', () => {
            Toast.info('FYI');
            expect(Toast.toasts[0].el.classList.contains('toast-info')).toBe(true);
        });
    });

    describe('dismiss', () => {
        it('should remove toast from list', () => {
            Toast.add('success', 'Test', 'Title');
            const toastId = Toast.toasts[0].id;
            Toast.dismiss(toastId);
            expect(Toast.toasts).toHaveLength(0);
        });

        it('should handle invalid id gracefully', () => {
            Toast.add('success', 'Test', 'Title');
            expect(() => Toast.dismiss(999999)).not.toThrow();
            expect(Toast.toasts).toHaveLength(1); // Original still there
        });
    });

    describe('auto-dismiss timer', () => {
        it('should auto-dismiss after default duration', () => {
            Toast.add('success', 'Auto dismiss', 'Title');
            expect(Toast.toasts).toHaveLength(1);

            vi.advanceTimersByTime(Toast.defaultDuration + 100);
            expect(Toast.toasts).toHaveLength(0);
        });
    });

    describe('getIconForType', () => {
        it('should return SVG for success type', () => {
            const icon = Toast.getIconForType('success');
            expect(icon.tagName.toLowerCase()).toBe('svg');
        });

        it('should return SVG for error type', () => {
            const icon = Toast.getIconForType('error');
            expect(icon.tagName.toLowerCase()).toBe('svg');
        });

        it('should return SVG for info type (default)', () => {
            const icon = Toast.getIconForType('unknown');
            expect(icon.tagName.toLowerCase()).toBe('svg');
        });
    });
});
