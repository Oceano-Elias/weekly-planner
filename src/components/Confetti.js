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
        '#10b981', // Green
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
    createParticle(x, y) {
        const color = this.colors[Math.floor(Math.random() * this.colors.length)];
        const size = Math.random() * 12 + 6;
        const shape = Math.random() > 0.5 ? 'rect' : 'circle';

        return {
            x,
            y,
            vx: (Math.random() - 0.5) * 20,
            vy: Math.random() * -20 - 10,
            color,
            size,
            shape,
            rotation: Math.random() * 360,
            rotationSpeed: (Math.random() - 0.5) * 15,
            gravity: 0.4,
            friction: 0.98,
            opacity: 1,
            decay: 0.01 + Math.random() * 0.01 // Fade slightly faster but with more particles
        };
    },

    /**
     * Burst confetti from a point
     */
    burst(x, y, count = 100) {
        this.init();

        for (let i = 0; i < count; i++) {
            this.particles.push(this.createParticle(x, y));
        }

        if (!this.isActive) {
            this.isActive = true;
            this.animate();
        }
    },

    /**
     * Full celebration - confetti from multiple points
     */
    celebrate() {
        this.init();
        console.log('✨ [Confetti] Grand Celebration started!');

        const width = window.innerWidth;
        const height = window.innerHeight;

        // Spread across the whole bottom area
        this.burst(width * 0.15, height, 80);
        this.burst(width * 0.5, height, 120);
        this.burst(width * 0.85, height, 80);

        // Additional bursts after delay
        setTimeout(() => {
            this.burst(width * 0.35, height, 70);
            this.burst(width * 0.65, height, 70);
        }, 300);

        setTimeout(() => {
            this.burst(width * 0.5, height * 0.4, 100);
        }, 500);

        // Play celebration sound if available
        this.playSound();
    },

    /**
     * Play celebration sound
     */
    playSound() {
        // Create a simple celebration sound using Web Audio API
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;

            const audioContext = new AudioCtx();

            // Create a cheerful arpeggio
            const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51]; // C5, E5, G5, C6, E6

            notes.forEach((freq, i) => {
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();

                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);

                oscillator.frequency.value = freq;
                oscillator.type = 'sine';

                const startTime = audioContext.currentTime + (i * 0.1);
                const duration = 0.2;

                gainNode.gain.setValueAtTime(0.1, startTime);
                gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

                oscillator.start(startTime);
                oscillator.stop(startTime + duration);
            });
        } catch (e) {
            // Audio not available, silently ignore
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
            p.x += p.vx;
            p.y += p.vy;
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
    }
};

// Make globally available and add debug helper
if (typeof window !== 'undefined') {
    window.Confetti = Confetti;
    window.celebrate = () => Confetti.celebrate();
    console.log('🎊 Confetti loaded. Type celebrate() in console to trigger manually.');
}
