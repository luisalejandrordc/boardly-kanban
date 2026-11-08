// Tiny canvas confetti: two "party poppers" fire from the bottom corners
export function launchConfetti() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const canvas = document.createElement("canvas");
  Object.assign(canvas.style, {
    position: "fixed",
    inset: "0",
    width: "100%",
    height: "100%",
    pointerEvents: "none",
    zIndex: "50",
  });
  const dpr = window.devicePixelRatio || 1;
  const W = window.innerWidth;
  const H = window.innerHeight;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);

  const colors = [
    "#4338ff",
    "#f2a007",
    "#2aa86b",
    "#e5484d",
    "#0ea5e9",
    "#c026d3",
  ];
  const pieces = Array.from({ length: 200 }, (_, i) => {
    const fromLeft = i % 2 === 0;
    return {
      x: fromLeft ? 0 : W,
      y: H * 0.75,
      vx: (fromLeft ? 1 : -1) * (3 + Math.random() * 9),
      vy: -(9 + Math.random() * 13),
      size: 6 + Math.random() * 7,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.4,
      color: colors[i % colors.length],
      round: Math.random() < 0.3,
    };
  });

  const start = performance.now();
  function frame(now: number) {
    const t = now - start;
    ctx.clearRect(0, 0, W, H);
    const alpha = t > 2800 ? Math.max(0, 1 - (t - 2800) / 900) : 1;
    for (const p of pieces) {
      p.vy += 0.35;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      if (p.round) {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      } else ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.6);
      ctx.restore();
    }
    if (t < 3700) requestAnimationFrame(frame);
    else canvas.remove();
  }
  requestAnimationFrame(frame);
}
