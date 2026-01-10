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
     * Generate SVG path for sparkline chart
     * @param {Array<number>} values - Array of 7 percentage values (0-100)
     * @returns {Object} - { line: path for stroke, fill: path for gradient fill }
     */
    generateSparklinePath(values) {
        const width = 70;
        const height = 24;
        const padding = 2;

        // If all values are 0, return flat lines
        const hasData = values.some(v => v > 0);
        if (!hasData) {
            const y = height - padding;
            return {
                line: `M ${padding} ${y} L ${width - padding} ${y}`,
                fill: `M ${padding} ${y} L ${width - padding} ${y} L ${width - padding} ${height} L ${padding} ${height} Z`
            };
        }

        const points = values.map((val, i) => {
            const x = padding + (i * (width - 2 * padding) / (values.length - 1));
            const y = height - padding - (val / 100) * (height - 2 * padding);
            return { x, y };
        });

        // Create smooth curve using quadratic bezier
        let linePath = `M ${points[0].x} ${points[0].y}`;
        for (let i = 1; i < points.length; i++) {
            const midX = (points[i - 1].x + points[i].x) / 2;
            linePath += ` Q ${points[i - 1].x} ${points[i - 1].y}, ${midX} ${(points[i - 1].y + points[i].y) / 2}`;
        }
        linePath += ` T ${points[points.length - 1].x} ${points[points.length - 1].y}`;

        // Create fill path (close to bottom)
        const fillPath = linePath +
            ` L ${points[points.length - 1].x} ${height} ` +
            ` L ${points[0].x} ${height} Z`;

        return { line: linePath, fill: fillPath };
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
                    <div class="empty-state-illustration">
                        <svg viewBox="0 0 200 140" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <!-- Background decorations -->
                            <circle class="float-shape s1" cx="25" cy="30" r="6" fill="url(#aGrad1)" opacity="0.3"/>
                            <circle class="float-shape s2" cx="175" cy="25" r="5" fill="url(#aGrad2)" opacity="0.4"/>
                            
                            <!-- Chart bars -->
                            <g transform="translate(40, 20)">
                                <rect x="0" y="60" width="20" height="50" rx="4" fill="url(#aGrad1)" opacity="0.4"/>
                                <rect x="30" y="40" width="20" height="70" rx="4" fill="url(#aGrad1)" opacity="0.5"/>
                                <rect x="60" y="20" width="20" height="90" rx="4" fill="url(#aGrad1)" opacity="0.6"/>
                                <rect x="90" y="50" width="20" height="60" rx="4" fill="url(#aGrad1)" opacity="0.45"/>
                                
                                <!-- Baseline -->
                                <line x1="0" y1="110" x2="110" y2="110" stroke="#475569" stroke-width="2" stroke-linecap="round"/>
                            </g>
                            
                            <!-- Sparkle -->
                            <path class="sparkle" d="M160 60 L162 65 L167 67 L162 69 L160 74 L158 69 L153 67 L158 65 Z" fill="#fbbf24"/>
                            
                            <!-- Gradients -->
                            <defs>
                                <linearGradient id="aGrad1" x1="0%" y1="0%" x2="0%" y2="100%">
                                    <stop offset="0%" stop-color="#3b82f6"/>
                                    <stop offset="100%" stop-color="#8b5cf6"/>
                                </linearGradient>
                                <linearGradient id="aGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stop-color="#10b981"/>
                                    <stop offset="100%" stop-color="#06b6d4"/>
                                </linearGradient>
                            </defs>
                        </svg>
                    </div>
                    <p class="empty-state-title">No scheduled tasks</p>
                    <p class="empty-state-subtitle">Schedule tasks to see your analytics</p>
                </div>
            `;
            return;
        }

        const total = entries.reduce((sum, [, v]) => sum + v.total, 0);
        const taskPercent = tasks.total > 0 ? Math.round((tasks.completed / tasks.total) * 100) : 0;
        const miniPercent = miniTasks.total > 0 ? Math.round((miniTasks.completed / miniTasks.total) * 100) : 0;

        // Get daily stats for sparkline
        const dailyStats = Store.getDailyStatsForWeek();
        const taskSparkline = this.generateSparklinePath(dailyStats.map(d => d.tasks.percent));
        const miniSparkline = this.generateSparklinePath(dailyStats.map(d => d.miniTasks.percent));

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
                        <div class="sparkline-container">
                            <svg class="sparkline" viewBox="0 0 70 24" preserveAspectRatio="none">
                                <defs>
                                    <linearGradient id="sparkGradTasks" x1="0%" y1="0%" x2="0%" y2="100%">
                                        <stop offset="0%" stop-color="#10b981" stop-opacity="0.3"/>
                                        <stop offset="100%" stop-color="#10b981" stop-opacity="0"/>
                                    </linearGradient>
                                </defs>
                                <path class="sparkline-fill" d="${taskSparkline.fill}" fill="url(#sparkGradTasks)"/>
                                <path class="sparkline-line tasks" d="${taskSparkline.line}" fill="none" stroke="#10b981" stroke-width="1.5"/>
                            </svg>
                        </div>
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
                        <div class="sparkline-container">
                            <svg class="sparkline" viewBox="0 0 70 24" preserveAspectRatio="none">
                                <defs>
                                    <linearGradient id="sparkGradMini" x1="0%" y1="0%" x2="0%" y2="100%">
                                        <stop offset="0%" stop-color="#a855f7" stop-opacity="0.3"/>
                                        <stop offset="100%" stop-color="#a855f7" stop-opacity="0"/>
                                    </linearGradient>
                                </defs>
                                <path class="sparkline-fill" d="${miniSparkline.fill}" fill="url(#sparkGradMini)"/>
                                <path class="sparkline-line mini" d="${miniSparkline.line}" fill="none" stroke="#a855f7" stroke-width="1.5"/>
                            </svg>
                        </div>
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
