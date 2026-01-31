import { FocusAudio } from '../utils/FocusAudio.js';
import { DOMUtils } from '../utils/DOMUtils.js';

/**
 * Rewards Service
 * Handles visual and audio feedback for micro-achievements
 */
export const Rewards = {
    phrases: [
        'Nice!',
        'Good!',
        'Next!',
        'Yes!',
        'Done!',
        'Flow!',
        'Solid!',
        'Check!',
        'On Point!',
        'Keep Going!',
        'Crushed It!',
        'Boom!',
        'Easy!',
        'Steady!',
    ],

    /**
     * Show a floating reward at coordinates
     * @param {number} x - Screen X coordinate
     * @param {number} y - Screen Y coordinate
     * @param {string} type - 'standard' | 'huge'
     */
    show(x, y, type = 'standard') {
        // 1. Audio Interaction
        FocusAudio.playStepComplete();

        // 2. Visual Interaction
        const phrase = this.phrases[Math.floor(Math.random() * this.phrases.length)];

        const el = DOMUtils.createElement('div', {
            className: 'reward-floating-text',
            textContent: phrase,
            style: {
                left: `${x}px`,
                top: `${y}px`,
            },
        });

        if (type === 'huge') {
            el.classList.add('huge');
        }

        document.body.appendChild(el);

        // Auto-cleanup after animation
        setTimeout(() => {
            el.remove();
        }, 1000);
    },
};
