/**
 * Analytics - Hours by department with stats cards
 */

import { Store } from '../store.js';
import { Departments } from '../departments.js';
import { PlannerService } from '../services/PlannerService.js';

export const Analytics = {
    /**
     * SVG Icons for stats - professional line icons
     */
    icons: {
        tasks: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 11l3 3L22 4"/>
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
        </svg>`,
        miniTasks: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="8" y1="6" x2="21" y2="6"/>
            <line x1="8" y1="12" x2="21" y2="12"/>
            <line x1="8" y1="18" x2="21" y2="18"/>
            <circle cx="4" cy="6" r="1.5" fill="currentColor"/>
            <circle cx="4" cy="12" r="1.5" fill="currentColor"/>
            <circle cx="4" cy="18" r="1.5" fill="currentColor"/>
        </svg>`,
        time: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
        </svg>`
    },

    /**
     * Render analytics
     */
    render() {
        const container = document.getElementById('analyticsContainer');
        if (!container) return;

        const data = Store.getAnalyticsForWeek();
        const { byHierarchy, miniTasks, tasks, duration } = data;
        const entries = Object.entries(byHierarchy);

        if (entries.length === 0) {
            container.innerHTML = `
                <div class="analytics-empty">
                    <p>No scheduled tasks this week</p>
                </div>
            `;
            return;
        }

        const total = entries.reduce((sum, [, v]) => sum + v.total, 0);
        const taskPercent = tasks.total > 0 ? Math.round((tasks.completed / tasks.total) * 100) : 0;
        const miniPercent = miniTasks.total > 0 ? Math.round((miniTasks.completed / miniTasks.total) * 100) : 0;

        container.innerHTML = `
            <div class="analytics-stats-grid">
                <div class="analytics-stat-card ring-card">
                    <div class="progress-ring-container">
                        <svg class="progress-ring" viewBox="0 0 80 80">
                            <circle class="progress-ring-bg" cx="40" cy="40" r="32" />
                            <circle class="progress-ring-fill tasks" cx="40" cy="40" r="32" 
                                stroke-dasharray="${201}" 
                                stroke-dashoffset="${201 - (201 * taskPercent / 100)}" />
                        </svg>
                        <div class="progress-ring-value">${taskPercent}%</div>
                    </div>
                    <div class="stat-content">
                        <div class="stat-value">${tasks.completed}<span class="stat-total">/${tasks.total}</span></div>
                        <div class="stat-label">Tasks Done</div>
                    </div>
                </div>
                
                <div class="analytics-stat-card ring-card">
                    <div class="progress-ring-container">
                        <svg class="progress-ring" viewBox="0 0 80 80">
                            <circle class="progress-ring-bg" cx="40" cy="40" r="32" />
                            <circle class="progress-ring-fill mini" cx="40" cy="40" r="32" 
                                stroke-dasharray="${201}" 
                                stroke-dashoffset="${201 - (201 * miniPercent / 100)}" />
                        </svg>
                        <div class="progress-ring-value">${miniPercent}%</div>
                    </div>
                    <div class="stat-content">
                        <div class="stat-value">${miniTasks.completed}<span class="stat-total">/${miniTasks.total}</span></div>
                        <div class="stat-label">Mini-Tasks</div>
                    </div>
                </div>
                
                <div class="analytics-stat-card time-card">
                    <div class="stat-icon stat-icon-time">${this.icons.time}</div>
                    <div class="stat-content">
                        <div class="stat-value">${PlannerService.formatDuration(duration.total)}</div>
                        <div class="stat-label">Total Time</div>
                    </div>
                </div>
            </div>
            
            <div class="analytics-header">
                <h3>Time by Department</h3>
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
