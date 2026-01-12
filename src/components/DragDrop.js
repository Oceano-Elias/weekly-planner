/**
 * Drag and Drop - Handles all drag & drop functionality
 */

import { Store } from '../store.js';
import { PlannerService } from '../services/PlannerService.js';

export const DragDrop = {
    draggedTask: null,
    draggedElement: null,
    dayTasksCache: {},

    /**
     * Initialize drag and drop
     */
    init() {
        this.setupDragEvents();
    },

    /**
     * Setup all drag events using event delegation
     */
    setupDragEvents() {
        // Drag start
        document.addEventListener('dragstart', (e) => {
            const taskBlock = e.target.closest('.task-block');
            if (!taskBlock) return;

            this.dayTasksCache = {};

            const taskId = taskBlock.dataset.taskId;
            this.draggedTask = Store.getTask(taskId);
            this.draggedElement = taskBlock;

            if (!this.draggedTask) {
                e.preventDefault();
                return;
            }

            taskBlock.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', taskId);

            // Hide the task visually so mouse can reach cells underneath
            const calendarTask = taskBlock.closest('.calendar-task');
            if (calendarTask) {
                calendarTask.style.opacity = '0';
                calendarTask.style.visibility = 'hidden';
                console.log('✅ Hiding dragged task to allow cell selection underneath');
            } else {
                console.warn('⚠️ Could not find calendar-task element');
            }

            // Create custom drag image with compact size
            const clone = taskBlock.cloneNode(true);
            const rect = taskBlock.getBoundingClientRect();

            // Use compact dimensions - max 250px wide, 80px tall
            const maxWidth = 250;
            const maxHeight = 80;
            const actualWidth = Math.min(rect.width, maxWidth);
            const actualHeight = Math.min(rect.height, maxHeight);

            clone.style.width = actualWidth + 'px';
            clone.style.height = actualHeight + 'px';
            clone.style.maxHeight = actualHeight + 'px';
            clone.style.minHeight = actualHeight + 'px';
            clone.style.maxWidth = actualWidth + 'px';
            clone.style.opacity = '0.9';
            clone.style.position = 'absolute';
            clone.style.top = '-9999px';
            clone.style.left = '-9999px';
            clone.style.pointerEvents = 'none';
            clone.style.transform = 'scale(1)';
            clone.style.overflow = 'hidden';

            // If the original is too tall, add visual cue that it's been scaled
            if (rect.height > maxHeight) {
                clone.style.boxShadow = '0 4px 20px rgba(0,0,0,0.5)';
            }

            document.body.appendChild(clone);
            e.dataTransfer.setDragImage(clone, actualWidth / 2, 20);
            setTimeout(() => clone.remove(), 0);

        });

        // Drag end
        document.addEventListener('dragend', (e) => {
            const taskBlock = e.target.closest('.task-block');
            if (taskBlock) {
                taskBlock.classList.remove('dragging');

                // Restore visibility
                const calendarTask = taskBlock.closest('.calendar-task');
                if (calendarTask) {
                    calendarTask.style.opacity = '';
                    calendarTask.style.visibility = '';
                }
            }

            document.querySelectorAll('.drop-target, .drag-over').forEach(el => {
                el.classList.remove('drop-target', 'drag-over');
            });

            this.draggedTask = null;
            this.draggedElement = null;
            this.dayTasksCache = {};
        });

        // Drag over
        document.addEventListener('dragover', (e) => {
            const cell = e.target.closest('.calendar-cell');
            const queue = e.target.closest('#taskQueue') || e.target.closest('#queuePanel');

            if (cell || queue) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';

                if (cell) {
                    this.highlightDropZone(cell);
                }
            }
        });

        // Drag enter
        document.addEventListener('dragenter', (e) => {
            const cell = e.target.closest('.calendar-cell');
            const queue = e.target.closest('#taskQueue') || e.target.closest('#queuePanel');

            if (cell) {
                cell.classList.add('drag-over');
            }
            if (queue) {
                const queueEl = document.getElementById('taskQueue');
                if (queueEl) queueEl.classList.add('drag-over');
            }
        });

        // Drag leave
        document.addEventListener('dragleave', (e) => {
            const cell = e.target.closest('.calendar-cell');
            const queue = e.target.closest('#taskQueue') || e.target.closest('#queuePanel');

            if (cell && !cell.contains(e.relatedTarget)) {
                cell.classList.remove('drag-over', 'drop-target');
            }
            if (queue) {
                const queueEl = document.getElementById('taskQueue');
                if (queueEl && !queueEl.contains(e.relatedTarget)) {
                    queueEl.classList.remove('drag-over');
                }
            }
        });

        // Drop
        document.addEventListener('drop', (e) => {
            e.preventDefault();

            const cell = e.target.closest('.calendar-cell');
            const queue = e.target.closest('#taskQueue') || e.target.closest('#queuePanel');
            const taskId = e.dataTransfer.getData('text/plain');

            if (!taskId) return;

            const draggedTask = Store.getTask(taskId);
            if (!draggedTask) return;

            document.querySelectorAll('.drop-target, .drag-over, .drop-invalid').forEach(el => {
                el.classList.remove('drop-target', 'drag-over', 'drop-invalid');
            });

            if (cell) {
                const day = cell.dataset.day;
                const time = cell.dataset.time;

                // Clear cache to get fresh task list (excludes dragged task)
                this.dayTasksCache = {};

                if (this.isSlotAvailable(day, time, draggedTask.duration, taskId)) {
                    Store.rescheduleTaskInWeek(taskId, day, time);
                } else {
                    // Rebound animation
                    if (this.draggedElement) {
                        this.draggedElement.style.animation = 'rebound 0.4s ease';
                        setTimeout(() => this.draggedElement.style.animation = '', 400);
                    }
                }
            } else if (queue) {
                Store.unscheduleTask(taskId);
            }
        });
    },

    /**
     * Check if a time slot is available
     */
    isSlotAvailable(day, startTime, duration, excludeTaskId = null) {
        if (!this.dayTasksCache[day]) {
            this.dayTasksCache[day] = Store.getTasksForDay(day);
        }
        const dayTasks = this.dayTasksCache[day];

        return PlannerService.isSlotAvailable(startTime, duration, dayTasks, excludeTaskId);
    },

    /**
     * Highlight the drop zone based on task duration
     */
    highlightDropZone(startCell) {
        if (!this.draggedTask) return;

        document.querySelectorAll('.drop-target, .drop-invalid').forEach(el => {
            el.classList.remove('drop-target', 'drop-invalid');
        });

        const slotsNeeded = Math.ceil(this.draggedTask.duration / 30);
        const day = startCell.dataset.day;
        const column = startCell.closest('.day-column');
        const cells = column.querySelectorAll('.calendar-cell');

        const startIndex = Array.from(cells).indexOf(startCell);

        // Clear cache for live availability check
        this.dayTasksCache = {};
        const isAvailable = this.isSlotAvailable(day, startCell.dataset.time, this.draggedTask.duration, this.draggedTask.id);

        for (let i = 0; i < slotsNeeded && startIndex + i < cells.length; i++) {
            cells[startIndex + i].classList.add(isAvailable ? 'drop-target' : 'drop-invalid');
        }
    }
};
