/**
 * Store - Task data management with localStorage persistence
 */

import { PlannerService } from './services/PlannerService.js';

const STORAGE_KEY = 'weeklyPlanner_v3';

const initialState = {
    tasks: [], // Legacy - will be migrated to weekly system
    nextId: 1,
    currentWeekStart: null,

    // New recurring weekly system
    templates: [], // Task templates (the recurring pattern)
    weeklyInstances: {}, // Per-week state: { '2026-W01': { tasks: [...] } }
    migrated: false, // Migration flag

    // Kept for compatibility
    goals: {},
    // Focus Mode Statistics
    focusStats: {
        sessions: [], // Array of { date, duration, taskId, stepsCompleted }
        currentStreak: 0,
        totalFocusTime: 0,
        lastSessionDate: null,
    },
    // Professional Execution System
    activeExecution: {
        taskId: null,
        sessionStartTime: null,
        accumulatedTime: 0,
        running: false,
        phase: 'orientation', // 'orientation', 'execution', 'closure', 'decision', 'completed'
        mode: 'work', // 'work', 'break'
        breakStartTime: null,
        returnAnchor: '',
        currentStepIndex: -1,
        updatedAt: null,
        // Step timing tracking for Results Card
        stepTimings: [], // Array of { stepIndex, stepText, startedAt, completedAt, duration, status }
        pauseCount: 0, // Number of times user paused
        sessionStats: {
            // Session-level statistics
            startedAt: null,
            completedAt: null,
            totalFocusTime: 0,
            totalBreakTime: 0,
            pomodorosUsed: 0,
        },
    },
};

let state = { ...initialState };

let listeners = [];
let saveTimeout = null;

export const Store = {
    /**
     * Get the current state (primarily for testing)
     */
    getState() {
        return state;
    },

    /**
     * Reset store (primarily for testing)
     */
    reset() {
        state = JSON.parse(JSON.stringify(initialState));
        listeners = [];
    },

    /**
     * Initialize store
     */
    init() {
        this.load();
        this.setCurrentWeek(new Date());
        this.notify();
    },

    /**
     * Subscribe to store changes
     * @param {Function} callback
     * @returns {Function} Unsubscribe function
     */
    subscribe(callback) {
        listeners.push(callback);
        return () => {
            listeners = listeners.filter((l) => l !== callback);
        };
    },

    /**
     * Notify all listeners of a change
     */
    notify() {
        listeners.forEach((callback) => {
            try {
                callback();
            } catch (e) {
                console.error('Error in store listener:', e);
            }
        });
    },

    /**
     * Load from localStorage
     */
    load() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const data = JSON.parse(saved);
                state.tasks = data.tasks || [];
                state.nextId = data.nextId || 1;
                state.goals = data.goals || {};

                // New recurring system
                state.templates = data.templates || [];
                state.weeklyInstances = data.weeklyInstances || {};
                state.migrated = data.migrated || false;

                // Focus statistics
                state.focusStats = data.focusStats || {
                    sessions: [],
                    currentStreak: 0,
                    totalFocusTime: 0,
                    lastSessionDate: null,
                };

                // Professional Execution System
                state.activeExecution = data.activeExecution || {
                    taskId: null,
                    sessionStartTime: null,
                    accumulatedTime: 0,
                    running: false,
                    phase: 'orientation',
                    mode: 'work',
                    breakStartTime: null,
                    returnAnchor: '',
                    currentStepIndex: -1,
                    updatedAt: null,
                    stepTimings: [],
                    pauseCount: 0,
                    sessionStats: {
                        startedAt: null,
                        completedAt: null,
                        totalFocusTime: 0,
                        totalBreakTime: 0,
                        pomodorosUsed: 0,
                    },
                };
                // Ensure new fields exist on loaded state
                if (!state.activeExecution.stepTimings) state.activeExecution.stepTimings = [];
                if (!state.activeExecution.pauseCount) state.activeExecution.pauseCount = 0;
                if (!state.activeExecution.sessionStats) {
                    state.activeExecution.sessionStats = {
                        startedAt: null,
                        completedAt: null,
                        totalFocusTime: 0,
                        totalBreakTime: 0,
                        pomodorosUsed: 0,
                    };
                }
            }

            // Run migration if needed
            if (!state.migrated && state.tasks.length > 0) {
                this.migrateToWeeklySystem();
            }
        } catch (e) {
            console.error('Error loading from storage:', e);
        }
    },

    /**
     * Save to localStorage (Throttled/Debounced)
     */
    save(immediate = false) {
        if (saveTimeout) clearTimeout(saveTimeout);

        const performSave = () => {
            try {
                localStorage.setItem(
                    STORAGE_KEY,
                    JSON.stringify({
                        tasks: state.tasks,
                        nextId: state.nextId,
                        goals: state.goals,
                        templates: state.templates,
                        weeklyInstances: state.weeklyInstances,
                        migrated: state.migrated,
                        focusStats: state.focusStats,
                        activeExecution: state.activeExecution,
                    })
                );
                console.log('[Store] Changes persisted to localStorage');
            } catch (e) {
                console.error('Error saving to storage:', e);
            }
        };

        if (immediate) {
            performSave();
        } else {
            saveTimeout = setTimeout(performSave, 500); // 1s throttle
        }
    },

    /**
     * Set current week context
     */
    setCurrentWeek(date) {
        state.currentWeekStart = PlannerService.getWeekStart(date);
        this.notify();
    },

    /**
     * Get current week key
     */
    getCurrentWeekKey() {
        return PlannerService.getWeekKey(state.currentWeekStart);
    },

    /**
     * Add a new task
     */
    addTask({ title, goal = '', hierarchy, duration, notes = '' }) {
        const task = {
            id: `task_${state.nextId++}`,
            title,
            goal,
            hierarchy,
            duration,
            notes,
            completed: false,
            scheduledDay: null,
            scheduledTime: null,
            createdAt: Date.now(),
        };
        state.tasks.push(task);
        this.save();
        this.notify();
        return task;
    },

    /**
     * Update a task (Unified)
     */
    updateTask(taskId, updates) {
        const resolved = this._resolveTask(taskId);
        if (!resolved) return null;

        if (resolved.type === 'legacy') {
            Object.assign(resolved.task, updates);
        } else if (resolved.type === 'week_standalone') {
            Object.assign(resolved.instance, updates);
        } else if (resolved.type === 'template') {
            // Update the template itself
            Object.assign(resolved.template, updates);
            // Update the instance for this week
            if (updates.completed !== undefined) resolved.instance.completed = updates.completed;
            if (updates.notes !== undefined) resolved.instance.notes = updates.notes;
            if (updates.returnAnchor !== undefined)
                resolved.instance.returnAnchor = updates.returnAnchor;
            if (updates.sessionResult !== undefined)
                resolved.instance.sessionResult = updates.sessionResult;
        }

        this.save();
        this.notify();
        return this.getTask(taskId);
    },

    /**
     * Delete a task (Unified)
     */
    deleteTask(taskId) {
        const resolved = this._resolveTask(taskId);
        if (!resolved) return;

        if (resolved.type === 'legacy') {
            state.tasks = state.tasks.filter((t) => t.id !== taskId);
        } else if (resolved.type === 'week_standalone' || resolved.type === 'template') {
            const weekInstances = state.weeklyInstances[resolved.weekId];
            if (weekInstances) {
                weekInstances.tasks = weekInstances.tasks.filter(
                    (t) =>
                        (resolved.type === 'week_standalone' &&
                            t.instanceId !== resolved.instance.instanceId) ||
                        (resolved.type === 'template' && t.templateId !== resolved.templateId)
                );
            }

            // [NEW] If it was a template task, remove the template itself so it doesn't reappear in future weeks
            if (resolved.type === 'template') {
                const idToRemove = resolved.templateId;
                state.templates = state.templates.filter((t) => t.id !== idToRemove);

                // [FIX] Also clean up "orphan" instances in ALL weeks to prevent reappearing ghosts
                Object.keys(state.weeklyInstances).forEach(weekId => {
                    const week = state.weeklyInstances[weekId];
                    if (week.tasks) {
                        week.tasks = week.tasks.filter(t => t.templateId !== idToRemove);
                    }
                });
            }
        }

        this.save();
        this.notify();
    },

    /**
     * Get task by ID (Unified Resolver)
     */
    getTask(taskId) {
        if (!taskId) return null;
        const resolved = this._resolveTask(taskId);
        if (!resolved) return null;

        // Merge instance and template data if applicable
        if (resolved.type === 'template') {
            return {
                ...resolved.template,
                id: taskId,
                completed: resolved.instance.completed,
                notes: resolved.instance.notes,
                returnAnchor: resolved.instance.returnAnchor || '',
                scheduledDay: resolved.instance.scheduledDay || resolved.template.scheduledDay,
                scheduledTime: resolved.instance.scheduledTime || resolved.template.scheduledTime,
            };
        } else if (resolved.type === 'week_standalone') {
            return {
                id: taskId,
                ...resolved.instance,
            };
        }

        return resolved.task; // legacy
    },

    /**
     * Internal helper to resolve task reference from any ID format
     * @private
     */
    _resolveTask(taskId) {
        // pattern 1: Legacy tasks (task_123)
        if (
            !taskId.includes('_') ||
            (!taskId.startsWith('week_') && !taskId.startsWith('template_'))
        ) {
            const task = state.tasks.find((t) => t.id === taskId);
            return task ? { type: 'legacy', task } : null;
        }

        // pattern 2: Standalone week task (week_2026-W01_inst_5)
        if (taskId.startsWith('week_')) {
            const parts = taskId.split('_');
            const weekId = parts[1];
            const weekInstances = state.weeklyInstances[weekId];
            if (!weekInstances) return null;

            const suffix = parts.slice(2).join('_');
            let instance = null;
            if (suffix.startsWith('inst_')) {
                instance = weekInstances.tasks.find((t) => t.instanceId === suffix);
            } else if (suffix.startsWith('idx_') || suffix.startsWith('task_')) {
                const idx = parseInt(suffix.split('_')[1]);
                instance = weekInstances.tasks[idx];
            }
            return instance ? { type: 'week_standalone', instance, weekId } : null;
        }

        // pattern 3: Template-based week task (template_123_2026-W01)
        if (taskId.startsWith('template_')) {
            const parts = taskId.split('_');
            const weekId = parts[parts.length - 1];
            const templateId = parts.slice(0, -1).join('_');

            const template = state.templates.find((t) => t.id === templateId);
            const weekInstances = state.weeklyInstances[weekId];
            if (!template || !weekInstances) return null;

            const instance = weekInstances.tasks.find((t) => t.templateId === templateId);
            return instance ? { type: 'template', template, instance, weekId, templateId } : null;
        }

        return null;
    },

    /**
     * Get all queue tasks (unscheduled)
     */
    getQueueTasks() {
        return state.tasks.filter((t) => !t.scheduledDay);
    },

    /**
     * Get all scheduled tasks
     */
    getScheduledTasks() {
        return state.tasks.filter((t) => t.scheduledDay && t.scheduledTime);
    },

    getAllTasks() {
        const currentWeekId = this.getWeekIdentifier(state.currentWeekStart || new Date());
        const weekTasks = this.getTasksForWeek(currentWeekId);

        // Combine queue tasks and week tasks, avoiding duplicates by sourceTaskId
        const all = [...state.tasks];
        weekTasks.forEach(wt => {
            if (!all.find(t => t.id === wt.sourceTaskId || t.id === wt.id)) {
                all.push(wt);
            }
        });
        return all;
    },

    /**
     * Get tasks for a specific day (uses weekly system)
     */
    getTasksForDay(day) {
        const currentWeekId = this.getWeekIdentifier(state.currentWeekStart || new Date());
        const weekTasks = this.getTasksForWeek(currentWeekId);
        return weekTasks.filter((t) => t.scheduledDay === day);
    },

    /**
     * Schedule a task (adds to current week ONLY - does NOT create template)
     */
    scheduleTask(taskId, day, time, immediate = false) {
        const task = state.tasks.find((t) => t.id === taskId);
        if (!task) return null;

        // Update the legacy task
        task.scheduledDay = day;
        task.scheduledTime = time;

        const currentWeekId = this.getWeekIdentifier(state.currentWeekStart || new Date());
        if (!state.weeklyInstances[currentWeekId]) {
            state.weeklyInstances[currentWeekId] = { tasks: [] };
        }

        const weekTasks = state.weeklyInstances[currentWeekId].tasks;

        let existing = weekTasks.find((t) => t.sourceTaskId === taskId);
        if (!existing) {
            // Do NOT fallback to title matching. Quick Stamps (same title) should be distinct instances.
            // existing = weekTasks.find((t) => t.title === task.title);
        }

        if (existing) {
            console.log(
                `[Store] Updating existing instance for task: ${task.title} to ${day} ${time}`
            );
            // Update existing instance position
            existing.scheduledDay = day;
            existing.scheduledTime = time;
            existing.duration = task.duration;
            existing.hierarchy = [...(task.hierarchy || [])];
            existing.goal = task.goal || '';
            existing.notes = task.notes || '';
            if (!existing.sourceTaskId) existing.sourceTaskId = taskId;
        } else {
            console.log(`[Store] Creating new instance for task: ${task.title} on ${day} ${time}`);
            // Create a new week-specific entry
            state.weeklyInstances[currentWeekId].tasks.push({
                instanceId: `inst_${state.nextId++}`,
                templateId: null,
                sourceTaskId: taskId,
                title: task.title,
                goal: task.goal || '',
                hierarchy: [...(task.hierarchy || [])],
                duration: task.duration,
                completed: false,
                notes: task.notes || '',
                scheduledDay: day,
                scheduledTime: time,
            });
        }

        this.save(immediate);
        this.notify();
        return task;
    },

    /**
     * Reschedule a task within a week (for drag-and-drop of already scheduled tasks)
     */
    rescheduleTaskInWeek(taskId, day, time) {
        if (!taskId) return null;

        if (taskId.startsWith('task_')) {
            return this.scheduleTask(taskId, day, time, true);
        }

        // Handle standalone week task IDs (format: week_weekId_instanceId or legacy week_weekId_task_index)
        if (taskId.startsWith('week_')) {
            const parts = taskId.split('_');
            const weekId = parts[1]; // "2026-W01"

            const weekInstances = state.weeklyInstances[weekId];
            if (!weekInstances) return null;

            // Find the task by instanceId or by index (for legacy)
            const suffix = parts.slice(2).join('_');
            let instance = null;

            if (suffix.startsWith('inst_')) {
                instance = weekInstances.tasks.find((t) => t.instanceId === suffix);
            } else if (suffix.startsWith('idx_') || suffix.startsWith('task_')) {
                const taskIndex = parseInt(suffix.split('_')[1]);
                instance = weekInstances.tasks[taskIndex];
            }

            if (instance) {
                console.log(
                    `[Store] Rescheduling week-standalone instance ${taskId} to ${day} ${time}`
                );
                instance.scheduledDay = day;
                instance.scheduledTime = time;
                this.save(true); // Force immediate save for DnD
                this.notify();
                return this.getTask(taskId);
            }
            console.warn(`[Store] Week instance not found for ID: ${taskId}`);
            return null;
        }

        // Handle template-based week-specific IDs (format: template_X_weekId)
        if (taskId.split('_').length >= 3) {
            const parts = taskId.split('_');
            const weekId = parts[parts.length - 1];
            const templateId = parts.slice(0, -1).join('_');

            const weekInstances = state.weeklyInstances[weekId];
            if (!weekInstances) return null;

            const instance = weekInstances.tasks.find((t) => t.templateId === templateId);
            if (instance) {
                console.log(`[Store] Rescheduling template instance ${taskId} to ${day} ${time}`);
                instance.scheduledDay = day;
                instance.scheduledTime = time;
                this.save(true); // Force immediate save for DnD
                this.notify();
                return this.getTask(taskId);
            }
            console.warn(`[Store] Template instance not found for ID: ${taskId}`);
        }
        return null;
    },

    /**
     * Unschedule a task (move back to queue)
     */
    unscheduleTask(taskId, immediate = false) {
        const resolved = this._resolveTask(taskId);
        if (!resolved) return null;

        let taskToQueue = null;

        if (resolved.type === 'legacy') {
            resolved.task.scheduledDay = null;
            resolved.task.scheduledTime = null;
            taskToQueue = resolved.task;
        } else {
            // Create a queue task from the instance/template
            const source = resolved.type === 'template' ? resolved.template : resolved.instance;
            taskToQueue = {
                id: `task_${state.nextId++}`,
                title: source.title,
                goal: source.goal || '',
                hierarchy: [...(source.hierarchy || [])],
                duration: source.duration,
                notes: source.notes || '',
                completed: false,
                scheduledDay: null,
                scheduledTime: null,
                createdAt: Date.now(),
            };
            state.tasks.push(taskToQueue);

            // Remove from this week's instances
            const weekInstances = state.weeklyInstances[resolved.weekId];
            if (weekInstances) {
                weekInstances.tasks = weekInstances.tasks.filter(
                    (t) =>
                        (resolved.type === 'week_standalone' &&
                            t.instanceId !== resolved.instance.instanceId) ||
                        (resolved.type === 'template' && t.templateId !== resolved.templateId)
                );
            }

            // If it was a template task, we ALSO remove the template to prevent it reappearing
            if (resolved.type === 'template') {
                state.templates = state.templates.filter((t) => t.id !== resolved.templateId);
            }
        }

        this.save(immediate);
        this.notify();
        return taskToQueue;
    },

    /**
     * Toggle task completion
     */
    toggleComplete(taskId) {
        const task = state.tasks.find((t) => t.id === taskId);
        if (task) {
            task.completed = !task.completed;
            this.save();
            this.notify();
        }
        return task;
    },

    /**
     * Get goals
     */
    getGoals() {
        return state.goals || {};
    },

    /**
     * Save a daily goal
     */
    saveGoal(day, goal) {
        if (!state.goals) state.goals = {};
        state.goals[day] = goal;
        this.save();
        this.notify();
    },

    /**
     * Set the current week as the template (manual template control)
     */
    setTemplateFromCurrentWeek() {
        const currentWeekId = this.getWeekIdentifier(state.currentWeekStart || new Date());
        const currentWeekTasks = this.getTasksForWeek(currentWeekId);

        // Clear existing templates
        state.templates = [];

        // Convert current week tasks to templates
        currentWeekTasks.forEach((task) => {
            const templateId = `template_${state.nextId++}`;
            state.templates.push({
                id: templateId,
                title: task.title,
                goal: task.goal || '',
                hierarchy: [...task.hierarchy],
                duration: task.duration,
                notes: task.notes || '',
                scheduledDay: task.scheduledDay,
                scheduledTime: task.scheduledTime,
            });
        });

        // Clear all weekly instances for FUTURE weeks only
        // This forces future weeks to regenerate from the new template
        // Past weeks are preserved as history
        const weekIds = Object.keys(state.weeklyInstances);
        weekIds.forEach((weekId) => {
            if (weekId > currentWeekId) {
                delete state.weeklyInstances[weekId];
            }
        });

        this.save();
        this.notify();
    },

    /**
     * Get template count (for UI feedback)
     */
    getTemplateCount() {
        return state.templates.length;
    },

    /**
     * Reset current week to template
     */
    resetWeekToTemplate() {
        const currentWeekId = this.getWeekIdentifier(state.currentWeekStart || new Date());
        this.createWeekFromTemplate(currentWeekId);
        this.notify();
    },

    /**
     * Get week identifier (e.g., '2026-W01')
     */
    getWeekIdentifier(date) {
        return PlannerService.getWeekIdentifier(date);
    },

    /**
     * Copy all tasks from the previous week into the specified week
     * Returns true if tasks were copied, false if previous week was empty
     */
    copyFromPreviousWeek(targetWeekId) {
        const prevWeekId = PlannerService.getPreviousWeekId(targetWeekId);
        const prevTasks = this.getTasksForWeek(prevWeekId);

        if (prevTasks.length === 0) {
            console.log(`[Store] No tasks found in previous week (${prevWeekId}) to copy.`);
            return false;
        }

        // Initialize instance if missing
        if (!state.weeklyInstances[targetWeekId]) {
            state.weeklyInstances[targetWeekId] = { tasks: [] };
        }

        const currentTasks = state.weeklyInstances[targetWeekId].tasks;

        prevTasks.forEach((task) => {
            // Check if a task with the same title, time, and day already exists to avoid duplication
            const exists = currentTasks.some(
                (t) => t.title === task.title && t.scheduledTime === task.scheduledTime && t.scheduledDay === task.scheduledDay
            );

            if (!exists) {
                // If it's a template task, we add the template reference
                // If it's a standalone task, we clone it as a new standalone
                if (task.id.startsWith('template_')) {
                    const templateId = task.id.split('_').slice(0, 2).join('_');
                    currentTasks.push({
                        templateId: templateId,
                        completed: false,
                        notes: task.notes || '',
                        scheduledDay: task.scheduledDay,
                        scheduledTime: task.scheduledTime,
                        // [FIX] Copy overrides from the previous instance
                        duration: task.duration,
                        goal: task.goal || '',
                        hierarchy: [...(task.hierarchy || [])],
                        returnAnchor: task.returnAnchor || '',
                    });
                } else {
                    currentTasks.push({
                        instanceId: `inst_${state.nextId++}`,
                        templateId: null,
                        sourceTaskId: null,
                        title: task.title,
                        goal: task.goal || '',
                        hierarchy: [...(task.hierarchy || [])],
                        duration: task.duration,
                        completed: false,
                        notes: task.notes || '',
                        scheduledDay: task.scheduledDay,
                        scheduledTime: task.scheduledTime,
                    });
                }
            }
        });

        this.save();
        this.notify();
        return true;
    },

    /**
     * Check if week has instances
     */
    hasWeekInstances(weekId) {
        return !!state.weeklyInstances[weekId];
    },

    /**
     * Create week instances from templates
     */
    createWeekFromTemplate(weekId) {
        if (!state.templates || state.templates.length === 0) {
            state.weeklyInstances[weekId] = { tasks: [] };
            this.save();
            return;
        }

        state.weeklyInstances[weekId] = {
            tasks: state.templates.map((template) => ({
                templateId: template.id,
                completed: false,
                notes: template.notes || '',
                scheduledDay: template.scheduledDay,
                scheduledTime: template.scheduledTime,
            })),
        };
        this.save();
    },

    /**
     * Get tasks for a specific week (merges template + instance data, plus standalone tasks)
     */
    getTasksForWeek(weekId) {
        // Auto-create week if it doesn't exist
        if (!this.hasWeekInstances(weekId)) {
            this.createWeekFromTemplate(weekId);
        }

        const instances = state.weeklyInstances[weekId]?.tasks || [];

        return instances
            .map((instance, index) => {
                // If it has a template ID, it's a recurring task
                if (instance.templateId) {
                    const template = state.templates.find((t) => t.id === instance.templateId);
                    if (!template) return null;

                    return {
                        ...template,
                        id: `${template.id}_${weekId}`, // Unique ID per week
                        completed: instance.completed,
                        notes: instance.notes,
                        scheduledDay: instance.scheduledDay || template.scheduledDay,
                        scheduledTime: instance.scheduledTime || template.scheduledTime,
                    };
                } else {
                    // Standalone week-specific task (no template)
                    // Use stable instanceId if available, fallback to index for migration
                    const taskIdSuffix = instance.instanceId || `idx_${index}`;
                    return {
                        id: `week_${weekId}_${taskIdSuffix}`, // Stable unique ID
                        title: instance.title,
                        goal: instance.goal || '',
                        hierarchy: instance.hierarchy || [],
                        duration: instance.duration,
                        completed: instance.completed,
                        notes: instance.notes,
                        scheduledDay: instance.scheduledDay,
                        scheduledTime: instance.scheduledTime,
                    };
                }
            })
            .filter(Boolean);
    },

    /**
     * Migrate old system to new per-week system
     */
    migrateToWeeklySystem() {
        if (state.migrated) return;

        console.log('Migrating to per-week system...');

        // Create templates from currently scheduled tasks
        const scheduledTasks = state.tasks.filter((t) => t.scheduledDay && t.scheduledTime);

        state.templates = scheduledTasks.map((task, index) => ({
            id: `template_${state.nextId + index}`,
            title: task.title,
            goal: task.goal || '',
            hierarchy: [...task.hierarchy],
            duration: task.duration,
            scheduledDay: task.scheduledDay,
            scheduledTime: task.scheduledTime,
        }));

        state.nextId += scheduledTasks.length;

        // Create current week instance with existing state
        const currentWeekId = this.getWeekIdentifier(state.currentWeekStart || new Date());
        state.weeklyInstances[currentWeekId] = {
            tasks: state.templates.map((template) => {
                const originalTask = scheduledTasks.find(
                    (t) =>
                        t.title === template.title &&
                        t.scheduledDay === template.scheduledDay &&
                        t.scheduledTime === template.scheduledTime
                );
                return {
                    templateId: template.id,
                    completed: originalTask?.completed || false,
                    notes: originalTask?.notes || '',
                    scheduledDay: template.scheduledDay,
                    scheduledTime: template.scheduledTime,
                };
            }),
        };

        state.migrated = true;
        this.save();

        console.log(`Migration complete. Created ${state.templates.length} templates.`);
    },

    /**
     * Toggle task completion for a specific week
     * TaskId format: templateId_weekId (e.g., "template_1_2026-W01")
     */
    toggleCompleteForWeek(taskId) {
        if (!taskId) return null;

        // 1. Handle legacy tasks (no underscore or not matching new patterns)
        if (!taskId.includes('_')) {
            return this.toggleComplete(taskId);
        }

        // 2. Handle standalone week task IDs (format: week_weekId_instanceId)
        if (taskId.startsWith('week_')) {
            const parts = taskId.split('_');
            const weekId = parts[1]; // "2026-W01"
            const weekInstances = state.weeklyInstances[weekId];
            if (!weekInstances) return null;

            const suffix = parts.slice(2).join('_');
            let instance = null;

            if (suffix.startsWith('inst_')) {
                instance = weekInstances.tasks.find((t) => t.instanceId === suffix);
            } else if (suffix.startsWith('idx_') || suffix.startsWith('task_')) {
                const taskIndex = parseInt(suffix.split('_')[1]);
                instance = weekInstances.tasks[taskIndex];
            }

            if (instance) {
                instance.completed = !instance.completed;
                this.save();
                this.notify();
                return instance;
            }
            return null;
        }

        // 3. Handle template-based week-specific IDs (format: template_X_weekId)
        const parts = taskId.split('_');
        if (parts.length >= 3) {
            const weekId = parts[parts.length - 1]; // Last part is weekId
            const templateId = parts.slice(0, -1).join('_'); // Everything before is templateId

            const weekInstances = state.weeklyInstances[weekId];
            if (weekInstances) {
                const instance = weekInstances.tasks.find((t) => t.templateId === templateId);
                if (instance) {
                    instance.completed = !instance.completed;
                    this.save();
                    this.notify();
                    return instance;
                }
            }
        }

        return null;
    },

    /**
     * Advance task progress (complete next step or toggle task)
     * Returns { task, stepAdvanced: boolean }
     */
    advanceTaskProgress(taskId) {
        const task = this.getTask(taskId);
        if (!task) return null;

        let stepAdvanced = false;
        let notes = task.notes || '';

        // Find all lines that look like checklist items
        const lines = notes.split('\n');
        const firstIncompleteIndex = lines.findIndex((line) => line.includes('[ ]'));

        if (firstIncompleteIndex !== -1) {
            // Advance the first incomplete step
            lines[firstIncompleteIndex] = lines[firstIncompleteIndex].replace('[ ]', '[x]');
            notes = lines.join('\n');
            this.updateTaskNotesForWeek(taskId, notes);
            stepAdvanced = true;

            // Check if all steps are now complete
            const stillHasIncomplete = lines.some((line) => line.includes('[ ]'));
            if (!stillHasIncomplete && !task.completed) {
                // If this was the last step, mark the whole task as complete
                this.toggleCompleteForWeek(taskId);
            }
        } else {
            // No incomplete steps found, toggle the whole task
            this.toggleCompleteForWeek(taskId);
        }

        return { task: this.getTask(taskId), stepAdvanced };
    },

    /**
     * Update task notes for a specific week
     */
    updateTaskNotesForWeek(taskId, notes) {
        if (!taskId) return null;

        // Handle legacy tasks
        if (!taskId.includes('_')) {
            const task = state.tasks.find((t) => t.id === taskId);
            if (task) {
                task.notes = notes;
                this.save();
            }
            return task;
        }

        // Handle standalone week task IDs (format: week_weekId_instanceId or legacy week_weekId_task_index)
        if (taskId.startsWith('week_')) {
            const parts = taskId.split('_');
            const weekId = parts[1]; // "2026-W01"

            const weekInstances = state.weeklyInstances[weekId];
            if (!weekInstances) return null;

            // Find the task by instanceId or by index (for legacy)
            const suffix = parts.slice(2).join('_');
            let instance = null;

            if (suffix.startsWith('inst_')) {
                instance = weekInstances.tasks.find((t) => t.instanceId === suffix);
            } else if (suffix.startsWith('idx_') || suffix.startsWith('task_')) {
                const taskIndex = parseInt(suffix.split('_')[1]);
                instance = weekInstances.tasks[taskIndex];
            }

            if (instance) {
                instance.notes = notes;
                this.save();
                this.notify();
                return instance;
            }
            return null;
        }

        // Handle template-based week-specific IDs (format: template_X_weekId)
        if (taskId.split('_').length >= 3) {
            const parts = taskId.split('_');
            const weekId = parts[parts.length - 1];
            const templateId = parts.slice(0, -1).join('_');

            const weekInstances = state.weeklyInstances[weekId];
            if (!weekInstances) return null;

            const instance = weekInstances.tasks.find((t) => t.templateId === templateId);
            if (instance) {
                instance.notes = notes;
                this.save();
                this.notify();
                return instance;
            }
        }

        return null;
    },

    /**
     * Get the current active execution state
     */
    getActiveExecution() {
        return state.activeExecution;
    },

    /**
     * Update active execution state
     */
    updateActiveExecution(updates) {
        Object.assign(state.activeExecution, updates);
        state.activeExecution.updatedAt = Date.now();
        this.save();
        this.notify();
    },

    /**
     * Get analytics data
     */
    getAnalytics() {
        const scheduled = this.getScheduledTasks();
        const byHierarchy = {};

        scheduled.forEach((task) => {
            const topLevel = task.hierarchy[0] || 'Uncategorized';
            if (!byHierarchy[topLevel]) {
                byHierarchy[topLevel] = { total: 0, completed: 0 };
            }
            byHierarchy[topLevel].total += task.duration;
            if (task.completed) {
                byHierarchy[topLevel].completed += task.duration;
            }
        });

        return byHierarchy;
    },

    /**
     * Get analytics data for current week (includes mini-tasks)
     */
    getAnalyticsForWeek() {
        const currentWeekId = this.getWeekIdentifier(state.currentWeekStart || new Date());
        const weekTasks = this.getTasksForWeek(currentWeekId);

        const byHierarchy = {};
        let totalMiniTasks = 0;
        let completedMiniTasks = 0;
        let totalTasks = weekTasks.length;
        let completedTasks = 0;
        let totalDuration = 0;
        let completedDuration = 0;

        weekTasks.forEach((task) => {
            const topLevel = task.hierarchy[0] || 'Uncategorized';
            if (!byHierarchy[topLevel]) {
                byHierarchy[topLevel] = { total: 0, completed: 0 };
            }
            byHierarchy[topLevel].total += task.duration;
            totalDuration += task.duration;

            if (task.completed) {
                byHierarchy[topLevel].completed += task.duration;
                completedTasks++;
                completedDuration += task.duration;
            }

            // Count mini-tasks from notes
            if (task.notes) {
                const lines = task.notes.split('\n').filter((l) => l.trim() !== '');
                lines.forEach((line) => {
                    if (line.includes('[ ]') || line.includes('[x]')) {
                        totalMiniTasks++;
                        if (line.includes('[x]')) {
                            completedMiniTasks++;
                        }
                    }
                });
            }
        });

        return {
            byHierarchy,
            miniTasks: { total: totalMiniTasks, completed: completedMiniTasks },
            tasks: { total: totalTasks, completed: completedTasks },
            duration: { total: totalDuration, completed: completedDuration },
        };
    },

    /**
     * Get daily task stats for sparkline charts
     * Returns array of 7 days with completion percentages
     */
    getDailyStatsForWeek() {
        const currentWeekId = this.getWeekIdentifier(state.currentWeekStart || new Date());
        const weekTasks = this.getTasksForWeek(currentWeekId);
        const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

        return days.map((day) => {
            const dayTasks = weekTasks.filter((t) => t.scheduledDay === day);
            const total = dayTasks.length;
            const completed = dayTasks.filter((t) => t.completed).length;
            const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

            // Also count mini-tasks for that day
            let miniTotal = 0;
            let miniCompleted = 0;
            dayTasks.forEach((task) => {
                if (task.notes) {
                    const lines = task.notes.split('\n').filter((l) => l.trim() !== '');
                    lines.forEach((line) => {
                        if (line.includes('[ ]') || line.includes('[x]')) {
                            miniTotal++;
                            if (line.includes('[x]')) {
                                miniCompleted++;
                            }
                        }
                    });
                }
            });

            const miniPercent = miniTotal > 0 ? Math.round((miniCompleted / miniTotal) * 100) : 0;

            return {
                day: day.charAt(0).toUpperCase() + day.slice(1, 3),
                tasks: { total, completed, percent },
                miniTasks: { total: miniTotal, completed: miniCompleted, percent: miniPercent },
            };
        });
    },

    // ========================================
    // FOCUS MODE STATISTICS
    // ========================================

    /**
     * Get aggregated focus metrics for the current week
     * Used for "Deep Focus Time" and "Distraction Rate" cards
     */
    getFocusMetricsForWeek() {
        const currentWeekStart = state.currentWeekStart || new Date();
        const weekStart = PlannerService.getWeekStart(currentWeekStart).getTime();
        const weekEnd = weekStart + 7 * 24 * 60 * 60 * 1000;

        const sessions = state.focusStats.sessions.filter((s) => {
            // Handle both 'date' string (YYYY-MM-DD) and 'timestamp'
            const ts = s.timestamp ? s.timestamp : new Date(s.date).getTime();
            return ts >= weekStart && ts < weekEnd;
        });

        const totalFocusTimeMins = sessions.reduce((sum, s) => sum + (s.duration || 0), 0);
        const totalInterruptions = sessions.reduce((sum, s) => sum + (s.interruptions || 0), 0);
        const totalSessions = sessions.length;
        const totalVelocity = sessions.reduce((sum, s) => sum + (s.velocity || 0), 0);
        const avgVelocity = totalSessions > 0 ? (totalVelocity / totalSessions) : 0;

        // Distraction Rate = Interruptions / Hour of Focus
        // Avoid division by zero
        const hoursOfFocus = totalFocusTimeMins / 60;
        const distractionRate =
            hoursOfFocus > 0 ? Math.round((totalInterruptions / hoursOfFocus) * 10) / 10 : 0;

        return {
            totalFocusTime: totalFocusTimeMins, // Still in minutes
            avgInterruptions: distractionRate, // Interruptions per hour
            avgVelocity,
            totalSessions,
        };
    },

    /**
     * Record a focus session
     * @param {Object} sessionData - { taskId, duration, scheduledDuration, stepsCompleted, interruptions }
     */
    recordFocusSession({ taskId, duration, scheduledDuration, stepsCompleted = 0, interruptions = 0 }) {
        if (!state.focusStats) {
            state.focusStats = {
                sessions: [],
                currentStreak: 0,
                totalFocusTime: 0,
                lastSessionDate: null,
            };
        }

        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const velocity = scheduledDuration > 0 ? (duration / scheduledDuration) : 1;

        const session = {
            date: today,
            timestamp: Date.now(),
            duration, // Standardized to MINUTES
            scheduledDuration, // MINUTES
            velocity,
            taskId,
            stepsCompleted,
            interruptions,
        };

        state.focusStats.sessions.push(session);
        state.focusStats.totalFocusTime += duration;

        // Update streak
        const lastDate = state.focusStats.lastSessionDate;
        if (lastDate) {
            const lastDateObj = new Date(lastDate);
            const todayObj = new Date(today);
            const daysDiff = Math.floor((todayObj - lastDateObj) / (1000 * 60 * 60 * 24));

            if (daysDiff === 0) {
                // Same day, streak unchanged
            } else if (daysDiff === 1) {
                // Consecutive day, increment streak
                state.focusStats.currentStreak++;
            } else {
                // Streak broken, reset
                state.focusStats.currentStreak = 1;
            }
        } else {
            // First session ever
            state.focusStats.currentStreak = 1;
        }

        state.focusStats.lastSessionDate = today;
        this.save();
        this.notify();
    },

    /**
     * Get focus statistics
     * @returns {Object} Focus stats including sessions, streak, and total time
     */
    getFocusStats() {
        return (
            state.focusStats || {
                sessions: [],
                currentStreak: 0,
                totalFocusTime: 0,
                lastSessionDate: null,
            }
        );
    },

    /**
     * Get current focus streak
     * @returns {number} Current streak in days
     */
    getStreak() {
        const stats = this.getFocusStats();
        const today = new Date().toISOString().split('T')[0];
        const lastDate = stats.lastSessionDate;

        if (!lastDate) return 0;

        const lastDateObj = new Date(lastDate);
        const todayObj = new Date(today);
        const daysDiff = Math.floor((todayObj - lastDateObj) / (1000 * 60 * 60 * 24));

        // If more than 1 day has passed, streak is broken
        if (daysDiff > 1) return 0;
        return stats.currentStreak;
    },

    // ========================================
    // CUSTOM DEPARTMENT MANAGEMENT
    // ========================================

    /**
     * Get custom departments from localStorage
     * @returns {Object|null} Custom department data or null if using defaults
     */
    getCustomDepartments() {
        try {
            const saved = localStorage.getItem('weeklyPlanner_departments');
            if (saved) {
                return JSON.parse(saved);
            }
        } catch (e) {
            console.error('Error loading custom departments:', e);
        }
        return null;
    },

    /**
     * Save custom departments to localStorage
     * @param {Object} departmentData - The department hierarchy object
     */
    saveCustomDepartments(departmentData) {
        try {
            localStorage.setItem('weeklyPlanner_departments', JSON.stringify(departmentData));
            // Trigger event for live updates
            window.dispatchEvent(new CustomEvent('departmentsUpdated', { detail: departmentData }));
        } catch (e) {
            console.error('Error saving custom departments:', e);
        }
    },

    /**
     * Reset departments to defaults
     */
    resetDepartmentsToDefaults() {
        localStorage.removeItem('weeklyPlanner_departments');
        window.dispatchEvent(new CustomEvent('departmentsUpdated', { detail: null }));
    },

    /**
     * Migrate department path in all tasks, templates, and weekly instances
     * @param {Array} oldPath - The current hierarchy path
     * @param {Array|null} newPath - The new hierarchy path (null if deleted)
     */
    migrateDepartment(oldPath, newPath) {
        const updateHierarchy = (hierarchy) => {
            if (!hierarchy) return hierarchy;

            // Check if hierarchy starts with oldPath
            const startsWith = oldPath.every((p, i) => hierarchy[i] === p);
            if (!startsWith) return hierarchy;

            if (newPath === null) {
                // If deleted, just remove the prefix... or maybe set to empty?
                // For now, let's just clear it if it was specifically that department
                return [];
            }

            // Replace oldPath prefix with newPath
            const tail = hierarchy.slice(oldPath.length);
            return [...newPath, ...tail];
        };

        // 1. Update queue tasks
        state.tasks.forEach((task) => {
            task.hierarchy = updateHierarchy(task.hierarchy);
        });

        // 2. Update templates
        state.templates.forEach((template) => {
            template.hierarchy = updateHierarchy(template.hierarchy);
        });

        // 3. Update weekly instances
        Object.values(state.weeklyInstances).forEach((week) => {
            if (week.tasks) {
                week.tasks.forEach((task) => {
                    task.hierarchy = updateHierarchy(task.hierarchy);
                });
            }
        });

        this.save();
        this.notify();
    },

    // ========================================
    // DATA EXPORT/IMPORT
    // ========================================

    /**
     * Export all data as JSON
     * @returns {Object} Complete data export
     */
    /**
     * Export all data as JSON
     * @returns {Object} Complete data export
     */
    exportData() {
        return {
            version: '3.1', // Bumped version for new format
            exportedAt: new Date().toISOString(),
            data: {
                tasks: state.tasks,
                templates: state.templates,
                weeklyInstances: state.weeklyInstances,
                goals: state.goals,
                nextId: state.nextId,
                migrated: state.migrated,
                focusStats: state.focusStats,
                // Include Custom Departments
                customDepartments: this.getCustomDepartments(),
            },
        };
    },

    /**
     * Export data as downloadable JSON file
     */
    downloadExport() {
        const data = this.exportData();
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `weekly-planner-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    /**
     * Import data from JSON (with deep sanitization)
     */
    importData(importedData, merge = false) {
        try {
            // 1. Basic Structure Validation
            if (!importedData || !importedData.data) {
                throw new Error('Invalid data format');
            }

            const { data } = importedData;

            // 2. Sanitization helper
            const sanitize = (val) => {
                if (typeof val !== 'string') return val;
                return PlannerService.escapeHtml(val);
            };

            const sanitizeTask = (t) => ({
                ...t,
                title: sanitize(t.title),
                goal: sanitize(t.goal),
                notes: sanitize(t.notes),
                hierarchy: Array.isArray(t.hierarchy) ? t.hierarchy.map(sanitize) : [],
            });

            // 3. Process Data
            if (merge) {
                if (data.tasks) {
                    data.tasks.forEach((t) => {
                        const task = sanitizeTask(t);
                        task.id = `task_${state.nextId++}`;
                        state.tasks.push(task);
                    });
                }
                if (data.templates) {
                    data.templates.forEach((t) => {
                        const template = sanitizeTask(t);
                        template.id = `template_${state.nextId++}`;
                        state.templates.push(template);
                    });
                }
                if (data.goals) {
                    Object.keys(data.goals).forEach((day) => {
                        state.goals[day] = sanitize(data.goals[day]);
                    });
                }
                // NOTE: We do NOT merge departments to avoid structural conflicts
            } else {
                state.tasks = (data.tasks || []).map(sanitizeTask);
                state.templates = (data.templates || []).map(sanitizeTask);
                state.weeklyInstances = data.weeklyInstances || {};
                state.goals = data.goals || {};
                state.nextId = data.nextId || 1;
                state.migrated = data.migrated || false;
                state.focusStats = data.focusStats || {
                    sessions: [],
                    currentStreak: 0,
                    totalFocusTime: 0,
                    lastSessionDate: null
                };

                // Sanitize weekly instances too
                Object.values(state.weeklyInstances).forEach((week) => {
                    if (week.tasks) {
                        week.tasks = week.tasks.map(sanitizeTask);
                    }
                });

                // Restore Custom Departments if present
                if (data.customDepartments) {
                    this.saveCustomDepartments(data.customDepartments);
                }
            }

            this.save(true); // Save immediately after import
            this.notify();
            return true;
        } catch (error) {
            console.error('Import failed:', error);
            return false;
        }
    },

    /**
     * Import data from file input
     * @param {File} file - The file to import
     * @param {boolean} merge - If true, merge with existing
     * @returns {Promise<boolean>} Success status
     */
    async importFromFile(file, merge = false) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    const success = this.importData(data, merge);
                    resolve(success);
                } catch (error) {
                    console.error('Failed to parse import file:', error);
                    resolve(false);
                }
            };
            reader.onerror = () => resolve(false);
            reader.readAsText(file);
        });
    },

    /**
     * Get the active Pomodoro session
     */
    getActivePomodoro() {
        return state.activePomodoro;
    },

    /**
     * Set the active Pomodoro session
     */
    setActivePomodoro(taskId, data) {
        state.activePomodoro = {
            ...state.activePomodoro,
            ...data,
            taskId,
            updatedAt: Date.now(),
        };
        this.save();
        this.notify();
    },

    /**
     * Clear the active Pomodoro session
     */
    clearActivePomodoro() {
        state.activePomodoro = {
            taskId: null,
            remainingSeconds: 1500,
            targetEpoch: null,
            running: false,
            mode: 'work',
            updatedAt: Date.now(),
        };
        this.save();
        this.notify();
    },
};
