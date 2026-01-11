/**
 * Store - Task data management with localStorage persistence
 */

import { PlannerService } from './services/PlannerService.js';

const STORAGE_KEY = 'weeklyPlanner_v3';

let state = {
    tasks: [],          // Legacy - will be migrated to weekly system
    nextId: 1,
    currentWeekStart: null,

    // New recurring weekly system
    templates: [],      // Task templates (the recurring pattern)
    weeklyInstances: {}, // Per-week state: { '2026-W01': { tasks: [...] } }
    migrated: false,    // Migration flag

    // Kept for compatibility
    weeklyData: {},
    defaultTemplate: null,
    goals: {}
};

export const Store = {
    /**
     * Initialize store
     */
    init() {
        this.load();

        // Run migration if needed
        if (!state.migrated && state.tasks.length > 0) {
            console.log('Running migration on init...');
            this.migrateToWeeklySystem();
        }

        this.setCurrentWeek(new Date());
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
                state.weeklyData = data.weeklyData || {};
                state.defaultTemplate = data.defaultTemplate || null;
                state.goals = data.goals || {};

                // New recurring system
                state.templates = data.templates || [];
                state.weeklyInstances = data.weeklyInstances || {};
                state.migrated = data.migrated || false;
            }

            // Run migration if needed
            this.migrateToWeeklySystem();
        } catch (e) {
            console.error('Error loading from storage:', e);
        }
    },

    /**
     * Save to localStorage
     */
    save() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                tasks: state.tasks,
                nextId: state.nextId,
                weeklyData: state.weeklyData,
                defaultTemplate: state.defaultTemplate,
                goals: state.goals,

                // New recurring system
                templates: state.templates,
                weeklyInstances: state.weeklyInstances,
                migrated: state.migrated
            }));
        } catch (e) {
            console.error('Error saving to storage:', e);
        }
    },

    /**
     * Set current week context
     */
    setCurrentWeek(date) {
        state.currentWeekStart = PlannerService.getWeekStart(date);
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
            createdAt: Date.now()
        };
        state.tasks.push(task);
        this.save();
        return task;
    },

    /**
     * Update a task (handles both legacy and week-specific IDs)
     */
    updateTask(taskId, updates) {
        // Try legacy tasks first
        const legacyTask = state.tasks.find(t => t.id === taskId);
        if (legacyTask) {
            Object.assign(legacyTask, updates);
            this.save();
            return legacyTask;
        }

        // Handle week-specific task IDs
        if (!taskId || !taskId.includes('_')) return null;

        // Handle standalone week task IDs (format: week_weekId_instanceId or week_weekId_idx_X)
        if (taskId.startsWith('week_')) {
            const parts = taskId.split('_');
            const weekId = parts[1]; // "2026-W01"

            const weekInstances = state.weeklyInstances[weekId];
            if (!weekInstances) return null;

            // Find the task by instanceId or by index
            const suffix = parts.slice(2).join('_');
            let instance = null;

            if (suffix.startsWith('inst_')) {
                instance = weekInstances.tasks.find(t => t.instanceId === suffix);
            } else if (suffix.startsWith('idx_') || suffix.startsWith('task_')) {
                const taskIndex = parseInt(suffix.split('_')[1]);
                instance = weekInstances.tasks[taskIndex];
            }

            if (instance) {
                Object.assign(instance, updates);
                this.save();
                return this.getTask(taskId);
            }
            return null;
        }

        // Handle template-based week-specific IDs (format: template_X_weekId)
        if (taskId.split('_').length >= 3) {
            const parts = taskId.split('_');
            const weekId = parts[parts.length - 1];
            const templateId = parts.slice(0, -1).join('_');

            // Update the template itself
            const template = state.templates.find(t => t.id === templateId);
            if (template) {
                Object.assign(template, updates);
            }

            // Update the instance for this week
            const weekInstances = state.weeklyInstances[weekId];
            if (weekInstances) {
                const instance = weekInstances.tasks.find(t => t.templateId === templateId);
                if (instance) {
                    // Only copy relevant fields to instance (not schedule data)
                    if (updates.completed !== undefined) instance.completed = updates.completed;
                    if (updates.notes !== undefined) instance.notes = updates.notes;
                }
            }

            this.save();
            return this.getTask(taskId);
        }

        return null;
    },

    /**
     * Delete a task (handles both legacy and week-specific IDs)
     */
    deleteTask(taskId) {
        // Try legacy tasks first
        const legacyDeleted = state.tasks.filter(t => t.id === taskId).length > 0;
        state.tasks = state.tasks.filter(t => t.id !== taskId);

        if (legacyDeleted) {
            this.save();
            return;
        }

        // Handle week-specific task IDs (format: week_weekId_task_index or template_X_weekId)
        if (taskId && taskId.includes('_')) {
            // Extract week ID from task ID
            let weekId = null;
            let taskIndex = null;

            if (taskId.startsWith('week_')) {
                // Format: week_2026-W01_inst_5 (new) or week_2026-W01_task_0 (legacy)
                const parts = taskId.split('_');
                weekId = parts[1]; // "2026-W01"

                const weekInstances = state.weeklyInstances[weekId];
                if (weekInstances) {
                    const suffix = parts.slice(2).join('_');
                    let instanceIndex = -1;

                    if (suffix.startsWith('inst_')) {
                        instanceIndex = weekInstances.tasks.findIndex(t => t.instanceId === suffix);
                    } else if (suffix.startsWith('idx_') || suffix.startsWith('task_')) {
                        instanceIndex = parseInt(suffix.split('_')[1]);
                    }

                    if (instanceIndex >= 0 && weekInstances.tasks[instanceIndex]) {
                        weekInstances.tasks.splice(instanceIndex, 1);
                        this.save();
                        return;
                    }
                }
            } else if (taskId.split('_').length >= 3) {
                // Format: template_X_2026-W01
                const parts = taskId.split('_');
                weekId = parts[parts.length - 1];
                const templateId = parts.slice(0, -1).join('_');

                // Find and remove from week instances
                const weekInstances = state.weeklyInstances[weekId];
                if (weekInstances) {
                    weekInstances.tasks = weekInstances.tasks.filter(t => t.templateId !== templateId);
                    this.save();
                    return;
                }
            }
        }

        this.save();
    },

    /**
         * Get task by ID (handles all task ID formats)
         */
    getTask(taskId) {
        // Try legacy tasks first
        const legacyTask = state.tasks.find(t => t.id === taskId);
        if (legacyTask) return legacyTask;

        if (!taskId || !taskId.includes('_')) return null;

        // Handle week-specific standalone task IDs (format: week_weekId_instanceId or legacy week_weekId_task_index)
        if (taskId.startsWith('week_')) {
            const parts = taskId.split('_');
            // Format: week_2026-W01_inst_5 (new) or week_2026-W01_task_0 (legacy) or week_2026-W01_idx_0 (migration)
            const weekId = parts[1]; // "2026-W01"

            const weekInstances = state.weeklyInstances[weekId];
            if (!weekInstances) return null;

            // Find the task by instanceId or by index (for legacy/migration)
            let instance = null;
            const suffix = parts.slice(2).join('_'); // "inst_5" or "task_0" or "idx_0"

            if (suffix.startsWith('inst_')) {
                // New format: find by instanceId
                const instanceId = suffix; // "inst_5"
                instance = weekInstances.tasks.find(t => t.instanceId === instanceId);
            } else if (suffix.startsWith('idx_') || suffix.startsWith('task_')) {
                // Legacy/migration format: find by index
                const taskIndex = parseInt(suffix.split('_')[1]);
                instance = weekInstances.tasks[taskIndex];
            }

            if (!instance) return null;

            return {
                id: taskId,
                title: instance.title,
                goal: instance.goal || '',
                hierarchy: instance.hierarchy || [],
                duration: instance.duration,
                completed: instance.completed,
                notes: instance.notes,
                scheduledDay: instance.scheduledDay,
                scheduledTime: instance.scheduledTime
            };
        }

        // Handle template-based week-specific IDs (format: template_X_weekId)
        if (taskId.split('_').length >= 3) {
            const parts = taskId.split('_');
            const weekId = parts[parts.length - 1];
            const templateId = parts.slice(0, -1).join('_');

            const template = state.templates.find(t => t.id === templateId);
            if (!template) return null;

            const weekInstances = state.weeklyInstances[weekId];
            if (!weekInstances) return null;

            const instance = weekInstances.tasks.find(t => t.templateId === templateId);
            if (!instance) return null;

            return {
                ...template,
                id: taskId,
                completed: instance.completed,
                notes: instance.notes,
                scheduledDay: instance.scheduledDay || template.scheduledDay,
                scheduledTime: instance.scheduledTime || template.scheduledTime
            };
        }

        return null;
    },

    /**
     * Get all queue tasks (unscheduled)
     */
    getQueueTasks() {
        return state.tasks.filter(t => !t.scheduledDay);
    },

    /**
     * Get all scheduled tasks
     */
    getScheduledTasks() {
        return state.tasks.filter(t => t.scheduledDay && t.scheduledTime);
    },

    /**
     * Get all tasks (both queue and scheduled)
     */
    getAllTasks() {
        return state.tasks;
    },

    /**
     * Get tasks for a specific day (uses weekly system)
     */
    getTasksForDay(day) {
        const currentWeekId = this.getWeekIdentifier(state.currentWeekStart || new Date());
        const weekTasks = this.getTasksForWeek(currentWeekId);
        return weekTasks.filter(t => t.scheduledDay === day);
    },

    /**
     * Schedule a task (adds to current week ONLY - does NOT create template)
     */
    scheduleTask(taskId, day, time) {
        const task = state.tasks.find(t => t.id === taskId);
        if (!task) return null;

        // Update the task in old system (for backward compatibility)
        task.scheduledDay = day;
        task.scheduledTime = time;

        // Add to current week instances ONLY
        const currentWeekId = this.getWeekIdentifier(state.currentWeekStart || new Date());
        if (!state.weeklyInstances[currentWeekId]) {
            state.weeklyInstances[currentWeekId] = { tasks: [] };
        }

        // Check if task already exists in this week (from template or previous schedule)
        const existing = state.weeklyInstances[currentWeekId].tasks.find(t =>
            t.title === task.title && t.scheduledDay === day && t.scheduledTime === time
        );

        if (!existing) {
            // Create a week-specific entry (NOT a template) with stable unique ID
            state.weeklyInstances[currentWeekId].tasks.push({
                instanceId: `inst_${state.nextId++}`,  // Stable unique ID
                templateId: null,  // No template - this is a one-off task
                title: task.title,
                goal: task.goal || '',
                hierarchy: [...task.hierarchy],
                duration: task.duration,
                completed: false,
                notes: task.notes || '',
                scheduledDay: day,
                scheduledTime: time
            });
        } else {
            // Update existing instance (e.g. if we are overwriting a template task with a custom one)
            existing.title = task.title;
            existing.goal = task.goal || '';
            existing.hierarchy = [...task.hierarchy];
            existing.duration = task.duration;
            existing.notes = task.notes || '';
            // Preserving completion status or other flags if necessary, 
            // but usually a new schedule implies a fresh start unless it was the same task
        }

        this.save();
        return task;
    },

    /**
     * Reschedule a task within a week (for drag-and-drop of already scheduled tasks)
     */
    rescheduleTaskInWeek(taskId, day, time) {
        if (!taskId || !taskId.includes('_')) {
            return this.scheduleTask(taskId, day, time);
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
                instance = weekInstances.tasks.find(t => t.instanceId === suffix);
            } else if (suffix.startsWith('idx_') || suffix.startsWith('task_')) {
                const taskIndex = parseInt(suffix.split('_')[1]);
                instance = weekInstances.tasks[taskIndex];
            }

            if (instance) {
                instance.scheduledDay = day;
                instance.scheduledTime = time;
                this.save();
                return this.getTask(taskId);
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

            const instance = weekInstances.tasks.find(t => t.templateId === templateId);
            if (instance) {
                instance.scheduledDay = day;
                instance.scheduledTime = time;
                this.save();
                return this.getTask(taskId);
            }
        }

        // Fallback to regular scheduleTask for queue tasks
        return this.scheduleTask(taskId, day, time);
    },

    /**
     * Unschedule a task (move back to queue)
     */
    unscheduleTask(taskId) {
        if (!taskId || !taskId.includes('_')) {
            // Legacy task handling
            const task = state.tasks.find(t => t.id === taskId);
            if (task) {
                task.scheduledDay = null;
                task.scheduledTime = null;
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
            let instanceIndex = -1;

            if (suffix.startsWith('inst_')) {
                instanceIndex = weekInstances.tasks.findIndex(t => t.instanceId === suffix);
                instance = instanceIndex >= 0 ? weekInstances.tasks[instanceIndex] : null;
            } else if (suffix.startsWith('idx_') || suffix.startsWith('task_')) {
                instanceIndex = parseInt(suffix.split('_')[1]);
                instance = weekInstances.tasks[instanceIndex];
            }

            if (!instance || instanceIndex < 0) return null;

            // Create a queue task from the instance
            const queueTask = {
                id: `task_${state.nextId++}`,
                title: instance.title,
                goal: instance.goal || '',
                hierarchy: [...(instance.hierarchy || [])],
                duration: instance.duration,
                notes: instance.notes || '',
                completed: false,
                scheduledDay: null,
                scheduledTime: null,
                createdAt: Date.now()
            };
            state.tasks.push(queueTask);

            // Remove from this week's instances
            weekInstances.tasks.splice(instanceIndex, 1);

            this.save();
            return queueTask;
        }

        // Handle template-based week-specific IDs (format: template_X_weekId)
        if (taskId.split('_').length >= 3) {
            const parts = taskId.split('_');
            const weekId = parts[parts.length - 1];
            const templateId = parts.slice(0, -1).join('_');

            const template = state.templates.find(t => t.id === templateId);
            if (!template) return null;

            const queueTask = {
                id: `task_${state.nextId++}`,
                title: template.title,
                goal: template.goal || '',
                hierarchy: [...template.hierarchy],
                duration: template.duration,
                notes: template.notes || '',
                completed: false,
                scheduledDay: null,
                scheduledTime: null,
                createdAt: Date.now()
            };
            state.tasks.push(queueTask);

            const weekInstances = state.weeklyInstances[weekId];
            if (weekInstances) {
                weekInstances.tasks = weekInstances.tasks.filter(t => t.templateId !== templateId);
            }

            state.templates = state.templates.filter(t => t.id !== templateId);

            this.save();
            return queueTask;
        }

        return null;
    },

    /**
     * Toggle task completion
     */
    toggleComplete(taskId) {
        const task = state.tasks.find(t => t.id === taskId);
        if (task) {
            task.completed = !task.completed;
            this.save();
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
    },

    /**
     * Set default template
     */
    setDefaultTemplate(scheduledTasks, queueTasks) {
        state.defaultTemplate = {
            scheduled: scheduledTasks.map(t => ({
                title: t.title,
                goal: t.goal || '',
                hierarchy: [...t.hierarchy],
                duration: t.duration,
                notes: t.notes || '',
                scheduledDay: t.scheduledDay,
                scheduledTime: t.scheduledTime
            })),
            queue: queueTasks.map(t => ({
                title: t.title,
                goal: t.goal || '',
                hierarchy: [...t.hierarchy],
                duration: t.duration,
                notes: t.notes || ''
            }))
        };
        this.save();
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
        currentWeekTasks.forEach(task => {
            const templateId = `template_${state.nextId++}`;
            state.templates.push({
                id: templateId,
                title: task.title,
                goal: task.goal || '',
                hierarchy: [...task.hierarchy],
                duration: task.duration,
                notes: task.notes || '',
                scheduledDay: task.scheduledDay,
                scheduledTime: task.scheduledTime
            });
        });

        // Clear all weekly instances EXCEPT the current week
        // This forces future weeks to regenerate from the new template
        const weekIds = Object.keys(state.weeklyInstances);
        weekIds.forEach(weekId => {
            if (weekId !== currentWeekId) {
                delete state.weeklyInstances[weekId];
            }
        });

        this.save();
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
    },

    /**
     * Get week identifier (e.g., '2026-W01')
     */
    getWeekIdentifier(date) {
        const weekStart = PlannerService.getWeekStart(date);
        const year = weekStart.getFullYear();
        const week = Math.ceil(((weekStart - new Date(year, 0, 1)) / 86400000 + 1) / 7);
        return `${year}-W${String(week).padStart(2, '0')}`;
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
            tasks: state.templates.map(template => ({
                templateId: template.id,
                completed: false,
                notes: template.notes || '',
                scheduledDay: template.scheduledDay,
                scheduledTime: template.scheduledTime
            }))
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

        return instances.map((instance, index) => {
            // If it has a template ID, it's a recurring task
            if (instance.templateId) {
                const template = state.templates.find(t => t.id === instance.templateId);
                if (!template) return null;

                return {
                    ...template,
                    id: `${template.id}_${weekId}`,  // Unique ID per week
                    completed: instance.completed,
                    notes: instance.notes,
                    scheduledDay: instance.scheduledDay || template.scheduledDay,
                    scheduledTime: instance.scheduledTime || template.scheduledTime
                };
            } else {
                // Standalone week-specific task (no template)
                // Use stable instanceId if available, fallback to index for migration
                const taskIdSuffix = instance.instanceId || `idx_${index}`;
                return {
                    id: `week_${weekId}_${taskIdSuffix}`,  // Stable unique ID
                    title: instance.title,
                    goal: instance.goal || '',
                    hierarchy: instance.hierarchy || [],
                    duration: instance.duration,
                    completed: instance.completed,
                    notes: instance.notes,
                    scheduledDay: instance.scheduledDay,
                    scheduledTime: instance.scheduledTime
                };
            }
        }).filter(Boolean);
    },

    /**
     * Migrate old system to new per-week system
     */
    migrateToWeeklySystem() {
        if (state.migrated) return;

        console.log('Migrating to per-week system...');

        // Create templates from currently scheduled tasks
        const scheduledTasks = state.tasks.filter(t => t.scheduledDay && t.scheduledTime);

        state.templates = scheduledTasks.map((task, index) => ({
            id: `template_${state.nextId + index}`,
            title: task.title,
            goal: task.goal || '',
            hierarchy: [...task.hierarchy],
            duration: task.duration,
            scheduledDay: task.scheduledDay,
            scheduledTime: task.scheduledTime
        }));

        state.nextId += scheduledTasks.length;

        // Create current week instance with existing state
        const currentWeekId = this.getWeekIdentifier(state.currentWeekStart || new Date());
        state.weeklyInstances[currentWeekId] = {
            tasks: state.templates.map(template => {
                const originalTask = scheduledTasks.find(t =>
                    t.title === template.title &&
                    t.scheduledDay === template.scheduledDay &&
                    t.scheduledTime === template.scheduledTime
                );
                return {
                    templateId: template.id,
                    completed: originalTask?.completed || false,
                    notes: originalTask?.notes || '',
                    scheduledDay: template.scheduledDay,
                    scheduledTime: template.scheduledTime
                };
            })
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
                instance = weekInstances.tasks.find(t => t.instanceId === suffix);
            } else if (suffix.startsWith('idx_') || suffix.startsWith('task_')) {
                const taskIndex = parseInt(suffix.split('_')[1]);
                instance = weekInstances.tasks[taskIndex];
            }

            if (instance) {
                instance.completed = !instance.completed;
                this.save();
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
                const instance = weekInstances.tasks.find(t => t.templateId === templateId);
                if (instance) {
                    instance.completed = !instance.completed;
                    this.save();
                    return instance;
                }
            }
        }

        return null;
    },

    /**
     * Update task notes for a specific week
     */
    updateTaskNotesForWeek(taskId, notes) {
        if (!taskId) return null;

        // Handle legacy tasks
        if (!taskId.includes('_')) {
            const task = state.tasks.find(t => t.id === taskId);
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
                instance = weekInstances.tasks.find(t => t.instanceId === suffix);
            } else if (suffix.startsWith('idx_') || suffix.startsWith('task_')) {
                const taskIndex = parseInt(suffix.split('_')[1]);
                instance = weekInstances.tasks[taskIndex];
            }

            if (instance) {
                instance.notes = notes;
                this.save();
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

            const instance = weekInstances.tasks.find(t => t.templateId === templateId);
            if (instance) {
                instance.notes = notes;
                this.save();
                return instance;
            }
        }

        return null;
    },

    /**
     * Get analytics data
     */
    getAnalytics() {
        const scheduled = this.getScheduledTasks();
        const byHierarchy = {};

        scheduled.forEach(task => {
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

        weekTasks.forEach(task => {
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
                const lines = task.notes.split('\n').filter(l => l.trim() !== '');
                lines.forEach(line => {
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
            duration: { total: totalDuration, completed: completedDuration }
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

        return days.map(day => {
            const dayTasks = weekTasks.filter(t => t.scheduledDay === day);
            const total = dayTasks.length;
            const completed = dayTasks.filter(t => t.completed).length;
            const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

            // Also count mini-tasks for that day
            let miniTotal = 0;
            let miniCompleted = 0;
            dayTasks.forEach(task => {
                if (task.notes) {
                    const lines = task.notes.split('\n').filter(l => l.trim() !== '');
                    lines.forEach(line => {
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
                miniTasks: { total: miniTotal, completed: miniCompleted, percent: miniPercent }
            };
        });
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
        state.tasks.forEach(task => {
            task.hierarchy = updateHierarchy(task.hierarchy);
        });

        // 2. Update templates
        state.templates.forEach(template => {
            template.hierarchy = updateHierarchy(template.hierarchy);
        });

        // 3. Update weekly instances
        Object.values(state.weeklyInstances).forEach(week => {
            if (week.tasks) {
                week.tasks.forEach(task => {
                    task.hierarchy = updateHierarchy(task.hierarchy);
                });
            }
        });

        this.save();
    },

    // ========================================
    // DATA EXPORT/IMPORT
    // ========================================

    /**
     * Export all data as JSON
     * @returns {Object} Complete data export
     */
    exportData() {
        return {
            version: '3.0',
            exportedAt: new Date().toISOString(),
            data: {
                tasks: state.tasks,
                templates: state.templates,
                weeklyInstances: state.weeklyInstances,
                goals: state.goals,
                nextId: state.nextId,
                migrated: state.migrated
            }
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
     * Import data from JSON
     * @param {Object} importedData - The data to import
     * @param {boolean} merge - If true, merge with existing; if false, replace
     * @returns {boolean} Success status
     */
    importData(importedData, merge = false) {
        try {
            // Validate the data structure
            if (!importedData || !importedData.data) {
                throw new Error('Invalid data format');
            }

            const { data } = importedData;

            if (merge) {
                // Merge mode - add to existing data
                if (data.tasks) {
                    data.tasks.forEach(task => {
                        task.id = `task_${state.nextId++}`;
                        state.tasks.push(task);
                    });
                }
                if (data.templates) {
                    data.templates.forEach(template => {
                        template.id = `template_${state.nextId++}`;
                        state.templates.push(template);
                    });
                }
                if (data.goals) {
                    state.goals = { ...state.goals, ...data.goals };
                }
            } else {
                // Replace mode - overwrite existing data
                state.tasks = data.tasks || [];
                state.templates = data.templates || [];
                state.weeklyInstances = data.weeklyInstances || {};
                state.goals = data.goals || {};
                state.nextId = data.nextId || 1;
                state.migrated = data.migrated || false;
            }

            this.save();
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
    }
};

