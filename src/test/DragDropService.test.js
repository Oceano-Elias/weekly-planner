/**
 * DragDropService Tests
 * Tests for time slot utilities and availability checking
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DragDropService } from '../services/DragDropService.js';
import { Store } from '../store.js';

describe('DragDropService', () => {
    beforeEach(() => {
        // Reset cached state
        DragDropService.dayTasksCache = {};
        DragDropService.hitTestCache = null;
        DragDropService.lastIndicatorKey = '';
        DragDropService.collisionTasks = [];
    });

    describe('getSlotIndexFromTime', () => {
        it('should convert 08:00 to slot 0', () => {
            expect(DragDropService.getSlotIndexFromTime('08:00')).toBe(0);
        });

        it('should convert 08:30 to slot 1', () => {
            expect(DragDropService.getSlotIndexFromTime('08:30')).toBe(1);
        });

        it('should convert 12:00 to slot 8', () => {
            expect(DragDropService.getSlotIndexFromTime('12:00')).toBe(8);
        });

        it('should convert 20:00 to slot 24', () => {
            expect(DragDropService.getSlotIndexFromTime('20:00')).toBe(24);
        });

        it('should handle null/undefined gracefully', () => {
            expect(DragDropService.getSlotIndexFromTime(null)).toBe(null);
            expect(DragDropService.getSlotIndexFromTime(undefined)).toBe(null);
        });
    });

    describe('getTimeFromSlotIndex', () => {
        it('should convert slot 0 to 08:00', () => {
            expect(DragDropService.getTimeFromSlotIndex(0)).toBe('08:00');
        });

        it('should convert slot 1 to 08:30', () => {
            expect(DragDropService.getTimeFromSlotIndex(1)).toBe('08:30');
        });

        it('should convert slot 8 to 12:00', () => {
            expect(DragDropService.getTimeFromSlotIndex(8)).toBe('12:00');
        });

        it('should convert slot 24 to 20:00', () => {
            expect(DragDropService.getTimeFromSlotIndex(24)).toBe('20:00');
        });

        it('should handle large slot indices', () => {
            // Slot 26 = 21:00
            expect(DragDropService.getTimeFromSlotIndex(26)).toBe('21:00');
        });
    });

    describe('Time conversion round-trip', () => {
        it('should round-trip 09:30 correctly', () => {
            const time = '09:30';
            const slot = DragDropService.getSlotIndexFromTime(time);
            expect(DragDropService.getTimeFromSlotIndex(slot)).toBe(time);
        });

        it('should round-trip 15:00 correctly', () => {
            const time = '15:00';
            const slot = DragDropService.getSlotIndexFromTime(time);
            expect(DragDropService.getTimeFromSlotIndex(slot)).toBe(time);
        });
    });
});
