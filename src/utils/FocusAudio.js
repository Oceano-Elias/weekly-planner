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
     * Task achieved - Zen Scale (for major success)
     */
    playTaskAchieved() {
        if (!this.enabled) return;
        // Pentatonic Scale: C D E G A
        const notes = [523.25, 587.33, 659.25, 783.99, 880.0];
        notes.forEach((freq, i) => {
            setTimeout(() => {
                this.playTone(freq, 0.6, 'sine', 0.15, i / 4 - 0.5);
            }, i * 150);
        });
        // End with a Gong
        setTimeout(() => this.playZenGong(), 800);
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
     * Zen Gong - Deep, metallic, resonant (for major events like Drag Drop or Session Start)
     */
    playZenGong() {
        if (!this.enabled) return;
        const ctx = this.getContext();
        const now = ctx.currentTime;

        // Base freq and partials for metallic gong sound
        const baseFreq = 160;
        const partials = [1.0, 1.41, 1.73, 2.15, 3.4];

        partials.forEach((ratio, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.frequency.value = baseFreq * ratio;
            osc.type = i === 0 ? 'sine' : 'triangle'; // Fund is sine, partials metallic

            // Randomize slight detuning for richness
            osc.detune.value = (Math.random() - 0.5) * 15;

            osc.connect(gain);
            gain.connect(ctx.destination);

            const dura = 3.0 / ratio; // Higher partials decay faster

            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.15 / (i + 1), now + 0.05); // Attack
            gain.gain.exponentialRampToValueAtTime(0.001, now + dura); // Decay

            osc.start(now);
            osc.stop(now + dura);
        });
    },

    /**
     * Zen Bell - Clear, crisp, high (for completion/success)
     */
    playZenBell() {
        if (!this.enabled) return;
        const ctx = this.getContext();
        const now = ctx.currentTime;

        // Bell fundamental
        const freq = 880; // A5

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        // Sharp metallic attack
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(3000, now);
        filter.frequency.exponentialRampToValueAtTime(500, now + 1.5);

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.2, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 2.0);

        osc.start(now);
        osc.stop(now + 2.0);
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
