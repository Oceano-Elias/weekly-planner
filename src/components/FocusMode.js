/**
 * FocusMode Component - Manages the high-intensity execution modal
 */

import { Store } from '../store.js';
import { Departments } from '../departments.js';
import { PlannerService } from '../services/PlannerService.js';
import { FocusAudio } from '../utils/FocusAudio.js';

export const FocusMode = {
    isOpen: false,
    activeTaskId: null,
    activeKeyHandler: null,

    // Execution Engine State
    activeTaskId: null,
    activeKeyHandler: null,
    sessionInterval: null,
    resizeHandler: null,
    positionRaf: null,
    carouselAnimating: false,
    lastDoneStepIndex: null,

    // Core session settings
    sessionDuration: 25 * 60, // 25 minutes default
    breakDuration: 5 * 60,    // 5 minutes break
    closureThreshold: 5 * 60, // 5 minutes before end

    /**
     * Open Focus Mode for a specific task
     */
    open(taskId) {
        const task = Store.getTask(taskId);
        if (!task) return;

        this.activeTaskId = taskId;
        this.isOpen = true;

        // Initialize or restore execution state
        this.initializeExecutionState(task);

        this.render(task);
        document.body.style.overflow = 'hidden';
    },

    /**
     * Initialize or restore state from Store
     */
    initializeExecutionState(task) {
        const state = Store.getState().activeExecution;

        // If we are opening a NEW task, or if no task is active, reset state
        if (state.taskId !== this.activeTaskId) {
            state.taskId = this.activeTaskId;
            state.running = false;
            state.phase = 'orientation';
            state.mode = 'work';
            state.sessionStartTime = null;
            state.accumulatedTime = 0;
            state.breakStartTime = null;
            state.returnAnchor = task.returnAnchor || '';

            // Find first incomplete step
            const lines = (task.notes || '').split('\n').filter(l => l.trim() !== '');
            state.currentStepIndex = lines.findIndex(l => l.includes('[ ]'));
            if (state.currentStepIndex === -1 && lines.length > 0) {
                state.currentStepIndex = 0; // Fallback to first
            }
            this.lastDoneStepIndex = null;
        }
    },

    /**
     * Close Focus Mode
     */
    close() {
        this.isOpen = false;

        const state = Store.getState().activeExecution;
        if (!state.running) {
            this.stopSession();
            this.activeTaskId = null;
        } else {
            // Keep running in background/floating mode
            this.openFloatingTimer();
        }

        // Remove the keyboard listener
        if (this.activeKeyHandler) {
            document.removeEventListener('keydown', this.activeKeyHandler);
            this.activeKeyHandler = null;
        }
        if (this.resizeHandler) {
            window.removeEventListener('resize', this.resizeHandler);
            this.resizeHandler = null;
        }

        const container = document.getElementById('focusModeContainer');
        container.innerHTML = '';
        document.body.style.overflow = '';

        if (window.Calendar) window.Calendar.renderScheduledTasks();
        if (window.TaskQueue) window.TaskQueue.refresh();
    },

    /**
     * Render the focus overlay
     */
    render(task) {
        const container = document.getElementById('focusModeContainer');
        const color = Departments.getColor(task.hierarchy);
        const state = Store.getState().activeExecution;

        container.innerHTML = `
            <div class="focus-overlay phase-${state.phase}" id="focusOverlay">
                <div class="focus-card glass-surface-deep" style="--task-color: ${color}">
                    <button class="focus-close" id="closeFocus">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M18 6L6 18M6 6l12 12"/>
                        </svg>
                    </button>
                    <button class="focus-sound-toggle ${FocusAudio.isEnabled() ? '' : 'muted'}" id="soundToggle" title="${FocusAudio.isEnabled() ? 'Mute sounds' : 'Enable sounds'}">
                        ${FocusAudio.isEnabled() ? `
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 5L6 9H2v6h4l5 4V5z"/>
                                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
                            </svg>
                        ` : `
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 5L6 9H2v6h4l5 4V5z"/>
                                <line x1="23" y1="9" x2="17" y2="15"/>
                                <line x1="17" y1="9" x2="23" y2="15"/>
                            </svg>
                        `}
                    </button>

                    <!-- Task title at top-left -->
                    <div class="focus-header-topleft">
                        <span class="focus-title" id="focusTaskTitle">${PlannerService.escapeHtml(task.title)}</span>
                        ${Store.getStreak() > 0 ? `<span class="focus-streak-badge" title="Focus streak: ${Store.getStreak()} day${Store.getStreak() > 1 ? 's' : ''}">🔥 ${Store.getStreak()}</span>` : ''}
                    </div>

                    <!-- Center: Focus Engine & Quest Stack -->
                    <div class="focus-engine-side">
                        <div class="execution-rings-container">
                            <svg class="execution-ring-svg" viewBox="0 0 120 120" style="position: absolute; width: 100%; height: 100%; transform: rotate(-90deg);">
                                <defs>
                                    <linearGradient id="outerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                        <stop offset="0%" stop-color="var(--task-color)" stop-opacity="0.4" />
                                        <stop offset="100%" stop-color="var(--task-color)" stop-opacity="1" />
                                    </linearGradient>
                                    <linearGradient id="innerGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                        <stop offset="0%" stop-color="white" />
                                        <stop offset="100%" stop-color="var(--task-color)" />
                                    </linearGradient>
                                    <filter id="innerGlow">
                                        <feGaussianBlur stdDeviation="2" result="blur" />
                                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                                    </filter>
                                </defs>
                                <circle class="outer-ring-bg" cx="60" cy="60" r="56"/>
                                <circle class="outer-ring-fill" id="outerRing" cx="60" cy="60" r="56" stroke="url(#outerGradient)"/>
                                <circle class="inner-ring-bg" cx="60" cy="60" r="48"/>
                                <circle class="inner-ring-fill" id="innerRing" cx="60" cy="60" r="48" stroke="url(#innerGradient)"/>
                            </svg>
                            <div class="ring-center">
                                <div class="ring-step-title" id="activeStepTitle">
                                    ${state.mode === 'work' ? (this.getActiveStepTitle ? this.getActiveStepTitle(task, state.currentStepIndex) : 'Loading step...') : 'Coffee & Recharge'}
                                </div>
                                <div class="ring-time" id="sessionTimeDisplay">00:00</div>
                                <div class="ring-media-controls" aria-label="Focus controls">
                                    <button class="ring-media-btn ring-media-primary ${state.running ? 'running' : ''}" id="sessionToggleBtn" aria-label="${state.running ? 'Pause' : ((state.accumulatedTime || 0) > 0 ? 'Resume' : 'Start Focus')}" title="${state.running ? 'Pause' : ((state.accumulatedTime || 0) > 0 ? 'Resume' : 'Start Focus')}">
                                        ${!state.running ? `
                                            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                                        ` : `
                                            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                                        `}
                                    </button>
                                    ${state.running ? `
                                        <button class="ring-media-btn ring-media-stop" id="stopSessionBtn" aria-label="Stop" title="Stop">
                                            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h12v12H6z"/></svg>
                                        </button>
                                    ` : ''}
                                </div>
                            </div>
                            ${state.phase === 'decision' ? this.renderDecisionOverlay() : ''}
                        </div>

                        <!-- Quest Stack Moved Under Controls -->
                        <div class="quest-stack-container" id="questStack">
                            ${this.renderQuestStack(task, state.currentStepIndex)}
                            <button class="step-action-btn complete-btn carousel-complete-btn" id="carouselCompleteBtn" title="Mark step complete (Enter)">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M20 6L9 17l-5-5"/>
                                </svg>
                                Complete
                            </button>
                            <div class="carousel-nav" id="carouselNav" aria-label="Step navigation">
                                <button class="carousel-nav-btn" id="carouselNavUpBtn" title="Previous step (↑)" aria-label="Previous step">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M12 5l-7 7h14l-7-7z"/>
                                    </svg>
                                </button>
                                <button class="carousel-nav-btn" id="carouselNavDownBtn" title="Next step (↓)" aria-label="Next step">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M12 19l7-7H5l7 7z"/>
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.setupListeners();
        this.updateRings();
        this.updateTimeDisplay();
        this.updateCarouselNavState(); // Set initial arrow states
        this.startSessionInterval();
        this.schedulePositionCarouselCompleteButton();
        const carousel = document.querySelector('#questStack .quest-carousel');
        requestAnimationFrame(() => {
            carousel?.classList.remove('no-initial-transition');
            this.schedulePositionCarouselCompleteButton();
        });
    },

    /**
     * Render the decision state overlay
     */
    renderDecisionOverlay() {
        const state = Store.getState().activeExecution;
        const title = state.mode === 'break' ? 'Time to Recharge' : 'Session Complete';
        const continueLabel = state.mode === 'break' ? 'Continue this step' : 'Continue this step';
        
        return `
            <div class="decision-overlay">
                <div class="decision-title">${title}</div>
                <div class="decision-grid">
                    <button class="decision-btn primary" id="decisionComplete">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M20 6L9 17l-5-5"/>
                        </svg>
                        Mark step complete
                    </button>
                    <button class="decision-btn" id="decisionContinue">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M12 5v14M5 12h14"/>
                        </svg>
                        ${continueLabel}
                    </button>
                    <button class="decision-btn" id="decisionModify">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                        Modify / Split step
                    </button>
                </div>
            </div>
        `;
    },

    /**
     * Get the title of the current active step
     */
    getActiveStepTitle(task, index) {
        if (!task.notes) return "Define your first step";
        const lines = task.notes.split('\n').filter(l => l.trim() !== '');
        if (lines.length === 0) return "Define your first step";
        if (index < 0 || index >= lines.length) return lines[0].replace(/\[[ x]\]\s*/, '').trim();

        return lines[index].replace(/\[[ x]\]\s*/, '').trim();
    },

    /**
     * Update only the quest stack and active step display without full re-render
     * Uses class toggling for smooth CSS transitions (no HTML replacement)
     */
    updateQuestStack() {
        const task = Store.getTask(this.activeTaskId);
        const state = Store.getState().activeExecution;

        const stackContainer = document.getElementById('questStack');
        const activeTitle = document.getElementById('activeStepTitle');

        if (stackContainer) {
            const carousel = stackContainer.querySelector('.quest-carousel');

            // If no carousel exists yet, do initial render
            if (!carousel) {
                stackContainer.innerHTML = this.renderQuestStack(task, state.currentStepIndex);
                this.ensureCarouselCompleteButton(stackContainer);
                this.ensureCarouselNav(stackContainer);
                this.setupCarouselListeners(stackContainer);
                const newCarousel = stackContainer.querySelector('.quest-carousel');
                requestAnimationFrame(() => {
                    newCarousel?.classList.remove('no-initial-transition');
                    this.schedulePositionCarouselCompleteButton();
                });
            } else {
                if (!this.carouselAnimating) {
                    this.syncCarousel(carousel, task, state.currentStepIndex);
                }
            }
        }

        if (activeTitle) {
            activeTitle.textContent = this.getActiveStepTitle(task, state.currentStepIndex);
        }
        this.updateRings();
        this.schedulePositionCarouselCompleteButton();
        this.updateCarouselNavState(); // Update arrow enabled/disabled states
    },

    schedulePositionCarouselCompleteButton() {
        if (this.positionRaf) {
            cancelAnimationFrame(this.positionRaf);
        }
        this.positionRaf = requestAnimationFrame(() => {
            this.positionRaf = null;
            this.positionCarouselCompleteButton();
            this.positionCarouselNav();
        });
    },

    ensureCarouselCompleteButton(stackContainer) {
        if (!stackContainer) return;
        if (stackContainer.querySelector('#carouselCompleteBtn')) return;
        const btn = document.createElement('button');
        btn.className = 'step-action-btn complete-btn carousel-complete-btn';
        btn.id = 'carouselCompleteBtn';
        btn.title = 'Mark step complete (Enter)';
        btn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 6L9 17l-5-5"/>
            </svg>
            Complete
        `;
        stackContainer.appendChild(btn);
    },

    ensureCarouselNav(stackContainer) {
        if (!stackContainer) return;
        if (stackContainer.querySelector('#carouselNav')) return;
        const nav = document.createElement('div');
        nav.className = 'carousel-nav';
        nav.id = 'carouselNav';
        nav.setAttribute('aria-label', 'Step navigation');
        nav.innerHTML = `
            <button class="carousel-nav-btn" id="carouselNavUpBtn" title="Previous step (↑)" aria-label="Previous step">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 5l-7 7h14l-7-7z"/>
                </svg>
            </button>
            <button class="carousel-nav-btn" id="carouselNavDownBtn" title="Next step (↓)" aria-label="Next step">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 19l7-7H5l7 7z"/>
                </svg>
            </button>
        `;
        stackContainer.appendChild(nav);
    },

    positionCarouselCompleteButton() {
        const stackContainer = document.getElementById('questStack');
        const btn = document.getElementById('carouselCompleteBtn');
        if (!stackContainer || !btn) return;

        const carousel = stackContainer.querySelector('.quest-carousel');
        const activeCard = carousel?.querySelector('.carousel-card.active');
        if (!carousel || !activeCard || activeCard.classList.contains('is-completed')) {
            btn.classList.add('hidden');
            return;
        }

        const stackRect = stackContainer.getBoundingClientRect();
        const cardRect = activeCard.getBoundingClientRect();
        if (!stackRect.width || !stackRect.height || !cardRect.width || !cardRect.height) {
            btn.classList.add('hidden');
            return;
        }

        const scaleX = stackContainer.offsetWidth ? (stackRect.width / stackContainer.offsetWidth) : 1;
        const scaleY = stackContainer.offsetHeight ? (stackRect.height / stackContainer.offsetHeight) : 1;
        const cardLeft = (cardRect.left - stackRect.left) / scaleX;
        const cardTop = (cardRect.top - stackRect.top) / scaleY;
        const cardWidth = cardRect.width / scaleX;
        const cardHeight = cardRect.height / scaleY;

        const isNarrow = window.matchMedia('(max-width: 520px)').matches;
        const inset = 16;

        btn.classList.remove('hidden');

        if (isNarrow) {
            const width = Math.max(0, cardWidth - inset * 2);
            btn.style.width = `${width}px`;
            btn.style.setProperty('--complete-tx', `-50%`);
            btn.style.setProperty('--complete-ty', `-100%`);
            btn.style.setProperty('--complete-x', `${cardLeft + (cardWidth / 2)}px`);
            btn.style.setProperty('--complete-y', `${cardTop + cardHeight - inset}px`);
        } else {
            btn.style.width = '';
            btn.style.setProperty('--complete-tx', `-100%`);
            btn.style.setProperty('--complete-ty', `-100%`);
            btn.style.setProperty('--complete-x', `${cardLeft + cardWidth - inset}px`);
            btn.style.setProperty('--complete-y', `${cardTop + cardHeight - inset}px`);
        }
    },

    positionCarouselNav() {
        const stackContainer = document.getElementById('questStack');
        const nav = document.getElementById('carouselNav');
        if (!stackContainer || !nav) return;

        const carousel = stackContainer.querySelector('.quest-carousel');
        const activeCard = carousel?.querySelector('.carousel-card.active');
        if (!carousel || !activeCard) {
            nav.classList.add('hidden');
            return;
        }

        const stackRect = stackContainer.getBoundingClientRect();
        const cardRect = activeCard.getBoundingClientRect();
        if (!stackRect.width || !stackRect.height || !cardRect.width || !cardRect.height) {
            nav.classList.add('hidden');
            return;
        }

        const scaleX = stackContainer.offsetWidth ? (stackRect.width / stackContainer.offsetWidth) : 1;
        const scaleY = stackContainer.offsetHeight ? (stackRect.height / stackContainer.offsetHeight) : 1;
        const cardLeft = (cardRect.left - stackRect.left) / scaleX;
        const cardTop = (cardRect.top - stackRect.top) / scaleY;
        const cardWidth = cardRect.width / scaleX;
        const cardHeight = cardRect.height / scaleY;

        const isNarrow = window.matchMedia('(max-width: 520px)').matches;
        const gap = isNarrow ? 10 : 14;
        const navWidth = 36;
        const edgePadding = isNarrow ? 8 : 10;
        nav.classList.remove('hidden');

        nav.style.setProperty('--nav-tx', `0%`);
        nav.style.setProperty('--nav-ty', `-50%`);
        const xRaw = cardLeft + cardWidth + gap;
        const x = Math.max(edgePadding, Math.min(xRaw, stackContainer.offsetWidth - navWidth - edgePadding));
        nav.style.setProperty('--nav-x', `${x}px`);
        nav.style.setProperty('--nav-y', `${cardTop + (cardHeight / 2)}px`);
    },

    /**
     * Setup click listeners for carousel cards
     */
    setupCarouselListeners(container) {
        const carousel = container.querySelector('.quest-carousel');
        if (!carousel) return;
        if (carousel.dataset.listenersAttached === 'true') return;
        carousel.dataset.listenersAttached = 'true';

        carousel.addEventListener('click', (e) => {
            const card = e.target.closest('.carousel-card');
            if (!card || card.classList.contains('empty')) return;
            const state = Store.getState().activeExecution;
            if (state.phase === 'execution') return;
            const idx = parseInt(card.dataset.index);
            if (Number.isNaN(idx) || idx < 0) return;
            state.currentStepIndex = idx;
            this.lastDoneStepIndex = null;
            this.updateQuestStack();
        });
    },

    getNextIncompleteIndex(lines, fromIndex) {
        return lines.findIndex((l, i) => i > fromIndex && l.includes('[ ]'));
    },

    getPrevCompletedIndex(lines, fromIndex) {
        for (let i = fromIndex - 1; i >= 0; i--) {
            if (lines[i]?.includes('[x]')) return i;
        }
        return -1;
    },

    buildCarouselCardInnerHtml(stateClass, index, cleanText, isCompleted = false) {
        const visualState = stateClass === 'below' ? 'done' : stateClass;
        const stepLabel = index >= 0 ? `Step ${index + 1}` : '';
        
        // Icon logic: if completed, always show checkmark
        const icon = isCompleted 
            ? '<div class="carousel-icon done">✓</div>'
            : (visualState === 'active'
                ? '<div class="carousel-icon active">●</div>'
                : '<div class="carousel-icon upcoming">○</div>');

        const badge = (visualState === 'active' && !isCompleted) ? '<div class="carousel-badge">NOW</div>' : '';
        const completedClass = isCompleted ? 'is-completed' : '';
        const textHtml = `<div class="carousel-text ${completedClass}">${PlannerService.escapeHtml(cleanText)}</div>`;

        return `
            <div class="carousel-header ${completedClass}">
                ${icon}
                <div class="carousel-step">${stepLabel}</div>
                ${badge}
            </div>
            ${textHtml}
        `;
    },

    fillCarouselCard(cardEl, stateClass, index, lines) {
        cardEl.classList.remove('active', 'upcoming', 'done', 'behind', 'below', 'empty', 'is-completed', 'sliding-down', 'sliding-to-active', 'sliding-behind-to-upcoming', 'sliding-out', 'sliding-done-to-active', 'sliding-active-to-upcoming', 'sliding-upcoming-to-behind', 'sliding-below-to-done');
        cardEl.classList.add(stateClass);

        if (index === -1) {
            cardEl.classList.add('empty');
            cardEl.dataset.index = '-1';
            cardEl.style.setProperty('--depth', 1);
            cardEl.innerHTML = '';
            return;
        }

        const raw = lines[index] || '';
        const isCompleted = raw.includes('[x]');
        const cleanText = raw.replace(/\[[ x]\]\s*/, '').trim();
        
        if (isCompleted) {
            cardEl.classList.add('is-completed');
        }

        const depth = stateClass === 'active' ? 0 : (stateClass === 'behind' || stateClass === 'below' ? 2 : 1);
        cardEl.dataset.index = String(index);
        cardEl.style.setProperty('--depth', depth);
        cardEl.innerHTML = this.buildCarouselCardInnerHtml(stateClass, index, cleanText, isCompleted);
    },

    syncCarousel(carousel, task, activeIndex) {
        const lines = (task.notes || '').split('\n').filter(l => l.trim() !== '');
        if (lines.length === 0) return;

        const doneCard = carousel.querySelector('.carousel-card[data-role="done"]');
        const activeCard = carousel.querySelector('.carousel-card[data-role="active"]');
        const upcomingCard = carousel.querySelector('.carousel-card[data-role="upcoming"]');
        const behindCard = carousel.querySelector('.carousel-card[data-role="behind"]');
        if (!doneCard || !activeCard || !upcomingCard || !behindCard) return;

        // Use sequential indices for a complete view of the journey
        const prevIndex = activeIndex - 1;
        const nextIndex = activeIndex + 1 < lines.length ? activeIndex + 1 : -1;
        const behindIndex = activeIndex + 2 < lines.length ? activeIndex + 2 : -1;

        this.fillCarouselCard(doneCard, 'done', prevIndex, lines);
        this.fillCarouselCard(activeCard, 'active', activeIndex, lines);
        this.fillCarouselCard(upcomingCard, 'upcoming', nextIndex, lines);
        this.fillCarouselCard(behindCard, 'behind', behindIndex, lines);
    },

    animateCarouselRoll(toIndex, { markComplete }) {
        if (this.carouselAnimating) return;
        const task = Store.getTask(this.activeTaskId);
        const state = Store.getState().activeExecution;
        const fromIndex = state.currentStepIndex;

        if (toIndex === -1 || toIndex === fromIndex) return;

        const stackContainer = document.getElementById('questStack');
        const carousel = stackContainer?.querySelector('.quest-carousel');
        if (!carousel) return;

        const doneCard = carousel.querySelector('.carousel-card[data-role="done"]');
        const activeCard = carousel.querySelector('.carousel-card[data-role="active"]');
        const upcomingCard = carousel.querySelector('.carousel-card[data-role="upcoming"]');
        const behindCard = carousel.querySelector('.carousel-card[data-role="behind"]');
        if (!doneCard || !activeCard || !upcomingCard || !behindCard) return;

        const linesBefore = (task.notes || '').split('\n').filter(l => l.trim() !== '');
        const nextIndexBefore = toIndex;
        const behindIndexBefore = toIndex + 1 < linesBefore.length ? toIndex + 1 : -1;
        this.fillCarouselCard(upcomingCard, 'upcoming', nextIndexBefore, linesBefore);
        this.fillCarouselCard(behindCard, 'behind', behindIndexBefore, linesBefore);

        if (markComplete) {
            this.toggleMiniTask(fromIndex, true);
        }

        this.carouselAnimating = true;
        carousel.classList.add('carousel-rolling');
        document.getElementById('carouselCompleteBtn')?.classList.add('hidden');
        document.getElementById('carouselNav')?.classList.add('hidden');

        doneCard.classList.add('sliding-out');
        activeCard.classList.add('sliding-down');
        upcomingCard.classList.add('sliding-to-active');
        behindCard.classList.add('sliding-behind-to-upcoming');
        void carousel.offsetHeight;

        const finish = () => {
            this.lastDoneStepIndex = fromIndex;
            state.currentStepIndex = toIndex;

            const taskAfter = Store.getTask(this.activeTaskId);
            const linesAfter = (taskAfter.notes || '').split('\n').filter(l => l.trim() !== '');
            const nextUpcoming = toIndex + 1 < linesAfter.length ? toIndex + 1 : -1;
            const nextBehind = toIndex + 2 < linesAfter.length ? toIndex + 2 : -1;

            const oldDone = doneCard;
            const oldActive = activeCard;
            const oldUpcoming = upcomingCard;
            const oldBehind = behindCard;

            oldDone.dataset.role = 'behind';
            oldBehind.dataset.role = 'upcoming';
            oldUpcoming.dataset.role = 'active';
            oldActive.dataset.role = 'done';

            this.fillCarouselCard(oldActive, 'done', fromIndex, linesAfter);
            this.fillCarouselCard(oldUpcoming, 'active', toIndex, linesAfter);
            this.fillCarouselCard(oldBehind, 'upcoming', nextUpcoming, linesAfter);
            this.fillCarouselCard(oldDone, 'behind', nextBehind, linesAfter);

            const activeTitle = document.getElementById('activeStepTitle');
            if (activeTitle) {
                activeTitle.textContent = this.getActiveStepTitle(taskAfter, state.currentStepIndex);
            }
            this.updateRings();
            carousel.classList.remove('carousel-rolling');
            this.carouselAnimating = false;
            this.schedulePositionCarouselCompleteButton();
            this.updateCarouselNavState();
        };

        const onAnimationEnd = (e) => {
            if (e.animationName !== 'rollToActive') return;
            finish();

            // Play success sound if marking complete
            if (markComplete) {
                FocusAudio.playStepComplete();
                this.showSuccessVisuals();
            }
        };

        upcomingCard.addEventListener('animationend', onAnimationEnd, { once: true });
    },

    animateCarouselRollReverse(toIndex) {
        if (this.carouselAnimating) return;
        const task = Store.getTask(this.activeTaskId);
        const state = Store.getState().activeExecution;
        const fromIndex = state.currentStepIndex;

        if (toIndex === -1 || toIndex === fromIndex) return;

        const stackContainer = document.getElementById('questStack');
        const carousel = stackContainer?.querySelector('.quest-carousel');
        if (!carousel) return;

        const doneCard = carousel.querySelector('.carousel-card[data-role="done"]');
        const activeCard = carousel.querySelector('.carousel-card[data-role="active"]');
        const upcomingCard = carousel.querySelector('.carousel-card[data-role="upcoming"]');
        const behindCard = carousel.querySelector('.carousel-card[data-role="behind"]');
        if (!doneCard || !activeCard || !upcomingCard || !behindCard) return;

        const linesBefore = (task.notes || '').split('\n').filter(l => l.trim() !== '');
        const prevDoneForTo = toIndex - 1;
        this.fillCarouselCard(behindCard, 'below', prevDoneForTo, linesBefore);

        this.carouselAnimating = true;
        carousel.classList.add('carousel-rolling');
        document.getElementById('carouselCompleteBtn')?.classList.add('hidden');
        document.getElementById('carouselNav')?.classList.add('hidden');

        doneCard.classList.add('sliding-done-to-active');
        activeCard.classList.add('sliding-active-to-upcoming');
        upcomingCard.classList.add('sliding-upcoming-to-behind');
        behindCard.classList.add('sliding-below-to-done');
        void carousel.offsetHeight;

        const finish = () => {
            state.currentStepIndex = toIndex;
            this.lastDoneStepIndex = null;

            const taskAfter = Store.getTask(this.activeTaskId);
            const linesAfter = (taskAfter.notes || '').split('\n').filter(l => l.trim() !== '');
            const nextDone = toIndex - 1;
            const nextUpcoming = toIndex + 1 < linesAfter.length ? toIndex + 1 : -1;
            const nextBehind = toIndex + 2 < linesAfter.length ? toIndex + 2 : -1;

            const oldDone = doneCard;
            const oldActive = activeCard;
            const oldUpcoming = upcomingCard;
            const oldBehind = behindCard;

            oldDone.dataset.role = 'active';
            oldActive.dataset.role = 'upcoming';
            oldUpcoming.dataset.role = 'behind';
            oldBehind.dataset.role = 'done';

            this.fillCarouselCard(oldDone, 'active', toIndex, linesAfter);
            this.fillCarouselCard(oldActive, 'upcoming', nextUpcoming, linesAfter);
            this.fillCarouselCard(oldUpcoming, 'behind', nextBehind, linesAfter);
            this.fillCarouselCard(oldBehind, 'done', nextDone, linesAfter);

            const activeTitle = document.getElementById('activeStepTitle');
            if (activeTitle) {
                activeTitle.textContent = this.getActiveStepTitle(taskAfter, state.currentStepIndex);
            }
            this.updateRings();
            carousel.classList.remove('carousel-rolling');
            this.carouselAnimating = false;
            this.schedulePositionCarouselCompleteButton();
            this.updateCarouselNavState();
        };

        const onAnimationEnd = (e) => {
            if (e.animationName !== 'rollDoneToActive') return;
            finish();
        };

        doneCard.addEventListener('animationend', onAnimationEnd, { once: true });
    },

    /**
     * Render the steps as a 3D vertical carousel
     * All cards rendered upfront for smooth CSS transitions
     */
    renderQuestStack(task, activeIndex) {
        const notes = task.notes || '';
        if (!notes) return '<div class="pills-empty">Define your journey steps...</div>';

        const lines = notes.split('\n').filter(l => l.trim() !== '');
        if (lines.length === 0) return '<div class="pills-empty">Define your journey steps...</div>';

        // Use sequential indices for initial render
        const prevDone = activeIndex - 1;
        const nextIndex = activeIndex + 1 < lines.length ? activeIndex + 1 : -1;
        const behindIndex = activeIndex + 2 < lines.length ? activeIndex + 2 : -1;

        const buildCardInner = (role, idx) => {
            if (idx === -1) return '';
            const raw = lines[idx];
            const isCompleted = raw.includes('[x]');
            const cleanText = raw.replace(/\[[ x]\]\s*/, '').trim();
            return this.buildCarouselCardInnerHtml(role, idx, cleanText, isCompleted);
        };

        const doneInner = buildCardInner('done', prevDone);
        const activeInner = buildCardInner('active', activeIndex);
        const upcomingInner = buildCardInner('upcoming', nextIndex);
        const behindInner = buildCardInner('behind', behindIndex);

        const getCompletedClass = (idx) => {
            if (idx === -1) return '';
            return lines[idx].includes('[x]') ? 'is-completed' : '';
        };

        return `
            <div class="quest-carousel no-initial-transition" data-carousel="drum">
                <div class="carousel-card done ${prevDone === -1 ? 'empty' : ''} ${getCompletedClass(prevDone)}" data-role="done" data-index="${prevDone}" style="--depth: 1;">${doneInner}</div>
                <div class="carousel-card active ${getCompletedClass(activeIndex)}" data-role="active" data-index="${activeIndex}" style="--depth: 0;">${activeInner}</div>
                <div class="carousel-card upcoming ${nextIndex === -1 ? 'empty' : ''} ${getCompletedClass(nextIndex)}" data-role="upcoming" data-index="${nextIndex}" style="--depth: 1;">${upcomingInner}</div>
                <div class="carousel-card behind ${behindIndex === -1 ? 'empty' : ''} ${getCompletedClass(behindIndex)}" data-role="behind" data-index="${behindIndex}" style="--depth: 2;">${behindInner}</div>
            </div>
        `;
    },

    /**
     * Setup event listeners
     */
    setupListeners() {
        const overlay = document.getElementById('focusOverlay');
        const closeBtn = document.getElementById('closeFocus');
        const sessionToggleBtn = document.getElementById('sessionToggleBtn');
        const questCards = document.querySelectorAll('.carousel-card');

        overlay?.addEventListener('click', (e) => {
            if (e.target === overlay) this.close();
        });

        closeBtn?.addEventListener('click', () => this.close());

        sessionToggleBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            const state = Store.getState().activeExecution;
            if (state.running) {
                this.pauseSession();
            } else {
                this.startSession();
            }
            // Update button icon without full re-render
            this.updateToggleButton();
        });

        document.getElementById('stopSessionBtn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.stopSession();
            this.updateToggleButton();
        });

        // The old startBreakBtn is replaced by the unified toggle

        // Decision buttons
        document.getElementById('decisionComplete')?.addEventListener('click', () => this.handleDecision('complete'));
        document.getElementById('decisionContinue')?.addEventListener('click', () => this.handleDecision('continue'));
        document.getElementById('decisionModify')?.addEventListener('click', () => this.handleDecision('modify'));

        // Sound toggle
        document.getElementById('soundToggle')?.addEventListener('click', (e) => {
            e.stopPropagation();
            FocusAudio.toggle();
            this.updateSoundToggleButton();
        });

        document.getElementById('carouselNavUpBtn')?.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.navigateToPrevVisibleStep();
        });
        document.getElementById('carouselNavDownBtn')?.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.navigateToNextVisibleStep();
        });
        document.getElementById('carouselCompleteBtn')?.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.completeCurrentStep();
        });

        questCards.forEach(card => {
            card.addEventListener('mousemove', (e) => {
                const rect = card.getBoundingClientRect();
                const x = ((e.clientX - rect.left) / rect.width) * 100;
                const y = ((e.clientY - rect.top) / rect.height) * 100;
                card.style.setProperty('--mouse-x', `${x}%`);
                card.style.setProperty('--mouse-y', `${y}%`);
            });
        });

        // ESC or F to close
        if (this.activeKeyHandler) {
            document.removeEventListener('keydown', this.activeKeyHandler);
        }

        this.activeKeyHandler = (e) => {
            // Skip if typing in an input field
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            // Enter: Complete current step
            if (e.key === 'Enter') {
                if (e.metaKey || e.ctrlKey || e.altKey) return;
                this.completeCurrentStep();
                return;
            }

            // Space: Toggle pause/resume
            if (e.key === ' ' || e.code === 'Space') {
                e.preventDefault(); // Prevent page scroll
                const state = Store.getState().activeExecution;
                if (state.running) {
                    this.pauseSession();
                } else {
                    this.startSession();
                }
                this.updateToggleButton();
                return;
            }

            // Arrow Up: Navigate to previous step
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.navigateToPrevVisibleStep();
                return;
            }

            // Arrow Down: Navigate to next step (skip)
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.skipToNextStep();
                return;
            }

            // S: Skip current step
            if (e.key.toLowerCase() === 's') {
                this.skipToNextStep();
                return;
            }

            // Escape or F: Close Focus Mode
            if (e.key === 'Escape' || e.key.toLowerCase() === 'f') {
                this.close();
            }
        };
        document.addEventListener('keydown', this.activeKeyHandler);

        if (this.resizeHandler) {
            window.removeEventListener('resize', this.resizeHandler);
        }
        this.resizeHandler = () => this.schedulePositionCarouselCompleteButton();
        window.addEventListener('resize', this.resizeHandler);
    },

    /**
     * Toggle session state
     */
    toggleSession() {
        const state = Store.getState().activeExecution;

        if (state.running) {
            this.stopSession();
        } else {
            this.startSession();
        }
        this.render(Store.getTask(this.activeTaskId));
    },

    /**
     * Start focus session
     */
    startSession() {
        const state = Store.getState().activeExecution;

        // Cannot start without a step
        const task = Store.getTask(this.activeTaskId);
        const steps = (task.notes || '').split('\n').filter(l => l.trim() !== '');
        if (steps.length === 0) {
            alert('Please define at least one step before starting.');
            return;
        }

        state.running = true;
        state.phase = 'execution';
        state.mode = 'work';
        state.sessionStartTime = Date.now();
        state.breakStartTime = null;
        state.updatedAt = Date.now();

        this.startSessionInterval();

        // Update visual states
        this.updateTimerVisualState();
        this.updateCarouselNavState();
    },

    /**
     * Stop focus session (Interruption) - with confirmation
     * Uses a two-step process: first call shows confirm, second call actually stops
     */
    stopSession(confirmed = false) {
        if (!confirmed) {
            // Show confirmation overlay
            this.showStopConfirmation();
            return;
        }

        // Actually stop the session
        const state = Store.getState().activeExecution;
        state.running = false;
        state.phase = 'orientation';
        state.sessionStartTime = null;
        state.accumulatedTime = 0;
        state.mode = 'work';
        state.breakStartTime = null;
        clearInterval(this.sessionInterval);
        this.sessionInterval = null;

        // Update visual states
        this.updateTimerVisualState();
        this.updateCarouselNavState();
        this.updateToggleButton();
        this.updateTimeDisplay(); // Refresh to show 25:00
    },

    /**
     * Show stop confirmation overlay
     */
    showStopConfirmation() {
        // Remove any existing confirmation
        document.getElementById('stopConfirmOverlay')?.remove();

        const overlay = document.createElement('div');
        overlay.id = 'stopConfirmOverlay';
        overlay.className = 'stop-confirm-overlay';
        overlay.innerHTML = `
            <div class="stop-confirm-modal">
                <div class="stop-confirm-icon">🔄</div>
                <div class="stop-confirm-title">Reset Timer?</div>
                <div class="stop-confirm-message">Timer will go back to 25:00. Your steps will stay.</div>
                <div class="stop-confirm-buttons">
                    <button class="stop-confirm-btn cancel" id="stopConfirmCancel">Cancel</button>
                    <button class="stop-confirm-btn confirm" id="stopConfirmYes">Reset</button>
                </div>
            </div>
        `;

        document.querySelector('.focus-overlay')?.appendChild(overlay);

        // Add listeners
        document.getElementById('stopConfirmCancel')?.addEventListener('click', () => {
            overlay.remove();
        });

        document.getElementById('stopConfirmYes')?.addEventListener('click', () => {
            overlay.remove();
            this.stopSession(true); // Confirmed
        });

        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.remove();
        });
    },

    /**
     * Start/update session interval
     */
    startSessionInterval() {
        if (this.sessionInterval) clearInterval(this.sessionInterval);

        this.sessionInterval = setInterval(() => {
            if (!this.isOpen && !Store.getState().activeExecution.running) {
                clearInterval(this.sessionInterval);
                return;
            }
            this.tick();
        }, 1000);
    },

    /**
     * Core logic tick (1s)
     */
    tick() {
        const state = Store.getState().activeExecution;
        if (!state.running && state.mode !== 'break') return;

        const now = Date.now();

        if (state.mode === 'work') {
            const currentSessionElapsed = state.sessionStartTime ? (now - state.sessionStartTime) : 0;
            const totalElapsedMs = (state.accumulatedTime || 0) + currentSessionElapsed;
            const elapsedSeconds = Math.floor(totalElapsedMs / 1000);

            // Check for closure phase
            if (elapsedSeconds >= (this.sessionDuration - this.closureThreshold) && state.phase === 'execution') {
                state.phase = 'closure';
                FocusAudio.playClosureWarning();
                this.notifyPhaseChange('closure');
            }

            // Check for session completion
            if (elapsedSeconds >= this.sessionDuration) {
                // Count steps completed before recording
                const task = Store.getTask(this.activeTaskId);
                const lines = (task?.notes || '').split('\n').filter(l => l.trim() !== '');
                const stepsCompleted = lines.filter(l => l.includes('[x]')).length;

                // Record the session
                Store.recordFocusSession({
                    taskId: this.activeTaskId,
                    duration: this.sessionDuration,
                    stepsCompleted
                });

                state.running = false;
                state.mode = 'break';
                state.breakStartTime = Date.now();
                state.phase = 'decision';
                state.accumulatedTime = 0; // Reset for next session
                FocusAudio.playSessionComplete();
                this.render(Store.getTask(this.activeTaskId));
            }
        } else if (state.mode === 'break') {
            // Break mode - count down
            const breakElapsed = state.breakStartTime ? Math.floor((Date.now() - state.breakStartTime) / 1000) : 0;
            if (breakElapsed >= this.breakDuration) {
                // Break finished
                // Keep in break mode but maybe pulse the timer or show a notification
            }
        }

        this.updateRings();
        this.updateTimeDisplay();
    },

    pauseSession() {
        const state = Store.getState().activeExecution;

        if (!state.running) return;
        if (state.sessionStartTime) {
            state.accumulatedTime = (state.accumulatedTime || 0) + (Date.now() - state.sessionStartTime);
        }
        state.running = false;
        state.sessionStartTime = null;

        // Update visual states
        this.updateTimerVisualState();
        this.updateCarouselNavState();
    },

    /**
     * Update toggle button icon without full re-render
     */
    updateToggleButton() {
        const state = Store.getState().activeExecution;
        const btn = document.getElementById('sessionToggleBtn');
        const stopBtn = document.getElementById('stopSessionBtn');
        const mediaControls = document.querySelector('.ring-media-controls');

        if (btn) {
            if (state.running) {
                btn.classList.add('running');
                btn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;
                btn.setAttribute('aria-label', 'Pause');
                btn.setAttribute('title', 'Pause');

                // Add stop button if not present
                if (!stopBtn && mediaControls) {
                    const newStopBtn = document.createElement('button');
                    newStopBtn.className = 'ring-media-btn ring-media-stop';
                    newStopBtn.id = 'stopSessionBtn';
                    newStopBtn.setAttribute('aria-label', 'Stop');
                    newStopBtn.setAttribute('title', 'Stop');
                    newStopBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h12v12H6z"/></svg>`;
                    newStopBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.stopSession();
                        this.updateToggleButton();
                    });
                    mediaControls.appendChild(newStopBtn);
                }
            } else {
                btn.classList.remove('running');
                btn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
                const label = (state.accumulatedTime || 0) > 0 ? 'Resume' : 'Start Focus';
                btn.setAttribute('aria-label', label);
                btn.setAttribute('title', label);

                // Remove stop button when paused/stopped
                stopBtn?.remove();
            }
        }
    },

    /**
     * Update sound toggle button UI without full re-render
     */
    updateSoundToggleButton() {
        const btn = document.getElementById('soundToggle');
        if (!btn) return;

        const enabled = FocusAudio.isEnabled();
        btn.classList.toggle('muted', !enabled);
        btn.title = enabled ? 'Mute sounds' : 'Enable sounds';
        btn.innerHTML = enabled ? `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 5L6 9H2v6h4l5 4V5z"/>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
            </svg>
        ` : `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 5L6 9H2v6h4l5 4V5z"/>
                <line x1="23" y1="9" x2="17" y2="15"/>
                <line x1="17" y1="9" x2="23" y2="15"/>
            </svg>
        `;
    },

    /**
     * Update timer visual state (greyed when not running)
     */
    updateTimerVisualState() {
        const state = Store.getState().activeExecution;
        const timerDisplay = document.getElementById('sessionTimeDisplay');

        if (timerDisplay) {
            if (state.running) {
                timerDisplay.classList.add('running');
                timerDisplay.classList.remove('paused');
            } else {
                timerDisplay.classList.remove('running');
                timerDisplay.classList.add('paused');
            }
        }
    },

    /**
     * Update carousel navigation state (disabled when timer is running or at boundaries)
     */
    updateCarouselNavState() {
        const state = Store.getState().activeExecution;
        const task = Store.getTask(this.activeTaskId);
        const carouselNav = document.getElementById('carouselNav');
        const upBtn = document.getElementById('carouselNavUpBtn');
        const downBtn = document.getElementById('carouselNavDownBtn');

        // If timer is running, disable everything
        if (state.running) {
            if (carouselNav) carouselNav.classList.add('disabled');
            if (upBtn) {
                upBtn.disabled = true;
                upBtn.classList.remove('at-boundary');
            }
            if (downBtn) {
                downBtn.disabled = true;
                downBtn.classList.remove('at-boundary');
            }
            return;
        }

        // Timer not running - check step boundaries
        if (carouselNav) carouselNav.classList.remove('disabled');

        const lines = (task?.notes || '').split('\n').filter(l => l.trim() !== '');
        const currentIndex = state.currentStepIndex || 0;

        // Source of truth: are there steps before/after current index?
        const hasPrevStep = currentIndex > 0;
        const hasNextStep = currentIndex < lines.length - 1;

        console.log('[NAV] updateCarouselNavState:', {
            currentIndex,
            hasPrevStep,
            hasNextStep,
            linesCount: lines.length
        });

        // Update individual buttons based on boundaries
        if (upBtn) {
            upBtn.disabled = !hasPrevStep;
            upBtn.classList.toggle('at-boundary', !hasPrevStep);
        }
        if (downBtn) {
            downBtn.disabled = !hasNextStep;
            downBtn.classList.toggle('at-boundary', !hasNextStep);
        }
    },

    /**
     * Handle decision after session
     */
    handleDecision(choice) {
        const state = Store.getState().activeExecution;
        const task = Store.getTask(this.activeTaskId);

        if (choice === 'complete') {
            this.toggleMiniTask(state.currentStepIndex);

            // Move to next step if available
            const lines = task.notes.split('\n').filter(l => l.trim() !== '');
            const nextIncomplete = lines.findIndex((l, i) => i > state.currentStepIndex && l.includes('[ ]'));
            if (nextIncomplete !== -1) {
                state.currentStepIndex = nextIncomplete;
            }
            state.mode = 'work'; // Transition back to work mode
            state.breakStartTime = null;
        } else if (choice === 'modify') {
            // Simply close decision overlay and show orientation
        } else if (choice === 'continue') {
            // Immediate restart
            state.mode = 'work';
            state.breakStartTime = null;
            this.startSession();
            return;
        }

        state.phase = 'orientation';
        state.running = false;
        this.render(Store.getTask(this.activeTaskId));
    },

    /**
     * Update ring progress
     */
    updateRings() {
        const state = Store.getState().activeExecution;
        const task = Store.getTask(this.activeTaskId);

        const outerRing = document.getElementById('outerRing');
        const outerRingBg = document.querySelector('.outer-ring-bg');
        const innerRing = document.getElementById('innerRing');
        if (!outerRing || !innerRing) return;

        // Outer Ring: Step-based progress
        const lines = (task.notes || '').split('\n').filter(l => l.trim() !== '');
        const taskLines = lines.filter(l => l.includes('[ ]') || l.includes('[x]'));
        const completedCount = taskLines.filter(l => l.includes('[x]')).length;
        const totalCount = taskLines.length || 1;
        
        const outerCircumference = 2 * Math.PI * 56;
        const isTotalComplete = taskLines.length > 0 && taskLines.every(l => l.includes('[x]'));

        // --- SEGMENTATION LOGIC ---
        if (totalCount > 1) {
            const strokeWidth = 4;
            const targetGap = 6; // Total visible gap between segments
            
            // With stroke-linecap: round, each segment adds strokeWidth/2 to each end.
            // So we must subtract strokeWidth from the dash length and add it to the gap length.
            const segmentDash = (outerCircumference / totalCount) - targetGap;
            const gapDash = targetGap;
            
            // Background: Repeating segments [dash, gap]
            if (outerRingBg) {
                // Adjust for round caps: dash length = segmentLength - strokeWidth, gap length = gapLength + strokeWidth
                outerRingBg.style.strokeDasharray = `${segmentDash - strokeWidth} ${gapDash + strokeWidth}`;
            }

            if (isTotalComplete) {
                // Fully closed circle
                outerRing.style.strokeDasharray = `${outerCircumference} 0`;
                outerRing.style.strokeDashoffset = 0;
            } else if (completedCount === 0) {
                outerRing.style.strokeDasharray = `0 ${outerCircumference}`;
                outerRing.style.strokeDashoffset = 0;
            } else {
                // Non-repeating dasharray to show exact number of segments
                let fillArray = [];
                let currentLength = 0;

                for (let i = 0; i < completedCount; i++) {
                    // 1. Add the dash (segment)
                    const dash = segmentDash - strokeWidth;
                    fillArray.push(dash);
                    currentLength += dash;
                    
                    // 2. Add the gap
                    if (i < completedCount - 1) {
                        // Gap between completed segments
                        const gap = gapDash + strokeWidth;
                        fillArray.push(gap);
                        currentLength += gap;
                    } else {
                        // LAST completed segment: add the remaining circumference as a gap
                        // This ensures the array length is EVEN (dash, gap, dash, gap...)
                        // and prevents the browser from doubling the array and turning gaps into dashes.
                        const finalGap = outerCircumference - currentLength;
                        fillArray.push(finalGap);
                    }
                }
                
                outerRing.style.strokeDasharray = fillArray.join(' ');
                outerRing.style.strokeDashoffset = 0;
            }
        } else {
            outerRing.style.strokeDasharray = `${outerCircumference} 0`;
            if (outerRingBg) outerRingBg.style.strokeDasharray = `${outerCircumference} 0`;
            outerRing.style.strokeDashoffset = isTotalComplete ? 0 : outerCircumference;
        }

        outerRing.style.opacity = completedCount > 0 ? "1" : "0.3";

        // Inner Ring: Session progress
        const innerCircumference = 2 * Math.PI * 48;
        innerRing.style.strokeDasharray = innerCircumference;

        if (isTotalComplete) {
            innerRing.style.strokeDashoffset = 0;
            innerRing.style.opacity = "1";
        } else if (state.mode === 'work') {
            const currentSessionElapsed = (state.running && state.sessionStartTime) ? (Date.now() - state.sessionStartTime) : 0;
            const totalElapsedMs = (state.accumulatedTime || 0) + currentSessionElapsed;
            const innerProgress = Math.min(1, totalElapsedMs / (this.sessionDuration * 1000));

            innerRing.style.strokeDashoffset = innerCircumference * (1 - innerProgress);
            innerRing.style.opacity = state.running ? "1" : "0.5";
        } else if (state.mode === 'break') {
            innerRing.style.strokeDashoffset = 0;
            innerRing.style.opacity = "0.2";
        } else {
            innerRing.style.strokeDashoffset = innerCircumference;
            innerRing.style.opacity = "0.3";
        }
    },

    /**
     * Update numeric time (hidden by default in CSS)
     */
    updateTimeDisplay() {
        const display = document.getElementById('sessionTimeDisplay');
        if (!display) return;

        const state = Store.getState().activeExecution;
        
        // If task is fully completed, show 00:00 or a checkmark
        if (state.phase === 'completed') {
            display.textContent = "00:00";
            display.classList.add('timer-finished-pulse');
            return;
        }

        let elapsedMs = state.accumulatedTime || 0;
        if (state.mode === 'work' && state.running && state.sessionStartTime) {
            elapsedMs += (Date.now() - state.sessionStartTime);
        }

        const elapsedSeconds = Math.floor(elapsedMs / 1000);
        let totalSeconds = 0;

        if (state.mode === 'work') {
            totalSeconds = Math.max(0, this.sessionDuration - elapsedSeconds);
        } else if (state.mode === 'break') {
            // Count down break time
            const breakElapsed = state.breakStartTime ? Math.floor((Date.now() - state.breakStartTime) / 1000) : 0;
            totalSeconds = Math.max(0, this.breakDuration - breakElapsed);

            // Pulse the timer when break is over
            if (totalSeconds === 0) {
                display.classList.add('timer-finished-pulse');
            } else {
                display.classList.remove('timer-finished-pulse');
            }
        }

        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        display.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    },

    /**
     * Show success visuals (flash/animation)
     */
    showSuccessVisuals() {
        const ring = document.getElementById('outerRing');
        if (!ring) return;

        ring.classList.add('success-flash');
        setTimeout(() => ring.classList.remove('success-flash'), 1000);

        // Check for total task achievement
        const task = Store.getTask(this.activeTaskId);
        const lines = (task.notes || '').split('\n').filter(l => l.trim() !== '');
        // Explicitly check for lines that are tasks
        const taskLines = lines.filter(l => l.includes('[ ]') || l.includes('[x]'));
        
        // Log for debugging
        const completedCount = taskLines.filter(l => l.includes('[x]')).length;
        console.log(`[Focus] Checking achievement: ${completedCount}/${taskLines.length}`);
        
        const allCompleted = taskLines.length > 0 && taskLines.every(l => l.includes('[x]'));

        if (allCompleted) {
            console.log('[Focus] SUCCESS! All tasks completed. Celebrating...');
            this.celebrateTaskAchieved();
        } else {
            // Update rings even if not all complete (to show progress)
            this.updateRings();
        }
    },

    /**
     * Triumphant celebration for total task completion
     */
    celebrateTaskAchieved() {
        FocusAudio.playTaskAchieved();

        const ring = document.getElementById('outerRing');
        if (ring) {
            ring.classList.add('triumph-glow');
            setTimeout(() => ring.classList.remove('triumph-glow'), 2000);
        }

        // Stop the timer and fill everything
        const state = Store.getState().activeExecution;
        state.running = false;
        state.sessionStartTime = null;
        state.accumulatedTime = 0;
        state.phase = 'completed'; // New phase for total completion

        // Final UI update
        this.updateRings();
        this.updateTimeDisplay();
        this.updateToggleButton();

        // Create confetti effect
        this.spawnConfetti();
    },

    spawnConfetti() {
        const container = document.querySelector('.execution-rings-container');
        if (!container) return;

        const colors = ['#3b82f6', '#10b981', '#fbbf24', '#f87171', '#a78bfa'];
        const particleCount = 40;

        for (let i = 0; i < particleCount; i++) {
            const particle = document.createElement('div');
            particle.className = 'confetti-particle';
            
            const color = colors[Math.floor(Math.random() * colors.length)];
            const left = Math.random() * 100;
            const size = 4 + Math.random() * 6;
            const duration = 1 + Math.random() * 2;
            const delay = Math.random() * 0.5;

            particle.style.backgroundColor = color;
            particle.style.left = `${left}%`;
            particle.style.top = `-10px`;
            particle.style.width = `${size}px`;
            particle.style.height = `${size}px`;
            particle.style.animationDuration = `${duration}s`;
            particle.style.animationDelay = `${delay}s`;

            container.appendChild(particle);

            // Cleanup
            setTimeout(() => particle.remove(), (duration + delay) * 1000);
        }
    },

    notifyPhaseChange(phase) {
        // Optional: play subtle sound or visual flash
        console.log(`[Focus] Phase changed to: ${phase}`);
    },

    /**
     * Delete a mini-task
     */
    deleteMiniTask(index) {
        const task = Store.getTask(this.activeTaskId);
        const lines = task.notes.split('\n');
        lines.splice(index, 1);

        Store.updateTaskNotesForWeek(this.activeTaskId, lines.join('\n'));
        this.updateQuestStack();
        if (window.Calendar) window.Calendar.refresh();
    },

    /**
     * Toggle a mini-task in notes
     * @param {number} index - The step index to toggle
     * @param {boolean} skipUpdate - If true, don't call updateQuestStack (for chained operations)
     */
    toggleMiniTask(index, skipUpdate = false) {
        const task = Store.getTask(this.activeTaskId);
        const lines = task.notes.split('\n');
        const line = lines[index];

        if (line.includes('[x]')) {
            lines[index] = line.replace('[x]', '[ ]');
        } else if (line.includes('[ ]')) {
            lines[index] = line.replace('[ ]', '[x]');
        } else {
            lines[index] = `[x] ${line}`;
        }

        Store.updateTaskNotesForWeek(this.activeTaskId, lines.join('\n'));
        if (!skipUpdate) {
            this.updateQuestStack();
        }
        if (window.Calendar) window.Calendar.refresh();
    },

    /**
     * Navigate to previous step without marking completion
     */
    goToPreviousStep() {
        const state = Store.getState().activeExecution;
        const task = Store.getTask(this.activeTaskId);
        const lines = (task.notes || '').split('\n').filter(l => l.trim() !== '');
        if (lines.length === 0) return;

        for (let i = state.currentStepIndex - 1; i >= 0; i--) {
            if (lines[i] !== undefined) {
                state.currentStepIndex = i;
                this.lastDoneStepIndex = null;
                this.updateQuestStack();
                return;
            }
        }
    },

    navigateToPrevVisibleStep() {
        if (this.carouselAnimating) return;
        const state = Store.getState().activeExecution;
        const task = Store.getTask(this.activeTaskId);
        if (state.phase === 'execution') return;

        const lines = (task?.notes || '').split('\n').filter(l => l.trim() !== '');
        const currentIndex = state.currentStepIndex || 0;

        // Logic: Simply go back one index if possible
        if (currentIndex > 0) {
            this.animateCarouselRollReverse(currentIndex - 1);
        }
    },

    navigateToNextVisibleStep() {
        if (this.carouselAnimating) return;
        const state = Store.getState().activeExecution;
        const task = Store.getTask(this.activeTaskId);
        if (state.phase === 'execution') return;

        const lines = (task?.notes || '').split('\n').filter(l => l.trim() !== '');
        const currentIndex = state.currentStepIndex || 0;

        if (currentIndex < lines.length - 1) {
            this.animateCarouselRoll(currentIndex + 1, { markComplete: false });
        }
    },

    /**
     * Skip to next incomplete step
     */
    skipToNextStep() {
        const state = Store.getState().activeExecution;
        const task = Store.getTask(this.activeTaskId);
        const lines = (task.notes || '').split('\n').filter(l => l.trim() !== '');

        // Find next incomplete step
        const nextIndex = lines.findIndex((l, i) => i > state.currentStepIndex && l.includes('[ ]'));
        if (nextIndex !== -1) {
            this.animateCarouselRoll(nextIndex, { markComplete: false });
        }
    },

    /**
     * Complete current step and move to next
     */
    completeCurrentStep() {
        const state = Store.getState().activeExecution;
        const task = Store.getTask(this.activeTaskId);
        const previousIndex = state.currentStepIndex;

        // Find the next incomplete step BEFORE we mark current as complete
        const lines = (task.notes || '').split('\n').filter(l => l.trim() !== '');
        const nextIndex = lines.findIndex((l, i) => i > state.currentStepIndex && l.includes('[ ]'));
        if (nextIndex !== -1) {
            this.animateCarouselRoll(nextIndex, { markComplete: true });
            return;
        }

        this.toggleMiniTask(previousIndex, true);
        this.lastDoneStepIndex = previousIndex;
        this.updateQuestStack();
    },

    // =========================================
    // POMODORO TIMER METHODS
    // =========================================

    /**
     * Format seconds to MM:SS
     */
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    },

    /**
     * Update timer display
     */
    updateTimerDisplay() {
        const timeEl = document.getElementById('pomodoroTime');
        const ringEl = document.getElementById('pomodoroRing');
        const modeEl = document.getElementById('pomodoroModeLabel');

        if (!timeEl || !ringEl) return;

        timeEl.textContent = this.formatTime(this.pomodoroSeconds);

        // Update ring progress (circumference = 2 * PI * 52 ≈ 327)
        const circumference = 327;
        const totalSeconds = this.pomodoroMode === 'work' ? this.workDuration : this.breakDuration;
        const progress = this.pomodoroSeconds / totalSeconds;
        const offset = circumference * (1 - progress);
        ringEl.style.strokeDasharray = circumference;
        ringEl.style.strokeDashoffset = offset;

        // Update mode label and color
        if (this.pomodoroMode === 'work') {
            modeEl.textContent = '🎯 Focus Mode';
            ringEl.style.stroke = '#3b82f6';
        } else {
            modeEl.textContent = '☕ Break Time';
            ringEl.style.stroke = '#10b981';
        }
    },

    /**
     * Start/Pause timer
     */
    startPauseTimer() {
        const btn = document.getElementById('pomodoroStartPause');

        if (this.pomodoroRunning) {
            // Pause
            clearInterval(this.pomodoroTimer);
            this.pomodoroRunning = false;
            btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5,3 19,12 5,21"/>
            </svg>`;
            this.pomodoroTargetEpoch = null;
            this.persistTimerState();
            this.updateFloatingTimer();
        } else {
            // Start
            this.pomodoroRunning = true;
            btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <rect x="5" y="4" width="4" height="16"/>
                <rect x="15" y="4" width="4" height="16"/>
            </svg>`;
            this.pomodoroTargetEpoch = Date.now() + this.pomodoroSeconds * 1000;
            this.pomodoroTimer = setInterval(() => {
                const remaining = Math.max(0, Math.round((this.pomodoroTargetEpoch - Date.now()) / 1000));
                this.pomodoroSeconds = remaining;
                this.updateTimerDisplay();
                this.updateFloatingTimer();
                if (remaining <= 0) {
                    this.switchMode();
                }
            }, 1000);
            this.persistTimerState();
            this.updateFloatingTimer();
        }
    },

    /**
     * Reset timer
     */
    resetTimer() {
        clearInterval(this.pomodoroTimer);
        this.pomodoroRunning = false;
        this.pomodoroMode = 'work';
        this.pomodoroSeconds = this.workDuration;
        this.pomodoroTargetEpoch = null;

        const btn = document.getElementById('pomodoroStartPause');
        if (btn) {
            btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5,3 19,12 5,21"/>
            </svg>`;
        }

        this.updateTimerDisplay();
        this.persistTimerState();
        this.updateFloatingTimer();
    },

    /**
     * Switch between work and break mode
     */
    switchMode() {
        clearInterval(this.pomodoroTimer);
        this.pomodoroRunning = false;

        if (this.pomodoroMode === 'work') {
            this.pomodoroMode = 'break';
            this.pomodoroSeconds = this.breakDuration;
            // Play notification sound or show notification
            if (Notification.permission === 'granted') {
                new Notification('🎉 Focus session complete!', { body: 'Time for a break.' });
            }
        } else {
            this.pomodoroMode = 'work';
            this.pomodoroSeconds = this.workDuration;
            if (Notification.permission === 'granted') {
                new Notification('💪 Break over!', { body: 'Ready to focus again?' });
            }
        }

        const btn = document.getElementById('pomodoroStartPause');
        if (btn) {
            btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5,3 19,12 5,21"/>
            </svg>`;
        }

        this.updateTimerDisplay();
        this.pomodoroTargetEpoch = null;
        this.persistTimerState();
        this.updateFloatingTimer();
    },

    /**
     * Stop timer when closing modal
     */
    stopTimer() {
        if (this.pomodoroTimer) {
            clearInterval(this.pomodoroTimer);
            this.pomodoroTimer = null;
        }
        this.pomodoroRunning = false;
        this.pomodoroTargetEpoch = null;
        this.persistTimerState();
        this.updateFloatingTimer();
    },

    persistTimerState() {
        const state = {
            mode: this.pomodoroMode,
            running: this.pomodoroRunning,
            remaining: this.pomodoroSeconds,
            targetEpoch: this.pomodoroTargetEpoch,
            work: this.workDuration,
            break: this.breakDuration,
            updatedAt: Date.now()
        };
        try {
            localStorage.setItem('focusModeTimerState', JSON.stringify(state));
        } catch { }
    },

    restoreTimerState() {
        let state = null;
        try {
            state = JSON.parse(localStorage.getItem('focusModeTimerState') || 'null');
        } catch { }
        if (!state) {
            this.pomodoroMode = 'work';
            this.pomodoroSeconds = this.workDuration;
            this.pomodoroRunning = false;
            this.pomodoroTargetEpoch = null;
            return;
        }
        this.workDuration = state.work || this.workDuration;
        this.breakDuration = state.break || this.breakDuration;
        this.pomodoroMode = state.mode || 'work';
        if (state.targetEpoch && state.running) {
            const remaining = Math.max(0, Math.round((state.targetEpoch - Date.now()) / 1000));
            this.pomodoroSeconds = remaining;
            this.pomodoroRunning = remaining > 0;
            this.pomodoroTargetEpoch = state.targetEpoch;
            if (this.pomodoroRunning && !this.pomodoroTimer) {
                this.pomodoroTimer = setInterval(() => {
                    const r = Math.max(0, Math.round((this.pomodoroTargetEpoch - Date.now()) / 1000));
                    this.pomodoroSeconds = r;
                    this.updateTimerDisplay();
                    this.updateFloatingTimer();
                    if (r <= 0) {
                        this.switchMode();
                    }
                }, 1000);
            }
        } else {
            this.pomodoroSeconds = state.remaining || (this.pomodoroMode === 'work' ? this.workDuration : this.breakDuration);
            this.pomodoroRunning = false;
            this.pomodoroTargetEpoch = null;
        }
    },

    async openFloatingTimer() {
        const api = document.documentPictureInPicture;
        if (this.pipWindow) return;
        try {
            if (!api) throw new Error('pip');
            const pip = await api.requestWindow({ initialWidth: 220, initialHeight: 160 });
            this.pipWindow = pip;
            const doc = pip.document;
            doc.body.style.margin = '0';
            doc.body.style.fontFamily = 'system-ui, -apple-system, Segoe UI, Roboto, Arial';
            doc.body.innerHTML = `
                <div id="pipRoot" style="display:flex;flex-direction:column;align-items:center;gap:8px;padding:12px;background:#111;color:#fff;height:100%;box-sizing:border-box;">
                    <div id="pipMode" style="font-size:12px;font-weight:600;opacity:0.8"></div>
                    <div id="pipTime" style="font-size:32px;font-weight:700;letter-spacing:-1px"></div>
                    <div style="display:flex;gap:8px;">
                        <button id="pipStartPause" style="padding:6px 10px;border:none;border-radius:8px;background:#2563eb;color:#fff">Start</button>
                        <button id="pipReset" style="padding:6px 10px;border:1px solid #333;border-radius:8px;background:#222;color:#ddd">Reset</button>
                    </div>
                </div>`;
            pip.startPause = () => this.startPauseTimer();
            pip.resetTimer = () => this.resetTimer();
            doc.getElementById('pipStartPause').addEventListener('click', () => pip.startPause());
            doc.getElementById('pipReset').addEventListener('click', () => pip.resetTimer());
            pip.addEventListener('pagehide', () => { this.pipWindow = null; });
            this.updateFloatingTimer();
            this.hideBadge();
        } catch {
            this.showBadge();
        }
    },

    updateFloatingTimer() {
        const pip = this.pipWindow;
        if (pip) {
            const doc = pip.document;
            const timeEl = doc.getElementById('pipTime');
            const modeEl = doc.getElementById('pipMode');
            const startPauseEl = doc.getElementById('pipStartPause');
            if (timeEl && modeEl && startPauseEl) {
                timeEl.textContent = this.formatTime(this.pomodoroSeconds);
                modeEl.textContent = this.pomodoroMode === 'work' ? 'Focus' : 'Break';
                startPauseEl.textContent = this.pomodoroRunning ? 'Pause' : 'Start';
            }
        }
        this.updateBadge();
    },

    closeFloatingTimer() {
        if (this.pipWindow) {
            try { this.pipWindow.close(); } catch { }
            this.pipWindow = null;
        }
    },

    showBadge() {
        if (this.badgeEl) return;
        const el = document.createElement('div');
        el.id = 'floatingPomodoroBadge';
        el.style.position = 'fixed';
        el.style.zIndex = '9999';
        el.style.background = '#111';
        el.style.color = '#fff';
        el.style.border = '1px solid #333';
        el.style.borderRadius = '12px';
        el.style.boxShadow = '0 6px 20px rgba(0,0,0,0.4)';
        el.style.padding = '10px 12px';
        el.style.display = 'flex';
        el.style.alignItems = 'center';
        el.style.gap = '10px';
        el.innerHTML = `
            <span id="badgeMode" style="font-size:12px;opacity:0.8"></span>
            <span id="badgeTime" style="font-size:18px;font-weight:700;letter-spacing:-0.5px"></span>
            <button id="badgeStartPause" style="padding:6px 10px;border:none;border-radius:8px;background:#2563eb;color:#fff;font-size:12px">Start</button>
            <button id="badgeReset" style="padding:6px 10px;border:1px solid #333;border-radius:8px;background:#222;color:#ddd;font-size:12px">Reset</button>
        `;
        document.body.appendChild(el);
        this.badgeEl = el;
        const savedPos = (() => { try { return JSON.parse(localStorage.getItem('floatingPomodoroBadgePos') || 'null'); } catch { return null; } })();
        if (savedPos && typeof savedPos.left === 'number' && typeof savedPos.top === 'number') {
            el.style.left = `${savedPos.left}px`;
            el.style.top = `${savedPos.top}px`;
        } else {
            const defaultLeft = Math.max(0, window.innerWidth - el.offsetWidth - 16);
            const defaultTop = Math.max(0, window.innerHeight - el.offsetHeight - 16);
            el.style.left = `${defaultLeft}px`;
            el.style.top = `${defaultTop}px`;
        }
        el.querySelector('#badgeStartPause').addEventListener('click', () => this.startPauseTimer());
        el.querySelector('#badgeReset').addEventListener('click', () => this.resetTimer());
        let dragging = false;
        let startX = 0, startY = 0, startLeft = 0, startTop = 0;
        const onMouseMove = (e) => {
            if (!dragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            const newLeft = Math.min(Math.max(0, startLeft + dx), window.innerWidth - el.offsetWidth);
            const newTop = Math.min(Math.max(0, startTop + dy), window.innerHeight - el.offsetHeight);
            el.style.left = `${newLeft}px`;
            el.style.top = `${newTop}px`;
        };
        const endDrag = () => {
            if (!dragging) return;
            dragging = false;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', endDrag);
            try {
                const rect = el.getBoundingClientRect();
                localStorage.setItem('floatingPomodoroBadgePos', JSON.stringify({ left: rect.left, top: rect.top }));
            } catch { }
        };
        el.addEventListener('mousedown', (e) => {
            if (e.target && e.target.tagName === 'BUTTON') return;
            dragging = true;
            startX = e.clientX;
            startY = e.clientY;
            const rect = el.getBoundingClientRect();
            startLeft = rect.left;
            startTop = rect.top;
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', endDrag);
        });
        this.updateBadge();
    },

    updateBadge() {
        if (!this.badgeEl) return;
        const timeEl = this.badgeEl.querySelector('#badgeTime');
        const modeEl = this.badgeEl.querySelector('#badgeMode');
        const spEl = this.badgeEl.querySelector('#badgeStartPause');
        if (!timeEl || !modeEl || !spEl) return;
        timeEl.textContent = this.formatTime(this.pomodoroSeconds);
        modeEl.textContent = this.pomodoroMode === 'work' ? 'Focus' : 'Break';
        spEl.textContent = this.pomodoroRunning ? 'Pause' : 'Start';
        if (!this.pomodoroRunning && this.pomodoroSeconds <= 0) {
            this.hideBadge();
        }
    },

    hideBadge() {
        if (this.badgeEl) {
            try { this.badgeEl.remove(); } catch { }
            this.badgeEl = null;
        }
    },

};

window.FocusMode = FocusMode;
