const canvas = document.querySelector('#field');
const ctx = canvas.getContext('2d');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let visible = true;
let width = 0;
let height = 0;
let time = 0;
let lastFrame = 0;
let frame = 0;
let pointerX = 0;
let pointerY = 0;
let tiltX = 0;
let tiltY = 0;

// A toroidal field: individual filaments fold around a common core.
const filaments = Array.from({ length: 105 }, (_, i) => ({
  phase: i / 105 * Math.PI * 2,
  warm: i > 72 && i < 80,
}));

function project(u, v, rotation) {
  const ripple = Math.sin(u * 3 + v * 2 + time * 0.22) * 0.035;
  const r = 0.63 + ripple;
  const radius = 1.35 + r * Math.cos(v);
  let x = radius * Math.cos(u);
  let y = radius * Math.sin(u);
  let z = r * Math.sin(v);
  const rx = 0.93 + tiltY;
  const ry = -0.42 + tiltX;
  const y1 = y * Math.cos(rx) - z * Math.sin(rx);
  z = y * Math.sin(rx) + z * Math.cos(rx);
  const x1 = x * Math.cos(ry) + z * Math.sin(ry);
  z = -x * Math.sin(ry) + z * Math.cos(ry);
  x = x1 * Math.cos(rotation) - y1 * Math.sin(rotation);
  y = x1 * Math.sin(rotation) + y1 * Math.cos(rotation);
  const perspective = 5 / (5 - z);
  const scale = Math.min(width, height) * 0.215;
  return [width * 0.5 + x * scale * perspective, height * 0.5 + y * scale * perspective, z];
}

function draw() {
  if (!ctx) return;
  ctx.clearRect(0, 0, width, height);
  tiltX += (pointerX - tiltX) * 0.035;
  tiltY += (pointerY - tiltY) * 0.035;
  const rotation = -0.43 + Math.sin(time * 0.1) * 0.15;
  const segments = width < 700 ? 125 : 180;
  for (const filament of filaments) {
    const v = filament.phase + time * 0.105;
    ctx.beginPath();
    for (let j = 0; j <= segments; j++) {
      const u = j / segments * Math.PI * 2;
      const p = project(u, v + Math.sin(u * 2 + time * 0.15) * 0.22, rotation);
      if (j === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]);
    }
    const alpha = 0.15 + (Math.cos(v - 0.6) + 1) * 0.18;
    ctx.strokeStyle = filament.warm ? `rgba(255,105,61,${alpha + 0.1})` : `rgba(213,219,216,${alpha})`;
    ctx.lineWidth = filament.warm ? 0.8 : 0.65;
    ctx.stroke();
  }
  // Sparse travelling particles make the field's direction visible.
  for (let i = 0; i < 100; i++) {
    const u = i * 2.39996 + time * (0.12 + (i % 4) * 0.025);
    const v = i * 1.618 + time * 0.105;
    const p = project(u, v + Math.sin(u * 2 + time * 0.15) * 0.22, rotation);
    ctx.fillStyle = i % 9 === 0 ? '#ff835d' : `rgba(239,242,232,${0.3 + (p[2] + 1) * 0.2})`;
    ctx.beginPath();
    ctx.arc(p[0], p[1], i % 9 === 0 ? 1.5 : 0.8, 0, Math.PI * 2);
    ctx.fill();
  }
}

function animate(timestamp) {
  frame = 0;
  if (reducedMotion.matches || !visible || document.hidden) return;
  if (timestamp - lastFrame >= 1000 / 30) {
    time += Math.min((timestamp - lastFrame) / 1000, 0.05);
    lastFrame = timestamp;
    draw();
  }
  frame = requestAnimationFrame(animate);
}

function syncMotion() {
  if (frame) cancelAnimationFrame(frame);
  frame = 0;
  if (!reducedMotion.matches && visible && !document.hidden) {
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
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  draw();
}

reducedMotion.addEventListener('change', syncMotion);
document.addEventListener('visibilitychange', syncMotion);
canvas.addEventListener('pointermove', event => {
  if (reducedMotion.matches || event.pointerType === 'touch') return;
  const bounds = canvas.getBoundingClientRect();
  pointerX = ((event.clientX - bounds.left) / width - 0.5) * 0.3;
  pointerY = ((event.clientY - bounds.top) / height - 0.5) * 0.3;
});
canvas.addEventListener('pointerleave', () => { pointerX = 0; pointerY = 0; });
new ResizeObserver(resize).observe(canvas);
new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; syncMotion(); }).observe(canvas);
document.querySelector('#year').textContent = new Date().getFullYear();
resize();
syncMotion();
