/**
 * Analytics - Hours by department with stats cards
 */

import { Store } from '../store.js';
import { Departments } from '../departments.js';
import { PlannerService } from '../services/PlannerService.js';
import { DOMUtils } from '../utils/DOMUtils.js';

export const Analytics = {
    /**
     * Initialize Analytics
     */
    init() {
        // Initial render
        this.render();

        // Listen for department updates (colors/names)
        window.addEventListener('departmentsUpdated', () => {
            this.render();
        });
    },

    /**
     * SVG Icons for stats - professional line icons
     */
    icons: {
        tasks: () =>
            DOMUtils.createSVG(
                'svg',
                {
                    width: '18',
                    height: '18',
                    viewBox: '0 0 24 24',
                    fill: 'none',
                    stroke: 'currentColor',
                    'stroke-width': '2',
                    'stroke-linecap': 'round',
                    'stroke-linejoin': 'round',
                },
                [
                    DOMUtils.createSVG('path', { d: 'M9 11l3 3L22 4' }),
                    DOMUtils.createSVG('path', {
                        d: 'M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
                    }),
                ]
            ),
        miniTasks: () =>
            DOMUtils.createSVG(
                'svg',
                {
                    width: '18',
                    height: '18',
                    viewBox: '0 0 24 24',
                    fill: 'none',
                    stroke: 'currentColor',
                    'stroke-width': '2',
                    'stroke-linecap': 'round',
                    'stroke-linejoin': 'round',
                },
                [
                    DOMUtils.createSVG('line', { x1: '8', y1: '6', x2: '21', y2: '6' }),
                    DOMUtils.createSVG('line', { x1: '8', y1: '12', x2: '21', y2: '12' }),
                    DOMUtils.createSVG('line', { x1: '8', y1: '18', x2: '21', y2: '18' }),
                    DOMUtils.createSVG('circle', {
                        cx: '4',
                        cy: '6',
                        r: '1.5',
                        fill: 'currentColor',
                    }),
                    DOMUtils.createSVG('circle', {
                        cx: '4',
                        cy: '12',
                        r: '1.5',
                        fill: 'currentColor',
                    }),
                    DOMUtils.createSVG('circle', {
                        cx: '4',
                        cy: '18',
                        r: '1.5',
                        fill: 'currentColor',
                    }),
                ]
            ),
        time: () =>
            DOMUtils.createSVG(
                'svg',
                {
                    width: '18',
                    height: '18',
                    viewBox: '0 0 24 24',
                    fill: 'none',
                    stroke: 'currentColor',
                    'stroke-width': '2',
                    'stroke-linecap': 'round',
                    'stroke-linejoin': 'round',
                },
                [
                    DOMUtils.createSVG('circle', { cx: '12', cy: '12', r: '10' }),
                    DOMUtils.createSVG('polyline', { points: '12 6 12 12 16 14' }),
                ]
            ),
        velocity: () =>
            DOMUtils.createSVG(
                'svg',
                {
                    width: '18',
                    height: '18',
                    viewBox: '0 0 24 24',
                    fill: 'none',
                    stroke: 'currentColor',
                    'stroke-width': '2',
                    'stroke-linecap': 'round',
                    'stroke-linejoin': 'round',
                },
                [DOMUtils.createSVG('path', { d: 'M22 12h-4l-3 9L9 3l-3 9H2' })]
            ),
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
        const hasData = values.some((v) => v > 0);
        if (!hasData) {
            const y = height - padding;
            return {
                line: `M ${padding} ${y} L ${width - padding} ${y}`,
                fill: `M ${padding} ${y} L ${width - padding} ${y} L ${width - padding} ${height} L ${padding} ${height} Z`,
            };
        }

        const points = values.map((val, i) => {
            const x = padding + (i * (width - 2 * padding)) / (values.length - 1);
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
        const fillPath =
            linePath +
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

        DOMUtils.clear(container);

        if (entries.length === 0) {
            const emptyState = DOMUtils.createElement('div', { className: 'analytics-empty' });
            const illustration = DOMUtils.createElement('div', {
                className: 'empty-state-illustration',
            });

            const svg = DOMUtils.createSVG('svg', {
                viewBox: '0 0 200 140',
                fill: 'none',
                xmlns: 'http://www.w3.org/2000/svg',
            });

            // Defs
            const defs = DOMUtils.createSVG('defs');
            const grad1 = DOMUtils.createSVG('linearGradient', {
                id: 'aGrad1',
                x1: '0%',
                y1: '0%',
                x2: '0%',
                y2: '100%',
            });
            grad1.appendChild(
                DOMUtils.createSVG('stop', { offset: '0%', 'stop-color': '#3b82f6' })
            );
            grad1.appendChild(
                DOMUtils.createSVG('stop', { offset: '100%', 'stop-color': '#8b5cf6' })
            );
            defs.appendChild(grad1);

            const grad2 = DOMUtils.createSVG('linearGradient', {
                id: 'aGrad2',
                x1: '0%',
                y1: '0%',
                x2: '100%',
                y2: '100%',
            });
            grad2.appendChild(
                DOMUtils.createSVG('stop', { offset: '0%', 'stop-color': 'var(--accent-success)' })
            );
            grad2.appendChild(
                DOMUtils.createSVG('stop', {
                    offset: '100%',
                    'stop-color': 'var(--accent-secondary)',
                })
            );
            defs.appendChild(grad2);
            svg.appendChild(defs);

            // Background decorations
            svg.appendChild(
                DOMUtils.createSVG('circle', {
                    className: 'float-shape s1',
                    cx: '25',
                    cy: '30',
                    r: '6',
                    fill: 'url(#aGrad1)',
                    opacity: '0.3',
                })
            );
            svg.appendChild(
                DOMUtils.createSVG('circle', {
                    className: 'float-shape s2',
                    cx: '175',
                    cy: '25',
                    r: '5',
                    fill: 'url(#aGrad2)',
                    opacity: '0.4',
                })
            );

            // Chart bars
            const g = DOMUtils.createSVG('g', { transform: 'translate(40, 20)' });
            g.appendChild(
                DOMUtils.createSVG('rect', {
                    x: '0',
                    y: '60',
                    width: '20',
                    height: '50',
                    rx: '4',
                    fill: 'url(#aGrad1)',
                    opacity: '0.4',
                })
            );
            g.appendChild(
                DOMUtils.createSVG('rect', {
                    x: '30',
                    y: '40',
                    width: '20',
                    height: '70',
                    rx: '4',
                    fill: 'url(#aGrad1)',
                    opacity: '0.5',
                })
            );
            g.appendChild(
                DOMUtils.createSVG('rect', {
                    x: '60',
                    y: '20',
                    width: '20',
                    height: '90',
                    rx: '4',
                    fill: 'url(#aGrad1)',
                    opacity: '0.6',
                })
            );
            g.appendChild(
                DOMUtils.createSVG('rect', {
                    x: '90',
                    y: '50',
                    width: '20',
                    height: '60',
                    rx: '4',
                    fill: 'url(#aGrad1)',
                    opacity: '0.45',
                })
            );
            g.appendChild(
                DOMUtils.createSVG('line', {
                    x1: '0',
                    y1: '110',
                    x2: '110',
                    y2: '110',
                    stroke: '#475569',
                    'stroke-width': '2',
                    'stroke-linecap': 'round',
                })
            );
            svg.appendChild(g);

            // Sparkle
            svg.appendChild(
                DOMUtils.createSVG('path', {
                    className: 'sparkle',
                    d: 'M160 60 L162 65 L167 67 L162 69 L160 74 L158 69 L153 67 L158 65 Z',
                    fill: '#fbbf24',
                })
            );

            illustration.appendChild(svg);
            emptyState.appendChild(illustration);
            emptyState.appendChild(
                DOMUtils.createElement('p', {
                    className: 'empty-state-title',
                    textContent: 'No scheduled tasks',
                })
            );
            emptyState.appendChild(
                DOMUtils.createElement('p', {
                    className: 'empty-state-subtitle',
                    textContent: 'Schedule tasks to see your analytics',
                })
            );

            container.appendChild(emptyState);
            return;
        }

        const total = entries.reduce((sum, [, v]) => sum + v.total, 0);
        const taskPercent = tasks.total > 0 ? Math.round((tasks.completed / tasks.total) * 100) : 0;
        const miniPercent =
            miniTasks.total > 0 ? Math.round((miniTasks.completed / miniTasks.total) * 100) : 0;

        // Get daily stats for sparkline
        const dailyStats = Store.getDailyStatsForWeek();
        const taskSparkline = this.generateSparklinePath(dailyStats.map((d) => d.tasks.percent));
        const miniSparkline = this.generateSparklinePath(
            dailyStats.map((d) => d.miniTasks.percent)
        );

        const grid = DOMUtils.createElement('div', { className: 'analytics-stats-grid' });

        // Task Card
        const taskCard = DOMUtils.createElement('div', {
            className: 'analytics-stat-card ring-card',
        });
        const taskRingContainer = DOMUtils.createElement('div', {
            className: 'progress-ring-container',
        });
        const taskSvg = DOMUtils.createSVG('svg', {
            className: 'progress-ring',
            viewBox: '0 0 80 80',
        });
        taskSvg.appendChild(
            DOMUtils.createSVG('circle', {
                className: 'progress-ring-bg',
                cx: '40',
                cy: '40',
                r: '32',
            })
        );
        taskSvg.appendChild(
            DOMUtils.createSVG('circle', {
                className: 'progress-ring-fill tasks',
                cx: '40',
                cy: '40',
                r: '32',
                'stroke-dasharray': '201',
                'stroke-dashoffset': `${201 - (201 * taskPercent) / 100}`,
            })
        );
        taskRingContainer.appendChild(taskSvg);
        taskRingContainer.appendChild(
            DOMUtils.createElement('div', {
                className: 'progress-ring-value',
                textContent: `${taskPercent}%`,
            })
        );
        taskCard.appendChild(taskRingContainer);

        const taskContent = DOMUtils.createElement('div', { className: 'stat-content' });
        const taskValue = DOMUtils.createElement('div', {
            className: 'stat-value',
            textContent: tasks.completed,
        });
        taskValue.appendChild(
            DOMUtils.createElement('span', {
                className: 'stat-total',
                textContent: `/${tasks.total}`,
            })
        );
        taskContent.appendChild(taskValue);
        taskContent.appendChild(
            DOMUtils.createElement('div', { className: 'stat-label', textContent: 'Tasks Done' })
        );

        const taskSparkContainer = DOMUtils.createElement('div', {
            className: 'sparkline-container',
        });
        const taskSparkSvg = DOMUtils.createSVG('svg', {
            className: 'sparkline',
            viewBox: '0 0 70 24',
            preserveAspectRatio: 'none',
        });
        const taskDefs = DOMUtils.createSVG('defs');
        const taskGrad = DOMUtils.createSVG('linearGradient', {
            id: 'sparkGradTasks',
            x1: '0%',
            y1: '0%',
            x2: '0%',
            y2: '100%',
        });
        taskGrad.appendChild(
            DOMUtils.createSVG('stop', {
                offset: '0%',
                'stop-color': 'var(--accent-success)',
                'stop-opacity': '0.3',
            })
        );
        taskGrad.appendChild(
            DOMUtils.createSVG('stop', {
                offset: '100%',
                'stop-color': 'var(--accent-success)',
                'stop-opacity': '0',
            })
        );
        taskDefs.appendChild(taskGrad);
        taskSparkSvg.appendChild(taskDefs);
        taskSparkSvg.appendChild(
            DOMUtils.createSVG('path', {
                className: 'sparkline-fill',
                d: taskSparkline.fill,
                fill: 'url(#sparkGradTasks)',
            })
        );
        taskSparkSvg.appendChild(
            DOMUtils.createSVG('path', {
                className: 'sparkline-line tasks',
                d: taskSparkline.line,
                fill: 'none',
                stroke: 'var(--accent-success)',
                'stroke-width': '1.5',
            })
        );
        taskSparkContainer.appendChild(taskSparkSvg);
        taskContent.appendChild(taskSparkContainer);
        taskCard.appendChild(taskContent);
        grid.appendChild(taskCard);

        // Mini Task Card
        const miniCard = DOMUtils.createElement('div', {
            className: 'analytics-stat-card ring-card',
        });
        const miniRingContainer = DOMUtils.createElement('div', {
            className: 'progress-ring-container',
        });
        const miniSvg = DOMUtils.createSVG('svg', {
            className: 'progress-ring',
            viewBox: '0 0 80 80',
        });
        miniSvg.appendChild(
            DOMUtils.createSVG('circle', {
                className: 'progress-ring-bg',
                cx: '40',
                cy: '40',
                r: '32',
            })
        );
        miniSvg.appendChild(
            DOMUtils.createSVG('circle', {
                className: 'progress-ring-fill mini',
                cx: '40',
                cy: '40',
                r: '32',
                'stroke-dasharray': '201',
                'stroke-dashoffset': `${201 - (201 * miniPercent) / 100}`,
            })
        );
        miniRingContainer.appendChild(miniSvg);
        miniRingContainer.appendChild(
            DOMUtils.createElement('div', {
                className: 'progress-ring-value',
                textContent: `${miniPercent}%`,
            })
        );
        miniCard.appendChild(miniRingContainer);

        const miniContent = DOMUtils.createElement('div', { className: 'stat-content' });
        const miniValue = DOMUtils.createElement('div', {
            className: 'stat-value',
            textContent: miniTasks.completed,
        });
        miniValue.appendChild(
            DOMUtils.createElement('span', {
                className: 'stat-total',
                textContent: `/${miniTasks.total}`,
            })
        );
        miniContent.appendChild(miniValue);
        miniContent.appendChild(
            DOMUtils.createElement('div', { className: 'stat-label', textContent: 'Mini-Tasks' })
        );

        const miniSparkContainer = DOMUtils.createElement('div', {
            className: 'sparkline-container',
        });
        const miniSparkSvg = DOMUtils.createSVG('svg', {
            className: 'sparkline',
            viewBox: '0 0 70 24',
            preserveAspectRatio: 'none',
        });
        const miniDefs = DOMUtils.createSVG('defs');
        const miniGrad = DOMUtils.createSVG('linearGradient', {
            id: 'sparkGradMini',
            x1: '0%',
            y1: '0%',
            x2: '0%',
            y2: '100%',
        });
        miniGrad.appendChild(
            DOMUtils.createSVG('stop', {
                offset: '0%',
                'stop-color': '#a855f7',
                'stop-opacity': '0.3',
            })
        );
        miniGrad.appendChild(
            DOMUtils.createSVG('stop', {
                offset: '100%',
                'stop-color': '#a855f7',
                'stop-opacity': '0',
            })
        );
        miniDefs.appendChild(miniGrad);
        miniSparkSvg.appendChild(miniDefs);
        miniSparkSvg.appendChild(
            DOMUtils.createSVG('path', {
                className: 'sparkline-fill',
                d: miniSparkline.fill,
                fill: 'url(#sparkGradMini)',
            })
        );
        miniSparkSvg.appendChild(
            DOMUtils.createSVG('path', {
                className: 'sparkline-line mini',
                d: miniSparkline.line,
                fill: 'none',
                stroke: '#a855f7',
                'stroke-width': '1.5',
            })
        );
        miniSparkContainer.appendChild(miniSparkSvg);
        miniContent.appendChild(miniSparkContainer);
        miniCard.appendChild(miniContent);
        grid.appendChild(miniCard);

        const focusMetrics = Store.getFocusMetricsForWeek();

        // Time Card (Deep Focus)
        const timeCard = DOMUtils.createElement('div', {
            className: 'analytics-stat-card time-card',
        });
        const timeIcon = DOMUtils.createElement('div', { className: 'stat-icon stat-icon-time' });
        timeIcon.appendChild(this.icons.time());
        timeCard.appendChild(timeIcon);

        const timeContent = DOMUtils.createElement('div', { className: 'stat-content' });
        timeContent.appendChild(
            DOMUtils.createElement('div', {
                className: 'stat-value',
                textContent: PlannerService.formatDuration(focusMetrics.totalFocusTime),
            })
        );
        timeContent.appendChild(
            DOMUtils.createElement('div', {
                className: 'stat-label',
                textContent: 'Deep Focus Time',
            })
        );
        timeCard.appendChild(timeContent);
        grid.appendChild(timeCard);

        // Distraction Rate Card
        const distCard = DOMUtils.createElement('div', {
            className: 'analytics-stat-card dist-card',
        });
        const distIcon = DOMUtils.createElement('div', { className: 'stat-icon stat-icon-dist' });
        // Pulse icon
        distIcon.appendChild(
            DOMUtils.createSVG(
                'svg',
                {
                    width: '18',
                    height: '18',
                    viewBox: '0 0 24 24',
                    fill: 'none',
                    stroke: 'currentColor',
                    'stroke-width': '2',
                },
                [DOMUtils.createSVG('path', { d: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z' })]
            )
        );
        distCard.appendChild(distIcon);

        const distContent = DOMUtils.createElement('div', { className: 'stat-content' });
        distContent.appendChild(
            DOMUtils.createElement('div', {
                className: 'stat-value',
                textContent: focusMetrics.avgInterruptions,
            })
        );
        distContent.appendChild(
            DOMUtils.createElement('div', {
                className: 'stat-label',
                textContent: 'Distractions / Hour',
            })
        );
        distCard.appendChild(distContent);
        grid.appendChild(distCard);

        // Focus Velocity Card
        const velocityCard = DOMUtils.createElement('div', {
            className: 'analytics-stat-card velocity-card',
        });
        const velocityIcon = DOMUtils.createElement('div', {
            className: 'stat-icon stat-icon-velocity',
        });
        velocityIcon.appendChild(this.icons.velocity());
        velocityCard.appendChild(velocityIcon);

        const velocityVal = Math.round(focusMetrics.avgVelocity * 100);
        let velocityStatus = 'neutral';
        if (velocityVal >= 90) velocityStatus = 'high';
        else if (velocityVal < 70) velocityStatus = 'low';

        const velocityContent = DOMUtils.createElement('div', { className: 'stat-content' });
        const velocityValueEl = DOMUtils.createElement('div', {
            className: `stat-value status-${velocityStatus}`,
            textContent: `${velocityVal}%`,
        });
        velocityContent.appendChild(velocityValueEl);
        velocityContent.appendChild(
            DOMUtils.createElement('div', {
                className: 'stat-label',
                textContent: 'Focus Velocity',
            })
        );
        velocityCard.appendChild(velocityContent);
        grid.appendChild(velocityCard);

        container.appendChild(grid);

        // Chart
        const header = DOMUtils.createElement('div', { className: 'analytics-header' });
        header.appendChild(DOMUtils.createElement('h3', { textContent: 'Time by Department' }));
        container.appendChild(header);

        const chart = DOMUtils.createElement('div', { className: 'analytics-chart' });
        entries.forEach(([dept, { total: deptTotal, completed }]) => {
            const color = Departments.getColor([dept]);
            const percent = Math.round((deptTotal / total) * 100);
            const completedPercent = Math.round((completed / deptTotal) * 100);

            const barContainer = DOMUtils.createElement('div', {
                className: 'analytics-bar-container',
            });

            const label = DOMUtils.createElement('div', { className: 'analytics-bar-label' });
            label.appendChild(
                DOMUtils.createElement('span', {
                    className: 'analytics-dept',
                    style: { color: color },
                    textContent: dept,
                })
            );
            label.appendChild(
                DOMUtils.createElement('span', {
                    className: 'analytics-value',
                    textContent: `${PlannerService.formatDuration(deptTotal)} (${percent}%)`,
                })
            );
            barContainer.appendChild(label);

            const wrapper = DOMUtils.createElement('div', { className: 'analytics-bar-wrapper' });
            const bar = DOMUtils.createElement('div', {
                className: 'analytics-bar',
                style: { width: `${percent}%`, backgroundColor: color },
            });
            bar.appendChild(
                DOMUtils.createElement('div', {
                    className: 'analytics-bar-completed',
                    style: { width: `${completedPercent}%` },
                })
            );
            wrapper.appendChild(bar);
            barContainer.appendChild(wrapper);

            chart.appendChild(barContainer);
        });
        container.appendChild(chart);
    },
};
