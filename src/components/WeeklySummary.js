/**
 * WeeklySummary Component
 * Displays end-of-week statistics and productivity insights
 */

import { Store } from '../store.js';
import { PlannerService } from '../services/PlannerService.js';
import { DOMUtils } from '../utils/DOMUtils.js';

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
        const completedTasks = tasks.filter((t) => t.completed).length;
        const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

        // Calculate total scheduled time
        let totalMinutes = 0;
        let completedMinutes = 0;
        tasks.forEach((task) => {
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
        tasks.forEach((task) => {
            if (task.notes) {
                const lines = task.notes.split('\n');
                lines.forEach((line) => {
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

        const focusMetrics = Store.getFocusMetricsForWeek();

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
            miniTaskRate:
                totalMiniTasks > 0 ? Math.round((completedMiniTasks / totalMiniTasks) * 100) : 0,
            currentStreak,
            dailyStats,
            focusVelocity: focusMetrics.avgVelocity,
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
        const values = dailyStats.map((d) => d.tasks.percent);
        const max = Math.max(...values, 1);
        const width = 200;
        const height = 40;
        const padding = 4;

        const points = values
            .map((v, i) => {
                const x = padding + (i / (values.length - 1)) * (width - padding * 2);
                const y = height - padding - (v / max) * (height - padding * 2);
                return `${x},${y}`;
            })
            .join(' ');

        const svg = DOMUtils.createSVG('svg', {
            viewBox: `0 0 ${width} ${height}`,
            className: 'summary-sparkline',
        });

        const defs = DOMUtils.createSVG('defs');
        const grad = DOMUtils.createSVG('linearGradient', {
            id: 'summaryGrad',
            x1: '0%',
            y1: '0%',
            x2: '0%',
            y2: '100%',
        });
        grad.appendChild(
            DOMUtils.createSVG('stop', { offset: '0%', 'stop-color': 'rgba(99, 102, 241, 0.3)' })
        );
        grad.appendChild(
            DOMUtils.createSVG('stop', { offset: '100%', 'stop-color': 'rgba(99, 102, 241, 0)' })
        );
        defs.appendChild(grad);
        svg.appendChild(defs);

        svg.appendChild(
            DOMUtils.createSVG('polyline', {
                fill: 'url(#summaryGrad)',
                stroke: 'none',
                points: `${padding},${height - padding} ${points} ${width - padding},${height - padding}`,
            })
        );

        svg.appendChild(
            DOMUtils.createSVG('polyline', {
                fill: 'none',
                stroke: '#6366f1',
                'stroke-width': '2',
                'stroke-linecap': 'round',
                'stroke-linejoin': 'round',
                points: points,
            })
        );

        return svg;
    },

    /**
     * Generate progress ring SVG
     */
    generateProgressRing(percent, color = '#6366f1') {
        const radius = 45;
        const circumference = 2 * Math.PI * radius;
        const offset = circumference * (1 - percent / 100);

        const svg = DOMUtils.createSVG('svg', {
            viewBox: '0 0 100 100',
            className: 'summary-ring',
        });

        svg.appendChild(
            DOMUtils.createSVG('circle', {
                cx: '50',
                cy: '50',
                r: `${radius}`,
                fill: 'none',
                stroke: 'rgba(255,255,255,0.1)',
                'stroke-width': '8',
            })
        );

        svg.appendChild(
            DOMUtils.createSVG('circle', {
                cx: '50',
                cy: '50',
                r: `${radius}`,
                fill: 'none',
                stroke: color,
                'stroke-width': '8',
                'stroke-linecap': 'round',
                'stroke-dasharray': `${circumference}`,
                'stroke-dashoffset': `${offset}`,
                transform: 'rotate(-90 50 50)',
                className: 'ring-progress',
            })
        );

        const text = DOMUtils.createSVG('text', {
            x: '50',
            y: '52',
            'text-anchor': 'middle',
            'dominant-baseline': 'middle',
            className: 'ring-text',
        });
        text.textContent = `${percent}%`;
        svg.appendChild(text);

        return svg;
    },

    /**
     * Render the summary modal
     */
    render() {
        const container = document.getElementById('weeklySummaryContainer');
        if (!container) return;

        const stats = this.getWeeklyStats();
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const fullDays = [
            'Monday',
            'Tuesday',
            'Wednesday',
            'Thursday',
            'Friday',
            'Saturday',
            'Sunday',
        ];

        DOMUtils.clear(container);

        const overlay = DOMUtils.createElement('div', {
            className: 'summary-overlay',
            id: 'summaryOverlay',
        });
        const content = DOMUtils.createElement('div', { className: 'summary-content' });

        content.appendChild(
            DOMUtils.createElement('button', {
                className: 'summary-close',
                id: 'closeSummary',
                textContent: '×',
            })
        );

        // Header
        const header = DOMUtils.createElement('div', { className: 'summary-header' }, [
            DOMUtils.createElement('h2', { textContent: '📊 Weekly Summary' }),
            DOMUtils.createElement('span', {
                className: 'summary-week-label',
                textContent: stats.weekId,
            }),
        ]);
        content.appendChild(header);

        // Body
        const body = DOMUtils.createElement('div', { className: 'summary-body' });

        // Main Stat
        const mainStat = DOMUtils.createElement('div', { className: 'summary-main-stat' });
        mainStat.appendChild(this.generateProgressRing(stats.completionRate));
        mainStat.appendChild(
            DOMUtils.createElement('div', {
                className: 'summary-main-label',
                textContent: 'Task Completion',
            })
        );
        body.appendChild(mainStat);

        // Grid
        const grid = DOMUtils.createElement('div', { className: 'summary-stats-grid' });
        const createCard = (val, label, highlight = false) => {
            return DOMUtils.createElement(
                'div',
                { className: `summary-stat-card ${highlight ? 'highlight' : ''}` },
                [
                    DOMUtils.createElement('span', { className: 'stat-value', textContent: val }),
                    DOMUtils.createElement('span', { className: 'stat-label', textContent: label }),
                ]
            );
        };
        grid.appendChild(createCard(`${stats.completedTasks}/${stats.totalTasks}`, 'Tasks Done'));
        grid.appendChild(createCard(this.formatDuration(stats.completedMinutes), 'Time Completed'));
        grid.appendChild(
            createCard(`${stats.completedMiniTasks}/${stats.totalMiniTasks}`, 'Mini-Tasks')
        );
        grid.appendChild(createCard(`${Math.round(stats.focusVelocity * 100)}%`, 'Focus Velocity'));
        grid.appendChild(createCard(`${stats.currentStreak}`, 'Day Streak 🔥', true));
        body.appendChild(grid);

        // Daily Breakdown
        const daily = DOMUtils.createElement('div', { className: 'summary-daily' });
        daily.appendChild(DOMUtils.createElement('h4', { textContent: 'Daily Breakdown' }));
        const bars = DOMUtils.createElement('div', { className: 'daily-bars' });
        stats.dailyStats.forEach((day, i) => {
            const isBestDay = stats.bestDay === fullDays[i];
            const item = DOMUtils.createElement('div', {
                className: `daily-bar-item ${isBestDay ? 'best' : ''}`,
            });
            item.appendChild(
                DOMUtils.createElement('div', {
                    className: 'daily-bar-fill',
                    style: { height: `${day.tasks.percent}%` },
                })
            );
            item.appendChild(
                DOMUtils.createElement('span', {
                    className: 'daily-bar-label',
                    textContent: days[i],
                })
            );
            item.appendChild(
                DOMUtils.createElement('span', {
                    className: 'daily-bar-value',
                    textContent: `${day.tasks.completed}/${day.tasks.total}`,
                })
            );
            bars.appendChild(item);
        });
        daily.appendChild(bars);
        body.appendChild(daily);

        // Highlight
        if (stats.bestDay) {
            const highlight = DOMUtils.createElement('div', { className: 'summary-highlight' }, [
                DOMUtils.createElement('span', { className: 'highlight-icon', textContent: '🏆' }),
                DOMUtils.createElement('span', { className: 'highlight-text' }, [
                    document.createTextNode('Best Day: '),
                    DOMUtils.createElement('strong', { textContent: stats.bestDay }),
                    document.createTextNode(` (${stats.bestDayRate}%)`),
                ]),
            ]);
            body.appendChild(highlight);
        }

        // Trend
        const trend = DOMUtils.createElement('div', { className: 'summary-trend' });
        trend.appendChild(DOMUtils.createElement('h4', { textContent: 'Weekly Trend' }));
        trend.appendChild(this.generateSparkline(stats.dailyStats));
        body.appendChild(trend);

        content.appendChild(body);

        // Footer
        const footer = DOMUtils.createElement('div', { className: 'summary-footer' });
        footer.appendChild(
            DOMUtils.createElement('button', {
                className: 'btn btn-secondary',
                id: 'closeSummaryBtn',
                textContent: 'Close',
            })
        );
        content.appendChild(footer);

        overlay.appendChild(content);
        container.appendChild(overlay);

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
    },
};

// Make globally available
if (typeof window !== 'undefined') {
    window.WeeklySummary = WeeklySummary;
}
