/**
 * DevLog - Development-only logging utility
 * All calls are stripped in production builds by Vite
 */

const isDev = import.meta.env.DEV;

export const DevLog = {
    log(...args) {
        if (isDev) console.log(...args);
    },

    warn(...args) {
        if (isDev) console.warn(...args);
    },

    info(...args) {
        if (isDev) console.info(...args);
    },

    // Errors always log (they're important)
    error(...args) {
        console.error(...args);
    },
};
