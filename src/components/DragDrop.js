/**
 * Drag and Drop - Handles all drag & drop functionality
 */

import { Store } from '../store.js';
import { PlannerService } from '../services/PlannerService.js';
import { Calendar } from './Calendar.js';
import { TaskQueue } from './TaskQueue.js';
import { Analytics } from './Analytics.js';

export const DragDrop = {
    draggedTask: null,
    draggedElement: null,
    dayTasksCache: {},
    lastHoverCell: null,
    lastHoverQueue: null,
    isDraggingTask: false,

    getCellFromPointerEvent(e) {
        if (!e) return null;

        if (!Number.isFinite(e.clientX) || !Number.isFinite(e.clientY)) return null;
        if (e.clientX === 0 && e.clientY === 0) return null;

        const fromPoint = typeof document !== 'undefined' ? document.elementFromPoint(e.clientX, e.clientY) : null;
        if (fromPoint?.closest?.('.time-column') || e.target?.closest?.('.time-column')) return null;

        const column = fromPoint?.closest?.('.day-column') || e.target?.closest?.('.day-column');
        if (!column) return null;

        const cells = column.querySelectorAll('.calendar-cell');
        if (!cells.length) return null;

        const firstCellRect = cells[0].getBoundingClientRect();
        const cellHeight = cells[0].offsetHeight || PlannerService.CELL_HEIGHT;
        const rawIndex = Math.floor((e.clientY - firstCellRect.top) / cellHeight);
        const index = Math.min(Math.max(0, rawIndex), cells.length - 1);
        return cells[index] || null;
    },

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
        let pointerCandidate = null;
        let pointerStartX = 0;
        let pointerStartY = 0;
        let pointerId = null;
        let pointerDragging = false;
        let pointerGhost = null;
        let pointerGhostOffsetX = 0;
        let pointerGhostOffsetY = 0;

        // Drag start
        document.addEventListener('dragstart', (e) => {
            const taskBlock = e.target?.closest?.('.task-block');
            if (!taskBlock) return;

            document.body.classList.add('dnd-active');
            this.dayTasksCache = {};
            this.lastHoverCell = null;
            this.lastHoverQueue = null;
            this.isDraggingTask = true;

            const taskId = taskBlock.dataset.taskId;
            this.draggedTask = Store.getTask(taskId);
            this.draggedElement = taskBlock;

            if (!this.draggedTask) {
                this.isDraggingTask = false;
                e.preventDefault();
                return;
            }

            taskBlock.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', taskId);
            e.dataTransfer.setData('text', taskId);

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

        }, { capture: true });

        document.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return;
            const taskBlock = e.target?.closest?.('.task-block');
            if (!taskBlock) return;
            if (!taskBlock.closest('.calendar-task')) return;
            if (e.target?.closest?.('.task-delete')) return;
            if (e.target?.closest?.('input, textarea, select, button')) return;

            const taskId = taskBlock.dataset.taskId;
            const task = Store.getTask(taskId);
            if (!task) return;

            const rect = taskBlock.getBoundingClientRect();
            pointerGhostOffsetX = e.clientX - rect.left;
            pointerGhostOffsetY = e.clientY - rect.top;

            pointerCandidate = { taskId, taskBlock };
            pointerStartX = e.clientX;
            pointerStartY = e.clientY;
            pointerId = e.pointerId;
            pointerDragging = false;
        }, { capture: true });

        document.addEventListener('pointermove', (e) => {
            if (!pointerCandidate) return;
            if (pointerId !== e.pointerId) return;

            const dx = e.clientX - pointerStartX;
            const dy = e.clientY - pointerStartY;
            const movedEnough = (dx * dx + dy * dy) >= 36;

            if (!pointerDragging) {
                if (!movedEnough) return;

                pointerDragging = true;
                this.isDraggingTask = true;
                document.body.classList.add('dnd-active');
                this.dayTasksCache = {};
                this.lastHoverCell = null;
                this.lastHoverQueue = null;

                const task = Store.getTask(pointerCandidate.taskId);
                this.draggedTask = task;
                this.draggedElement = pointerCandidate.taskBlock;
                this.draggedElement.classList.add('dragging');

                const ghost = pointerCandidate.taskBlock.cloneNode(true);
                ghost.classList.add('drag-ghost');

                // CRITICAL style sanitation: Strip any inherited off-screen positioning
                // which might have been set by native dragstart or previous states.
                ghost.style.top = '0';
                ghost.style.left = '0';
                ghost.style.margin = '0';
                ghost.style.opacity = '0.9';

                // Hide original to prevent hit-test interference
                // CRITICAL: Hide AFTER cloning, or ghost will inherit opacity 0
                this.draggedElement.style.opacity = '0';
                this.draggedElement.style.pointerEvents = 'none';

                const rect = pointerCandidate.taskBlock.getBoundingClientRect();
                const maxWidth = 250;
                const maxHeight = 80;
                const actualWidth = Math.min(rect.width, maxWidth);
                const actualHeight = Math.min(rect.height, maxHeight);

                ghost.style.width = actualWidth + 'px';
                ghost.style.height = actualHeight + 'px';
                ghost.style.maxHeight = actualHeight + 'px';
                ghost.style.minHeight = actualHeight + 'px';
                ghost.style.maxWidth = actualWidth + 'px';

                // Set initial position before adding to DOM
                const initialX = e.clientX - pointerGhostOffsetX;
                const initialY = e.clientY - pointerGhostOffsetY;
                ghost.style.transform = `translate3d(${initialX}px, ${initialY}px, 0)`;
                ghost.style.left = '0';
                ghost.style.top = '0';

                document.body.appendChild(ghost);
                pointerGhost = ghost;
            }

            e.preventDefault();

            const fromPoint = document.elementFromPoint(e.clientX, e.clientY);
            const queue = fromPoint?.closest?.('#taskQueue') || fromPoint?.closest?.('#queuePanel') || fromPoint?.closest?.('.sidebar');
            const cell = this.getCellFromPointerEvent(e);

            if (pointerGhost) {
                // Prevent text selection during drag - aggressive approach
                if (window.getSelection) {
                    const selection = window.getSelection();
                    if (selection.removeAllRanges) {
                        selection.removeAllRanges();
                    } else if (selection.empty) {
                        selection.empty();
                    }
                }

                // Suppress context menu during active pointer drag to prevent right-click interference
                const preventDefault = (e) => e.preventDefault();
                document.addEventListener('contextmenu', preventDefault, { once: true, capture: true });

                // Use requestAnimationFrame for smooth movement
                requestAnimationFrame(() => {
                    if (pointerGhost) {
                        const x = e.clientX - pointerGhostOffsetX;
                        const y = e.clientY - pointerGhostOffsetY;
                        pointerGhost.style.transform = `translate3d(${x}px, ${y}px, 0)`;
                    }
                });
            }

            if (cell) {
                this.lastHoverCell = cell;
                this.lastHoverQueue = null; // Clear stale queue state
                this.highlightDropZone(cell);
                const queueEl = document.getElementById('taskQueue');
                if (queueEl) queueEl.classList.remove('drag-over');
            }
            if (queue) {
                this.lastHoverQueue = queue;
                this.lastHoverCell = null; // Clear stale cell state
                document.querySelectorAll('.drop-target, .drop-invalid').forEach(el => {
                    el.classList.remove('drop-target', 'drop-invalid');
                });
                const queueEl = document.getElementById('taskQueue');
                if (queueEl) queueEl.classList.add('drag-over');
            }
            if (!cell && !queue) {
                // If we are in the "dead zone", keep the last hover states for visual persistence
                // but we might want to clear them if we are far enough away.
            }
        }, { capture: true });

        const finishPointerDrag = (e) => {
            if (!pointerCandidate) return;
            if (pointerId !== e.pointerId) return;

            if (pointerDragging && this.draggedTask && this.draggedElement) {
                const fromPoint = document.elementFromPoint(e.clientX, e.clientY);

                // Prioritize CURRENT targets over stale last-hover states
                let cell = this.getCellFromPointerEvent(e);
                let queue = fromPoint?.closest?.('#taskQueue') || fromPoint?.closest?.('#queuePanel') || fromPoint?.closest?.('.sidebar');

                if (!cell && !queue) {
                    // Only use last-hover if we are truly in a "dead zone" (no active target)
                    if (this.lastHoverCell) cell = this.lastHoverCell;
                    else if (this.lastHoverQueue) queue = this.lastHoverQueue;
                }

                const taskId = this.draggedTask.id;
                console.log(`[DragDrop] Pointer release: taskId=${taskId}, currentCell=${!!cell}, currentQueue=${!!queue}`);

                document.querySelectorAll('.drop-target, .drag-over, .drop-invalid').forEach(el => {
                    el.classList.remove('drop-target', 'drag-over', 'drop-invalid');
                });

                if (queue) {
                    console.log(`[DragDrop] ⬅️ Unscheduling task ${taskId} (via sidebar drop)`);
                    Store.unscheduleTask(taskId, true);
                } else if (cell) {
                    const day = cell.dataset.day;
                    const time = cell.dataset.time;
                    console.log(`[DragDrop] 📅 Rescheduling task ${taskId} to ${day} ${time}`);
                    this.dayTasksCache = {};
                    if (this.isSlotAvailable(day, time, this.draggedTask.duration, taskId)) {
                        Store.rescheduleTaskInWeek(taskId, day, time);
                    }
                }

                if (Calendar && typeof Calendar.refresh === 'function') Calendar.refresh();
                if (TaskQueue && typeof TaskQueue.refresh === 'function') TaskQueue.refresh();
                if (Analytics && typeof Analytics.render === 'function') Analytics.render();
            }

            pointerCandidate = null;
            pointerId = null;
            pointerDragging = false;
            if (pointerGhost) {
                pointerGhost.remove();
                pointerGhost = null;
            }

            document.body.classList.remove('dnd-active');
            if (this.draggedElement) {
                this.draggedElement.classList.remove('dragging');
                this.draggedElement.style.opacity = '';
                this.draggedElement.style.pointerEvents = '';
            }
            this.draggedTask = null;
            this.draggedElement = null;
            this.dayTasksCache = {};
            this.lastHoverCell = null;
            this.lastHoverQueue = null;
            this.isDraggingTask = false;

            document.querySelectorAll('.drop-target, .drag-over, .drop-invalid').forEach(el => {
                el.classList.remove('drop-target', 'drag-over', 'drop-invalid');
            });
        };

        document.addEventListener('pointerup', finishPointerDrag, { capture: true });
        document.addEventListener('pointercancel', finishPointerDrag, { capture: true });

        // Drag end
        document.addEventListener('dragend', (e) => {
            document.body.classList.remove('dnd-active');
            const taskBlock = e.target?.closest?.('.task-block');
            if (taskBlock) {
                taskBlock.classList.remove('dragging');
            }

            document.querySelectorAll('.drop-target, .drag-over').forEach(el => {
                el.classList.remove('drop-target', 'drag-over');
            });

            this.draggedTask = null;
            this.draggedElement = null;
            this.dayTasksCache = {};
            this.lastHoverCell = null;
            this.lastHoverQueue = null;
            this.isDraggingTask = false;
        }, { capture: true });

        // Drag over
        document.addEventListener('dragover', (e) => {
            let cell = e.target.closest('.calendar-cell');
            if (!cell) cell = this.getCellFromPointerEvent(e);
            const queue = e.target.closest('#taskQueue') || e.target.closest('#queuePanel') || e.target.closest('.sidebar');

            if (cell) this.lastHoverCell = cell;
            if (queue) this.lastHoverQueue = queue;

            if (this.isDraggingTask) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';

                if (cell) {
                    this.highlightDropZone(cell);
                }
                if (queue) {
                    const queueEl = document.getElementById('taskQueue');
                    if (queueEl) queueEl.classList.add('drag-over');
                }
            }
        }, { capture: true });

        // Drag enter
        document.addEventListener('dragenter', (e) => {
            let cell = e.target.closest('.calendar-cell');
            if (!cell) cell = this.getCellFromPointerEvent(e);
            const queue = e.target.closest('#taskQueue') || e.target.closest('#queuePanel') || e.target.closest('.sidebar');

            if (cell) {
                this.lastHoverCell = cell;
                cell.classList.add('drag-over');
            }
            if (queue) {
                this.lastHoverQueue = queue;
                const queueEl = document.getElementById('taskQueue');
                if (queueEl) queueEl.classList.add('drag-over');
            }
        }, { capture: true });

        // Drag leave
        document.addEventListener('dragleave', (e) => {
            let cell = e.target.closest('.calendar-cell');
            if (!cell) cell = this.getCellFromPointerEvent(e);
            const queue = e.target.closest('#taskQueue') || e.target.closest('#queuePanel') || e.target.closest('.sidebar');

            if (cell && !cell.contains(e.relatedTarget)) {
                cell.classList.remove('drag-over', 'drop-target');
            }
            if (queue) {
                const queueEl = document.getElementById('taskQueue');
                if (queueEl && !queueEl.contains(e.relatedTarget)) {
                    queueEl.classList.remove('drag-over');
                }
            }
        }, { capture: true });

        // Drop
        document.addEventListener('drop', (e) => {
            e.preventDefault();

            try {
                let cell = e.target.closest('.calendar-cell');
                if (!cell) cell = this.getCellFromPointerEvent(e);

                let queue = e.target.closest('#taskQueue') || e.target.closest('#queuePanel') || e.target.closest('.sidebar');

                if (!cell && !queue) {
                    if (this.lastHoverCell) cell = this.lastHoverCell;
                    else if (this.lastHoverQueue) queue = this.lastHoverQueue;
                }

                let taskId = e.dataTransfer.getData('text/plain');
                if (!taskId) taskId = e.dataTransfer.getData('text');
                if (!taskId && this.draggedElement?.dataset?.taskId) taskId = this.draggedElement.dataset.taskId;
                if (!taskId && this.draggedTask?.id) taskId = this.draggedTask.id;
                taskId = (taskId || '').trim();

                if (!taskId) return;

                const draggedTask = Store.getTask(taskId);
                if (!draggedTask) return;

                document.querySelectorAll('.drop-target, .drag-over, .drop-invalid').forEach(el => {
                    el.classList.remove('drop-target', 'drag-over', 'drop-invalid');
                });

                if (queue) {
                    Store.unscheduleTask(taskId, true);
                    if (Calendar && typeof Calendar.refresh === 'function') Calendar.refresh();
                    if (TaskQueue && typeof TaskQueue.refresh === 'function') TaskQueue.refresh();
                    if (Analytics && typeof Analytics.render === 'function') Analytics.render();
                } else if (cell) {
                    const day = cell.dataset.day;
                    const time = cell.dataset.time;

                    this.dayTasksCache = {};

                    if (this.isSlotAvailable(day, time, draggedTask.duration, taskId)) {
                        const result = Store.rescheduleTaskInWeek(taskId, day, time);

                        if (result) {
                            if (Calendar && typeof Calendar.refresh === 'function') Calendar.refresh();
                            if (TaskQueue && typeof TaskQueue.refresh === 'function') TaskQueue.refresh();
                            if (Analytics && typeof Analytics.render === 'function') Analytics.render();
                        }
                    } else {
                        if (this.draggedElement) {
                            this.draggedElement.style.animation = 'rebound 0.4s ease';
                            setTimeout(() => this.draggedElement.style.animation = '', 400);
                        }
                    }
                } else if (queue) {
                    Store.unscheduleTask(taskId, true);
                    if (Calendar && typeof Calendar.refresh === 'function') Calendar.refresh();
                    if (TaskQueue && typeof TaskQueue.refresh === 'function') TaskQueue.refresh();
                    if (Analytics && typeof Analytics.render === 'function') Analytics.render();
                }
            } catch (err) {
                console.error('[DragDrop] Drop handler error:', err);
            } finally {
                document.body.classList.remove('dnd-active');
                this.isDraggingTask = false;
                this.lastHoverCell = null;
                this.lastHoverQueue = null;
            }
        }, { capture: true });
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
