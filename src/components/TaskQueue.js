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
        const clearBtn = document.getElementById('searchClearBtn');
        if (!searchInput) return;

        searchInput.addEventListener('input', (e) => {
            this.searchTerm = e.target.value.toLowerCase();
            this.render();
        });

        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                searchInput.value = '';
                this.searchTerm = '';
                this.render();
                searchInput.focus();
            });
        }
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
            const isFiltered = activeFilters.length > 0;
            container.innerHTML = `
        <div class="task-queue-empty">
          <div class="empty-state-illustration">
            <svg viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg">
              <!-- Floating shapes background -->
              <circle class="float-shape s1" cx="30" cy="40" r="8" fill="url(#grad1)" opacity="0.3"/>
              <circle class="float-shape s2" cx="170" cy="30" r="6" fill="url(#grad2)" opacity="0.4"/>
              <rect class="float-shape s3" x="150" y="100" width="12" height="12" rx="3" fill="url(#grad1)" opacity="0.3" transform="rotate(15 156 106)"/>
              <circle class="float-shape s4" cx="25" cy="120" r="5" fill="url(#grad2)" opacity="0.35"/>
              
              <!-- Main illustration - stylized inbox/clipboard -->
              <g transform="translate(50, 20)">
                <!-- Paper stack -->
                <rect x="8" y="12" width="84" height="100" rx="8" fill="#1e293b" stroke="url(#grad1)" stroke-width="1.5"/>
                <rect x="4" y="8" width="84" height="100" rx="8" fill="#1e3a5f" stroke="url(#grad1)" stroke-width="1.5"/>
                <rect x="0" y="4" width="84" height="100" rx="8" fill="url(#cardGrad)" stroke="url(#grad1)" stroke-width="2"/>
                
                <!-- Decorative lines on paper -->
                <line x1="16" y1="30" x2="68" y2="30" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" opacity="0.5"/>
                <line x1="16" y1="45" x2="52" y2="45" stroke="#6366f1" stroke-width="2" stroke-linecap="round" opacity="0.4"/>
                <line x1="16" y1="60" x2="60" y2="60" stroke="#8b5cf6" stroke-width="2" stroke-linecap="round" opacity="0.3"/>
                
                <!-- Checkmark circle -->
                <circle cx="42" cy="80" r="14" fill="none" stroke="#10b981" stroke-width="2" stroke-dasharray="4 3" opacity="0.6"/>
              </g>
              
              <!-- Sparkle -->
              <path class="sparkle" d="M160 70 L162 75 L167 77 L162 79 L160 84 L158 79 L153 77 L158 75 Z" fill="#fbbf24"/>
              
              <!-- Gradients -->
              <defs>
                <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#3b82f6"/>
                  <stop offset="100%" stop-color="#8b5cf6"/>
                </linearGradient>
                <linearGradient id="grad2" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#10b981"/>
                  <stop offset="100%" stop-color="#06b6d4"/>
                </linearGradient>
                <linearGradient id="cardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#1e3a5f"/>
                  <stop offset="100%" stop-color="#0f172a"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
          <p class="empty-state-title">${isFiltered ? 'No tasks match filters' : 'Your queue is empty'}</p>
          <p class="empty-state-subtitle">${isFiltered ? 'Try adjusting your department filters' : 'Press N or click "New Task" to get started'}</p>
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
