/**
 * FocusModeUI - Pure UI templates for FocusMode component
 */

import { Departments } from '../departments.js';
// import { PlannerService } from '../services/PlannerService.js';
import { FocusAudio } from '../utils/FocusAudio.js';
import { Store } from '../store.js';
import { DOMUtils } from '../utils/DOMUtils.js';

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
    getActiveStepTitle(task, currentStepIndex, isBreak = false) {
        if (isBreak) return 'Mandatory Break';
        if (!task || !task.notes) return 'Execute Phase';
        const lines = task.notes.split('\n').filter((l) => l.trim() !== '');
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

        // If task is fully completed, show celebration
        if (state.phase === 'completed') {
            DOMUtils.clear(display);
            display.appendChild(
                DOMUtils.createElement('span', {
                    className: 'completion-celebration',
                    textContent: '🏆',
                })
            );
            display.classList.add('timer-completed');
            display.classList.remove('timer-finished-pulse');
            const stepTitle = document.getElementById('activeStepTitle');
            const controls = document.querySelector('.ring-media-controls');
            if (stepTitle) {
                DOMUtils.clear(stepTitle);
                stepTitle.appendChild(
                    DOMUtils.createElement('span', {
                        className: 'completion-text',
                        textContent: 'All Done!',
                    })
                );
                stepTitle.classList.add('completion-title');
            }
            if (controls) controls.style.display = 'none';
            document.title = '🎉 All Done! – Focus Mode';
            return;
        }

        // Reset from completed state if needed
        display.classList.remove('timer-completed');
        const stepTitle = document.getElementById('activeStepTitle');
        const controls = document.querySelector('.ring-media-controls');
        if (stepTitle) stepTitle.classList.remove('completion-title');
        if (controls) controls.style.display = '';

        let secondsRemaining;
        if (state.mode === 'work') {
            const currentSessionElapsed = state.sessionStartTime
                ? Date.now() - state.sessionStartTime
                : 0;
            const totalElapsedMs = (state.accumulatedTime || 0) + currentSessionElapsed;
            secondsRemaining = Math.max(0, sessionDuration - Math.floor(totalElapsedMs / 1000));
        } else {
            const breakElapsed = state.breakStartTime
                ? Math.floor((Date.now() - state.breakStartTime) / 1000)
                : 0;
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
        const lines = (task.notes || '').split('\n').filter((l) => l.trim() !== '');
        const taskLines = lines.filter((l) => l.includes('[ ]') || l.includes('[x]'));
        const completedCount = taskLines.filter((l) => l.includes('[x]')).length;
        const totalCount = taskLines.length || 1;

        const outerCircumference = 2 * Math.PI * 56;
        const isTotalComplete = taskLines.length > 0 && taskLines.every((l) => l.includes('[x]'));

        // --- SEGMENTATION LOGIC ---
        if (totalCount > 1) {
            const strokeWidth = 4;
            const targetGap = 6; // Total visible gap between segments

            const segmentDash = outerCircumference / totalCount - targetGap;
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

        outerRing.style.opacity = completedCount > 0 ? '1' : '0.3';

        // Inner Ring: Session time progress
        const innerCircumference = 2 * Math.PI * 48;
        innerRing.style.strokeDasharray = innerCircumference;

        if (isTotalComplete || state.phase === 'completed') {
            innerRing.style.strokeDashoffset = 0;
            innerRing.style.opacity = '1';
        } else if (state.mode === 'work') {
            const currentSessionElapsed =
                state.running && state.sessionStartTime ? Date.now() - state.sessionStartTime : 0;
            const totalElapsedMs = (state.accumulatedTime || 0) + currentSessionElapsed;
            const innerProgress = Math.min(1, totalElapsedMs / (sessionDuration * 1000));

            innerRing.style.strokeDashoffset = innerCircumference * (1 - innerProgress);
            innerRing.style.opacity = state.running ? '1' : '0.5';
            innerRing.style.stroke = 'url(#innerGradient)';
        } else if (state.mode === 'break') {
            const breakElapsed = state.breakStartTime
                ? Math.floor((Date.now() - state.breakStartTime) / 1000)
                : 0;
            const breakDuration = 5 * 60; // 5 mins break
            const innerProgress = Math.min(1, breakElapsed / breakDuration);

            innerRing.style.strokeDashoffset = innerCircumference * (1 - innerProgress);
            innerRing.style.opacity = '1';
            innerRing.style.stroke = 'var(--accent-success)'; // Use green for break
        } else {
            innerRing.style.strokeDashoffset = innerCircumference;
            innerRing.style.opacity = '0.3';
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
                DOMUtils.clear(btn);
                btn.appendChild(
                    DOMUtils.createSVG('svg', { viewBox: '0 0 24 24', fill: 'currentColor' }, [
                        DOMUtils.createSVG('path', { d: 'M6 19h4V5H6v14zm8-14v14h4V5h-4z' }),
                    ])
                );
                btn.setAttribute('aria-label', 'Pause');
                btn.setAttribute('title', 'Pause');

                if (!stopBtn && mediaControls) {
                    const newStopBtn = DOMUtils.createElement(
                        'button',
                        {
                            className: 'ring-media-btn ring-media-stop',
                            id: 'stopSessionBtn',
                            'aria-label': 'Stop',
                            title: 'Stop',
                        },
                        [
                            DOMUtils.createSVG(
                                'svg',
                                { viewBox: '0 0 24 24', fill: 'currentColor' },
                                [DOMUtils.createSVG('path', { d: 'M6 6h12v12H6z' })]
                            ),
                        ]
                    );
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
                DOMUtils.clear(btn);
                btn.appendChild(
                    DOMUtils.createSVG('svg', { viewBox: '0 0 24 24', fill: 'currentColor' }, [
                        DOMUtils.createSVG('path', { d: 'M8 5v14l11-7z' }),
                    ])
                );
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
        btn.innerHTML = enabled
            ? `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 5L6 9H2v6h4l5 4V5z"/>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
            </svg>
        `
            : `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 5L6 9H2v6h4l5 4V5z"/>
                <line x1="23" y1="9" x2="17" y2="15"/>
                <line x1="17" y1="9" x2="23" y2="15"/>
            </svg>
        `;
    },

    /**
     * Get floating badge template
     */
    getBadgeTemplate() {
        return `
            <div id="focusBadge" class="focus-badge">
                <div class="focus-badge-pulse"></div>
                <div class="focus-badge-content">
                    <svg class="focus-badge-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <circle cx="12" cy="12" r="6" fill="currentColor" stroke="none"></circle>
                    </svg>
                    <span class="focus-badge-time" id="badgeTime">00:00</span>
                </div>
            </div>
        `;
    },

    /**
     * Show missing steps modal
     */
    showMissingStepsModal(onClose, onEdit) {
        // Remove any existing overlay
        document.getElementById('missingStepsOverlay')?.remove();

        const overlay = DOMUtils.createElement('div', {
            id: 'missingStepsOverlay',
            className: 'stop-confirm-overlay', // Re-use existing overlay style
            style: { zIndex: '2000' }
        });

        const modal = DOMUtils.createElement('div', { className: 'stop-confirm-modal' }, [
            DOMUtils.createElement('div', {
                className: 'stop-confirm-icon',
                textContent: '📝',
                style: { width: '48px', height: '48px', fontSize: '24px' }
            }),
            DOMUtils.createElement('div', {
                className: 'stop-confirm-title',
                textContent: 'Steps Required',
            }),
            DOMUtils.createElement('div', {
                className: 'stop-confirm-message',
                textContent: 'Please add some steps to your task before starting a Focus Session. This helps you stay on track!',
            }),
            DOMUtils.createElement('div', { className: 'stop-confirm-buttons' }, [
                DOMUtils.createElement('button', {
                    className: 'stop-confirm-btn cancel',
                    id: 'missingStepsCancel',
                    textContent: 'Cancel',
                }),
                DOMUtils.createElement('button', {
                    className: 'stop-confirm-btn confirm',
                    id: 'missingStepsEdit',
                    textContent: 'Edit Task',
                }),
            ]),
        ]);

        overlay.appendChild(modal);
        document.querySelector('.focus-overlay')?.appendChild(overlay);

        // Add listeners
        overlay.querySelector('#missingStepsCancel')?.addEventListener('click', (e) => {
            e.stopPropagation();
            overlay.remove();
            if (onClose) onClose();
        });

        overlay.querySelector('#missingStepsEdit')?.addEventListener('click', (e) => {
            e.stopPropagation();
            overlay.remove();
            if (onEdit) onEdit();
        });

        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.remove();
                if (onClose) onClose();
            }
        });
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

        const lines = (task?.notes || '').split('\n').filter((l) => l.trim() !== '');
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
        const resultsCard = document.querySelector('.results-card-container');

        if (ring) {
            ring.classList.add('success-flash');
            setTimeout(() => ring.classList.remove('success-flash'), 1000);
        } else if (resultsCard) {
            // Fallback for completion phase
            resultsCard.classList.add('success-flash');
            setTimeout(() => resultsCard.classList.remove('success-flash'), 1000);
        }

        const activeCard = document.querySelector('.carousel-card.active');
        if (activeCard) {
            activeCard.classList.add('step-complete-flash');
            setTimeout(() => activeCard.classList.remove('step-complete-flash'), 600);
        }
    },

    /**
     * Triumphant celebration for total task completion
     */
    celebrateVisuals() {
        const ring = document.getElementById('outerRing');
        const resultsCard = document.querySelector('.results-card-container');

        if (ring) {
            ring.classList.add('triumph-glow');
            setTimeout(() => ring.classList.remove('triumph-glow'), 2000);
        }

        if (resultsCard) {
            resultsCard.classList.add('triumph-glow-results');
            setTimeout(() => resultsCard.classList.remove('triumph-glow-results'), 2000);
        }
    },

    /**
     * Build inner HTML for a carousel card
     */
    getCarouselCardInner(stateClass, index, cleanText, isCompleted = false) {
        const stepLabel = index >= 0 ? `Step ${index + 1}` : '';
        const visualState = stateClass === 'below' ? 'done' : stateClass;

        const fragment = document.createDocumentFragment();

        let iconEl;
        if (isCompleted) {
            iconEl = DOMUtils.createElement('div', {
                className: 'carousel-icon done',
                textContent: '✓',
            });
        } else if (visualState === 'active') {
            iconEl = DOMUtils.createElement('div', {
                className: 'carousel-icon active',
                textContent: '●',
            });
        } else {
            iconEl = DOMUtils.createElement('div', {
                className: 'carousel-icon upcoming',
                textContent: '○',
            });
        }

        const completedClass = isCompleted ? 'is-completed' : '';
        const header = DOMUtils.createElement(
            'div',
            { className: `carousel-header ${completedClass}` },
            [
                iconEl,
                DOMUtils.createElement('div', {
                    className: 'carousel-step',
                    textContent: stepLabel,
                }),
            ]
        );

        if (visualState === 'active' && !isCompleted) {
            header.appendChild(
                DOMUtils.createElement('div', { className: 'carousel-badge', textContent: 'NOW' })
            );
        }

        fragment.appendChild(header);

        fragment.appendChild(
            DOMUtils.createElement('div', {
                className: `carousel-text ${completedClass}`,
                textContent: cleanText,
            })
        );

        return fragment;
    },

    /**
     * Quest stack 3D vertical carousel template
     */
    getQuestStack(task, activeIndex) {
        const notes = task.notes || '';
        const fragment = document.createDocumentFragment();

        if (!notes) {
            fragment.appendChild(
                DOMUtils.createElement('div', {
                    className: 'pills-empty',
                    textContent: 'Define your journey steps...',
                })
            );
            return fragment;
        }

        const lines = notes.split('\n').filter((l) => l.trim() !== '');
        if (lines.length === 0) {
            fragment.appendChild(
                DOMUtils.createElement('div', {
                    className: 'pills-empty',
                    textContent: 'Define your journey steps...',
                })
            );
            return fragment;
        }

        const prevDone = activeIndex - 1;
        const nextIndex = activeIndex + 1 < lines.length ? activeIndex + 1 : -1;
        const behindIndex = activeIndex + 2 < lines.length ? activeIndex + 2 : -1;

        const buildCard = (role, idx, depth) => {
            const card = DOMUtils.createElement('div', {
                className: `carousel-card ${role}`,
                dataset: { role, index: idx },
                style: { '--depth': depth },
            });

            if (idx === -1) {
                card.classList.add('empty');
                return card;
            }

            const raw = lines[idx];
            const isCompleted = raw.includes('[x]');
            const cleanText = raw.replace(/\[[ x]\]\s*/, '').trim();

            if (isCompleted) card.classList.add('is-completed');
            card.appendChild(this.getCarouselCardInner(role, idx, cleanText, isCompleted));
            return card;
        };

        const carousel = DOMUtils.createElement('div', {
            className: 'quest-carousel no-initial-transition',
            dataset: { carousel: 'drum' },
        });

        carousel.appendChild(buildCard('done', prevDone, 1));
        carousel.appendChild(buildCard('active', activeIndex, 0));
        carousel.appendChild(buildCard('upcoming', nextIndex, 1));
        carousel.appendChild(buildCard('behind', behindIndex, 2));

        fragment.appendChild(carousel);

        // Complete Button
        const completeBtn = DOMUtils.createElement(
            'button',
            {
                className: 'step-action-btn complete-btn carousel-complete-btn',
                id: 'carouselCompleteBtn',
                title: 'Mark step complete (Enter)',
            },
            [
                DOMUtils.createSVG(
                    'svg',
                    {
                        width: '16',
                        height: '16',
                        viewBox: '0 0 24 24',
                        fill: 'none',
                        stroke: 'currentColor',
                        'stroke-width': '2',
                    },
                    [DOMUtils.createSVG('path', { d: 'M20 6L9 17l-5-5' })]
                ),
                document.createTextNode(' Complete'),
            ]
        );
        fragment.appendChild(completeBtn);

        // Navigation
        const nav = DOMUtils.createElement(
            'div',
            {
                className: 'carousel-nav',
                id: 'carouselNav',
                'aria-label': 'Step navigation',
            },
            [
                DOMUtils.createElement(
                    'button',
                    {
                        className: 'carousel-nav-btn',
                        id: 'carouselNavUpBtn',
                        title: 'Previous step (↑)',
                        'aria-label': 'Previous step',
                    },
                    [
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
                            [DOMUtils.createSVG('path', { d: 'M12 5l-7 7h14l-7-7z' })]
                        ),
                    ]
                ),
                DOMUtils.createElement(
                    'button',
                    {
                        className: 'carousel-nav-btn',
                        id: 'carouselNavDownBtn',
                        title: 'Next step (↓)',
                        'aria-label': 'Next step',
                    },
                    [
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
                            [DOMUtils.createSVG('path', { d: 'M12 19l7-7H5l7 7z' })]
                        ),
                    ]
                ),
            ]
        );
        fragment.appendChild(nav);

        return fragment;
    },

    /**
     * Update a carousel card element's state and content
     */
    updateCarouselCard(cardEl, stateClass, index, lines) {
        cardEl.classList.remove(
            'active',
            'upcoming',
            'done',
            'behind',
            'below',
            'empty',
            'is-completed',
            'sliding-down',
            'sliding-to-active',
            'sliding-behind-to-upcoming',
            'sliding-out',
            'sliding-done-to-active',
            'sliding-active-to-upcoming',
            'sliding-upcoming-to-behind',
            'sliding-below-to-done'
        );
        cardEl.classList.add(stateClass);

        if (index === -1) {
            cardEl.classList.add('empty');
            cardEl.dataset.index = '-1';
            cardEl.style.setProperty('--depth', 1);
            DOMUtils.clear(cardEl);
            return;
        }

        const raw = lines[index] || '';
        const isCompleted = raw.includes('[x]');
        const cleanText = raw.replace(/\[[ x]\]\s*/, '').trim();

        if (isCompleted) {
            cardEl.classList.add('is-completed');
        }

        const depth =
            stateClass === 'active' ? 0 : stateClass === 'behind' || stateClass === 'below' ? 2 : 1;
        cardEl.dataset.index = String(index);
        cardEl.style.setProperty('--depth', depth);

        DOMUtils.clear(cardEl);
        cardEl.appendChild(this.getCarouselCardInner(stateClass, index, cleanText, isCompleted));
    },

    /**
     * Orchestrate forward roll animation
     */
    animateForwardRoll({ fromIndex, toIndex, task, onStepComplete, onFinish }) {
        const els = this.getCarouselElements();
        if (
            !els.carousel ||
            !els.doneCard ||
            !els.activeCard ||
            !els.upcomingCard ||
            !els.behindCard
        )
            return;

        const lines = (task.notes || '').split('\n').filter((l) => l.trim() !== '');

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

            this.finalizeForwardRoll(els, { fromIndex, toIndex, nextUpcoming, nextBehind }, lines);

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
        if (
            !els.carousel ||
            !els.doneCard ||
            !els.activeCard ||
            !els.upcomingCard ||
            !els.behindCard
        )
            return;

        const lines = (task.notes || '').split('\n').filter((l) => l.trim() !== '');

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

            this.finalizeBackwardRoll(els, { toIndex, nextDone, nextUpcoming, nextBehind }, lines);

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
        const subtitle =
            state.mode === 'break' ? 'Recharge before the next push.' : 'Choose how to continue.';

        const fragment = document.createDocumentFragment();

        const overlay = DOMUtils.createElement('div', { className: 'decision-overlay' }, [
            DOMUtils.createElement('div', { className: 'decision-card' }, [
                DOMUtils.createElement('div', { className: 'decision-title', textContent: title }),
                DOMUtils.createElement('div', {
                    className: 'decision-subtitle',
                    textContent: subtitle,
                }),
                // Primary Actions
                DOMUtils.createElement('div', { className: 'decision-actions primary-actions' }, [
                    DOMUtils.createElement(
                        'button',
                        { className: 'decision-btn primary', id: 'decisionComplete' },
                        [
                            DOMUtils.createSVG(
                                'svg',
                                {
                                    width: '20',
                                    height: '20',
                                    viewBox: '0 0 24 24',
                                    fill: 'none',
                                    stroke: 'currentColor',
                                    'stroke-width': '2',
                                },
                                [DOMUtils.createSVG('path', { d: 'M20 6L9 17l-5-5' })]
                            ),
                            document.createTextNode(' Mark step complete'),
                        ]
                    ),
                    DOMUtils.createElement(
                        'button',
                        { className: 'decision-btn', id: 'decisionContinue' },
                        [
                            DOMUtils.createSVG(
                                'svg',
                                {
                                    width: '20',
                                    height: '20',
                                    viewBox: '0 0 24 24',
                                    fill: 'none',
                                    stroke: 'currentColor',
                                    'stroke-width': '2',
                                },
                                [DOMUtils.createSVG('path', { d: 'M12 5v14l11-7z' })]
                            ),
                            document.createTextNode(' Continue this step'),
                        ]
                    ),
                ]),
                DOMUtils.createElement('div', { className: 'decision-divider' }),
                // Secondary Actions
                DOMUtils.createElement('div', { className: 'decision-actions secondary-actions' }, [
                    DOMUtils.createElement(
                        'button',
                        { className: 'decision-btn secondary', id: 'decisionBreak' },
                        [
                            DOMUtils.createSVG(
                                'svg',
                                {
                                    width: '20',
                                    height: '20',
                                    viewBox: '0 0 24 24',
                                    fill: 'none',
                                    stroke: 'currentColor',
                                    'stroke-width': '2',
                                },
                                [
                                    DOMUtils.createSVG('path', { d: 'M18 8h1a4 4 0 0 1 0 8h-1' }),
                                    DOMUtils.createSVG('path', {
                                        d: 'M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z',
                                    }),
                                    DOMUtils.createSVG('line', {
                                        x1: '6',
                                        y1: '1',
                                        x2: '6',
                                        y2: '4',
                                    }),
                                    DOMUtils.createSVG('line', {
                                        x1: '10',
                                        y1: '1',
                                        x2: '10',
                                        y2: '4',
                                    }),
                                    DOMUtils.createSVG('line', {
                                        x1: '14',
                                        y1: '1',
                                        x2: '14',
                                        y2: '4',
                                    }),
                                ]
                            ),
                            document.createTextNode(' Take a break'),
                        ]
                    ),
                    DOMUtils.createElement(
                        'button',
                        { className: 'decision-btn secondary', id: 'decisionStop' },
                        [
                            DOMUtils.createSVG(
                                'svg',
                                {
                                    width: '20',
                                    height: '20',
                                    viewBox: '0 0 24 24',
                                    fill: 'none',
                                    stroke: 'currentColor',
                                    'stroke-width': '2',
                                },
                                [
                                    DOMUtils.createSVG('path', {
                                        d: 'M18.36 6.64a9 9 0 1 1-12.73 0',
                                    }),
                                    DOMUtils.createSVG('line', {
                                        x1: '12',
                                        y1: '2',
                                        x2: '12',
                                        y2: '12',
                                    }),
                                ]
                            ),
                            document.createTextNode(' End Focus session'),
                        ]
                    ),
                ]),
            ]),
        ]);

        fragment.appendChild(overlay);
        return fragment;
    },

    /**
     * Show stop confirmation overlay
     */
    showStopConfirmation(onConfirm) {
        // Remove any existing confirmation
        document.getElementById('stopConfirmOverlay')?.remove();

        const overlay = DOMUtils.createElement('div', {
            id: 'stopConfirmOverlay',
            className: 'stop-confirm-overlay',
        });

        const modal = DOMUtils.createElement('div', { className: 'stop-confirm-modal' }, [
            DOMUtils.createElement('div', { className: 'stop-confirm-icon', textContent: '🔄' }),
            DOMUtils.createElement('div', {
                className: 'stop-confirm-title',
                textContent: 'Reset Timer?',
            }),
            DOMUtils.createElement('div', {
                className: 'stop-confirm-message',
                textContent: 'Timer will go back to 25:00. Your steps will stay.',
            }),
            DOMUtils.createElement('div', { className: 'stop-confirm-buttons' }, [
                DOMUtils.createElement('button', {
                    className: 'stop-confirm-btn cancel',
                    id: 'stopConfirmCancel',
                    textContent: 'Cancel',
                }),
                DOMUtils.createElement('button', {
                    className: 'stop-confirm-btn confirm',
                    id: 'stopConfirmYes',
                    textContent: 'Reset',
                }),
            ]),
        ]);

        overlay.appendChild(modal);

        document.querySelector('.focus-overlay')?.appendChild(overlay);

        // Add listeners
        overlay.querySelector('#stopConfirmCancel')?.addEventListener('click', () => {
            overlay.remove();
        });

        overlay.querySelector('#stopConfirmYes')?.addEventListener('click', () => {
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
        // Fallback to focus-card if rings container is hidden
        const container =
            document.querySelector('.execution-rings-container') ||
            document.querySelector('.focus-card');
        if (!container) return;

        const colors = ['#3b82f6', 'var(--accent-success)', '#fbbf24', '#f87171', '#a78bfa'];
        const particleCount = 60; // Increased for better effect

        for (let i = 0; i < particleCount; i++) {
            const particle = document.createElement('div');
            particle.className = 'confetti-particle';

            const color = colors[Math.floor(Math.random() * colors.length)];
            const left = Math.random() * 100;
            const size = 6 + Math.random() * 8; // Slightly larger
            const duration = 2 + Math.random() * 2; // Longer fall
            const delay = Math.random() * 0.8;

            particle.style.backgroundColor = color;
            particle.style.left = `${left}%`;
            particle.style.top = `-20px`; // Start slightly higher
            particle.style.width = `${size}px`;
            particle.style.height = `${size}px`;
            particle.style.animationDuration = `${duration}s`;
            particle.style.animationDelay = `${delay}s`;
            particle.style.zIndex = '1000'; // Ensure it's on top

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
        if (
            !carousel ||
            !activeCard ||
            activeCard.classList.contains('is-completed') ||
            carousel.classList.contains('carousel-rolling')
        ) {
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

        const scaleX = stackContainer.offsetWidth
            ? stackRect.width / stackContainer.offsetWidth
            : 1;
        const scaleY = stackContainer.offsetHeight
            ? stackRect.height / stackContainer.offsetHeight
            : 1;

        const cardLeft = (cardRect.left - stackRect.left) / scaleX;
        const cardTop = (cardRect.top - stackRect.top) / scaleY;
        const cardWidth = cardRect.width / scaleX;
        const cardHeight = cardRect.height / scaleY;

        const isNarrow = window.innerWidth <= 520;
        const inset = 16;

        btn.classList.remove('hidden');

        if (isNarrow) {
            // Mobile: Position on the right side of the bottom to leave room for nav on the left
            const navTotalWidth = 36 * 2 + 8 + 10; // (btn width * 2) + gap between arrows + gap to complete btn
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

        const scaleX = stackContainer.offsetWidth
            ? stackRect.width / stackContainer.offsetWidth
            : 1;
        const scaleY = stackContainer.offsetHeight
            ? stackRect.height / stackContainer.offsetHeight
            : 1;

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
            navTop = cardTop + cardHeight / 2;
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

        const fragment = document.createDocumentFragment();

        const overlay = DOMUtils.createElement('div', {
            className: `focus-overlay phase-${state.phase}`,
            id: 'focusOverlay',
        });

        // Ambient Background
        overlay.appendChild(
            DOMUtils.createElement('div', { className: 'focus-ambient-bg' }, [
                DOMUtils.createElement('div', {
                    className: 'ambient-blob blob-1',
                    style: { background: color },
                }),
                DOMUtils.createElement('div', {
                    className: 'ambient-blob blob-2',
                    style: { background: color },
                }),
                DOMUtils.createElement('div', {
                    className: 'ambient-blob blob-3',
                    style: { background: color },
                }),
                DOMUtils.createElement('div', { className: 'focus-particles' }),
            ])
        );

        const card = DOMUtils.createElement('div', {
            className: 'focus-card glass-surface-deep',
            style: { '--task-color': color },
        });

        // Close Button
        card.appendChild(
            DOMUtils.createElement('button', { className: 'focus-close', id: 'closeFocus' }, [
                DOMUtils.createSVG(
                    'svg',
                    {
                        width: '24',
                        height: '24',
                        viewBox: '0 0 24 24',
                        fill: 'none',
                        stroke: 'currentColor',
                        'stroke-width': '2',
                    },
                    [DOMUtils.createSVG('path', { d: 'M18 6L6 18M6 6l12 12' })]
                ),
            ])
        );

        // Sound Toggle
        const soundBtn = DOMUtils.createElement('button', {
            className: `focus-sound-toggle ${FocusAudio.isEnabled() ? '' : 'muted'}`,
            id: 'soundToggle',
            title: FocusAudio.isEnabled() ? 'Mute sounds' : 'Enable sounds',
        });
        if (FocusAudio.isEnabled()) {
            soundBtn.appendChild(
                DOMUtils.createSVG(
                    'svg',
                    {
                        width: '20',
                        height: '20',
                        viewBox: '0 0 24 24',
                        fill: 'none',
                        stroke: 'currentColor',
                        'stroke-width': '2',
                    },
                    [
                        DOMUtils.createSVG('path', { d: 'M11 5L6 9H2v6h4l5 4V5z' }),
                        DOMUtils.createSVG('path', {
                            d: 'M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07',
                        }),
                    ]
                )
            );
        } else {
            soundBtn.appendChild(
                DOMUtils.createSVG(
                    'svg',
                    {
                        width: '20',
                        height: '20',
                        viewBox: '0 0 24 24',
                        fill: 'none',
                        stroke: 'currentColor',
                        'stroke-width': '2',
                    },
                    [
                        DOMUtils.createSVG('path', { d: 'M11 5L6 9H2v6h4l5 4V5z' }),
                        DOMUtils.createSVG('line', { x1: '23', y1: '9', x2: '17', y2: '15' }),
                        DOMUtils.createSVG('line', { x1: '17', y1: '9', x2: '23', y2: '15' }),
                    ]
                )
            );
        }
        card.appendChild(soundBtn);

        // Header
        const header = DOMUtils.createElement('div', { className: 'focus-header-topleft' }, [
            DOMUtils.createElement('span', {
                className: 'focus-title',
                id: 'focusTaskTitle',
                textContent: task.title,
            }),
        ]);
        if (streak > 0) {
            header.appendChild(
                DOMUtils.createElement('span', {
                    className: 'focus-streak-badge',
                    title: `Focus streak: ${streak} day${streak > 1 ? 's' : ''}`,
                    textContent: `🔥 ${streak}`,
                })
            );
        }
        card.appendChild(header);

        // Focus Engine Side
        const engineSide = DOMUtils.createElement('div', { className: 'focus-engine-side' });

        if (state.phase !== 'completed') {
            const ringsContainer = DOMUtils.createElement('div', {
                className: `execution-rings-container`,
            });
            const flipSurface = DOMUtils.createElement('div', { className: 'ring-flip-surface' });

            // Front Face
            const frontFace = DOMUtils.createElement('div', {
                className: 'ring-face ring-face-front',
            });

            // SVG Rings
            const svg = DOMUtils.createSVG('svg', {
                className: 'execution-ring-svg',
                viewBox: '0 0 120 120',
                style: {
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    transform: 'rotate(-90deg)',
                },
            });
            // Defs
            const defs = DOMUtils.createSVG('defs');
            const grad1 = DOMUtils.createSVG('linearGradient', {
                id: 'outerGradient',
                x1: '0%',
                y1: '0%',
                x2: '100%',
                y2: '100%',
            });
            grad1.appendChild(
                DOMUtils.createSVG('stop', {
                    offset: '0%',
                    'stop-color': 'var(--task-color)',
                    'stop-opacity': '0.4',
                })
            );
            grad1.appendChild(
                DOMUtils.createSVG('stop', {
                    offset: '100%',
                    'stop-color': 'var(--task-color)',
                    'stop-opacity': '1',
                })
            );
            defs.appendChild(grad1);

            const grad2 = DOMUtils.createSVG('linearGradient', {
                id: 'innerGradient',
                x1: '0%',
                y1: '0%',
                x2: '0%',
                y2: '100%',
            });
            grad2.appendChild(DOMUtils.createSVG('stop', { offset: '0%', 'stop-color': 'white' }));
            grad2.appendChild(
                DOMUtils.createSVG('stop', {
                    offset: '100%',
                    'stop-color': 'var(--task-color)',
                })
            );
            defs.appendChild(grad2);

            const filter = DOMUtils.createSVG('filter', { id: 'innerGlow' });
            filter.appendChild(
                DOMUtils.createSVG('feGaussianBlur', { stdDeviation: '2', result: 'blur' })
            );
            filter.appendChild(
                DOMUtils.createSVG('feComposite', {
                    in: 'SourceGraphic',
                    in2: 'blur',
                    operator: 'over',
                })
            );
            defs.appendChild(filter);
            svg.appendChild(defs);

            svg.appendChild(
                DOMUtils.createSVG('circle', {
                    className: 'outer-ring-bg',
                    cx: '60',
                    cy: '60',
                    r: '56',
                })
            );
            svg.appendChild(
                DOMUtils.createSVG('circle', {
                    className: 'outer-ring-fill',
                    id: 'outerRing',
                    cx: '60',
                    cy: '60',
                    r: '56',
                    stroke: 'url(#outerGradient)',
                })
            );
            svg.appendChild(
                DOMUtils.createSVG('circle', {
                    className: 'inner-ring-bg',
                    cx: '60',
                    cy: '60',
                    r: '48',
                })
            );
            svg.appendChild(
                DOMUtils.createSVG('circle', {
                    className: 'inner-ring-fill',
                    id: 'innerRing',
                    cx: '60',
                    cy: '60',
                    r: '48',
                    stroke: 'url(#innerGradient)',
                })
            );
            frontFace.appendChild(svg);

            // Ring Center
            const center = DOMUtils.createElement('div', { className: 'ring-center' }, [
                DOMUtils.createElement('div', {
                    className: 'ring-step-title',
                    id: 'activeStepTitle',
                    textContent: state.mode === 'work' ? activeStepTitle : 'Coffee & Recharge',
                }),
                DOMUtils.createElement('div', {
                    className: 'ring-time',
                    id: 'sessionTimeDisplay',
                    textContent: '00:00',
                }),
            ]);

            const controls = DOMUtils.createElement('div', {
                className: 'ring-media-controls',
                'aria-label': 'Focus controls',
            });
            const toggleBtn = DOMUtils.createElement('button', {
                className: `ring-media-btn ring-media-primary ${state.running ? 'running' : ''}`,
                id: 'sessionToggleBtn',
                'aria-label': state.running
                    ? 'Pause'
                    : (state.accumulatedTime || 0) > 0
                        ? 'Resume'
                        : 'Start Focus',
                title: state.running
                    ? 'Pause'
                    : (state.accumulatedTime || 0) > 0
                        ? 'Resume'
                        : 'Start Focus',
            });
            if (!state.running) {
                toggleBtn.appendChild(
                    DOMUtils.createSVG('svg', { viewBox: '0 0 24 24', fill: 'currentColor' }, [
                        DOMUtils.createSVG('path', { d: 'M8 5v14l11-7z' }),
                    ])
                );
            } else {
                toggleBtn.appendChild(
                    DOMUtils.createSVG('svg', { viewBox: '0 0 24 24', fill: 'currentColor' }, [
                        DOMUtils.createSVG('path', { d: 'M6 19h4V5H6v14zm8-14v14h4V5h-4z' }),
                    ])
                );
            }
            controls.appendChild(toggleBtn);

            if (state.running) {
                const stopBtn = DOMUtils.createElement('button', {
                    className: 'ring-media-btn ring-media-stop',
                    id: 'stopSessionBtn',
                    'aria-label': 'Stop',
                    title: 'Stop',
                });
                stopBtn.appendChild(
                    DOMUtils.createSVG('svg', { viewBox: '0 0 24 24', fill: 'currentColor' }, [
                        DOMUtils.createSVG('path', { d: 'M6 6h12v12H6z' }),
                    ])
                );
                controls.appendChild(stopBtn);
            }
            center.appendChild(controls);
            frontFace.appendChild(center);

            flipSurface.appendChild(frontFace);

            // Back Face
            const backFace = DOMUtils.createElement('div', {
                className: 'ring-face ring-face-back',
            });
            if (state.phase === 'decision') {
                backFace.appendChild(this.getDecisionOverlay(state));
            }
            flipSurface.appendChild(backFace);

            ringsContainer.appendChild(flipSurface);
            engineSide.appendChild(ringsContainer);
        }

        const stackContainer = DOMUtils.createElement('div', {
            className: 'quest-stack-container',
            id: 'questStack',
        });
        if (state.phase === 'completed') {
            stackContainer.appendChild(this.getResultsCard(state));
        } else {
            stackContainer.appendChild(this.getQuestStack(task, state.currentStepIndex));
        }
        engineSide.appendChild(stackContainer);

        card.appendChild(engineSide);
        overlay.appendChild(card);

        fragment.appendChild(overlay);
        return fragment;
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
            ringEl.style.stroke = 'var(--accent-success)';
        }
    },

    /**
     * Get PIP window content
     */
    /**
     * Get PIP window content
     */
    getPipContent() {
        return `
            <div id="pipRoot" style="display:flex;flex-direction:column;align-items:center;gap:10px;padding:14px;background:linear-gradient(160deg,#0f1117 0%,#05080f 100%);color:#f0f6fc;height:100%;box-sizing:border-box;border-radius:0;font-family:'Outfit',system-ui,sans-serif;">
                <div style="display:flex;align-items:center;gap:8px;">
                    <div id="pipModeDot" style="width:8px;height:8px;border-radius:999px;background:#6366f1;box-shadow:0 0 12px rgba(99,102,241,0.6);"></div>
                    <div id="pipMode" style="font-size:11px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#8b949e;"></div>
                </div>
                <div style="position:relative;width:96px;height:96px;display:flex;align-items:center;justify-content:center;">
                    <svg width="96" height="96" viewBox="0 0 96 96" style="position:absolute;inset:0;">
                        <circle cx="48" cy="48" r="40" stroke="rgba(240,246,252,0.1)" stroke-width="6" fill="none"></circle>
                        <circle id="pipRing" cx="48" cy="48" r="40" stroke="#6366f1" stroke-width="6" fill="none" stroke-linecap="round" transform="rotate(-90 48 48)"></circle>
                    </svg>
                    <div id="pipTime" style="font-size:24px;font-weight:700;letter-spacing:-0.5px;color:#f0f6fc;text-shadow:0 0 20px rgba(99,102,241,0.2)"></div>
                </div>
                <div style="display:flex;gap:8px;">
                    <button id="pipStartPause" style="padding:7px 14px;border:none;border-radius:100px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;font-weight:600;font-size:12px;box-shadow:0 4px 12px rgba(99,102,241,0.3);cursor:pointer;">Start</button>
                    <button id="pipReset" style="padding:7px 14px;border:1px solid rgba(240,246,252,0.1);border-radius:100px;background:rgba(255,255,255,0.05);color:#8b949e;font-weight:600;font-size:12px;cursor:pointer;">Reset</button>
                    <button id="pipExpand" style="padding:7px;border:1px solid rgba(240,246,252,0.1);border-radius:100px;background:rgba(255,255,255,0.05);color:#8b949e;display:flex;align-items:center;justify-content:center;cursor:pointer;" title="Return to App">
                         <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>
                    </button>
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
        if (timeEl && startPauseEl) {
            timeEl.textContent = this.formatTime(seconds);
            if (modeEl) modeEl.textContent = mode === 'work' ? 'Focus' : 'Break';

            // Toggle Icon for Start/Pause
            if (running) {
                // Pause Icon
                startPauseEl.innerHTML = '<svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6zm8 0h4v16h-4z"/></svg>';
            } else {
                // Play Icon
                startPauseEl.innerHTML = '<svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
            }

            if (modeDot) {
                const dotColor = mode === 'work' ? '#3b82f6' : 'var(--accent-success)';
                modeDot.style.background = dotColor;
                modeDot.style.boxShadow = `0 0 12px ${dotColor}66`;
            }
            // Radius is now 54
            const circumference = 2 * Math.PI * 54;
            // Invert progress so it acts as a countdown (stroke shrinks) or fill (stroke grows)
            // Let's make it shrink as time goes down (standard timer)
            // seconds starts at totalSeconds and goes to 0
            const progress = seconds / totalSeconds;

            ringEl.style.strokeDasharray = `${circumference}`;
            ringEl.style.strokeDashoffset = `${circumference * (1 - progress)}`;
        }
    },

    /**
     * Get floating badge template
     */
    getBadgeTemplate() {
        return `
            <span id="badgeMode" class="badge-mode"></span>
            <span id="badgeTime" class="badge-time"></span>
            <div class="badge-controls">
                <button id="badgeStartPause" class="badge-btn badge-btn-primary">Start</button>
                <button id="badgeReset" class="badge-btn badge-btn-secondary">Reset</button>
            </div>
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
     * Update Pomodoro counter display in UI
     * Shows progress like "🍅 2/4" toward long break
     */
    updatePomodoroCounter(completed, total, todayTotal) {
        // If phase is completed, hide tomatoes (as requested by user)
        const activeExec = Store.getActiveExecution();
        if (activeExec && activeExec.phase === 'completed') {
            const el = document.getElementById('pomodoroCounterDisplay');
            if (el) el.style.display = 'none';
            return;
        }

        // Update or create counter in the ring center area
        let counterEl = document.getElementById('pomodoroCounterDisplay');
        const ringCenter = document.querySelector('.ring-center');

        if (!counterEl && ringCenter) {
            counterEl = DOMUtils.createElement('div', {
                id: 'pomodoroCounterDisplay',
                className: 'pomodoro-counter-display',
            });
            ringCenter.insertBefore(counterEl, ringCenter.firstChild);
        }

        if (counterEl) {
            counterEl.style.display = ''; // Ensure visible
            const tomatoes = '🍅'.repeat(completed);
            const empty = '⚪'.repeat(total - completed);
            const isNearLongBreak = completed >= total - 1 && completed > 0;

            DOMUtils.clear(counterEl);
            counterEl.appendChild(
                DOMUtils.createElement(
                    'div',
                    { className: `pomodoro-dots ${isNearLongBreak ? 'near-long-break' : ''}` },
                    [document.createTextNode(`${tomatoes}${empty}`)]
                )
            );
            counterEl.appendChild(
                DOMUtils.createElement('div', {
                    className: 'pomodoro-count-text',
                    textContent: `${completed}/${total}`,
                })
            );
            if (todayTotal > 0) {
                counterEl.appendChild(
                    DOMUtils.createElement('div', {
                        className: 'pomodoro-today-total',
                        textContent: `Today: ${todayTotal}`,
                    })
                );
            }
        }

        // Also update floating badge if visible
        const badge = document.getElementById('floatingPomodoroBadge');
        if (badge) {
            let badgeCounter = badge.querySelector('#badgeCounter');
            if (!badgeCounter) {
                badgeCounter = DOMUtils.createElement('span', {
                    id: 'badgeCounter',
                    style: { fontSize: '14px', marginRight: '4px' },
                });
                badge.insertBefore(badgeCounter, badge.firstChild);
            }
            badgeCounter.textContent = `🍅${completed}/${total}`;
        }
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
            behindCard: carousel.querySelector('.carousel-card[data-role="behind"]'),
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
            questCards: document.querySelectorAll('.carousel-card'),
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

        const state = Store.getActiveExecution();
        DOMUtils.clear(stackContainer);

        if (state.phase === 'completed') {
            stackContainer.appendChild(this.getResultsCard(state));
        } else {
            stackContainer.appendChild(this.getQuestStack(task, currentStepIndex));
            if (onCardClick) {
                this.setupCarouselListeners(stackContainer, onCardClick);
            }
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
        cards.forEach((card) => {
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
    setupPipWindow(pip, onStartPause, onReset, onRestore) {
        console.log('[FocusModeUI] Setting up PiP Window (DOM API Version)', { pip });
        const doc = pip.document;

        // Clear existing
        doc.body.innerHTML = '';

        doc.body.style.margin = '0';
        doc.body.style.height = '100vh';
        doc.body.style.fontFamily = 'system-ui, -apple-system, Segoe UI, Roboto, Arial';
        doc.body.style.userSelect = 'none';
        doc.body.style.background = '#0f1117'; // Fallback

        // Build DOM structure manually if not using innerHTML (which we are partially doing above)
        // But since getPipContent() is used elsewhere for `innerHTML`, let's verify if this method is used for Web or Tauri logic
        // The `setupPipWindow` viewed previously (lines 1932+) builds DOM manually.
        // We need to add the button to the DOM construction block.

        // Re-reading file content... wait, the previous `get_file` showed `setupPipWindow` line 1932 using `createElement`.
        // My previous edit (above) was to `getPipContent` which returns a string.
        // `setupPipWindow` seems to be doing manual DOM creation primarily for the test/fallback flow?
        // Let's look at `setupPipWindow` again. It has manual DOM creation.
        // The `getPipContent` string is likely used by `main.js` or fallback.
        // `FocusMode.js` calls `FocusModeUI.setupPipWindow(pip...)`.
        // So we must update the Manual DOM creation part too.

        // Root Container - Minimize padding for tighter fit
        const root = doc.createElement('div');
        root.id = 'pipRoot';
        root.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;box-sizing:border-box;background:#0f1117;color:#f0f6fc;font-family:Outfit,system-ui,sans-serif;overflow:hidden;position:relative;';

        // Container for the Circle
        const timerContainer = doc.createElement('div');
        timerContainer.style.cssText = 'position:relative;display:flex;align-items:center;justify-content:center;margin-bottom:8px;';

        // SVG Ring
        const ns = 'http://www.w3.org/2000/svg';
        const svg = doc.createElementNS(ns, 'svg');
        svg.setAttribute('width', '140'); // Larger ring
        svg.setAttribute('height', '140');
        svg.setAttribute('viewBox', '0 0 120 120');
        svg.style.cssText = 'transform: rotate(-90deg);';

        const circleBg = doc.createElementNS(ns, 'circle');
        circleBg.setAttribute('cx', '60');
        circleBg.setAttribute('cy', '60');
        circleBg.setAttribute('r', '54'); // Maximize size
        circleBg.setAttribute('stroke', 'rgba(255,255,255,0.08)');
        circleBg.setAttribute('stroke-width', '6');
        circleBg.setAttribute('fill', 'none');

        const circleRing = doc.createElementNS(ns, 'circle');
        circleRing.id = 'pipRing';
        circleRing.setAttribute('cx', '60');
        circleRing.setAttribute('cy', '60');
        circleRing.setAttribute('r', '54');
        circleRing.setAttribute('stroke', '#6366f1');
        circleRing.setAttribute('stroke-width', '6');
        circleRing.setAttribute('fill', 'none');
        circleRing.setAttribute('stroke-linecap', 'round');

        svg.appendChild(circleBg);
        svg.appendChild(circleRing);
        timerContainer.appendChild(svg);

        // Time Text - Centered Absolute
        const timeText = doc.createElement('div');
        timeText.id = 'pipTime';
        timeText.textContent = '--:--';
        timeText.style.cssText = 'position:absolute;font-size:28px;font-weight:700;letter-spacing:-1px;color:#fff;text-shadow:0 0 20px rgba(99,102,241,0.4);';
        timerContainer.appendChild(timeText);

        root.appendChild(timerContainer);

        // Controls - Floating at bottom or compact
        const controls = doc.createElement('div');
        controls.style.cssText = 'display:flex;gap:12px;z-index:10;';

        // Helper style for icon buttons
        const btnStyle = 'width:32px;height:32px;border:none;border-radius:50%;background:rgba(255,255,255,0.1);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background 0.2s;';

        const startBtn = doc.createElement('button');
        startBtn.id = 'pipStartPause';
        // Initial Icon (valid SVG)
        startBtn.innerHTML = '<svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
        startBtn.style.cssText = btnStyle + 'background:#6366f1;box-shadow:0 4px 12px rgba(99,102,241,0.3);';

        const resetBtn = doc.createElement('button');
        resetBtn.id = 'pipReset';
        resetBtn.title = 'Reset';
        resetBtn.innerHTML = '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>';
        resetBtn.style.cssText = btnStyle;

        const expandBtn = doc.createElement('button');
        expandBtn.id = 'pipExpand';
        expandBtn.title = 'Return to App';
        expandBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>';
        expandBtn.style.cssText = btnStyle;

        controls.appendChild(resetBtn);
        controls.appendChild(startBtn);
        controls.appendChild(expandBtn);
        root.appendChild(controls);

        // Append root to body
        doc.body.appendChild(root);

        // Attach listeners directly to elements we just created
        console.log('[FocusModeUI] Attaching listeners to created elements');

        // Use both onclick and addEventListener for redundancy
        startBtn.onclick = (e) => {
            console.log('[FocusModeUI] PiP Start Clicked (onclick)');
            e.preventDefault();
            e.stopPropagation();
            onStartPause(e);
        };

        resetBtn.onclick = (e) => {
            console.log('[FocusModeUI] PiP Reset Clicked (onclick)');
            e.preventDefault();
            e.stopPropagation();
            onReset(e);
        };

        expandBtn.onclick = (e) => {
            console.log('[FocusModeUI] PiP Expand Clicked (onclick)');
            e.preventDefault();
            e.stopPropagation();
            onRestore(e);
        };

        // Double click on body
        const handleRestore = (e) => {
            console.log('[FocusModeUI] PiP Body Double Clicked');
            // Ignore if clicking on buttons
            if (e.target.closest('button')) return;
            onRestore(e);
        };

        doc.body.addEventListener('dblclick', handleRestore);
        root.addEventListener('dblclick', handleRestore);
    },

    /**
     * Show/Create the floating badge
     */
    showBadge(pomodoroSeconds, pomodoroMode, pomodoroRunning, onStartPause, onReset, onOpen) {
        if (this.badgeEl) return this.badgeEl;

        this.badgeEl = this.createBadge(onStartPause, onReset, onOpen);
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
            try {
                this.badgeEl.remove();
            } catch {
                // Ignore removal errors
            }
            this.badgeEl = null;
        }
    },

    /**
     * Create and initialize the floating badge element
     */
    createBadge(onStartPause, onReset, onOpen) {
        const el = document.createElement('div');
        el.id = 'floatingPomodoroBadge';
        el.className = 'floating-badge glass-surface-deep';

        // Use template
        el.innerHTML = this.getBadgeTemplate();

        // Position it
        const savedPos = (() => {
            try {
                return JSON.parse(localStorage.getItem('floatingPomodoroBadgePos') || 'null');
            } catch {
                return null;
            }
        })();

        // Initial Styles
        el.style.position = 'fixed';
        el.style.zIndex = '9999';
        el.style.width = 'auto'; // Auto width to fit content
        el.style.height = 'auto';
        el.style.minWidth = '320px';
        el.style.maxWidth = '450px';
        el.style.boxSizing = 'border-box';
        el.style.cursor = 'grab';

        if (savedPos && typeof savedPos.left === 'number' && typeof savedPos.top === 'number') {
            el.style.left = `${savedPos.left}px`;
            el.style.top = `${savedPos.top}px`;
            el.style.bottom = 'auto';
            el.style.right = 'auto';
        } else {
            el.style.left = '20px';
            el.style.bottom = '20px';
        }

        document.body.appendChild(el);

        // Wire up buttons with stopPropagation to prevent opening the full mode
        const startPauseBtn = el.querySelector('#badgeStartPause');
        const resetBtn = el.querySelector('#badgeReset');

        if (startPauseBtn && onStartPause) {
            startPauseBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                onStartPause();
            });
        }

        if (resetBtn && onReset) {
            resetBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                onReset();
            });
        }

        // Double click to open
        if (onOpen) {
            el.addEventListener('dblclick', (e) => {
                // Prevent interfering with buttons
                if (e.target.closest('button')) return;
                onOpen();
            });
        }

        // Drag Logic
        let isDragging = false;
        let dragStartX, dragStartY, initialLeft, initialTop;

        el.addEventListener('mousedown', (e) => {
            // Allow clicking buttons (and their children icons) inside without dragging
            if (e.target.closest('button') || e.target.closest('.badge-btn')) return;

            isDragging = true;
            dragStartX = e.clientX;
            dragStartY = e.clientY;

            const rect = el.getBoundingClientRect();
            initialLeft = rect.left;
            initialTop = rect.top;

            el.style.cursor = 'grabbing';
            el.style.transition = 'none'; // Disable transition for smooth drag
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            e.preventDefault(); // Prevent text selection

            const dx = e.clientX - dragStartX;
            const dy = e.clientY - dragStartY;

            // Remove bottom positioning if we start dragging to rely on top/left
            if (el.style.bottom) {
                el.style.bottom = 'auto'; // Clear bottom constraint
                el.style.top = `${initialTop}px`; // Lock to current visual top
            }

            el.style.left = `${initialLeft + dx}px`;
            el.style.top = `${initialTop + dy}px`;
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                el.style.cursor = 'grab';

                // Save position
                const rect = el.getBoundingClientRect();
                localStorage.setItem('floatingPomodoroBadgePos', JSON.stringify({
                    left: rect.left,
                    top: rect.top
                }));
            }
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

        const toast = DOMUtils.createElement('div', {
            id: 'phaseNotification',
            className: 'phase-toast',
        });

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

        toast.appendChild(
            DOMUtils.createElement('span', { className: 'toast-icon', textContent: icon })
        );
        toast.appendChild(
            DOMUtils.createElement('span', { className: 'toast-text', textContent: text })
        );

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

        DOMUtils.clear(btn);

        if (running) {
            btn.appendChild(
                DOMUtils.createSVG(
                    'svg',
                    { width: '20', height: '20', viewBox: '0 0 24 24', fill: 'currentColor' },
                    [
                        DOMUtils.createSVG('rect', { x: '5', y: '4', width: '4', height: '16' }),
                        DOMUtils.createSVG('rect', { x: '15', y: '4', width: '4', height: '16' }),
                    ]
                )
            );
        } else {
            btn.appendChild(
                DOMUtils.createSVG(
                    'svg',
                    { width: '20', height: '20', viewBox: '0 0 24 24', fill: 'currentColor' },
                    [DOMUtils.createSVG('polygon', { points: '5,3 19,12 5,21' })]
                )
            );
        }
    },

    /**
     * Get Results Card template
     */
    getResultsCard(state) {
        const timings = state.stepTimings || [];

        const formatDuration = (ms) => {
            const min = Math.floor(ms / 60000);
            const sec = Math.floor((ms % 60000) / 1000);
            if (min === 0) return `${sec}s`;
            return `${min}m ${sec}s`;
        };

        const maxDuration = Math.max(...timings.map((t) => t.duration || 0), 1);

        const totalFocus = timings.reduce((acc, t) => acc + (t.duration || 0), 0);
        const pomodoroCount = Store.getActiveExecution().sessionStats?.pomodorosUsed || 0;
        const stats = state.sessionStats || {};
        const totalDuration =
            stats.completedAt && stats.startedAt ? stats.completedAt - stats.startedAt : 0;
        const focusScore =
            totalDuration > 0 ? Math.min(100, Math.round((totalFocus / totalDuration) * 100)) : 0;

        const formatTime = (ts) => {
            if (!ts) return '--:--';
            return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        };

        const fragment = document.createDocumentFragment();

        const wrapper = DOMUtils.createElement('div', {
            className: 'results-card-wrapper animate-in-up',
        });

        // Celebration Header
        wrapper.appendChild(
            DOMUtils.createElement(
                'div',
                { className: 'completion-celebration results-celebration' },
                [
                    DOMUtils.createElement('div', {
                        className: 'completion-trophy',
                        textContent: '🏆',
                    }),
                    DOMUtils.createElement('div', {
                        className: 'completion-text',
                        textContent: 'All Done!',
                    }),
                ]
            )
        );

        const cardContainer = DOMUtils.createElement('div', {
            className: 'results-card-container glass-surface',
        });

        // Header
        const header = DOMUtils.createElement('div', { className: 'results-header' }, [
            document.createTextNode('SESSION ANALYSIS'),
            DOMUtils.createElement('div', {
                className: 'results-session-meta',
                textContent: `${formatTime(stats.startedAt)} – ${formatTime(stats.completedAt)}`,
            }),
        ]);
        cardContainer.appendChild(header);

        // Scroll Area
        const scrollArea = DOMUtils.createElement('div', { className: 'results-scroll-area' });
        if (timings.length > 0) {
            timings.forEach((t) => {
                const percent = Math.min(100, (t.duration / maxDuration) * 100);
                const icon = t.status === 'completed' ? '✓' : '⏭';

                const row = DOMUtils.createElement(
                    'div',
                    { className: `results-row ${t.status}` },
                    [
                        DOMUtils.createElement('div', { className: 'results-row-header' }, [
                            DOMUtils.createElement('span', {
                                className: 'results-icon',
                                textContent: icon,
                            }),
                            DOMUtils.createElement('span', {
                                className: 'results-text',
                                textContent: t.stepText,
                            }),
                            DOMUtils.createElement('span', {
                                className: 'results-time',
                                textContent: formatDuration(t.duration),
                            }),
                        ]),
                        DOMUtils.createElement('div', { className: 'results-bar-container' }, [
                            DOMUtils.createElement('div', {
                                className: 'results-bar',
                                style: { width: `${percent}%` },
                            }),
                        ]),
                    ]
                );
                scrollArea.appendChild(row);
            });
        } else {
            scrollArea.appendChild(
                DOMUtils.createElement('div', {
                    className: 'results-empty',
                    textContent: 'No step data recorded',
                })
            );
        }
        cardContainer.appendChild(scrollArea);

        // Footer (Stats)
        const footer = DOMUtils.createElement('div', { className: 'results-footer' });
        const statGroup = DOMUtils.createElement('div', { className: 'results-stat-group' });

        const createStat = (label, value) => {
            return DOMUtils.createElement('div', { className: 'results-stat' }, [
                DOMUtils.createElement('span', { className: 'stat-label', textContent: label }),
                DOMUtils.createElement('span', { className: 'stat-value', textContent: value }),
            ]);
        };

        statGroup.appendChild(createStat('FOCUS TIME', formatDuration(totalFocus)));
        statGroup.appendChild(createStat('TOTAL TIME', formatDuration(totalDuration)));
        statGroup.appendChild(createStat('PAUSES', (state.pauseCount || 0).toString()));
        statGroup.appendChild(createStat('TOMATOES', `${pomodoroCount} 🍅`));
        statGroup.appendChild(createStat('FOCUS SCORE', `${focusScore}%`));

        footer.appendChild(statGroup);
        cardContainer.appendChild(footer);

        wrapper.appendChild(cardContainer);

        wrapper.appendChild(
            DOMUtils.createElement('div', {
                className: 'results-hint',
                textContent: 'Share your focus achievement! 📸',
            })
        );

        // Actions
        const actions = DOMUtils.createElement('div', { className: 'results-actions' }, [
            DOMUtils.createElement(
                'button',
                { className: 'results-restart-btn', id: 'restartSessionBtn' },
                [
                    DOMUtils.createSVG('svg', { viewBox: '0 0 24 24', fill: 'currentColor' }, [
                        DOMUtils.createSVG('path', {
                            d: 'M17.65 6.35c-1.63-1.63-3.94-2.57-6.48-2.25-3.52.44-6.42 3.33-6.86 6.85-.56 4.5 3 8.35 7.42 8.35 3.32 0 6.13-2.13 7.15-5.08.18-.53-.22-1.07-.78-1.07h-.05c-.39 0-.74.24-.87.61-.75 2.19-2.85 3.76-5.45 3.76-2.56 0-4.74-1.74-5.38-4.14-.39-1.48.06-2.92.93-3.94a5.02 5.02 0 013.91-1.63c1.39.02 2.62.59 3.49 1.48l-1.79 1.79c-.31.31-.09.85.35.85H20c.28 0 .5-.22.5-.5V10.7c0-.45-.54-.67-.85-.35l-2-2z',
                        }),
                    ]),
                    document.createTextNode(' RESTART FOCUS'),
                ]
            ),
        ]);
        wrapper.appendChild(actions);

        fragment.appendChild(wrapper);
        return fragment;
    },
};
