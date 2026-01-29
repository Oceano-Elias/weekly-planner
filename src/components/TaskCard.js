/**
 * TaskCard Component - Renders task blocks with responsive layouts
 */

import { Departments } from '../departments.js';
import { PlannerService } from '../services/PlannerService.js';
import { DOMUtils } from '../utils/DOMUtils.js';

export class TaskCard {
    constructor(task) {
        this.task = task;
    }

    /**
     * Count steps (checklist items) from notes
     * Returns { completed, total }
     */
    getStepCounts() {
        const notes = this.task.notes || '';
        const lines = notes.split('\n').filter((line) => line.trim());
        const steps = lines.filter((line) => line.includes('[ ]') || line.includes('[x]'));
        const completed = steps.filter((line) => line.includes('[x]')).length;
        return { completed, total: steps.length };
    }

    render({ isDayView = false, isCompact = false, isActive = false } = {}) {
        const task = this.task;
        const color = Departments.getColor(task.hierarchy);
        const abbr = Departments.getRootAbbreviation(task.hierarchy);
        const topDept = task.hierarchy[0] || '';
        const hierarchyPath = task.hierarchy.slice(1).join(' › ');

        // Determine layout tier based on duration
        const isStandard = task.duration >= 45 && task.duration < 90;
        const isFull = task.duration >= 90;

        // Use a unified layout class for base styling
        // Use a unified layout class with Day View adjustments
        const actualStandard = isDayView ? (task.duration >= 45 && task.duration < 60) : isStandard;
        const actualFull = isDayView ? (task.duration >= 60) : isFull;

        const className = `glass-surface glass-surface-hover task-block ${task.completed ? 'completed' : ''} ${isDayView ? 'day-view' : ''} ${isCompact ? 'layout-compact' : actualStandard ? 'layout-standard' : actualFull ? 'layout-full' : ''} ${isActive ? 'is-active' : ''}`;

        const el = DOMUtils.createElement('div', {
            className,
            draggable: true,
            tabIndex: 0,
            role: 'button',
            'aria-label': `${task.title}, ${PlannerService.formatDuration(task.duration)}${task.completed ? ', completed' : ''}`,
            dataset: { taskId: task.id },
            style: { '--task-color': color },
        });

        // Add click listener to track last selected task for shortcuts
        el.addEventListener('click', (e) => {
            window.lastClickedTaskId = task.id;
        });

        // Add keyboard support
        el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                // Simulate click for selection
                window.lastClickedTaskId = task.id;
            }
        });

        // Delete Button
        const deleteBtn = DOMUtils.createElement(
            'button',
            {
                className: 'task-delete',
                title: 'Delete',
                'aria-label': 'Delete task',
            },
            [
                DOMUtils.createSVG(
                    'svg',
                    {
                        width: '12',
                        height: '12',
                        viewBox: '0 0 24 24',
                        fill: 'none',
                        stroke: 'currentColor',
                        'stroke-width': '2',
                    },
                    [DOMUtils.createSVG('path', { d: 'M18 6L6 18M6 6l12 12' })]
                ),
            ]
        );
        el.appendChild(deleteBtn);

        // Header
        const header = DOMUtils.createElement('div', { className: 'task-header task-header-row' });

        const headerLeft = DOMUtils.createElement('div', { className: 'task-header-left' });

        // Add running icon if active
        if (isActive) {
            headerLeft.appendChild(DOMUtils.createElement('div', { className: 'task-running-icon' }));
        }

        headerLeft.appendChild(
            DOMUtils.createElement('span', {
                className: 'task-dept-badge',
                style: {
                    backgroundColor: `color-mix(in srgb, ${color} 20%, transparent)`,
                    color: color,
                    border: `1px solid ${color}`,
                },
                textContent: abbr,
            })
        );
        headerLeft.appendChild(
            DOMUtils.createElement('span', {
                className: 'task-title',
                textContent: task.title,
            })
        );
        header.appendChild(headerLeft);

        const { completed, total } = this.getStepCounts();
        const progressPercent = total > 0 ? (completed / total) * 100 : 0;
        const isAllComplete = total > 0 && completed === total;
        const stepText = isAllComplete ? '✓ Complete' : `${completed}/${total} steps`;
        const completeClass = isAllComplete ? 'complete' : '';

        // Prepare Progress Element (if needed)
        let stepProgress = null;
        if (total > 0) {
            stepProgress = DOMUtils.createElement('span', {
                className: `task-step-progress ${isDayView ? 'header-pill' : 'full-width'} ${completeClass}`,
            });
            stepProgress.appendChild(
                DOMUtils.createElement('span', {
                    className: 'step-fill',
                    style: { width: `${progressPercent}%` },
                })
            );
            stepProgress.appendChild(
                DOMUtils.createElement('span', {
                    className: 'step-text',
                    innerHTML: isAllComplete
                        ? '<svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"4\" style=\"margin-right:4px\"><polyline points=\"20 6 9 17 4 12\"></polyline></svg>Complete'
                        : stepText,
                })
            );
        }

        // Minimal Status Indicator (UX Polish)
        if (task.completed) {
            const statusIcon = DOMUtils.createSVG(
                'svg',
                {
                    width: '14',
                    height: '14',
                    viewBox: '0 0 24 24',
                    fill: 'none',
                    stroke: 'var(--accent-success)',
                    'stroke-width': '3',
                    class: 'task-status-icon',
                },
                [DOMUtils.createSVG('polyline', { points: '20 6 9 17 4 12' })]
            );
            header.appendChild(statusIcon);
        } else {
            // Support for horizontal minitasks in Day View
            if (isDayView && stepProgress) {
                header.appendChild(stepProgress);
            }

            // Duration only if not completed or if space allows
            const durationDiv = DOMUtils.createElement('div', { className: 'task-duration' });
            durationDiv.appendChild(
                DOMUtils.createElement('span', {
                    textContent: PlannerService.formatDuration(task.duration),
                })
            );
            header.appendChild(durationDiv);
        }

        el.appendChild(header);

        // Additional Content - Progress Row for Week View or Hierarchy
        if (total > 0 && !isDayView) {
            // Week View Progress Row
            const progressRow = DOMUtils.createElement('div', {
                className: `task-progress-row ${isCompact ? 'compact' : ''}`,
            });
            progressRow.appendChild(stepProgress);
            el.appendChild(progressRow);
        }

        // Add Resize Handle (only for non-completed tasks)
        if (!task.completed) {
            const resizeHandle = DOMUtils.createElement('div', {
                className: 'task-resize-handle',
                title: 'Drag to resize duration',
            });
            el.appendChild(resizeHandle);
        }

        return el;
    }
}
