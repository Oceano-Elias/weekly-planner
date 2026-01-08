/**
 * Analytics - Hours by department
 */

import { Store } from '../store.js';
import { Departments } from '../departments.js';
import { PlannerService } from '../services/PlannerService.js';

export const Analytics = {
    /**
     * Render analytics
     */
    render() {
        const container = document.getElementById('analyticsContainer');
        if (!container) return;

        const data = Store.getAnalytics();
        const entries = Object.entries(data);

        if (entries.length === 0) {
            container.innerHTML = `
        <div class="analytics-empty">
          <p>No scheduled tasks this week</p>
        </div>
      `;
            return;
        }

        const total = entries.reduce((sum, [, v]) => sum + v.total, 0);

        container.innerHTML = `
      <div class="analytics-header">
        <h3>Time by Department</h3>
        <p class="analytics-total">Total: ${PlannerService.formatDuration(total)}</p>
      </div>
      <div class="analytics-chart">
        ${entries.map(([dept, { total: deptTotal, completed }]) => {
            const color = Departments.getColor([dept]);
            const percent = Math.round((deptTotal / total) * 100);
            const completedPercent = Math.round((completed / deptTotal) * 100);
            return `
            <div class="analytics-bar-container">
              <div class="analytics-bar-label">
                <span class="analytics-dept" style="color: ${color};">${dept}</span>
                <span class="analytics-value">${PlannerService.formatDuration(deptTotal)} (${percent}%)</span>
              </div>
              <div class="analytics-bar-wrapper">
                <div class="analytics-bar" style="width: ${percent}%; background-color: ${color};">
                  <div class="analytics-bar-completed" style="width: ${completedPercent}%;"></div>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
    }
};
