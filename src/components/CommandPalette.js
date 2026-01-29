/**
 * Command Palette - Fast, keyboard-first navigation and search
 */
import { Store } from '../store.js';
import { Calendar } from './Calendar.js';
import { DOMUtils } from '../utils/DOMUtils.js';
import FocusTrap from '../utils/FocusTrap.js';

export const CommandPalette = {
    isOpen: false,
    results: [],
    selectedIndex: 0,
    container: null,
    input: null,
    resultsList: null,

    init() {
        this.createUI();
        window.CommandPalette = this;
    },

    createUI() {
        this.container = DOMUtils.createElement('div', { className: 'command-palette-overlay' });

        const palette = DOMUtils.createElement('div', { className: 'command-palette' });

        const searchWrapper = DOMUtils.createElement('div', { className: 'palette-search-wrapper' });
        this.input = DOMUtils.createElement('input', {
            type: 'text',
            className: 'palette-input',
            placeholder: 'Type a command or search tasks...',
            spellcheck: false,
            autocomplete: 'off'
        });

        const kbdHint = DOMUtils.createElement('div', {
            className: 'palette-kbd-hint',
            innerHTML: '<span>ESC</span> to close'
        });

        searchWrapper.appendChild(this.input);
        searchWrapper.appendChild(kbdHint);

        this.resultsList = DOMUtils.createElement('div', { className: 'palette-results' });

        palette.appendChild(searchWrapper);
        palette.appendChild(this.resultsList);
        this.container.appendChild(palette);

        document.body.appendChild(this.container);

        this.setupEvents();
    },

    setupEvents() {
        this.container.addEventListener('click', (e) => {
            if (e.target === this.container) this.close();
        });

        this.input.addEventListener('input', () => this.handleSearch());

        this.input.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                this.close();
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.navigate(1);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.navigate(-1);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                this.selectCurrent();
            }
        });
    },

    toggle() {
        if (this.isOpen) this.close();
        else this.open();
    },

    open() {
        this.isOpen = true;
        this.container.classList.add('active');
        this.input.value = '';
        this.handleSearch();
        this.input.focus();
        FocusTrap.activate(this.container);
    },

    close() {
        this.isOpen = false;
        this.container.classList.remove('active');
        FocusTrap.deactivate();
    },

    handleSearch() {
        const query = this.input.value.toLowerCase().trim();
        this.generateResults(query);
        this.renderResults();
    },

    generateResults(query) {
        const results = [];

        const icons = {
            today: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line><path d="M9 16l2 2 4-4"></path></svg>`,
            week: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line><line x1="15" y1="3" x2="15" y2="21"></line><line x1="3" y1="9" x2="21" y2="9"></line><line x1="3" y1="15" x2="21" y2="15"></line></svg>`,
            day: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`,
            plus: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`,
            task: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`
        };

        // 1. Static Commands
        const staticCommands = [
            { id: 'goto-today', type: 'action', title: 'Go to Today', icon: icons.today, action: () => Calendar.setCurrentWeek(new Date()) },
            { id: 'view-week', type: 'action', title: 'Switch to Week View', icon: icons.week, action: () => Calendar.setViewMode('week') },
            { id: 'view-day', type: 'action', title: 'Switch to Day View', icon: icons.day, action: () => Calendar.setViewMode('day') },
            { id: 'new-task', type: 'action', title: 'Create New Task', icon: icons.plus, action: () => document.getElementById('newTaskBtn')?.click() },
        ];

        staticCommands.forEach(cmd => {
            if (!query || cmd.title.toLowerCase().includes(query)) {
                results.push(cmd);
            }
        });

        // 2. Search Tasks
        if (query.length > 0) {
            const allTasks = Store.getAllTasks();
            const filteredTasks = allTasks.filter(t =>
                t.title.toLowerCase().includes(query) ||
                (t.goal && t.goal.toLowerCase().includes(query))
            ).slice(0, 8);

            filteredTasks.forEach(task => {
                results.push({
                    id: task.id,
                    type: 'task',
                    title: task.title,
                    subtitle: task.goal || 'No goal',
                    icon: icons.task,
                    action: () => {
                        if (window.FocusMode) window.FocusMode.open(task.id);
                    }
                });
            });
        }

        this.results = results;
        this.selectedIndex = 0;
    },

    renderResults() {
        DOMUtils.clear(this.resultsList);

        if (this.results.length === 0) {
            const empty = DOMUtils.createElement('div', {
                className: 'palette-no-results',
                textContent: 'No matching commands or tasks.'
            });
            this.resultsList.appendChild(empty);
            return;
        }

        this.results.forEach((res, index) => {
            const item = DOMUtils.createElement('div', {
                className: `palette-item ${index === this.selectedIndex ? 'selected' : ''}`
            });

            item.innerHTML = `
                <div class="item-icon">${res.icon}</div>
                <div class="item-content">
                    <div class="item-title">${res.title}</div>
                    ${res.subtitle ? `<div class="item-subtitle">${res.subtitle}</div>` : ''}
                </div>
            `;

            item.addEventListener('click', () => {
                this.selectedIndex = index;
                this.selectCurrent();
            });

            this.resultsList.appendChild(item);
        });
    },

    navigate(direction) {
        if (this.results.length === 0) return;
        this.selectedIndex = (this.selectedIndex + direction + this.results.length) % this.results.length;
        this.renderResults();

        // Scroll into view
        const selected = this.resultsList.querySelector('.selected');
        if (selected) {
            selected.scrollIntoView({ block: 'nearest' });
        }
    },

    selectCurrent() {
        const result = this.results[this.selectedIndex];
        if (result && result.action) {
            result.action();
            this.close();
        }
    }
};
