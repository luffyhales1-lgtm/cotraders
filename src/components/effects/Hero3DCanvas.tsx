import React, { useEffect, useRef } from 'react';

/**
 * Lightweight market-network canvas backdrop.
 *
 * Performance-hardened so it never becomes a background CPU/GPU drain:
 *  - the render loop is CAPPED to ~30fps (was an uncapped ~60fps loop),
 *  - it PAUSES entirely when the canvas is scrolled off-screen
 *    (IntersectionObserver) or the tab is hidden (visibilitychange),
 *  - it honours `prefers-reduced-motion` by drawing a single static frame
 *    and never starting the loop.
 * This keeps the exact same look while eliminating the constant repaint that
 * was running even when nobody was looking at it.
 */
export const Hero3DCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduceMotion = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    let animationFrameId = 0;
    let running = false;
    let visibleOnScreen = true;
    let width = (canvas.width = canvas.offsetWidth);
    let height = (canvas.height = canvas.offsetHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
    };
    window.addEventListener('resize', handleResize);

    // Fewer nodes than before (35 -> 28) — the connection step is O(n^2) so
    // this meaningfully cuts per-frame work while looking identical.
    const particles = Array.from({ length: 28 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.6,
      vy: (Math.random() - 0.5) * 0.6,
      radius: Math.random() * 2 + 1,
      color: Math.random() > 0.5 ? 'rgba(16, 185, 129, ' : 'rgba(6, 182, 212, ',
      alpha: Math.random() * 0.6 + 0.2,
    }));

    let gridOffset = 0;

    const drawFrame = (advance: boolean) => {
      ctx.clearRect(0, 0, width, height);

      ctx.strokeStyle = 'rgba(30, 41, 59, 0.4)';
      ctx.lineWidth = 1;

      if (advance) gridOffset = (gridOffset + 0.3) % 20;

      for (let x = 0; x < width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      for (let y = gridOffset; y < height; y += 20) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      for (let i = 0; i < particles.length; i++) {
        const p1 = particles[i];
        if (advance) {
          p1.x += p1.vx;
          p1.y += p1.vy;
          if (p1.x < 0 || p1.x > width) p1.vx *= -1;
          if (p1.y < 0 || p1.y > height) p1.vy *= -1;
        }

        ctx.fillStyle = `${p1.color}${p1.alpha})`;
        ctx.beginPath();
        ctx.arc(p1.x, p1.y, p1.radius, 0, Math.PI * 2);
        ctx.fill();

        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 110) {
            ctx.strokeStyle = `rgba(16, 185, 129, ${0.25 * (1 - dist / 110)})`;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
      }
    };

    // ~30fps cap: only advance/redraw every ~33ms even though rAF fires ~60x/s.
    const FRAME_MS = 1000 / 30;
    let last = 0;
    const loop = (now: number) => {
      if (!running) return;
      if (now - last >= FRAME_MS) {
        last = now;
        drawFrame(true);
      }
      animationFrameId = requestAnimationFrame(loop);
    };

    const start = () => {
      if (running || reduceMotion) return;
      if (document.hidden || !visibleOnScreen) return;
      running = true;
      last = 0;
      animationFrameId = requestAnimationFrame(loop);
    };
    const stop = () => {
      running = false;
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };

    // Pause when scrolled out of view.
    const io = new IntersectionObserver(
      (entries) => {
        visibleOnScreen = entries[0]?.isIntersecting ?? true;
        if (visibleOnScreen) start();
        else stop();
      },
      { threshold: 0.01 },
    );
    io.observe(canvas);

    // Pause when the tab is backgrounded.
    const handleVisibility = () => {
      if (document.hidden) stop();
      else start();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // Draw once immediately so it's never blank, then start the (gated) loop.
    drawFrame(false);
    start();

    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibility);
      io.disconnect();
      stop();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none opacity-40 z-0"
    />
  );
};
