/**
 * FocusAudio - Audio feedback for Focus Mode using Web Audio API
 * Generates tones without external audio files
 */

const STORAGE_KEY = 'focusMode_audioEnabled';

export const FocusAudio = {
    enabled: true,
    audioContext: null,

    /**
     * Initialize audio system and load preferences
     */
    init() {
        try {
            this.enabled = localStorage.getItem(STORAGE_KEY) !== 'false';
        } catch (e) {
            this.enabled = true;
        }
    },

    /**
     * Get or create AudioContext (lazy initialization for browser autoplay policies)
     */
    getContext() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        // Resume if suspended (happens after user interaction)
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        return this.audioContext;
    },

    /**
     * Play a tone with specified frequency, duration, and type
     */
    playTone(frequency, duration = 0.3, type = 'sine', volume = 0.3, pan = 0) {
        if (!this.enabled) return;

        try {
            const ctx = this.getContext();
            const oscillator = ctx.createOscillator();
            const overtone = ctx.createOscillator();
            const gainNode = ctx.createGain();
            const overtoneGain = ctx.createGain();
            const panner = ctx.createStereoPanner();

            oscillator.connect(gainNode);
            overtone.connect(overtoneGain);
            gainNode.connect(panner);
            overtoneGain.connect(panner);
            panner.connect(ctx.destination);

            panner.pan.setValueAtTime(pan, ctx.currentTime);

            oscillator.type = type;
            oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
            overtone.type = 'triangle';
            overtone.frequency.setValueAtTime(frequency * 1.005, ctx.currentTime);

            gainNode.gain.setValueAtTime(0, ctx.currentTime);
            gainNode.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.01);
            gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

            overtoneGain.gain.setValueAtTime(0, ctx.currentTime);
            overtoneGain.gain.linearRampToValueAtTime(volume * 0.35, ctx.currentTime + 0.01);
            overtoneGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

            oscillator.start(ctx.currentTime);
            oscillator.stop(ctx.currentTime + duration);
            overtone.start(ctx.currentTime);
            overtone.stop(ctx.currentTime + duration);
        } catch (e) {
            console.warn('[FocusAudio] Failed to play tone:', e);
        }
    },

    /**
     * Reward Arpeggio - shimmer effect
     */
    playArpeggio(rootFreq, duration = 1.0, volume = 0.2, pan = 0) {
        const notes = [1, 1.25, 1.5, 2]; // Major chord ratios
        notes.forEach((ratio, i) => {
            setTimeout(() => {
                this.playTone(rootFreq * ratio, duration * 0.8, 'sine', volume, pan);
            }, i * 100);
        });
    },

    /**
     * Closure warning - gentle ascending chime (5 min warning)
     */
    playClosureWarning() {
        if (!this.enabled) return;
        this.playTone(523.25, 0.4, 'sine', 0.25, -0.2); // C5 leftish
        setTimeout(() => this.playTone(659.25, 0.5, 'sine', 0.25, 0.2), 250); // E5 rightish
    },

    /**
     * Session complete - triumphant ascending chord
     */
    playSessionComplete() {
        if (!this.enabled) return;
        // Triumphant C Major
        this.playArpeggio(523.25, 1.5, 0.3, 0); // C5
        setTimeout(() => this.playArpeggio(783.99, 1.2, 0.25, 0.3), 400); // G5
    },

    /**
     * Step complete - quick positive chirp
     */
    playStepComplete() {
        if (!this.enabled) return;
        // Crisper "check" sound (Triangle wave for texture, short envelope)
        this.playTone(783.99, 0.08, 'triangle', 0.25, 0); // G5
        setTimeout(() => this.playTone(1046.5, 0.12, 'sine', 0.2, 0), 80); // C6
    },

    /**
     * Break complete - distinctive alert to return to focus
     */
    playBreakComplete() {
        if (!this.enabled) return;
        this.playTone(880, 0.2, 'sine', 0.3); // A5
        setTimeout(() => this.playTone(698.46, 0.5, 'sine', 0.35), 150); // F5
    },

    /**
     * Task achieved - Grand multi-layered melody
     */
    playTaskAchieved() {
        if (!this.enabled) return;

        // Sequence of arpeggios for massive gratification
        this.playArpeggio(523.25, 2.0, 0.4, -0.6); // Left C5
        setTimeout(() => this.playArpeggio(659.25, 1.8, 0.35, 0.6), 400); // Right E5
        setTimeout(() => this.playArpeggio(783.99, 1.6, 0.3, -0.3), 800); // Left-center G5
        setTimeout(() => this.playArpeggio(1046.50, 1.4, 0.25, 0.3), 1200); // Right-center C6

        // Grand Finale at 8s - Massive shimmer chord
        setTimeout(() => {
            // C MAJOR TRIAD (Inverted/Spread)
            this.playTone(523.25, 3.0, 'sine', 0.2, -0.5); // C5
            this.playTone(659.25, 3.0, 'triangle', 0.15, 0.5); // E5
            this.playTone(783.99, 3.0, 'sine', 0.15, 0); // G5
            this.playTone(1046.50, 3.0, 'triangle', 0.1, -0.3); // C6
            this.playTone(1318.51, 3.0, 'sine', 0.1, 0.3); // E6
            this.playTone(1567.98, 3.0, 'sine', 0.08, 0); // G6

            // Final high sparkle
            setTimeout(() => {
                this.playTone(2093.00, 2.0, 'sine', 0.05, 0); // C7
                this.playTone(3135.96, 2.0, 'triangle', 0.03, 0); // G7
            }, 500);
        }, 8000);
    },

    /**
     * Enable/disable audio feedback
     */
    setEnabled(enabled) {
        this.enabled = enabled;
        try {
            localStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
        } catch (e) {
            console.warn('[FocusAudio] Failed to save preference:', e);
        }
    },

    /**
     * Toggle audio on/off
     */
    toggle() {
        this.setEnabled(!this.enabled);
        return this.enabled;
    },

    /**
     * Check if audio is enabled
     */
    isEnabled() {
        return this.enabled;
    },
};

// Initialize on module load
FocusAudio.init();
