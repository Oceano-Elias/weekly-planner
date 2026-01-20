/**
 * FocusModeUI - Pure UI templates for FocusMode component
 */

import { Departments } from '../departments.js';
import { PlannerService } from '../services/PlannerService.js';
import { FocusAudio } from '../utils/FocusAudio.js';
import { Store } from '../store.js';

export const FocusModeUI = {
    /**
     * Format seconds to MM:SS
     */
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    },

    /**
     * Get active step title
     */
    getActiveStepTitle(task, currentStepIndex) {
        if (!task || !task.notes) return 'Execute Phase';
        const lines = task.notes.split('\n').filter(l => l.trim() !== '');
        if (currentStepIndex >= 0 && currentStepIndex < lines.length) {
            return lines[currentStepIndex].replace(/\[[ x]\]\s*/, '').trim();
        }
        return 'Execute Phase';
    },

    /**
     * Update time display and document title
     */
    updateTimeDisplay(state, sessionDuration, breakDuration) {
        const display = document.getElementById('sessionTimeDisplay');
        if (!display) return;

        // If task is fully completed, show 00:00 or a checkmark
        if (state.phase === 'completed') {
            display.textContent = "00:00";
            display.classList.add('timer-finished-pulse');
            return;
        }

        let secondsRemaining;
        if (state.mode === 'work') {
            const currentSessionElapsed = state.sessionStartTime ? (Date.now() - state.sessionStartTime) : 0;
            const totalElapsedMs = (state.accumulatedTime || 0) + currentSessionElapsed;
            secondsRemaining = Math.max(0, sessionDuration - Math.floor(totalElapsedMs / 1000));
        } else {
            const breakElapsed = state.breakStartTime ? Math.floor((Date.now() - state.breakStartTime) / 1000) : 0;
            secondsRemaining = Math.max(0, breakDuration - breakElapsed);

            // Pulse the timer when break is over
            if (secondsRemaining === 0) {
                display.classList.add('timer-finished-pulse');
            } else {
                display.classList.remove('timer-finished-pulse');
            }
        }

        display.textContent = this.formatTime(secondsRemaining);

        // Update document title if session is running
        if (state.running || state.mode === 'break') {
            document.title = `(${this.formatTime(secondsRemaining)}) Focus Mode`;
        } else {
            document.title = 'Calendar';
        }
    },

    /**
     * Update ring progress
     */
    updateRings(state, task, sessionDuration) {
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
            
            const segmentDash = (outerCircumference / totalCount) - targetGap;
            const gapDash = targetGap;
            
            if (outerRingBg) {
                outerRingBg.style.strokeDasharray = `${segmentDash - strokeWidth} ${gapDash + strokeWidth}`;
            }

            if (isTotalComplete) {
                outerRing.style.strokeDasharray = `${outerCircumference} 0`;
                outerRing.style.strokeDashoffset = 0;
            } else if (completedCount === 0) {
                outerRing.style.strokeDasharray = `0 ${outerCircumference}`;
                outerRing.style.strokeDashoffset = 0;
            } else {
                let fillArray = [];
                let currentLength = 0;

                for (let i = 0; i < completedCount; i++) {
                    const dash = segmentDash - strokeWidth;
                    fillArray.push(dash);
                    currentLength += dash;
                    
                    if (i < completedCount - 1) {
                        const gap = gapDash + strokeWidth;
                        fillArray.push(gap);
                        currentLength += gap;
                    } else {
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

        // Inner Ring: Session time progress
        const innerCircumference = 2 * Math.PI * 48;
        innerRing.style.strokeDasharray = innerCircumference;

        if (isTotalComplete || state.phase === 'completed') {
            innerRing.style.strokeDashoffset = 0;
            innerRing.style.opacity = "1";
        } else if (state.mode === 'work') {
            const currentSessionElapsed = (state.running && state.sessionStartTime) ? (Date.now() - state.sessionStartTime) : 0;
            const totalElapsedMs = (state.accumulatedTime || 0) + currentSessionElapsed;
            const innerProgress = Math.min(1, totalElapsedMs / (sessionDuration * 1000));

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
     * Update toggle button icon without full re-render
     */
    updateToggleButton(state, stopSessionCallback) {
        const btn = document.getElementById('sessionToggleBtn');
        const stopBtn = document.getElementById('stopSessionBtn');
        const mediaControls = document.querySelector('.ring-media-controls');

        if (btn) {
            if (state.running) {
                btn.classList.add('running');
                btn.classList.remove('waiting');
                btn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;
                btn.setAttribute('aria-label', 'Pause');
                btn.setAttribute('title', 'Pause');

                if (!stopBtn && mediaControls) {
                    const newStopBtn = document.createElement('button');
                    newStopBtn.className = 'ring-media-btn ring-media-stop';
                    newStopBtn.id = 'stopSessionBtn';
                    newStopBtn.setAttribute('aria-label', 'Stop');
                    newStopBtn.setAttribute('title', 'Stop');
                    newStopBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h12v12H6z"/></svg>`;
                    newStopBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        if (stopSessionCallback) stopSessionCallback();
                    });
                    mediaControls.appendChild(newStopBtn);
                }
            } else {
                btn.classList.remove('running');
                const isWaiting = (state.accumulatedTime || 0) > 0;
                btn.classList.toggle('waiting', isWaiting);
                btn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
                const label = isWaiting ? 'Resume' : 'Start Focus';
                btn.setAttribute('aria-label', label);
                btn.setAttribute('title', label);

                stopBtn?.remove();
            }
        }
    },

    /**
     * Update sound toggle button UI
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
     * Update timer visual state
     */
    updateTimerVisualState(state) {
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
     * Update carousel navigation state
     */
    updateCarouselNavState(state, task) {
        const carouselNav = document.getElementById('carouselNav');
        const upBtn = document.getElementById('carouselNavUpBtn');
        const downBtn = document.getElementById('carouselNavDownBtn');

        if (carouselNav) {
            carouselNav.classList.toggle('disabled', state.running);
        }

        const lines = (task?.notes || '').split('\n').filter(l => l.trim() !== '');
        const currentIndex = state.currentStepIndex || 0;

        const hasPrevStep = currentIndex > 0;
        const hasNextStep = currentIndex < lines.length - 1;

        if (upBtn) {
            upBtn.disabled = !hasPrevStep || state.running;
            upBtn.classList.toggle('at-boundary', !hasPrevStep);
        }
        if (downBtn) {
            downBtn.disabled = !hasNextStep || state.running;
            downBtn.classList.toggle('at-boundary', !hasNextStep);
        }
    },

    /**
     * Show success visuals (flash/animation)
     */
    showSuccessVisuals() {
        const ring = document.getElementById('outerRing');
        if (!ring) return;

        ring.classList.add('success-flash');
        setTimeout(() => ring.classList.remove('success-flash'), 1000);

        const activeCard = document.querySelector('.carousel-card.active');
        if (!activeCard) return;
        activeCard.classList.add('step-complete-flash');
        setTimeout(() => activeCard.classList.remove('step-complete-flash'), 600);
    },

    /**
     * Triumphant celebration for total task completion
     */
    celebrateVisuals() {
        const ring = document.getElementById('outerRing');
        if (ring) {
            ring.classList.add('triumph-glow');
            setTimeout(() => ring.classList.remove('triumph-glow'), 2000);
        }
    },

    /**
     * Build inner HTML for a carousel card
     */
    getCarouselCardInner(stateClass, index, cleanText, isCompleted = false) {
        const stepLabel = index >= 0 ? `Step ${index + 1}` : '';
        const visualState = stateClass === 'below' ? 'done' : stateClass;
        
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

    /**
     * Quest stack 3D vertical carousel template
     */
    getQuestStack(task, activeIndex) {
        const notes = task.notes || '';
        if (!notes) return '<div class="pills-empty">Define your journey steps...</div>';

        const lines = notes.split('\n').filter(l => l.trim() !== '');
        if (lines.length === 0) return '<div class="pills-empty">Define your journey steps...</div>';

        const prevDone = activeIndex - 1;
        const nextIndex = activeIndex + 1 < lines.length ? activeIndex + 1 : -1;
        const behindIndex = activeIndex + 2 < lines.length ? activeIndex + 2 : -1;

        const buildCardInner = (role, idx) => {
            if (idx === -1) return '';
            const raw = lines[idx];
            const isCompleted = raw.includes('[x]');
            const cleanText = raw.replace(/\[[ x]\]\s*/, '').trim();
            return this.getCarouselCardInner(role, idx, cleanText, isCompleted);
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
        `;
    },

    /**
     * Update a carousel card element's state and content
     */
    updateCarouselCard(cardEl, stateClass, index, lines) {
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
        cardEl.innerHTML = this.getCarouselCardInner(stateClass, index, cleanText, isCompleted);
    },

    /**
     * Orchestrate forward roll animation
     */
    animateForwardRoll({ fromIndex, toIndex, task, onStepComplete, onFinish }) {
        const els = this.getCarouselElements();
        if (!els.carousel || !els.doneCard || !els.activeCard || !els.upcomingCard || !els.behindCard) return;

        const lines = (task.notes || '').split('\n').filter(l => l.trim() !== '');
        
        // Pre-update upcoming/behind for smooth entry
        const nextIndexBefore = toIndex;
        const behindIndexBefore = toIndex + 1 < lines.length ? toIndex + 1 : -1;
        this.updateCarouselCard(els.upcomingCard, 'upcoming', nextIndexBefore, lines);
        this.updateCarouselCard(els.behindCard, 'behind', behindIndexBefore, lines);

        if (onStepComplete) onStepComplete();

        this.setCarouselRolling(true);
        this.applyForwardRollClasses(els);
        
        // Force reflow
        void els.carousel.offsetHeight;

        const handleFinish = () => {
            clearTimeout(fallbackTimeout);
            const nextUpcoming = toIndex + 1 < lines.length ? toIndex + 1 : -1;
            const nextBehind = toIndex + 2 < lines.length ? toIndex + 2 : -1;

            this.finalizeForwardRoll(
                els,
                { fromIndex, toIndex, nextUpcoming, nextBehind },
                lines
            );

            this.updateActiveStepTitle(task, toIndex);
            this.setCarouselRolling(false);
            if (onFinish) onFinish();
        };

        const onAnimationEnd = (e) => {
            if (e.animationName !== 'rollToActive') return;
            handleFinish();
        };

        // Fallback timeout in case animationend doesn't fire
        const fallbackTimeout = setTimeout(handleFinish, 1000);
        els.upcomingCard.addEventListener('animationend', onAnimationEnd, { once: true });
    },

    /**
     * Orchestrate backward roll animation
     */
    animateBackwardRoll({ fromIndex, toIndex, task, onFinish }) {
        const els = this.getCarouselElements();
        if (!els.carousel || !els.doneCard || !els.activeCard || !els.upcomingCard || !els.behindCard) return;

        const lines = (task.notes || '').split('\n').filter(l => l.trim() !== '');

        // Pre-update done card for smooth backward entry
        this.updateCarouselCard(els.doneCard, 'done', toIndex, lines);

        this.setCarouselRolling(true);
        this.applyBackwardRollClasses(els);
        
        // Force reflow
        void els.carousel.offsetHeight;

        const handleFinish = () => {
            clearTimeout(fallbackTimeout);
            const nextDone = toIndex - 1 >= 0 ? toIndex - 1 : -1;
            const nextUpcoming = toIndex + 1 < lines.length ? toIndex + 1 : -1;
            const nextBehind = toIndex + 2 < lines.length ? toIndex + 2 : -1;

            this.finalizeBackwardRoll(
                els,
                { toIndex, nextDone, nextUpcoming, nextBehind },
                lines
            );

            this.updateActiveStepTitle(task, toIndex);
            this.setCarouselRolling(false);
            if (onFinish) onFinish();
        };

        const onAnimationEnd = (e) => {
            // Correct animation name for backward roll is rollDoneToActive
            if (e.animationName !== 'rollDoneToActive') return;
            handleFinish();
        };

        // Fallback timeout in case animationend doesn't fire
        const fallbackTimeout = setTimeout(handleFinish, 1000);
        els.doneCard.addEventListener('animationend', onAnimationEnd, { once: true });
    },

    /**
     * Start the forward roll animation classes
     */
    applyForwardRollClasses(cards) {
        const { doneCard, activeCard, upcomingCard, behindCard } = cards;
        doneCard.classList.add('sliding-out');
        activeCard.classList.add('sliding-down');
        upcomingCard.classList.add('sliding-to-active');
        behindCard.classList.add('sliding-behind-to-upcoming');
    },

    /**
     * Finalize forward roll state swap
     */
    finalizeForwardRoll(cards, indices, lines) {
        const { doneCard, activeCard, upcomingCard, behindCard } = cards;
        const { fromIndex, toIndex, nextUpcoming, nextBehind } = indices;

        const oldDone = doneCard;
        const oldActive = activeCard;
        const oldUpcoming = upcomingCard;
        const oldBehind = behindCard;

        oldDone.dataset.role = 'behind';
        oldBehind.dataset.role = 'upcoming';
        oldUpcoming.dataset.role = 'active';
        oldActive.dataset.role = 'done';

        this.updateCarouselCard(oldActive, 'done', fromIndex, lines);
        this.updateCarouselCard(oldUpcoming, 'active', toIndex, lines);
        this.updateCarouselCard(oldBehind, 'upcoming', nextUpcoming, lines);
        this.updateCarouselCard(oldDone, 'behind', nextBehind, lines);
    },

    /**
     * Start the backward roll animation classes
     */
    applyBackwardRollClasses(cards) {
        const { doneCard, activeCard, upcomingCard, behindCard } = cards;
        doneCard.classList.add('sliding-done-to-active');
        activeCard.classList.add('sliding-active-to-upcoming');
        upcomingCard.classList.add('sliding-upcoming-to-behind');
        behindCard.classList.add('sliding-below-to-done');
    },

    /**
     * Finalize backward roll state swap
     */
    finalizeBackwardRoll(cards, indices, lines) {
        const { doneCard, activeCard, upcomingCard, behindCard } = cards;
        const { toIndex, nextDone, nextUpcoming, nextBehind } = indices;

        const oldDone = doneCard;
        const oldActive = activeCard;
        const oldUpcoming = upcomingCard;
        const oldBehind = behindCard;

        oldDone.dataset.role = 'active';
        oldActive.dataset.role = 'upcoming';
        oldUpcoming.dataset.role = 'behind';
        oldBehind.dataset.role = 'done';

        this.updateCarouselCard(oldBehind, 'done', nextDone, lines);
        this.updateCarouselCard(oldDone, 'active', toIndex, lines);
        this.updateCarouselCard(oldActive, 'upcoming', nextUpcoming, lines);
        this.updateCarouselCard(oldUpcoming, 'behind', nextBehind, lines);
    },

    /**
     * Decision state overlay template
     */
    getDecisionOverlay(state) {
        const title = state.mode === 'break' ? 'Break Time' : 'Session Complete';
        const subtitle = state.mode === 'break' ? 'Recharge before the next push.' : 'Choose how to continue.';

        return `
            <div class="decision-overlay">
                <div class="decision-card">
                    <div class="decision-title">${title}</div>
                    <div class="decision-subtitle">${subtitle}</div>
                    <div class="decision-actions primary-actions">
                        <button class="decision-btn primary" id="decisionComplete">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M20 6L9 17l-5-5"/>
                            </svg>
                            Mark step complete
                        </button>
                        <button class="decision-btn" id="decisionContinue">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M12 5v14l11-7z"/>
                            </svg>
                            Continue this step
                        </button>
                    </div>
                    <div class="decision-divider"></div>
                    <div class="decision-actions secondary-actions">
                        <button class="decision-btn secondary" id="decisionBreak">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M18 8h1a4 4 0 0 1 0 8h-1"/>
                                <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>
                                <line x1="6" y1="1" x2="6" y2="4"/>
                                <line x1="10" y1="1" x2="10" y2="4"/>
                                <line x1="14" y1="1" x2="14" y2="4"/>
                            </svg>
                            Take a break
                        </button>
                        <button class="decision-btn secondary" id="decisionStop">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M18.36 6.64a9 9 0 1 1-12.73 0"/>
                                <line x1="12" y1="2" x2="12" y2="12"/>
                            </svg>
                            End Focus session
                        </button>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Show stop confirmation overlay
     */
    showStopConfirmation(onConfirm) {
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
            if (onConfirm) onConfirm();
        });

        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.remove();
        });
    },

    /**
     * Create confetti effect
     */
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

    /**
     * Position carousel elements
     */
    positionCarouselElements() {
        this.positionCarouselCompleteButton();
        this.positionCarouselNav();
    },

    positionCarouselCompleteButton() {
        const stackContainer = document.getElementById('questStack');
        const btn = document.getElementById('carouselCompleteBtn');
        if (!stackContainer || !btn) return;

        const carousel = stackContainer.querySelector('.quest-carousel');
        const activeCard = carousel?.querySelector('.carousel-card.active');
        
        // Hide button if no active card, or card is completed, or carousel is currently rolling
        if (!carousel || !activeCard || activeCard.classList.contains('is-completed') || carousel.classList.contains('carousel-rolling')) {
            btn.classList.add('hidden');
            return;
        }

        const stackRect = stackContainer.getBoundingClientRect();
        const cardRect = activeCard.getBoundingClientRect();
        
        // If elements are not visible (rect is zero), don't try to position
        if (stackRect.width === 0 || cardRect.width === 0) {
            btn.classList.add('hidden');
            return;
        }

        const scaleX = stackContainer.offsetWidth ? (stackRect.width / stackContainer.offsetWidth) : 1;
        const scaleY = stackContainer.offsetHeight ? (stackRect.height / stackContainer.offsetHeight) : 1;
        
        const cardLeft = (cardRect.left - stackRect.left) / scaleX;
        const cardTop = (cardRect.top - stackRect.top) / scaleY;
        const cardWidth = cardRect.width / scaleX;
        const cardHeight = cardRect.height / scaleY;

        const isNarrow = window.innerWidth <= 520;
        const inset = 16;

        btn.classList.remove('hidden');

        if (isNarrow) {
            // Mobile: Position on the right side of the bottom to leave room for nav on the left
            const navTotalWidth = (36 * 2) + 8 + 10; // (btn width * 2) + gap between arrows + gap to complete btn
            const width = Math.max(0, cardWidth - inset * 2 - navTotalWidth);
            btn.style.width = `${width}px`;
            btn.style.setProperty('--complete-tx', `-100%`);
            btn.style.setProperty('--complete-ty', `-100%`);
            btn.style.setProperty('--complete-x', `${cardLeft + cardWidth - inset}px`);
            btn.style.setProperty('--complete-y', `${cardTop + cardHeight - inset}px`);
        } else {
            // Desktop: Bottom right corner of the card
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
        
        if (stackRect.width === 0 || cardRect.width === 0) {
            nav.classList.add('hidden');
            return;
        }

        const scaleX = stackContainer.offsetWidth ? (stackRect.width / stackContainer.offsetWidth) : 1;
        const scaleY = stackContainer.offsetHeight ? (stackRect.height / stackContainer.offsetHeight) : 1;
        
        const cardLeft = (cardRect.left - stackRect.left) / scaleX;
        const cardTop = (cardRect.top - stackRect.top) / scaleY;
        const cardWidth = cardRect.width / scaleX;
        const cardHeight = cardRect.height / scaleY;

        const isNarrow = window.innerWidth <= 520;
        const gap = isNarrow ? 10 : 14;

        nav.classList.remove('hidden');

        let navLeft, navTop, navTx;

        if (isNarrow) {
            // Mobile: Position on the left side of the bottom
            const inset = 16;
            navLeft = cardLeft + inset;
            navTop = cardTop + cardHeight - inset;
            navTx = '0%';
            nav.style.setProperty('--nav-ty', `-100%`);
            nav.style.flexDirection = 'row';
        } else {
            // Desktop: Position to the right of the card
            navLeft = cardLeft + cardWidth + gap;
            navTop = cardTop + (cardHeight / 2);
            navTx = '0%';
            nav.style.setProperty('--nav-ty', `-50%`);
            nav.style.flexDirection = 'column';
        }

        nav.style.setProperty('--nav-x', `${navLeft}px`);
        nav.style.setProperty('--nav-y', `${navTop}px`);
        nav.style.setProperty('--nav-tx', navTx);
    },

    /**
     * Main focus overlay template
     */
    getMainTemplate(task, state, activeStepTitle) {
        const color = Departments.getColor(task.hierarchy);
        const streak = Store.getStreak();

        return `
            <div class="focus-overlay phase-${state.phase}" id="focusOverlay">
                <div class="focus-ambient-bg">
                    <div class="ambient-blob blob-1" style="background: ${color}"></div>
                    <div class="ambient-blob blob-2" style="background: ${color}"></div>
                    <div class="ambient-blob blob-3" style="background: ${color}"></div>
                    <div class="focus-particles"></div>
                </div>
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

                    <div class="focus-header-topleft">
                        <span class="focus-title" id="focusTaskTitle">${PlannerService.escapeHtml(task.title)}</span>
                        ${streak > 0 ? `<span class="focus-streak-badge" title="Focus streak: ${streak} day${streak > 1 ? 's' : ''}">🔥 ${streak}</span>` : ''}
                    </div>

                    <div class="focus-engine-side">
                        <div class="execution-rings-container ${state.phase === 'decision' ? 'decision-flip' : ''}">
                            <div class="ring-flip-surface">
                                <div class="ring-face ring-face-front">
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
                                            ${state.mode === 'work' ? activeStepTitle : 'Coffee & Recharge'}
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
                                </div>
                                <div class="ring-face ring-face-back">
                                    ${state.phase === 'decision' ? this.getDecisionOverlay(state) : ''}
                                </div>
                            </div>
                        </div>

                        <div class="quest-stack-container" id="questStack">
                            ${this.getQuestStack(task, state.currentStepIndex)}
                        </div>
                    </div>
                </div>
            </div>
        `;
    },
    /**
     * Update pomodoro timer display
     */
    updatePomodoroTimer(seconds, totalSeconds, mode) {
        const timeEl = document.getElementById('pomodoroTime');
        const ringEl = document.getElementById('pomodoroRing');
        const modeEl = document.getElementById('pomodoroModeLabel');

        if (!timeEl || !ringEl) return;

        timeEl.textContent = this.formatTime(seconds);

        // Update ring progress (circumference = 2 * PI * 52 ≈ 327)
        const circumference = 327;
        const progress = seconds / totalSeconds;
        const offset = circumference * (1 - progress);
        ringEl.style.strokeDasharray = circumference;
        ringEl.style.strokeDashoffset = offset;

        // Update mode label and color
        if (mode === 'work') {
            if (modeEl) modeEl.textContent = '🎯 Focus Mode';
            ringEl.style.stroke = '#3b82f6';
        } else {
            if (modeEl) modeEl.textContent = '☕ Break Time';
            ringEl.style.stroke = '#10b981';
        }
    },

    /**
     * Get PIP window content
     */
    getPipContent() {
        return `
            <div id="pipRoot" style="display:flex;flex-direction:column;align-items:center;gap:10px;padding:14px;background:linear-gradient(160deg,rgba(15,23,42,0.98) 0%,rgba(2,6,23,0.98) 100%);color:#e2e8f0;height:100%;box-sizing:border-box;border-radius:16px;border:1px solid rgba(255,255,255,0.12);box-shadow:0 18px 50px rgba(0,0,0,0.55), inset 0 1px 1px rgba(255,255,255,0.06);">
                <div style="display:flex;align-items:center;gap:8px;">
                    <div id="pipModeDot" style="width:8px;height:8px;border-radius:999px;background:#3b82f6;box-shadow:0 0 12px rgba(59,130,246,0.6);"></div>
                    <div id="pipMode" style="font-size:11px;font-weight:800;letter-spacing:1.4px;text-transform:uppercase;opacity:0.85"></div>
                </div>
                <div style="position:relative;width:96px;height:96px;display:flex;align-items:center;justify-content:center;">
                    <svg width="96" height="96" viewBox="0 0 96 96" style="position:absolute;inset:0;">
                        <circle cx="48" cy="48" r="40" stroke="rgba(255,255,255,0.08)" stroke-width="6" fill="none"></circle>
                        <circle id="pipRing" cx="48" cy="48" r="40" stroke="#3b82f6" stroke-width="6" fill="none" stroke-linecap="round" transform="rotate(-90 48 48)"></circle>
                    </svg>
                    <div id="pipTime" style="font-size:22px;font-weight:800;letter-spacing:-0.5px;color:#ffffff"></div>
                </div>
                <div style="display:flex;gap:8px;">
                    <button id="pipStartPause" style="padding:7px 12px;border:none;border-radius:10px;background:linear-gradient(135deg,#3b82f6,#2563eb);color:#fff;font-weight:700;font-size:12px;box-shadow:0 8px 18px rgba(59,130,246,0.35)">Start</button>
                    <button id="pipReset" style="padding:7px 12px;border:1px solid rgba(255,255,255,0.16);border-radius:10px;background:rgba(15,23,42,0.6);color:#cbd5f5;font-weight:700;font-size:12px">Reset</button>
                </div>
            </div>`;
    },

    /**
     * Update PIP window UI
     */
    updatePipUI(pip, seconds, mode, running, totalSeconds) {
        if (!pip) return;
        const doc = pip.document;
        const timeEl = doc.getElementById('pipTime');
        const modeEl = doc.getElementById('pipMode');
        const modeDot = doc.getElementById('pipModeDot');
        const startPauseEl = doc.getElementById('pipStartPause');
        const ringEl = doc.getElementById('pipRing');
        if (timeEl && modeEl && startPauseEl) {
            timeEl.textContent = this.formatTime(seconds);
            modeEl.textContent = mode === 'work' ? 'Focus' : 'Break';
            startPauseEl.textContent = running ? 'Pause' : 'Start';
            if (modeDot) {
                const dotColor = mode === 'work' ? '#3b82f6' : '#10b981';
                modeDot.style.background = dotColor;
                modeDot.style.boxShadow = `0 0 12px ${dotColor}66`;
            }
            if (ringEl && totalSeconds) {
                const circumference = 2 * Math.PI * 40;
                const progress = Math.max(0, Math.min(1, seconds / totalSeconds));
                ringEl.style.stroke = mode === 'work' ? '#3b82f6' : '#10b981';
                ringEl.style.strokeDasharray = `${circumference}`;
                ringEl.style.strokeDashoffset = `${circumference * (1 - progress)}`;
            }
        }
    },

    /**
     * Get floating badge template
     */
    getBadgeTemplate() {
        return `
            <span id="badgeMode" style="font-size:12px;opacity:0.8"></span>
            <span id="badgeTime" style="font-size:18px;font-weight:700;letter-spacing:-0.5px"></span>
            <button id="badgeStartPause" style="padding:6px 10px;border:none;border-radius:8px;background:#2563eb;color:#fff;font-size:12px">Start</button>
            <button id="badgeReset" style="padding:6px 10px;border:1px solid #333;border-radius:8px;background:#222;color:#ddd;font-size:12px">Reset</button>
        `;
    },

    /**
     * Update floating badge UI
     */
    updateBadgeUI(badgeEl, seconds, mode, running) {
        if (!badgeEl) return;
        const timeEl = badgeEl.querySelector('#badgeTime');
        const modeEl = badgeEl.querySelector('#badgeMode');
        const spEl = badgeEl.querySelector('#badgeStartPause');
        if (!timeEl || !modeEl || !spEl) return;
        timeEl.textContent = this.formatTime(seconds);
        modeEl.textContent = mode === 'work' ? 'Focus' : 'Break';
        spEl.textContent = running ? 'Pause' : 'Start';
    },

    /**
     * Get carousel elements for animation
     */
    getCarouselElements() {
        const stackContainer = document.getElementById('questStack');
        const carousel = stackContainer?.querySelector('.quest-carousel');
        if (!carousel) return {};

        return {
            carousel,
            doneCard: carousel.querySelector('.carousel-card[data-role="done"]'),
            activeCard: carousel.querySelector('.carousel-card[data-role="active"]'),
            upcomingCard: carousel.querySelector('.carousel-card[data-role="upcoming"]'),
            behindCard: carousel.querySelector('.carousel-card[data-role="behind"]')
        };
    },

    /**
     * Get UI elements for event listener attachment
     */
    getListenerElements() {
        return {
            overlay: document.getElementById('focusOverlay'),
            closeBtn: document.getElementById('closeFocus'),
            sessionToggleBtn: document.getElementById('sessionToggleBtn'),
            stopSessionBtn: document.getElementById('stopSessionBtn'),
            decisionComplete: document.getElementById('decisionComplete'),
            decisionContinue: document.getElementById('decisionContinue'),
            decisionBreak: document.getElementById('decisionBreak'),
            decisionStop: document.getElementById('decisionStop'),
            soundToggle: document.getElementById('soundToggle'),
            navUp: document.getElementById('carouselNavUpBtn'),
            navDown: document.getElementById('carouselNavDownBtn'),
            completeBtn: document.getElementById('carouselCompleteBtn'),
            questCards: document.querySelectorAll('.carousel-card')
        };
    },

    /**
     * Update active step title in the UI
     */
    updateActiveStepTitle(task, currentStepIndex) {
        const activeTitle = document.getElementById('activeStepTitle');
        if (activeTitle) {
            activeTitle.textContent = this.getActiveStepTitle(task, currentStepIndex);
        }
    },

    /**
     * Remove initial transition block from carousel
     */
    removeCarouselInitialTransition() {
        const carousel = document.querySelector('#questStack .quest-carousel');
        carousel?.classList.remove('no-initial-transition');
    },

    /**
     * Set carousel animation state
     */
    setCarouselRolling(isRolling) {
        const carousel = document.querySelector('.quest-carousel');
        if (!carousel) return;
        
        if (isRolling) {
            carousel.classList.add('carousel-rolling');
            document.getElementById('carouselCompleteBtn')?.classList.add('hidden');
            document.getElementById('carouselNav')?.classList.add('hidden');
        } else {
            carousel.classList.remove('carousel-rolling');
        }
    },

    /**
     * Update quest stack container with new cards
     */
    updateQuestStack(task, currentStepIndex, onCardClick) {
        const stackContainer = document.getElementById('questStack');
        if (!stackContainer) return;
        stackContainer.innerHTML = this.getQuestStack(task, currentStepIndex);
        
        if (onCardClick) {
            this.setupCarouselListeners(stackContainer, onCardClick);
        }
        
        return stackContainer;
    },

    /**
     * Setup click and hover listeners for carousel cards
     */
    setupCarouselListeners(container, onCardClick) {
        const carousel = container.querySelector('.quest-carousel');
        if (!carousel) return;
        if (carousel.dataset.listenersAttached === 'true') return;
        carousel.dataset.listenersAttached = 'true';

        // Click listener for navigation (Event Delegation)
        carousel.addEventListener('click', (e) => {
            const card = e.target.closest('.carousel-card');
            if (!card || card.classList.contains('empty')) return;
            const idx = parseInt(card.dataset.index);
            if (Number.isNaN(idx) || idx < 0) return;
            
            if (onCardClick) onCardClick(idx);
        });

        // Hover effect listeners for 3D cards
        const cards = carousel.querySelectorAll('.carousel-card');
        cards.forEach(card => {
            card.addEventListener('mousemove', (e) => {
                this.updateCardHover(card, e);
            });
        });
    },

    /**
     * Set page overflow for focus mode
     */
    setPageOverflow(locked) {
        document.body.style.overflow = locked ? 'hidden' : '';
    },

    /**
     * Clear focus mode container
     */
    clearContainer() {
        const container = document.getElementById('focusModeContainer');
        if (container) container.innerHTML = '';
    },

    /**
     * Update card hover effect
     */
    updateCardHover(card, e) {
        const rect = card.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        card.style.setProperty('--mouse-x', `${x}%`);
        card.style.setProperty('--mouse-y', `${y}%`);
    },

    /**
     * Set up PiP window document styles and initial content
     */
    setupPipWindow(pip, onStartPause, onReset) {
        const doc = pip.document;
        doc.body.style.margin = '0';
        doc.body.style.fontFamily = 'system-ui, -apple-system, Segoe UI, Roboto, Arial';
        doc.body.innerHTML = this.getPipContent();

        doc.getElementById('pipStartPause')?.addEventListener('click', onStartPause);
        doc.getElementById('pipReset')?.addEventListener('click', onReset);
    },

    /**
     * Show/Create the floating badge
     */
    showBadge(pomodoroSeconds, pomodoroMode, pomodoroRunning, onStartPause, onReset) {
        if (this.badgeEl) return this.badgeEl;
        
        this.badgeEl = this.createBadge(onStartPause, onReset);
        this.updateBadge(pomodoroSeconds, pomodoroMode, pomodoroRunning);
        return this.badgeEl;
    },

    /**
     * Update the floating badge UI
     */
    updateBadge(seconds, mode, running) {
        if (!this.badgeEl) return;
        this.updateBadgeUI(this.badgeEl, seconds, mode, running);
        
        if (!running && seconds <= 0) {
            this.hideBadge();
        }
    },

    /**
     * Hide/Remove the floating badge
     */
    hideBadge() {
        if (this.badgeEl) {
            try { this.badgeEl.remove(); } catch { }
            this.badgeEl = null;
        }
    },

    /**
     * Create and initialize the floating badge element
     */
    createBadge(onStartPause, onReset) {
        const el = document.createElement('div');
        el.id = 'floatingPomodoroBadge';
        el.className = 'floating-badge glass-surface-deep';
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
        el.innerHTML = this.getBadgeTemplate();
        
        document.body.appendChild(el);

        // Position it
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

        // Setup listeners
        el.querySelector('#badgeStartPause')?.addEventListener('click', onStartPause);
        el.querySelector('#badgeReset')?.addEventListener('click', onReset);

        // Setup dragging
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
            if (e.target && e.target.closest('button')) return;
            dragging = true;
            startX = e.clientX;
            startY = e.clientY;
            const rect = el.getBoundingClientRect();
            startLeft = rect.left;
            startTop = rect.top;
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', endDrag);
        });

        return el;
    },

    /**
     * Show a brief notification for phase changes
     */
    showPhaseNotification(phase) {
        const container = document.querySelector('.focus-overlay');
        if (!container) return;

        const existing = document.getElementById('phaseNotification');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.id = 'phaseNotification';
        toast.className = 'phase-toast';
        
        let text = '';
        let icon = '';
        
        switch (phase) {
            case 'closure':
                text = 'Closure Phase: Wrapping up...';
                icon = '⏳';
                break;
            case 'execution':
                text = 'Execution Phase: Stay focused!';
                icon = '🎯';
                break;
            case 'orientation':
                text = 'Orientation: Preparing...';
                icon = '🗺️';
                break;
        }

        if (!text) return;

        toast.innerHTML = `<span class="toast-icon">${icon}</span><span class="toast-text">${text}</span>`;
        container.appendChild(toast);

        // Auto-remove after 3 seconds
        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => toast.remove(), 500);
        }, 3000);
    },

    /**
     * Update pomodoro start/pause button icon
     */
    updatePomodoroStartPauseButton(running) {
        const btn = document.getElementById('pomodoroStartPause');
        if (!btn) return;

        if (running) {
            btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <rect x="5" y="4" width="4" height="16"/>
                <rect x="15" y="4" width="4" height="16"/>
            </svg>`;
        } else {
            btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5,3 19,12 5,21"/>
            </svg>`;
        }
    }
};
