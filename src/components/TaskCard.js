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

    el.className = `task-block ${task.completed ? 'completed' : ''} ${isDayView ? 'day-view' : ''} ${isCompact ? 'layout-compact' : isStandard ? 'layout-standard' : isFull ? 'layout-full' : ''}`;
    el.dataset.taskId = task.id;
    el.draggable = true;
    el.style.setProperty('--task-color', color);

    // Escape HTML helper
    const esc = PlannerService.escapeHtml;

    // Step progress - show in both Day View and Week View if task has steps
    const { completed, total } = this.getStepCounts();
    const stepProgressHtml = total > 0
      ? `<span class="task-step-progress">${completed}/${total} steps</span>`
      : '';

    if (isCompact || task.duration <= 30) {
      // COMPACT: Badge + Title + Steps + Duration — all in one row
      el.innerHTML = `
        <button class="task-delete" title="Delete">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
        <div class="task-header task-header-row">
          <div class="task-header-left">
            <span class="task-dept-badge" style="background-color: ${color};">${abbr}</span>
            <span class="task-title">${esc(task.title)}</span>
          </div>
          ${stepProgressHtml}
          <span class="task-duration">${PlannerService.formatDuration(task.duration)}</span>
        </div>
      `;
    } else {
      // STANDARD/FULL: Header row + additional content below
      let additionalContent = '';

      // Show hierarchy for 60min+
      if (task.duration >= 60 && (topDept || hierarchyPath)) {
        const fullPath = [topDept, ...task.hierarchy.slice(1)].filter(Boolean).join(' › ');
        additionalContent += `<div class="task-hierarchy-row">${esc(fullPath)}</div>`;
      }

      // Mini-tasks are now shown in header as "X/Y steps" - no duplicate display needed

      el.innerHTML = `
        <button class="task-delete" title="Delete">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
        <div class="task-header task-header-row">
          <div class="task-header-left">
            <span class="task-dept-badge" style="background-color: ${color};">${abbr}</span>
            <span class="task-title">${esc(task.title)}</span>
          </div>
          ${stepProgressHtml}
          <span class="task-duration">${PlannerService.formatDuration(task.duration)}</span>
        </div>
        ${additionalContent}
      `;
    }

    return el;
  }
}
