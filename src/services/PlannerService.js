/**
 * Planner Service - Time-related utilities and constants
 */

export const PlannerService = {
    // Calendar time constants
    SLOT_DURATION: 30, // minutes per slot
    CELL_HEIGHT: 56, // pixels per cell (matching CSS --calendar-cell-height)
    DEFAULT_DURATION: 60, // default task duration
    MIN_DURATION: 15, // minimum task duration
    MAX_DURATION: 480, // maximum task duration (8 hours)
    START_HOUR: 8, // calendar start hour
    END_HOUR: 19, // calendar end hour
    MAX_DEPT_LEVELS: 4, // max department hierarchy depth
    DAYS: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
    DAY_LABELS: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],

    /**
     * Get the Monday of the week containing the given date
     */
    getWeekStart(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(d.setDate(diff));
        monday.setHours(0, 0, 0, 0);
        return monday;
    },

    /**
     * Get the 7 days of the week starting from the given Monday
     */
    getWeekDays(monday) {
        return Array.from({ length: 7 }, (_, i) => {
            const date = new Date(monday);
            date.setDate(monday.getDate() + i);
            return date;
        });
    },

    /**
     * Format a date to YYYY-MM-DD
     */
    formatDate(date) {
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },

    /**
     * Format duration for display
     */
    formatDuration(minutes) {
        if (minutes < 60) return `${minutes}m`;
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    },

    /**
     * Check if a time slot is available for a given duration
     */
    isSlotAvailable(startTime, duration, dayTasks, excludeTaskId = null) {
        const [startHour, startMin] = startTime.split(':').map(Number);
        const startTotal = startHour * 60 + startMin;
        const endTotal = startTotal + duration;

        const dayStart = this.START_HOUR * 60;
        const dayEnd = this.END_HOUR * 60;
        if (startTotal < dayStart || endTotal > dayEnd) return false;

        for (const task of dayTasks) {
            if (task.id === excludeTaskId) continue;
            if (!task.scheduledTime) continue;

            const [taskHour, taskMin] = task.scheduledTime.split(':').map(Number);
            const taskStart = taskHour * 60 + taskMin;
            const taskEnd = taskStart + task.duration;

            // Check overlap
            if (startTotal < taskEnd && endTotal > taskStart) {
                return false;
            }
        }
        return true;
    },

    /**
     * Get the week key for storing/loading template data
     */
    getWeekKey(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(d.setDate(diff));
        monday.setHours(0, 0, 0, 0);
        return monday.toISOString().split('T')[0];
    },

    /**
     * Get the week identifier (e.g., '2026-W01')
     * Robust logic: uses the Monday of the week to determine the year
     */
    getWeekIdentifier(date) {
        const monday = this.getWeekStart(date);
        const year = monday.getFullYear();

        // Calculate week number relative to the start of the year
        const yearStart = new Date(year, 0, 1);
        const dayOffset = (monday - yearStart) / 86400000;
        const week = Math.floor(dayOffset / 7) + 1;

        return `${year}-W${String(week).padStart(2, '0')}`;
    },

    /**
     * Get the previous week's identifier
     */
    getPreviousWeekId(weekId) {
        const [year, weekStr] = weekId.split('-W');
        const targetWeek = parseInt(weekStr);
        const yearInt = parseInt(year);

        // Initial guess: Jan 1 + (week * 7) days (overshoot slightly to ensure we hit at least the week)
        let date = new Date(yearInt, 0, 1 + (targetWeek * 7));

        // Align to Monday
        let monday = this.getWeekStart(date);

        // Check what week this date actually is
        let foundId = this.getWeekIdentifier(monday);

        // Optimization: prevent infinite loops (though highly unlikely with week logic)
        let attempts = 0;

        // Adjust if we missed the target week
        while (foundId !== weekId && attempts < 10) {
            const [fYear, fWeek] = foundId.split('-W');
            // If completely wrong year, break (should rely on simple logic then)
            if (parseInt(fYear) !== yearInt && targetWeek > 5 && targetWeek < 50) break;

            const fWeekInt = parseInt(fWeek);

            if (fWeekInt > targetWeek) {
                // We are too far ahead, go back
                monday.setDate(monday.getDate() - 7);
            } else if (fWeekInt < targetWeek) {
                // We are behind, go forward
                monday.setDate(monday.getDate() + 7);
            }
            foundId = this.getWeekIdentifier(monday);
            attempts++;
        }

        // Now monday should be the start of the CURRENT week.
        // Go back 7 days for PREVIOUS week.
        monday.setDate(monday.getDate() - 7);

        return this.getWeekIdentifier(monday);
    },

    /**
     * Escape HTML for safe display
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    /**
     * Simple throttle implementation
     */
    throttle(func, limit) {
        let inThrottle;
        return function () {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => (inThrottle = false), limit);
            }
        };
    },
};
