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
    hitTestCache: null,
    dropIndicatorEl: null,
    lastIndicatorKey: '',

    getCellFromPointerEvent(e) {
        if (!e) return null;

        if (!Number.isFinite(e.clientX) || !Number.isFinite(e.clientY)) return null;
        if (e.clientX === 0 && e.clientY === 0) return null;

        if (this.hitTestCache) {
            return this.getCellFromHitTestCache(e.clientX, e.clientY);
        }

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

    ensureDropIndicator() {
        if (this.dropIndicatorEl) return this.dropIndicatorEl;
        const el = document.createElement('div');
        el.className = 'drop-indicator';
        el.style.display = 'none';
        this.dropIndicatorEl = el;
        return el;
    },

    hideDropIndicator() {
        if (!this.dropIndicatorEl) return;
        this.dropIndicatorEl.style.display = 'none';
        this.dropIndicatorEl.classList.remove('invalid');
        this.lastIndicatorKey = '';
    },

    showDropIndicator(column, startIndex, slotsToShow, isAvailable) {
        const el = this.ensureDropIndicator();
        if (!column) {
            this.hideDropIndicator();
            return;
        }

        const cache = this.hitTestCache?.columnsByEl?.get(column);
        const cellHeight = cache?.cellHeight || PlannerService.CELL_HEIGHT;

        const top = startIndex * cellHeight + 2;
        const height = Math.max(0, slotsToShow * cellHeight - 4);
        const key = `${cache?.day || column.dataset.day}|${top}|${height}|${isAvailable ? 'ok' : 'bad'}`;

        if (this.lastIndicatorKey !== key) {
            if (el.parentElement !== column) column.appendChild(el);
            el.style.top = `${top}px`;
            el.style.height = `${height}px`;
            el.classList.toggle('invalid', !isAvailable);
            el.style.display = 'block';
            this.lastIndicatorKey = key;
        } else if (el.style.display !== 'block') {
            el.style.display = 'block';
        }
    },

    prepareHitTestCache() {
        if (this.hitTestCache) return;

        const grid = document.getElementById('calendarGrid');
        const timeColumn = grid?.querySelector?.('.time-column') || document.querySelector('.time-column');
        const timeColumnRect = timeColumn?.getBoundingClientRect?.();

        const columns = [];
        const columnsByEl = new Map();

        document.querySelectorAll('.day-column').forEach((column) => {
            const firstCell = column.querySelector('.calendar-cell');
            if (!firstCell) return;

            const columnRect = column.getBoundingClientRect();
            const firstCellRect = firstCell.getBoundingClientRect();
            const cellHeight = firstCell.offsetHeight || PlannerService.CELL_HEIGHT;
            const cells = column.querySelectorAll('.calendar-cell');
            const cellCount = cells.length;

            const entry = {
                el: column,
                day: column.dataset.day || '',
                left: columnRect.left,
                right: columnRect.right,
                firstCellTop: firstCellRect.top,
                cellHeight,
                cellCount,
                cells
            };
            columns.push(entry);
            columnsByEl.set(column, entry);
        });

        const updateVertical = () => {
            columns.forEach((entry) => {
                const firstCell = entry.el.querySelector('.calendar-cell');
                if (!firstCell) return;
                entry.firstCellTop = firstCell.getBoundingClientRect().top;
                entry.cellHeight = firstCell.offsetHeight || entry.cellHeight;
            });
        };

        let scheduled = false;
        const onScroll = () => {
            if (scheduled) return;
            scheduled = true;
            requestAnimationFrame(() => {
                scheduled = false;
                updateVertical();
            });
        };

        if (grid) grid.addEventListener('scroll', onScroll, { passive: true });

        this.hitTestCache = {
            grid,
            columns,
            columnsByEl,
            timeColumnRight: timeColumnRect ? timeColumnRect.right : 0,
            onScroll
        };
    },

    clearHitTestCache() {
        const cache = this.hitTestCache;
        if (!cache) return;
        if (cache.grid && cache.onScroll) cache.grid.removeEventListener('scroll', cache.onScroll);
        this.hitTestCache = null;
    },

    getCellFromHitTestCache(clientX, clientY) {
        const cache = this.hitTestCache;
        if (!cache) return null;
        if (cache.timeColumnRight && clientX < cache.timeColumnRight) return null;

        let columnEntry = null;
        for (const entry of cache.columns) {
            if (clientX >= entry.left && clientX < entry.right) {
                columnEntry = entry;
                break;
            }
        }
        if (!columnEntry) return null;

        const rawIndex = Math.floor((clientY - columnEntry.firstCellTop) / columnEntry.cellHeight);
        const index = Math.min(Math.max(0, rawIndex), columnEntry.cellCount - 1);
        if (!Number.isFinite(index) || index < 0) return null;

        const cell = columnEntry.cells?.[index] || null;
        return cell;
    },

    getSlotIndexFromTime(timeStr) {
        if (!timeStr) return null;
        const [hStr, mStr] = timeStr.split(':');
        const hours = Number(hStr);
        const minutes = Number(mStr);
        if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;

        const slotsPerHour = 60 / PlannerService.SLOT_DURATION;
        const hourOffset = hours - PlannerService.START_HOUR;
        const slotOffset = Math.floor(minutes / PlannerService.SLOT_DURATION);
        const index = hourOffset * slotsPerHour + slotOffset;
        return Number.isFinite(index) ? index : null;
    },

    getTimeFromSlotIndex(slotIndex) {
        if (!Number.isFinite(slotIndex)) return null;
        const minutesFromStart = slotIndex * PlannerService.SLOT_DURATION;
        const totalMinutes = PlannerService.START_HOUR * 60 + minutesFromStart;
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        const h = String(hours).padStart(2, '0');
        const m = String(minutes).padStart(2, '0');
        return `${h}:${m}`;
    },

    findNearestAvailableStart(day, desiredTime, duration, excludeTaskId) {
        const desiredIndex = this.getSlotIndexFromTime(desiredTime);
        if (desiredIndex === null) return null;

        const weekGrid = document.getElementById('calendarGrid');
        const column = weekGrid?.querySelector?.(`.day-column[data-day="${day}"]`) || document.querySelector(`.day-column[data-day="${day}"]`);
        const cellCount = column?.querySelectorAll?.('.calendar-cell')?.length ?? 0;
        if (!cellCount) return null;

        const slotsNeeded = Math.ceil(duration / PlannerService.SLOT_DURATION);
        const maxStart = Math.max(0, cellCount - slotsNeeded);
        const clampedDesired = Math.min(Math.max(0, desiredIndex), maxStart);

        const tryIndex = (idx) => {
            const time = this.getTimeFromSlotIndex(idx);
            if (!time) return null;
            return this.isSlotAvailable(day, time, duration, excludeTaskId) ? time : null;
        };

        let time = tryIndex(clampedDesired);
        if (time) return time;

        for (let step = 1; step <= maxStart; step++) {
            const up = clampedDesired - step;
            if (up >= 0) {
                time = tryIndex(up);
                if (time) return time;
            }
            const down = clampedDesired + step;
            if (down <= maxStart) {
                time = tryIndex(down);
                if (time) return time;
            }
        }

        return null;
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
        let pointerContextMenuBlocked = false;
        let pointerMoveRaf = 0;
        let pointerLatestX = 0;
        let pointerLatestY = 0;

        document.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return;
            const taskBlock = e.target?.closest?.('.task-block');
            if (!taskBlock) return;
            const inCalendar = !!taskBlock.closest('.calendar-task');
            const inQueue = !!taskBlock.closest('#taskQueue');
            if (!inCalendar && !inQueue) return;
            if (e.target?.closest?.('.task-delete')) return;
            if (e.target?.closest?.('input, textarea, select, button')) return;
            if (e.detail && e.detail > 1) return;

            const taskId = taskBlock.dataset.taskId;
            const task = Store.getTask(taskId);
            if (!task) return;

            const rect = taskBlock.getBoundingClientRect();
            pointerGhostOffsetX = e.clientX - rect.left;
            pointerGhostOffsetY = e.clientY - rect.top;

            // We skip immediate setPointerCapture here to allow the browser
            // to detect standard 'dblclick' sequences.

            pointerCandidate = { taskId, taskBlock };
            pointerStartX = e.clientX;
            pointerStartY = e.clientY;
            pointerId = e.pointerId;
            pointerDragging = false;
            pointerContextMenuBlocked = false;
        }, { capture: true });

        document.addEventListener('pointermove', (e) => {
            if (!pointerCandidate) return;
            if (pointerId !== e.pointerId) return;

            const dx = e.clientX - pointerStartX;
            const dy = e.clientY - pointerStartY;
            const movedEnough = (dx * dx + dy * dy) >= 144;

            if (!pointerDragging) {
                if (!movedEnough) return;

                // Capture pointer only when drag threshold is met
                try {
                    pointerCandidate.taskBlock.setPointerCapture(pointerId);
                } catch (err) { }

                pointerDragging = true;
                this.isDraggingTask = true;
                document.body.classList.add('dnd-active');
                this.dayTasksCache = {};
                this.lastHoverCell = null;
                this.lastHoverQueue = null;
                this.prepareHitTestCache();
                this.ensureDropIndicator();

                const task = Store.getTask(pointerCandidate.taskId);
                this.draggedTask = task;
                this.draggedElement = pointerCandidate.taskBlock;
                this.draggedElement.classList.add('dragging');

                const ghost = pointerCandidate.taskBlock.cloneNode(true);
                ghost.classList.add('drag-ghost');
                ghost.style.zIndex = '9999';

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

                if (!pointerContextMenuBlocked) {
                    pointerContextMenuBlocked = true;
                    document.addEventListener('contextmenu', (evt) => evt.preventDefault(), { once: true, capture: true });
                }
            }

            if (pointerDragging) e.preventDefault();

            const fromPoint = document.elementFromPoint(e.clientX, e.clientY);
            const queue = fromPoint?.closest?.('#taskQueue') || fromPoint?.closest?.('#queuePanel') || fromPoint?.closest?.('.sidebar');
            const cell = this.getCellFromPointerEvent(e);

            if (pointerGhost) {
                if (window.getSelection) {
                    const selection = window.getSelection();
                    if (selection.removeAllRanges) {
                        selection.removeAllRanges();
                    } else if (selection.empty) {
                        selection.empty();
                    }
                }

                pointerLatestX = e.clientX;
                pointerLatestY = e.clientY;
                if (!pointerMoveRaf) {
                    pointerMoveRaf = requestAnimationFrame(() => {
                        pointerMoveRaf = 0;
                        if (!pointerGhost) return;
                        const x = pointerLatestX - pointerGhostOffsetX;
                        const y = pointerLatestY - pointerGhostOffsetY;
                        pointerGhost.style.transform = `translate3d(${x}px, ${y}px, 0)`;
                    });
                }
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
                this.hideDropIndicator();
                const queueEl = document.getElementById('taskQueue');
                if (queueEl) queueEl.classList.add('drag-over');
            }
            if (!cell && !queue) {
                if (this.lastHoverCell) this.highlightDropZone(this.lastHoverCell);
                else this.hideDropIndicator();
                const queueEl = document.getElementById('taskQueue');
                if (queueEl) queueEl.classList.remove('drag-over');
            }
        }, { capture: true });

        const finishPointerDrag = (e) => {
            if (!pointerCandidate) return;
            if (pointerId !== e.pointerId) return;

            const finishVisuals = () => {
                if (pointerMoveRaf) {
                    cancelAnimationFrame(pointerMoveRaf);
                    pointerMoveRaf = 0;
                }
                if (pointerGhost) {
                    pointerGhost.remove();
                    pointerGhost = null;
                }
                document.body.classList.remove('dnd-active');
                this.hideDropIndicator();
                this.clearHitTestCache();
                if (this.draggedElement) {
                    this.draggedElement.classList.remove('dragging');
                    this.draggedElement.style.opacity = '';
                    this.draggedElement.style.pointerEvents = '';
                } else if (pointerCandidate && pointerCandidate.taskBlock) {
                    // Safety reset for visibility if drag didn't activate
                    pointerCandidate.taskBlock.style.opacity = '';
                    pointerCandidate.taskBlock.style.pointerEvents = '';
                }
            };

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
                const duration = this.draggedTask.duration;

                const day = cell?.dataset?.day || null;
                const time = cell?.dataset?.time || null;

                finishVisuals();

                if (queue) {
                    Store.unscheduleTask(taskId, true);
                } else if (day && time) {
                    this.dayTasksCache = {};
                    const bestTime = this.findNearestAvailableStart(day, time, duration, taskId);
                    if (bestTime) Store.rescheduleTaskInWeek(taskId, day, bestTime);
                }

                if (Calendar && typeof Calendar.refresh === 'function') Calendar.refresh();
                if (TaskQueue && typeof TaskQueue.refresh === 'function') TaskQueue.refresh();
                if (Analytics && typeof Analytics.render === 'function') Analytics.render();
            } else {
                finishVisuals();
            }

            pointerCandidate = null;
            pointerId = null;
            pointerDragging = false;
            this.draggedTask = null;
            this.draggedElement = null;
            this.dayTasksCache = {};
            this.lastHoverCell = null;
            this.lastHoverQueue = null;
            this.isDraggingTask = false;
        };

        document.addEventListener('pointerup', finishPointerDrag, { capture: true });
        document.addEventListener('pointercancel', finishPointerDrag, { capture: true });
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
        const day = startCell.dataset.day;
        const time = startCell.dataset.time;
        const column = startCell.closest('.day-column');

        const slotIndex = this.getSlotIndexFromTime(time);
        if (slotIndex === null) {
            this.hideDropIndicator();
            return;
        }

        const cache = this.hitTestCache?.columnsByEl?.get(column);
        const cellCount = cache?.cellCount ?? column?.querySelectorAll?.('.calendar-cell')?.length ?? 0;

        const slotsNeeded = Math.ceil(this.draggedTask.duration / PlannerService.SLOT_DURATION);
        const slotsToShow = Math.max(0, Math.min(slotsNeeded, cellCount - slotIndex));
        const fits = slotIndex + slotsNeeded <= cellCount;

        const isAvailable = fits && this.isSlotAvailable(day, time, this.draggedTask.duration, this.draggedTask.id);
        this.showDropIndicator(column, slotIndex, slotsToShow, isAvailable);
    }
};
