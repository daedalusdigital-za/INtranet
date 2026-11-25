/**
 * A short confetti burst for milestones (tender awarded, project at 100%). No library:
 * one temporary full-screen canvas, ~1.2 s, then removed. Does nothing for reduced motion.
 *
 *   import { confettiBurst } from '../../ui/confetti';
 *   confettiBurst();                       // from the middle of the screen
 *   confettiBurst(event.clientX, event.clientY);
 */
export function confettiBurst(x?: number, y?: number): void {
  if (typeof window === 'undefined') return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const canvas = document.createElement('canvas');
  const dpr = window.devicePixelRatio || 1;
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  Object.assign(canvas.style, { position: 'fixed', inset: '0', width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: '3000' });
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);
  const ox = x ?? innerWidth / 2, oy = y ?? innerHeight / 3;
  const colours = ['#2563eb', '#7c3aed', '#059669', '#ea580c', '#db2777', '#ca8a04', '#0891b2'];
  const bits = Array.from({ length: 90 }, () => {
    const a = Math.random() * Math.PI * 2, v = 4 + Math.random() * 7;
    return { x: ox, y: oy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 4, r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.4,
      w: 5 + Math.random() * 5, h: 3 + Math.random() * 3, c: colours[(Math.random() * colours.length) | 0] };
  });
  const start = performance.now();
  const frame = (now: number) => {
    const t = now - start;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const b of bits) {
      b.vy += 0.22; b.vx *= 0.985; b.x += b.vx; b.y += b.vy; b.r += b.vr;
      ctx.save(); ctx.globalAlpha = Math.max(0, 1 - t / 1200); ctx.translate(b.x, b.y); ctx.rotate(b.r);
      ctx.fillStyle = b.c; ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h); ctx.restore();
    }
    if (t < 1200) requestAnimationFrame(frame); else canvas.remove();
  };
  requestAnimationFrame(frame);
}
