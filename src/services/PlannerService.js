/**
 * Planner Service - Time-related utilities and constants
 */

export const PlannerService = {
    // Calendar time constants
    SLOT_DURATION: 30,      // minutes per slot
    CELL_HEIGHT: 60,        // pixels per cell
    DEFAULT_DURATION: 60,   // default task duration
    MIN_DURATION: 15,       // minimum task duration
    MAX_DURATION: 480,      // maximum task duration (8 hours)
    START_HOUR: 8,          // calendar start hour
    END_HOUR: 19,           // calendar end hour
    MAX_DEPT_LEVELS: 4,     // max department hierarchy depth
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
     * Escape HTML for safe display
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};
