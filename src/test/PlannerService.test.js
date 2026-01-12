import { describe, it, expect } from 'vitest';
import { PlannerService } from '../services/PlannerService';

describe('PlannerService', () => {
    describe('getWeekStart', () => {
        it('should return Monday as the start of the week for a mid-week date', () => {
            const date = new Date('2026-01-08'); // Thursday
            const weekStart = PlannerService.getWeekStart(date);
            expect(weekStart.getDay()).toBe(1); // Monday
            expect(weekStart.getDate()).toBe(5); // Jan 5th
        });

        it('should return the same date if it is already Monday', () => {
            const date = new Date('2026-01-05'); // Monday
            const weekStart = PlannerService.getWeekStart(date);
            expect(weekStart.getDate()).toBe(5);
        });

        it('should handle Sunday correctly (return the previous Monday)', () => {
            const date = new Date('2026-01-11'); // Sunday
            const weekStart = PlannerService.getWeekStart(date);
            expect(weekStart.getDate()).toBe(5);
        });
    });

    describe('formatDate', () => {
        it('should format date correctly to YYYY-MM-DD', () => {
            const date = new Date('2026-01-05');
            expect(PlannerService.formatDate(date)).toBe('2026-01-05');
        });

        it('should handle padding for months and days', () => {
            const date = new Date('2026-10-10');
            expect(PlannerService.formatDate(date)).toBe('2026-10-10');
        });
    });

    describe('getWeekDays', () => {
        it('should return 7 days starting from Monday', () => {
            const monday = new Date('2026-01-05');
            const days = PlannerService.getWeekDays(monday);
            expect(days).toHaveLength(7);
            expect(days[0].getDate()).toBe(5);
            expect(days[6].getDate()).toBe(11);
        });
    });
});
