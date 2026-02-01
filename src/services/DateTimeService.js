/**
 * DateTimeService - Centralized date/time formatting
 * Uses system locale by default, respects user preferences
 */

// Default to system locale, can be overridden via localStorage
const getLocale = () => {
    const saved = localStorage.getItem('preferredLocale');
    return saved || navigator.language || 'en-US';
};

export const DateTimeService = {
    /**
     * Get current locale
     */
    getLocale,

    /**
     * Format date with locale
     */
    formatDate(date, options = {}) {
        return new Date(date).toLocaleDateString(getLocale(), options);
    },

    /**
     * Format time with locale
     */
    formatTime(date, options = {}) {
        return new Date(date).toLocaleTimeString(getLocale(), options);
    },

    /**
     * Format day header (e.g., "Mon 27")
     */
    formatDayHeader(date) {
        return this.formatDate(date, {
            weekday: 'short',
            day: 'numeric',
        });
    },

    /**
     * Format week range (e.g., "Jan 27 – Feb 2, 2026")
     */
    formatWeekRange(startDate, endDate) {
        const startOpts = { month: 'short', day: 'numeric' };
        const endOpts = { month: 'short', day: 'numeric', year: 'numeric' };
        const startStr = this.formatDate(startDate, startOpts);
        const endStr = this.formatDate(endDate, endOpts);
        return `${startStr} – ${endStr}`;
    },

    /**
     * Format current time (e.g., "10:30 AM")
     */
    formatCurrentTime(date = new Date()) {
        return this.formatTime(date, {
            hour: 'numeric',
            minute: '2-digit',
        });
    },

    /**
     * Format day view header (e.g., "Wednesday, January 29, 2026")
     */
    formatFullDate(date) {
        return this.formatDate(date, {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
        });
    },
};
