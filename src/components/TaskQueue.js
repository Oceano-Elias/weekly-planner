/**
 * Task Queue - Manages the sidebar task queue display
 */

import { Store } from '../store.js';
import { TaskCard } from './TaskCard.js';
import { ConfirmModal } from './ConfirmModal.js';

export const TaskQueue = {
    searchTerm: '',

    /**
     * Initialize the task queue
     */
    init() {
        this.render();
        this.setupTabs();
        this.setupSearch();
    },

    /**
     * Setup search functionality
     */
    setupSearch() {
        const searchInput = document.getElementById('taskSearchInput');
        if (!searchInput) return;

        searchInput.addEventListener('input', (e) => {
            this.searchTerm = e.target.value.toLowerCase();
            this.render();
        });
    },

    /**
     * Setup sidebar tabs
     */
    setupTabs() {
        const tabs = document.querySelectorAll('.sidebar-tab');
        const queuePanel = document.getElementById('queuePanel');
        const analyticsPanel = document.getElementById('analyticsPanel');
        const filtersPanel = document.getElementById('filtersPanel');
        const searchBar = document.getElementById('sidebarSearch');

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                const tabName = tab.dataset.tab;

                queuePanel.style.display = tabName === 'queue' ? 'block' : 'none';
                analyticsPanel.style.display = tabName === 'analytics' ? 'block' : 'none';
                filtersPanel.style.display = tabName === 'filters' ? 'block' : 'none';

                searchBar.style.display = tabName === 'queue' ? 'block' : 'none';

                if (tabName === 'analytics' && window.Analytics) {
                    window.Analytics.render();
                }
                if (tabName === 'filters' && window.Filters) {
                    window.Filters.refresh();
                }
            });
        });
    },

    /**
     * Render the task queue
     */
    render() {
        const container = document.getElementById('taskQueue');
        let tasks = Store.getQueueTasks();

        // Get active filters
        const activeFilters = window.Filters ? window.Filters.selectedPaths : [];

        // Apply filters
        if (activeFilters.length > 0 || this.searchTerm) {
            tasks = tasks.filter(task => {
                if (this.searchTerm && !task.title.toLowerCase().includes(this.searchTerm)) {
                    return false;
                }

                if (activeFilters.length > 0) {
                    return activeFilters.some(filterPath => {
                        if (!task.hierarchy) return false;
                        for (let i = 0; i < filterPath.length; i++) {
                            if (task.hierarchy[i] !== filterPath[i]) return false;
                        }
                        return true;
                    });
                }

                return true;
            });
        }

        if (tasks.length === 0) {
            container.innerHTML = `
        <div class="task-queue-empty">
          <div class="task-queue-empty-icon">📋</div>
          <p>${activeFilters.length > 0 ? 'No tasks match filters' : 'No tasks in queue'}</p>
          <p style="font-size: 12px; margin-top: 8px;">
            ${activeFilters.length > 0 ? 'Try adjusting your filters' : 'Click "New Task" to create one'}
          </p>
        </div>
      `;
            return;
        }

        container.innerHTML = '';

        tasks.forEach(task => {
            const card = new TaskCard(task);
            const el = card.render({ isDayView: false, isCompact: false });
            container.appendChild(el);
        });

        // Add event listeners
        container.querySelectorAll('.task-block').forEach(block => {
            const taskId = block.dataset.taskId;
            const deleteBtn = block.querySelector('.task-delete');

            block.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                if (window.App && window.App.editTask) {
                    window.App.editTask(taskId);
                }
            });

            block.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                Store.toggleComplete(taskId);
                this.refresh();
                if (window.Calendar) window.Calendar.refresh();
            });

            if (deleteBtn) {
                deleteBtn.addEventListener('click', async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Delete button clicked for task:', taskId);
                    const confirmed = await ConfirmModal.show('Are you sure you want to delete this task?');
                    if (confirmed) {
                        console.log('User confirmed delete');
                        Store.deleteTask(taskId);
                        this.refresh();
                        if (window.Calendar) window.Calendar.refresh();
                        if (window.Filters) window.Filters.refresh();
                    } else {
                        console.log('User canceled delete');
                    }
                });
            }
        });
    },

    /**
     * Refresh the queue display
     */
    refresh() {
        this.render();
    }
};
