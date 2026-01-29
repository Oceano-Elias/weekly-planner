/**
 * Confetti Celebration Component
 * Triggers beautiful confetti animation when all daily tasks are complete
 */

export const Confetti = {
    isActive: false,
    particles: [],
    canvas: null,
    ctx: null,
    animationId: null,

    // Particle colors - vibrant celebration palette
    colors: [
        '#6366f1', // Indigo
        '#8b5cf6', // Purple
        '#c084fc', // Lavender
        '#f59e0b', // Amber
        '#ef4444', // Red
        '#06b6d4', // Cyan
        '#ec4899', // Pink
        '#84cc16', // Lime
    ],

    /**
     * Initialize the confetti canvas
     */
    init() {
        if (this.canvas) return;

        this.canvas = document.createElement('canvas');
        this.canvas.id = 'confettiCanvas';
        this.canvas.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            pointer-events: none;
            z-index: 2147483647;
        `;
        document.body.appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d');
        this.resize();

        window.addEventListener('resize', () => this.resize());
    },

    /**
     * Resize canvas to window size
     */
    resize() {
        if (!this.canvas) return;

        // Handle High DPI screens
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = window.innerWidth * dpr;
        this.canvas.height = window.innerHeight * dpr;
        this.ctx.scale(dpr, dpr);
    },

    /**
     * Create a confetti particle
     */
    createParticle(x, y, options = {}) {
        const color = this.colors[Math.floor(Math.random() * this.colors.length)];
        const size = Math.random() * 10 + 6;
        const shape = Math.random() > 0.5 ? 'rect' : 'circle';

        // Random drift/wind factor
        const wind = (Math.random() - 0.5) * 0.2;

        return {
            x,
            y,
            vx: options.vx || (Math.random() - 0.5) * 20,
            vy: options.vy || Math.random() * -20 - 10,
            color,
            size,
            shape,
            rotation: Math.random() * 360,
            rotationSpeed: (Math.random() - 0.5) * 10,
            gravity: 0.25 + Math.random() * 0.15, // Lighter gravity for more hang time
            friction: 0.985,
            opacity: 1,
            decay: 0.005 + Math.random() * 0.008, // Slower decay for longer life
            wind,
            wobble: Math.random() * 10,
            wobbleSpeed: 0.05 + Math.random() * 0.1
        };
    },

    /**
     * Burst confetti from a point
     */
    burst(x, y, count = 100, options = {}) {
        this.init();

        for (let i = 0; i < count; i++) {
            const vy = options.power ? (Math.random() * -options.power - options.power / 2) : undefined;
            const vx = options.spread ? (Math.random() - 0.5) * options.spread : undefined;

            this.particles.push(this.createParticle(x, y, { vx, vy }));
        }

        if (!this.isActive) {
            this.isActive = true;
            this.animate();
        }
    },

    /**
     * Fire "Side Cannons" - classic celebratory effect
     */
    fireCannons() {
        const width = window.innerWidth;
        const height = window.innerHeight;

        // Left Cannon
        for (let i = 0; i < 60; i++) {
            this.particles.push(this.createParticle(0, height, {
                vx: Math.random() * 15 + 10,
                vy: Math.random() * -25 - 15
            }));
        }

        // Right Cannon
        for (let i = 0; i < 60; i++) {
            this.particles.push(this.createParticle(width, height, {
                vx: Math.random() * -15 - 10,
                vy: Math.random() * -25 - 15
            }));
        }

        if (!this.isActive) {
            this.isActive = true;
            this.animate();
        }
    },

    /**
     * Full celebration - Orchestrated Waves
     */
    celebrate() {
        this.init();
        console.log('✨ [Confetti] Gratifying Grand Celebration started!');

        const width = window.innerWidth;
        const height = window.innerHeight;

        // Wave 1: Initial Bang
        this.fireCannons();
        this.burst(width * 0.5, height, 100, { power: 25, spread: 20 });

        // Wave 2: Center Follow-up
        setTimeout(() => {
            this.burst(width * 0.5, height * 0.8, 80, { power: 15, spread: 40 });
        }, 800);

        // Wave 3: Side Cannon Refill
        setTimeout(() => {
            this.fireCannons();
        }, 1800);

        // Wave 4: Mid-celebration Hype
        setTimeout(() => {
            this.burst(width * 0.3, height * 0.7, 50, { power: 12, spread: 30 });
            this.burst(width * 0.7, height * 0.7, 50, { power: 12, spread: 30 });
        }, 3500);

        // Wave 5: Late Intensity
        setTimeout(() => {
            this.fireCannons();
        }, 6000);

        // Wave 6: Grand Finale - Massive Bang
        setTimeout(() => {
            this.fireCannons();
            this.burst(width * 0.5, height, 200, { power: 30, spread: 25 });
            console.log('🎆 [Confetti] Grand Finale!');
        }, 8000);

        // Wave 4: Glitter Shower (Extended)
        const showerInterval = setInterval(() => {
            if (this.particles.length < 500) {
                this.burst(Math.random() * width, -20, 5, { power: -2, spread: 5 });
            }
        }, 120);

        setTimeout(() => clearInterval(showerInterval), 8500);

        // Play celebration sequences
        this.playSound();
    },

    /**
     * Play celebration sound
     */
    playSound() {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;

            const audioContext = new AudioCtx();
            const masterGain = audioContext.createGain();
            masterGain.connect(audioContext.destination);
            masterGain.gain.setValueAtTime(0.15, audioContext.currentTime);

            // Layer 1: The "Pop" - Quick frequency sweep
            const pop = audioContext.createOscillator();
            const popGain = audioContext.createGain();
            pop.connect(popGain);
            popGain.connect(masterGain);
            pop.type = 'sine';
            pop.frequency.setValueAtTime(800, audioContext.currentTime);
            pop.frequency.exponentialRampToValueAtTime(100, audioContext.currentTime + 0.1);
            popGain.gain.setValueAtTime(0.5, audioContext.currentTime);
            popGain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
            pop.start();
            pop.stop(audioContext.currentTime + 0.1);

            // Layer 2: Shimmering Arpeggio
            const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98]; // C5 to G6
            notes.forEach((freq, i) => {
                const osc = audioContext.createOscillator();
                const node = audioContext.createGain();

                // Use triangle for a softer, more bell-like sound
                osc.type = 'triangle';
                osc.frequency.value = freq;

                osc.connect(node);
                node.connect(masterGain);

                const startTime = audioContext.currentTime + i * 0.08 + 0.05;
                const duration = 0.4;

                node.gain.setValueAtTime(0, startTime);
                node.gain.linearRampToValueAtTime(0.2, startTime + 0.02);
                node.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

                osc.start(startTime);
                osc.stop(startTime + duration);
            });

            // Layer 3: Natural Crowd Cheer
            // Loading the higher-quality natural sound effect we downloaded
            fetch('./src/assets/sounds/celebration.mp3')
                .then((response) => response.arrayBuffer())
                .then((arrayBuffer) => audioContext.decodeAudioData(arrayBuffer))
                .then((audioBuffer) => {
                    const source = audioContext.createBufferSource();
                    source.buffer = audioBuffer;

                    const cheerGain = audioContext.createGain();
                    cheerGain.gain.setValueAtTime(0.4, audioContext.currentTime);
                    cheerGain.gain.exponentialRampToValueAtTime(
                        0.001,
                        audioContext.currentTime + audioBuffer.duration
                    );

                    source.connect(cheerGain);
                    cheerGain.connect(masterGain);
                    source.start(audioContext.currentTime);
                })
                .catch((err) => console.warn('Could not play celebration MP3:', err));

            // Layer 4: High Sparkle harmonics
            const sparkle = audioContext.createOscillator();
            const sparkleGain = audioContext.createGain();
            sparkle.type = 'sine';
            sparkle.frequency.value = 3135.96; // G7
            sparkle.connect(sparkleGain);
            sparkleGain.connect(masterGain);

            const sparkleStart = audioContext.currentTime + 0.5;
            sparkleGain.gain.setValueAtTime(0, sparkleStart);
            sparkleGain.gain.linearRampToValueAtTime(0.05, sparkleStart + 0.05);
            sparkleGain.gain.exponentialRampToValueAtTime(0.001, sparkleStart + 0.3);

            sparkle.start(sparkleStart);
            sparkle.stop(sparkleStart + 0.4);
        } catch (e) {
            // Silently ignore if audio fails
        }
    },

    /**
     * Animation loop
     */
    animate() {
        if (!this.ctx || !this.canvas) return;

        this.ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];

            // Update physics
            p.vy += p.gravity;
            p.vx *= p.friction;
            p.vy *= p.friction;

            // Add wind and wobble drift
            p.vx += p.wind;
            p.x += p.vx + Math.sin(p.wobble) * 2; // Horizontal wobble
            p.y += p.vy;

            p.wobble += p.wobbleSpeed;
            p.rotation += p.rotationSpeed;
            p.opacity -= p.decay;

            // Remove dead particles
            if (p.opacity <= 0) {
                this.particles.splice(i, 1);
                continue;
            }

            // Draw particle
            this.ctx.save();
            this.ctx.translate(p.x, p.y);
            this.ctx.rotate((p.rotation * Math.PI) / 180);
            this.ctx.globalAlpha = p.opacity;
            this.ctx.fillStyle = p.color;

            if (p.shape === 'rect') {
                this.ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
            } else {
                this.ctx.beginPath();
                this.ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
                this.ctx.fill();
            }

            this.ctx.restore();
        }

        if (this.particles.length > 0) {
            this.animationId = requestAnimationFrame(() => this.animate());
        } else {
            this.isActive = false;
        }
    },

    /**
     * Stop and cleanup
     */
    stop() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        this.particles = [];
        this.isActive = false;
        if (this.ctx && this.canvas) {
            this.ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
        }
    },
};

// Make globally available and add debug helper
if (typeof window !== 'undefined') {
    window.Confetti = Confetti;
    window.celebrate = () => Confetti.celebrate();
    console.log('🎊 Confetti loaded. Type celebrate() in console to trigger manually.');
}
