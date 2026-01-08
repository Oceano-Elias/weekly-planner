/**
 * Filters - Premium department filtering (top-level only)
 */

import { Departments } from '../departments.js';

export const Filters = {
    selectedDepts: [],

    /**
     * Initialize filters
     */
    init() {
        this.render();
    },

    /**
     * Render the filter cards (top-level departments only)
     */
    render() {
        const container = document.getElementById('filterTree');
        if (!container) return;

        const topLevel = Departments.getTopLevel();

        let html = `
      <div class="filter-header">
        <h3 class="filter-title">Filter by Department</h3>
        <button class="filter-clear-btn" id="clearFilters">Clear All</button>
      </div>
      <div class="filter-cards">
    `;

        topLevel.forEach(deptName => {
            const color = Departments.getColor([deptName]);
            const isSelected = this.selectedDepts.includes(deptName);
            const taskCount = this.getTaskCount(deptName);

            html += `
        <div class="filter-card ${isSelected ? 'selected' : ''}" 
             data-dept="${deptName}" 
             style="--dept-color: ${color}">
          <div class="filter-card-header">
            <span class="filter-card-color" style="background: ${color}"></span>
            <span class="filter-card-name">${deptName}</span>
          </div>
          <div class="filter-card-count">${taskCount} task${taskCount !== 1 ? 's' : ''}</div>
          <div class="filter-card-check">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
              <path d="M5 13l4 4L19 7"/>
            </svg>
          </div>
        </div>
      `;
        });

        html += '</div>';
        container.innerHTML = html;
        this.setupListeners();
    },

    /**
     * Get task count for a department
     */
    getTaskCount(deptName) {
        const allTasks = window.Store ? window.Store.getAllTasks() : [];
        return allTasks.filter(t => t.hierarchy && t.hierarchy[0] === deptName).length;
    },

    /**
     * Setup event listeners
     */
    setupListeners() {
        const filters = this;

        // Card click handlers
        document.querySelectorAll('.filter-card').forEach(card => {
            card.addEventListener('click', () => {
                const dept = card.dataset.dept;

                if (filters.selectedDepts.includes(dept)) {
                    filters.selectedDepts = filters.selectedDepts.filter(d => d !== dept);
                    card.classList.remove('selected');
                } else {
                    filters.selectedDepts.push(dept);
                    card.classList.add('selected');
                }

                // Convert to path format for Calendar filtering
                filters.selectedPaths = filters.selectedDepts.map(d => [d]);

                if (window.TaskQueue) window.TaskQueue.refresh();
                if (window.Calendar) window.Calendar.refresh();
            });
        });

        // Clear all button
        const clearBtn = document.getElementById('clearFilters');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                filters.clear();
            });
        }
    },

    /**
     * Clear all filters
     */
    clear() {
        this.selectedDepts = [];
        this.selectedPaths = [];
        this.render();
        if (window.TaskQueue) window.TaskQueue.refresh();
        if (window.Calendar) window.Calendar.refresh();
    },

    /**
     * Refresh the filters
     */
    refresh() {
        this.render();
    },

    // Keep selectedPaths for Calendar compatibility
    selectedPaths: []
};
