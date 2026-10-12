import { createHeroMotion } from './hero-motion.js';

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const controls = document.querySelectorAll('[data-motion-toggle]');
let paused = false;

function createWorlds(canvas) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};
  let width = 0;
  let height = 0;
  let visible = false;
  let frame = 0;
  let time = 0;
  let lastFrame = 0;
  let pointerX = 0;
  let pointerY = 0;
  let tiltX = 0;
  let tiltY = 0;

  const segments = 160;
  const strands = 25;

  function project(x, y, z) {
    const turn = -0.2 + tiltX;
    const px = x * Math.cos(turn) + z * Math.sin(turn);
    const depth = z * Math.cos(turn) - x * Math.sin(turn);
    const py = y * Math.cos(0.48 + tiltY) - depth * Math.sin(0.48 + tiltY);
    const scale = Math.min(width / 4.15, height / 2.8);
    return [width / 2 + (px * 0.98 + py * 0.18) * scale,
      height / 2 + (py * 0.98 - px * 0.18) * scale, depth];
  }

  // One continuous surface changes material across two connected worlds.
  function point(u, v) {
    const breath = 1 + Math.sin(time * 0.5) * 0.025;
    const ripple = Math.sin(u * 3 - time * 0.65) * 0.045;
    return project(
      (1.42 + v * 0.6) * Math.cos(u) * breath,
      0.64 * Math.sin(u * 2) + v * Math.sin(u) + ripple,
      0.62 * Math.sin(u) + v * Math.cos(u * 2),
    );
  }

  function line(a, b, color, lineWidth = 0.65) {
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);
    tiltX += (pointerX - tiltX) * 0.06;
    tiltY += (pointerY - tiltY) * 0.06;
    const mesh = Array.from({ length: segments + 1 }, (_, i) => {
      const u = i / segments * Math.PI * 2;
      return Array.from({ length: strands }, (_, j) => point(u, (j / (strands - 1) - 0.5) * 0.8));
    });
    // Paint the back first so the crossing reads as a folded, dimensional ribbon.
    const bands = Array.from({ length: segments }, (_, i) => i)
      .sort((a, b) => mesh[a][12][2] - mesh[b][12][2]);
    for (const i of bands) {
      const u = (i + 0.5) / segments * Math.PI * 2;
      const digital = Math.cos(u) > 0;
      const illumination = 0.55 + (mesh[i][12][2] + 1) * 0.18;
      // A shared pulse circles the whole surface, linking both visual materials.
      const pulse = Math.pow((1 + Math.cos(u - time * 0.48)) / 2, 18);
      for (let j = 0; j < strands; j++) {
        const p = mesh[i][j];
        const q = mesh[i + 1][j];
        if (digital) {
          if (j % 2 === 0) {
            line(p, q, `rgba(255,142,87,${0.28 * illumination + pulse * 0.22})`);
            if (j + 2 < strands && i % 2 === 0) {
              line(p, mesh[i + 1][j + 2], `rgba(255,142,87,${0.18 * illumination})`, 0.5);
              line(p, mesh[i][j + 2], `rgba(255,142,87,${0.26 * illumination})`, 0.5);
            }
            if (i % 2 === 0) {
              const size = 0.8 + pulse * 1.1;
              ctx.fillStyle = `rgba(255,203,148,${0.5 + pulse * 0.5})`;
              ctx.fillRect(p[0] - size / 2, p[1] - size / 2, size, size);
            }
          }
        } else {
          const edge = Math.sin(j / (strands - 1) * Math.PI);
          line(p, q, `rgba(233,232,220,${(0.28 + edge * 0.3) * illumination + pulse * 0.15})`, 0.8);
        }
      }
    }
    // Moving traces pass continuously from organic lines into the digital lattice.
    for (let i = 0; i < 18; i++) {
      const direction = i % 2 ? 1 : -1;
      const u = i * 2.39996 + time * 0.22 * direction;
      const v = ((i * 0.618) % 1 - 0.5) * 0.75;
      const p = point(u, v);
      const tail = point(u - 0.032 * direction, v);
      const digital = Math.cos(u) > 0;
      line(tail, p, digital ? '#ffb079' : '#eeeadd', 1.4);
      ctx.fillStyle = digital ? '#ffd3a6' : '#fff7e6';
      ctx.beginPath();
      ctx.arc(p[0], p[1], 1.25, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function animate(timestamp) {
    frame = 0;
    if (timestamp - lastFrame >= 1000 / 30) {
      time += Math.min((timestamp - lastFrame) / 1000, 0.05);
      lastFrame = timestamp;
      draw();
    }
    frame = requestAnimationFrame(animate);
  }

  function syncMotion() {
    cancelAnimationFrame(frame);
    frame = 0;
    if (!reducedMotion.matches && !paused && visible && !document.hidden) {
      lastFrame = performance.now();
      frame = requestAnimationFrame(animate);
    }
  }

  function resize() {
    const bounds = canvas.getBoundingClientRect();
    width = bounds.width;
    height = bounds.height;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  canvas.addEventListener('pointermove', event => {
    if (reducedMotion.matches || paused || event.pointerType === 'touch') return;
    const bounds = canvas.getBoundingClientRect();
    pointerX = ((event.clientX - bounds.left) / width - 0.5) * 0.3;
    pointerY = ((event.clientY - bounds.top) / height - 0.5) * 0.3;
  });
  canvas.addEventListener('pointerleave', () => { pointerX = 0; pointerY = 0; });
  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    syncMotion();
  }).observe(canvas);
  resize();
  return syncMotion;
}

const animations = [
  createHeroMotion(document.querySelector('#field'), reducedMotion, () => paused),
  ...[...document.querySelectorAll('[data-worlds]')].map(createWorlds),
];
function syncMotion() {
  controls.forEach(button => {
    button.hidden = reducedMotion.matches;
    button.textContent = paused ? 'Resume motion' : 'Pause motion';
  });
  animations.forEach(sync => sync());
}
controls.forEach(button => button.addEventListener('click', () => {
  paused = !paused;
  syncMotion();
}));
reducedMotion.addEventListener('change', syncMotion);
document.addEventListener('visibilitychange', syncMotion);
document.querySelector('#year').textContent = new Date().getFullYear();
syncMotion();
