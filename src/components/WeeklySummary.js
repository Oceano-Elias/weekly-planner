/**
 * WeeklySummary Component
 * Displays end-of-week statistics and productivity insights
 */

import { Store } from '../store.js';
import { PlannerService } from '../services/PlannerService.js';

export const WeeklySummary = {
    isOpen: false,

    /**
     * Open the weekly summary modal
     */
    open() {
        this.isOpen = true;
        this.render();
    },

    /**
     * Close the weekly summary modal
     */
    close() {
        this.isOpen = false;
        const container = document.getElementById('weeklySummaryContainer');
        if (container) {
            container.innerHTML = '';
        }
    },

    /**
     * Get weekly statistics
     */
    getWeeklyStats() {
        const weekId = Store.getWeekIdentifier(window.Calendar?.currentWeekStart || new Date());
        const tasks = Store.getTasksForWeek(weekId);
        const dailyStats = Store.getDailyStatsForWeek();

        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

        // Calculate totals
        const totalTasks = tasks.length;
        const completedTasks = tasks.filter(t => t.completed).length;
        const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

        // Calculate total scheduled time
        let totalMinutes = 0;
        let completedMinutes = 0;
        tasks.forEach(task => {
            if (task.scheduledDay && task.scheduledTime) {
                totalMinutes += task.duration;
                if (task.completed) {
                    completedMinutes += task.duration;
                }
            }
        });

        // Find best day
        let bestDay = null;
        let bestDayRate = 0;
        dailyStats.forEach((day, index) => {
            const total = day.tasks.total;
            const completed = day.tasks.completed;
            if (total > 0) {
                const rate = completed / total;
                const bestCompleted = bestDay !== null ? dailyStats[bestDay].tasks.completed : 0;
                if (rate > bestDayRate || (rate === bestDayRate && completed > bestCompleted)) {
                    bestDayRate = rate;
                    bestDay = index;
                }
            }
        });

        // Calculate mini-task stats
        let totalMiniTasks = 0;
        let completedMiniTasks = 0;
        tasks.forEach(task => {
            if (task.notes) {
                const lines = task.notes.split('\n');
                lines.forEach(line => {
                    if (line.includes('[x]')) completedMiniTasks++;
                    if (line.includes('[ ]') || line.includes('[x]')) totalMiniTasks++;
                });
            }
        });

        // Calculate streak (consecutive days with all tasks completed)
        let currentStreak = 0;
        for (let i = dailyStats.length - 1; i >= 0; i--) {
            const day = dailyStats[i];
            const total = day.tasks.total;
            const completed = day.tasks.completed;
            if (total > 0 && completed === total) {
                currentStreak++;
            } else if (total > 0) {
                break;
            }
        }

        return {
            weekId,
            totalTasks,
            completedTasks,
            completionRate,
            totalMinutes,
            completedMinutes,
            bestDay: bestDay !== null ? days[bestDay] : null,
            bestDayRate: Math.round(bestDayRate * 100),
            totalMiniTasks,
            completedMiniTasks,
            miniTaskRate: totalMiniTasks > 0 ? Math.round((completedMiniTasks / totalMiniTasks) * 100) : 0,
            currentStreak,
            dailyStats
        };
    },

    /**
     * Format minutes to hours and minutes
     */
    formatDuration(minutes) {
        if (minutes < 60) return `${minutes}m`;
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    },

    /**
     * Generate sparkline SVG for daily completion
     */
    generateSparkline(dailyStats) {
        const values = dailyStats.map(d => d.tasks.percent);
        const max = Math.max(...values, 1);
        const width = 200;
        const height = 40;
        const padding = 4;

        const points = values.map((v, i) => {
            const x = padding + (i / (values.length - 1)) * (width - padding * 2);
            const y = height - padding - (v / max) * (height - padding * 2);
            return `${x},${y}`;
        }).join(' ');

        return `
            <svg viewBox="0 0 ${width} ${height}" class="summary-sparkline">
                <defs>
                    <linearGradient id="summaryGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stop-color="rgba(99, 102, 241, 0.3)"/>
                        <stop offset="100%" stop-color="rgba(99, 102, 241, 0)"/>
                    </linearGradient>
                </defs>
                <polyline 
                    fill="url(#summaryGrad)" 
                    stroke="none"
                    points="${padding},${height - padding} ${points} ${width - padding},${height - padding}"
                />
                <polyline 
                    fill="none" 
                    stroke="#6366f1" 
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    points="${points}"
                />
            </svg>
        `;
    },

    /**
     * Generate progress ring SVG
     */
    generateProgressRing(percent, color = '#6366f1') {
        const radius = 45;
        const circumference = 2 * Math.PI * radius;
        const offset = circumference * (1 - percent / 100);

        return `
            <svg viewBox="0 0 100 100" class="summary-ring">
                <circle cx="50" cy="50" r="${radius}" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="8"/>
                <circle 
                    cx="50" cy="50" r="${radius}" 
                    fill="none" 
                    stroke="${color}" 
                    stroke-width="8"
                    stroke-linecap="round"
                    stroke-dasharray="${circumference}"
                    stroke-dashoffset="${offset}"
                    transform="rotate(-90 50 50)"
                    class="ring-progress"
                />
                <text x="50" y="52" text-anchor="middle" dominant-baseline="middle" class="ring-text">${percent}%</text>
            </svg>
        `;
    },

    /**
     * Render the summary modal
     */
    render() {
        const container = document.getElementById('weeklySummaryContainer');
        if (!container) return;

        const stats = this.getWeeklyStats();
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

        container.innerHTML = `
            <div class="summary-overlay" id="summaryOverlay">
                <div class="summary-content">
                    <button class="summary-close" id="closeSummary">×</button>
                    
                    <div class="summary-header">
                        <h2>📊 Weekly Summary</h2>
                        <span class="summary-week-label">${stats.weekId}</span>
                    </div>

                    <div class="summary-body">
                        <!-- Main Progress Ring -->
                        <div class="summary-main-stat">
                            ${this.generateProgressRing(stats.completionRate)}
                            <div class="summary-main-label">Task Completion</div>
                        </div>

                        <!-- Quick Stats Grid -->
                        <div class="summary-stats-grid">
                            <div class="summary-stat-card">
                                <span class="stat-value">${stats.completedTasks}/${stats.totalTasks}</span>
                                <span class="stat-label">Tasks Done</span>
                            </div>
                            <div class="summary-stat-card">
                                <span class="stat-value">${this.formatDuration(stats.completedMinutes)}</span>
                                <span class="stat-label">Time Completed</span>
                            </div>
                            <div class="summary-stat-card">
                                <span class="stat-value">${stats.completedMiniTasks}/${stats.totalMiniTasks}</span>
                                <span class="stat-label">Mini-Tasks</span>
                            </div>
                            <div class="summary-stat-card highlight">
                                <span class="stat-value">${stats.currentStreak}</span>
                                <span class="stat-label">Day Streak 🔥</span>
                            </div>
                        </div>

                        <!-- Daily Breakdown -->
                        <div class="summary-daily">
                            <h4>Daily Breakdown</h4>
                            <div class="daily-bars">
                                ${stats.dailyStats.map((day, i) => `
                                    <div class="daily-bar-item ${stats.bestDay === ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][i] ? 'best' : ''}">
                                        <div class="daily-bar-fill" style="height: ${day.tasks.percent}%"></div>
                                        <span class="daily-bar-label">${days[i]}</span>
                                        <span class="daily-bar-value">${day.tasks.completed}/${day.tasks.total}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>

                        <!-- Best Day Highlight -->
                        ${stats.bestDay ? `
                            <div class="summary-highlight">
                                <span class="highlight-icon">🏆</span>
                                <span class="highlight-text">Best Day: <strong>${stats.bestDay}</strong> (${stats.bestDayRate}%)</span>
                            </div>
                        ` : ''}

                        <!-- Weekly Trend Sparkline -->
                        <div class="summary-trend">
                            <h4>Weekly Trend</h4>
                            ${this.generateSparkline(stats.dailyStats)}
                        </div>
                    </div>

                    <div class="summary-footer">
                        <button class="btn btn-secondary" id="closeSummaryBtn">Close</button>
                    </div>
                </div>
            </div>
        `;

        this.setupListeners();
    },

    /**
     * Setup event listeners
     */
    setupListeners() {
        const overlay = document.getElementById('summaryOverlay');
        const closeBtn = document.getElementById('closeSummary');
        const closeFooterBtn = document.getElementById('closeSummaryBtn');

        if (overlay) {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) this.close();
            });
        }

        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.close());
        }

        if (closeFooterBtn) {
            closeFooterBtn.addEventListener('click', () => this.close());
        }

        // Escape key
        const keyHandler = (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
                document.removeEventListener('keydown', keyHandler);
            }
        };
        document.addEventListener('keydown', keyHandler);
    }
};

// Make globally available
if (typeof window !== 'undefined') {
    window.WeeklySummary = WeeklySummary;
}
