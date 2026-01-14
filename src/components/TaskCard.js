/**
 * TaskCard Component - Renders task blocks with responsive layouts
 */

import { Departments } from '../departments.js';
import { PlannerService } from '../services/PlannerService.js';

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
    const lines = notes.split('\n').filter(line => line.trim());
    const steps = lines.filter(line => line.includes('[ ]') || line.includes('[x]'));
    const completed = steps.filter(line => line.includes('[x]')).length;
    return { completed, total: steps.length };
  }

  render({ isDayView = false, isCompact = false } = {}) {
    const task = this.task;
    const color = Departments.getColor(task.hierarchy);
    const abbr = Departments.getRootAbbreviation(task.hierarchy);
    const topDept = task.hierarchy[0] || '';
    const hierarchyPath = task.hierarchy.slice(1).join(' › ');

    const el = document.createElement('div');

    // Determine layout tier based on duration
    const isStandard = task.duration >= 45 && task.duration < 90;
    const isFull = task.duration >= 90;

    // Use a unified layout class for base styling
    el.className = `task-block ${task.completed ? 'completed' : ''} ${isDayView ? 'day-view' : ''} ${isCompact ? 'layout-compact' : isStandard ? 'layout-standard' : isFull ? 'layout-full' : ''}`;
    el.dataset.taskId = task.id;
    el.draggable = true;
    el.style.setProperty('--task-color', color);

    // Escape HTML helper
    const esc = PlannerService.escapeHtml;

    // Step progress
    const { completed, total } = this.getStepCounts();
    const progressPercent = total > 0 ? (completed / total) * 100 : 0;
    const isAllComplete = total > 0 && completed === total;
    const stepText = isAllComplete ? '✓ Complete' : `${completed}/${total} steps`;
    const completeClass = isAllComplete ? 'complete' : '';

    const stepProgressHtml = total > 0
      ? `<span class="task-step-progress ${completeClass}">
           <span class="step-fill" style="width: ${progressPercent}%"></span>
           <span class="step-text">${stepText}</span>
         </span>`
      : '';

    // Unified Header Structure
    const headerHtml = `
      <div class="task-header task-header-row">
        <div class="task-header-left">
          <span class="task-dept-badge" style="background-color: ${color};">${abbr}</span>
          <span class="task-title">${esc(task.title)}</span>
        </div>
        ${isDayView ? stepProgressHtml : ''}
        <div class="task-duration">
          <span>${PlannerService.formatDuration(task.duration)}</span>
        </div>
      </div>
    `;

    // Additional Content (Progress Row or Hierarchy)
    let additionalContent = '';
    if (!isDayView && total > 0) {
      // Week View Progress Row
      additionalContent = `
        <div class="task-progress-row ${isCompact ? 'compact' : ''}">
          <span class="task-step-progress full-width ${completeClass}">
            <span class="step-fill" style="width: ${progressPercent}%"></span>
            <span class="step-text">${stepText}</span>
          </span>
        </div>
      `;
    } else if (isDayView && task.duration >= 60 && (topDept || hierarchyPath)) {
      // Day View Hierarchy Path
      const fullPath = [topDept, ...task.hierarchy.slice(1)].filter(Boolean).join(' › ');
      additionalContent = `<div class="task-hierarchy-row">${esc(fullPath)}</div>`;
    }

    el.innerHTML = `
      <button class="task-delete" title="Delete">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
      ${headerHtml}
      ${additionalContent}
    `;

    return el;
  }
}
