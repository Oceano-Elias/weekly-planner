/**
 * QuickPalette Component - Manages the "Stamp Tool" for rapid task creation
 */

import { Departments } from '../departments.js';
import { DOMUtils } from '../utils/DOMUtils.js';

export const QuickPalette = {
    init() {
        this.render();
    },

    /**
     * Render the department stamps
     */
    render() {
        const container = document.getElementById('quickPalette');
        if (!container) return;

        DOMUtils.clear(container);

        const topLevels = Departments.getTopLevel();

        // Add Header/Instruction
        const header = DOMUtils.createElement('div', { className: 'palette-header' }, [
            DOMUtils.createElement('h3', { textContent: 'Quick Stamps' }),
            DOMUtils.createElement('p', { textContent: 'Drag departments directly onto the calendar to rapid-fire your schedule.' })
        ]);
        container.appendChild(header);

        const grid = DOMUtils.createElement('div', { className: 'palette-grid' });

        topLevels.forEach(deptName => {
            const dept = Departments.get(deptName);
            const color = dept.color;
            const abbr = dept.abbr;

            const stamp = DOMUtils.createElement('div', {
                className: 'palette-stamp glass-surface-hover',
                dataset: {
                    type: 'stamp',
                    dept: deptName,
                    color: color
                },
                style: { '--dept-color': color }
            }, [
                DOMUtils.createElement('div', {
                    className: 'stamp-badge',
                    style: { backgroundColor: color },
                    textContent: abbr
                }),
                DOMUtils.createElement('div', {
                    className: 'stamp-label',
                    textContent: deptName
                })
            ]);

            grid.appendChild(stamp);
        });

        container.appendChild(grid);
    }
};

window.QuickPalette = QuickPalette;
