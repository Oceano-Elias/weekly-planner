/**
 * TaskIdParser - Pure utility for parsing task ID strings
 *
 * Task IDs come in three formats:
 *   1. Legacy queue tasks:          "task_123"
 *   2. Standalone week tasks:       "week_2026-W01_inst_5"
 *   3. Template-based week tasks:   "template_123_2026-W01"
 */

/**
 * Parse a task ID string into its constituent parts.
 * Returns null if the ID does not match any known format.
 *
 * @param {string} taskId
 * @returns {{ type: 'legacy' } |
 *           { type: 'week_standalone', weekId: string, suffix: string } |
 *           { type: 'template', weekId: string, templateId: string } |
 *           null}
 */
export function parseTaskId(taskId) {
    if (!taskId || typeof taskId !== 'string') return null;

    // Pattern 1: Standalone week task  "week_2026-W01_inst_5"
    if (taskId.startsWith('week_')) {
        const parts = taskId.split('_');
        // parts[0] = 'week', parts[1] = weekId (e.g. '2026-W01'), rest = instance suffix
        const weekId = parts[1];
        const suffix = parts.slice(2).join('_');
        if (!weekId || !suffix) return null;
        return { type: 'week_standalone', weekId, suffix };
    }

    // Pattern 2: Template-based week task  "template_123_2026-W01"
    if (taskId.startsWith('template_')) {
        const parts = taskId.split('_');
        if (parts.length < 3) return null;
        // Last part is the weekId, everything before it is the templateId
        const weekId = parts[parts.length - 1];
        const templateId = parts.slice(0, -1).join('_');
        return { type: 'template', weekId, templateId };
    }

    // Pattern 3: Legacy task — anything else (e.g. "task_123")
    return { type: 'legacy' };
}

/**
 * Resolve an instance within a week's task list by the parsed suffix.
 * Suffix formats: "inst_5" (stable) or "idx_3" / "task_3" (legacy index).
 *
 * @param {Array} tasks - The weeklyInstances[weekId].tasks array
 * @param {string} suffix - The suffix portion of a week_standalone ID
 * @returns {Object|null} The matching instance, or null
 */
export function resolveWeekInstance(tasks, suffix) {
    if (!tasks || !suffix) return null;

    if (suffix.startsWith('inst_')) {
        return tasks.find((t) => t.instanceId === suffix) || null;
    }

    if (suffix.startsWith('idx_') || suffix.startsWith('task_')) {
        const idx = parseInt(suffix.split('_')[1]);
        return Number.isFinite(idx) ? tasks[idx] || null : null;
    }

    return null;
}
