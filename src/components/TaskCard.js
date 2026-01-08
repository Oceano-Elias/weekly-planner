/**
 * TaskCard Component - Renders task blocks
 */

import { Departments } from '../departments.js';
import { PlannerService } from '../services/PlannerService.js';

export class TaskCard {
  constructor(task) {
    this.task = task;
  }

  render({ isDayView = false, isCompact = false } = {}) {
    const task = this.task;
    const color = Departments.getColor(task.hierarchy);
    const abbr = Departments.getAbbreviation(task.hierarchy);
    const topDept = task.hierarchy[0] || '';

    const el = document.createElement('div');
    el.className = `task-block ${task.completed ? 'completed' : ''} ${isDayView ? 'day-view' : ''}`;
    el.dataset.taskId = task.id;
    el.draggable = true;
    el.style.setProperty('--task-color', color);

    if (isCompact || task.duration <= 30) {
      // Compact layout
      el.innerHTML = `
        <button class="task-delete" title="Delete">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
        <div class="task-header">
          <span class="task-dept-badge" style="background-color: ${color};">${abbr}</span>
          <span class="task-title">${PlannerService.escapeHtml(task.title)}</span>
        </div>
      `;
    } else {
      // Full layout
      const hierarchyPath = task.hierarchy.slice(1).join(' › ');
      el.innerHTML = `
        <button class="task-delete" title="Delete">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
        <div class="task-header">
          <span class="task-dept-badge" style="background-color: ${color};">${abbr}</span>
          <span class="task-top-dept">${topDept}</span>
          <span class="task-duration">${PlannerService.formatDuration(task.duration)}</span>
        </div>
        <div class="task-title">${PlannerService.escapeHtml(task.title)}</div>
        ${task.goal ? `<div class="task-goal" style="display: ${isDayView ? 'block' : 'none'};">${PlannerService.escapeHtml(task.goal)}</div>` : ''}
        ${hierarchyPath ? `<div class="task-hierarchy">${PlannerService.escapeHtml(hierarchyPath)}</div>` : ''}
        ${task.notes && isDayView ? (() => {
          const lines = task.notes.split('\n').filter(line => line.trim());
          const miniTasks = lines.filter(line => line.includes('[ ]') || line.includes('[x]'));

          if (miniTasks.length === 0) return '';

          const completedCount = miniTasks.filter(line => line.includes('[x]')).length;
          return `
            <div class="task-notes">
              <div class="notes-summary">
                <span class="notes-count">${completedCount} of ${miniTasks.length} mini-tasks completed</span>
                <div class="notes-progress-bar">
                  <div class="notes-progress-fill" style="width: ${(completedCount / miniTasks.length) * 100}%"></div>
                </div>
              </div>
            </div>
          `;
        })() : ''}
      `;
    }

    return el;
  }

}
