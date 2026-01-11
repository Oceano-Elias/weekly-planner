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
            z-index: 9999;
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
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    },

    /**
     * Create a confetti particle
     */
    createParticle(x, y) {
        const color = this.colors[Math.floor(Math.random() * this.colors.length)];
        const size = Math.random() * 10 + 5;
        const shape = Math.random() > 0.5 ? 'rect' : 'circle';

        return {
            x,
            y,
            vx: (Math.random() - 0.5) * 15,
            vy: Math.random() * -15 - 5,
            color,
            size,
            shape,
            rotation: Math.random() * 360,
            rotationSpeed: (Math.random() - 0.5) * 10,
            gravity: 0.3,
            friction: 0.99,
            opacity: 1,
            decay: 0.005 + Math.random() * 0.01
        };
    },

    /**
     * Burst confetti from a point
     */
    burst(x, y, count = 50) {
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

        const width = window.innerWidth;
        const height = window.innerHeight;

        // Burst from bottom corners and center
        this.burst(width * 0.2, height, 40);
        this.burst(width * 0.5, height * 0.8, 60);
        this.burst(width * 0.8, height, 40);

        // Additional bursts after delay
        setTimeout(() => {
            this.burst(width * 0.3, height, 30);
            this.burst(width * 0.7, height, 30);
        }, 200);

        setTimeout(() => {
            this.burst(width * 0.5, height * 0.6, 40);
        }, 400);

        // Play celebration sound if available
        this.playSound();
    },

    /**
     * Play celebration sound
     */
    playSound() {
        // Create a simple celebration sound using Web Audio API
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();

            // Create a cheerful arpeggio
            const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6

            notes.forEach((freq, i) => {
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();

                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);

                oscillator.frequency.value = freq;
                oscillator.type = 'sine';

                const startTime = audioContext.currentTime + (i * 0.08);
                const duration = 0.15;

                gainNode.gain.setValueAtTime(0.15, startTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

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

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

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
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }
};

// Make globally available
if (typeof window !== 'undefined') {
    window.Confetti = Confetti;
}
