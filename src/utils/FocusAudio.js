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
    playTone(frequency, duration = 0.3, type = 'sine', volume = 0.3) {
        if (!this.enabled) return;

        try {
            const ctx = this.getContext();
            const oscillator = ctx.createOscillator();
            const overtone = ctx.createOscillator();
            const gainNode = ctx.createGain();
            const overtoneGain = ctx.createGain();

            oscillator.connect(gainNode);
            overtone.connect(overtoneGain);
            gainNode.connect(ctx.destination);
            overtoneGain.connect(ctx.destination);

            oscillator.type = type;
            oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
            overtone.type = 'triangle';
            overtone.frequency.setValueAtTime(frequency * 1.005, ctx.currentTime);

            gainNode.gain.setValueAtTime(0, ctx.currentTime);
            gainNode.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.01);

            gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);
            overtoneGain.gain.setValueAtTime(0, ctx.currentTime);
            overtoneGain.gain.linearRampToValueAtTime(volume * 0.35, ctx.currentTime + 0.01);
            overtoneGain.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);

            oscillator.start(ctx.currentTime);
            oscillator.stop(ctx.currentTime + duration);
            overtone.start(ctx.currentTime);
            overtone.stop(ctx.currentTime + duration);
        } catch (e) {
            console.warn('[FocusAudio] Failed to play tone:', e);
        }
    },

    /**
     * Closure warning - gentle ascending chime (5 min warning)
     */
    playClosureWarning() {
        if (!this.enabled) return;

        // Two-tone gentle alert: C5 -> E5
        this.playTone(523.25, 0.2, 'sine', 0.25); // C5
        setTimeout(() => this.playTone(659.25, 0.3, 'sine', 0.25), 200); // E5
    },

    /**
     * Session complete - triumphant ascending chord
     */
    playSessionComplete() {
        if (!this.enabled) return;

        // Three-tone completion: C5 -> E5 -> G5
        this.playTone(523.25, 0.15, 'sine', 0.3); // C5
        setTimeout(() => this.playTone(659.25, 0.15, 'sine', 0.3), 120); // E5
        setTimeout(() => this.playTone(783.99, 0.4, 'sine', 0.35), 240); // G5
    },

    /**
     * Step complete - quick positive chirp
     */
    playStepComplete() {
        if (!this.enabled) return;

        // More satisfying ascending chord: E5 -> G5 -> C6
        this.playTone(659.25, 0.1, 'sine', 0.25); // E5
        setTimeout(() => this.playTone(783.99, 0.1, 'sine', 0.25), 80); // G5
        setTimeout(() => this.playTone(1046.5, 0.2, 'sine', 0.3), 160); // C6
    },

    /**
     * Task achieved - triumphant melody for total completion
     */
    playTaskAchieved() {
        if (!this.enabled) return;

        // Triumphant melody: C5 -> G5 -> C6
        const ctx = this.getContext();
        const start = ctx.currentTime;

        this.playTone(523.25, 0.2, 'sine', 0.3); // C5
        setTimeout(() => this.playTone(783.99, 0.2, 'sine', 0.3), 150); // G5
        setTimeout(() => this.playTone(1046.5, 0.6, 'sine', 0.4), 300); // C6
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
