import { DevLog } from '../utils/DevLog.js';
/**
 * Task Queue - Manages the sidebar task queue display
 */

import { Store } from '../store.js';
import { TaskCard } from './TaskCard.js';
import { ConfirmModal } from './ConfirmModal.js';
import { Filters } from './Filters.js';
import { Analytics } from './Analytics.js';
import { DOMUtils } from '../utils/DOMUtils.js';

export const TaskQueue = {
    searchTerm: '',

    // Callbacks for App integration
    onEditTask: null,

    /**
     * Initialize the task queue
     */
    init() {
        this.render();
        this.setupTabs();
        this.setupSearch();

        // Subscribe to store changes for automatic UI updates
        Store.subscribe(() => {
            DevLog.log('TaskQueue: Store updated, refreshing UI...');
            this.refresh();
        });
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
        const palettePanel = document.getElementById('palettePanel');
        const analyticsPanel = document.getElementById('analyticsPanel');
        const filtersPanel = document.getElementById('filtersPanel');
        const searchBar = document.querySelector('.sidebar-search'); // Changed to class selector to match layout.css

        tabs.forEach((tab) => {
            tab.addEventListener('click', () => {
                tabs.forEach((t) => t.classList.remove('active'));
                tab.classList.add('active');

                const tabName = tab.dataset.tab;

                // Toggle Panel Visibility
                if (queuePanel) queuePanel.style.display = tabName === 'queue' ? 'block' : 'none';
                if (palettePanel)
                    palettePanel.style.display = tabName === 'palette' ? 'block' : 'none';
                if (analyticsPanel)
                    analyticsPanel.style.display = tabName === 'analytics' ? 'block' : 'none';
                if (filtersPanel)
                    filtersPanel.style.display = tabName === 'filters' ? 'block' : 'none';

                // Search Bar only for Queue
                if (searchBar) {
                    searchBar.style.display = tabName === 'queue' ? 'block' : 'none';
                }

                if (tabName === 'palette' && window.QuickPalette) {
                    window.QuickPalette.render();
                }

                if (tabName === 'analytics' && Analytics) {
                    Analytics.render();
                }
                if (tabName === 'filters' && Filters) {
                    Filters.refresh();
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
        const activeFilters = Filters ? Filters.selectedPaths : [];

        // Apply filters
        if (Filters || this.searchTerm) {
            tasks = tasks.filter((task) => {
                if (this.searchTerm && !task.title.toLowerCase().includes(this.searchTerm)) {
                    return false;
                }

                if (Filters && Filters.selectedPaths) {
                    if (Filters.selectedPaths.length === 0) return true;
                    return Filters.selectedPaths.some((filterPath) => {
                        if (!task.hierarchy || task.hierarchy.length === 0) return true;
                        for (let i = 0; i < filterPath.length; i++) {
                            if (task.hierarchy[i] !== filterPath[i]) return false;
                        }
                        return true;
                    });
                }

                return true;
            });
        }

        DOMUtils.clear(container);

        if (tasks.length === 0) {
            const isFiltered = activeFilters.length > 0;

            // Reconstruct the empty state using innerHTML for the complex SVG illustration
            // Moving the SVG to a separate file or component would be cleaner, but for now
            // we'll keep it here to avoid breaking the visual design.
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
                <circle cx="42" cy="80" r="14" fill="none" stroke="var(--accent-success)" stroke-width="2" stroke-dasharray="4 3" opacity="0.6"/>
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
                  <stop offset="0%" stop-color="var(--accent-success)"/>
                  <stop offset="100%" stop-color="var(--accent-secondary)"/>
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

        tasks.forEach((task) => {
            const card = new TaskCard(task);
            const el = card.render({ isDayView: false, isCompact: false });
            el.draggable = false;
            container.appendChild(el);
        });

        // Add event listeners
        container.querySelectorAll('.task-block').forEach((block) => {
            const taskId = block.dataset.taskId;
            const deleteBtn = block.querySelector('.task-delete');

            block.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                if (this.onEditTask) {
                    this.onEditTask(taskId);
                }
            });

            block.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();

                const taskState = Store.getTask(taskId);
                const wasCompleted = taskState ? taskState.completed : false;

                // Use advance progress method
                const result = Store.advanceTaskProgress(taskId);
                const updatedTask = result ? result.task : null;

                // Trigger individual task celebration if it JUST became completed
                if (!wasCompleted && updatedTask && updatedTask.completed && window.Confetti) {
                    const rect = block.getBoundingClientRect();
                    const x = rect.left + rect.width / 2;
                    const y = rect.top + rect.height / 2;
                    window.Confetti.burst(x, y, 40);
                }

                // Instant refresh for task queue is now handled by store subscriber
                this.refresh();
            });

            if (deleteBtn) {
                deleteBtn.addEventListener('click', async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    DevLog.log('Delete button clicked for task:', taskId);
                    const confirmed = await ConfirmModal.show(
                        'Are you sure you want to delete this task?'
                    );
                    if (confirmed) {
                        DevLog.log('User confirmed delete');
                        Store.deleteTask(taskId);
                    } else {
                        DevLog.log('User canceled delete');
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
    },
};
