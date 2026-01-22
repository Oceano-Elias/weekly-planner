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

    render({ isDayView = false, isCompact = false } = {}) {
        const task = this.task;
        const color = Departments.getColor(task.hierarchy);
        const abbr = Departments.getRootAbbreviation(task.hierarchy);
        const topDept = task.hierarchy[0] || '';
        const hierarchyPath = task.hierarchy.slice(1).join(' › ');

        // Determine layout tier based on duration
        const isStandard = task.duration >= 45 && task.duration < 90;
        const isFull = task.duration >= 90;

        // Use a unified layout class for base styling
        const className = `glass-surface glass-surface-hover task-block ${task.completed ? 'completed' : ''} ${isDayView ? 'day-view' : ''} ${isCompact ? 'layout-compact' : isStandard ? 'layout-standard' : isFull ? 'layout-full' : ''}`;

        const el = DOMUtils.createElement('div', {
            className,
            draggable: true,
            tabIndex: 0,
            role: 'button',
            'aria-label': `${task.title}, ${PlannerService.formatDuration(task.duration)}${task.completed ? ', completed' : ''}`,
            dataset: { taskId: task.id },
            style: { '--task-color': color },
        });

        // Add keyboard support
        el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                // Simulate click for selection
                window.lastClickedTaskId = task.id;
                // If double keypress (like dblclick), edit?
                // For now just allow selection via keyboard.
                // Editing usually requires a dedicated shortcut or button.
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

        // Step Progress (Day View)
        const { completed, total } = this.getStepCounts();
        const progressPercent = total > 0 ? (completed / total) * 100 : 0;
        const isAllComplete = total > 0 && completed === total;
        const stepText = isAllComplete ? '✓ Complete' : `${completed}/${total} steps`;
        const completeClass = isAllComplete ? 'complete' : '';

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

        // Additional Content
        if (!isDayView && total > 0) {
            // Week View Progress Row
            const progressRow = DOMUtils.createElement('div', {
                className: `task-progress-row ${isCompact ? 'compact' : ''}`,
            });
            const stepProgress = DOMUtils.createElement('span', {
                className: `task-step-progress full-width ${completeClass}`,
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
                    textContent: stepText,
                })
            );
            progressRow.appendChild(stepProgress);
            el.appendChild(progressRow);
        } else if (isDayView && task.duration >= 60 && (topDept || hierarchyPath)) {
            // Day View Hierarchy Path
            const fullPath = [topDept, ...task.hierarchy.slice(1)].filter(Boolean).join(' › ');
            el.appendChild(
                DOMUtils.createElement('div', {
                    className: 'task-hierarchy-row',
                    textContent: fullPath,
                })
            );
        }

        return el;
    }
}
