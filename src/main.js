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

  function project(world, x, y, z) {
    x += world === 0 ? -0.98 : 0.98;
    y += world === 0 ? -0.18 : 0.18;
    const angle = 0.18 + tiltX;
    const px = x * Math.cos(angle) + z * Math.sin(angle);
    const pz = z * Math.cos(angle) - x * Math.sin(angle);
    const py = y * Math.cos(0.3 + tiltY) - pz * Math.sin(0.3 + tiltY);
    const scale = Math.min(width / 3.9, height / 2.65);
    return [width / 2 + (px * 0.99 - py * 0.14) * scale,
      height / 2 + (px * 0.14 + py * 0.99) * scale, pz];
  }

  function point(world, longitude, latitude) {
    return project(world, 0.8 * Math.cos(latitude) * Math.cos(longitude),
      0.8 * Math.sin(latitude), 0.8 * Math.cos(latitude) * Math.sin(longitude));
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);
    tiltX += (pointerX - tiltX) * 0.06;
    tiltY += (pointerY - tiltY) * 0.06;
    // The same geometry takes two forms: a continuous lattice and discrete nodes.
    for (let world = 0; world < 2; world++) {
      const rotation = time * (world === 0 ? 0.055 : -0.075);
      ctx.lineWidth = 0.65;
      for (let meridian = 0; meridian < 28; meridian++) {
        const u = meridian / 28 * Math.PI * 2 + rotation;
        ctx.beginPath();
        for (let step = 0; step <= 64; step++) {
          const p = point(world, u, -Math.PI / 2 + step / 64 * Math.PI);
          if (step === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]);
        }
        ctx.strokeStyle = world === 0 ? 'rgba(226,231,219,0.27)' : 'rgba(226,231,219,0.12)';
        ctx.stroke();
      }
      for (let latitude = 1; latitude < 22; latitude++) {
        const v = -Math.PI / 2 + latitude / 22 * Math.PI;
        ctx.beginPath();
        for (let step = 0; step <= 96; step++) {
          const p = point(world, step / 96 * Math.PI * 2, v);
          if (step === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]);
        }
        ctx.strokeStyle = world === 0 ? 'rgba(226,231,219,0.23)' : 'rgba(255,132,92,0.2)';
        ctx.stroke();
        if (world === 1) {
          for (let node = 0; node < 36; node++) {
            const p = point(world, node / 36 * Math.PI * 2 + rotation, v);
            ctx.fillStyle = p[2] > 0 ? 'rgba(245,239,222,0.72)' : 'rgba(245,239,222,0.2)';
            ctx.fillRect(p[0] - 0.7, p[1] - 0.7, 1.4, 1.4);
          }
        }
      }
    }
    // Signals travel both ways between corresponding points on the two worlds.
    for (let lane = 0; lane < 7; lane++) {
      const latitude = (lane - 3) * 0.17;
      const a = point(0, 0.22, latitude);
      const b = point(1, Math.PI - 0.22, latitude);
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.strokeStyle = 'rgba(255,113,65,0.3)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
      let progress = (time * 0.18 + lane / 7) % 1;
      if (lane % 2) progress = 1 - progress;
      const x = a[0] + (b[0] - a[0]) * progress;
      const y = a[1] + (b[1] - a[1]) * progress;
      ctx.fillStyle = '#ff835d';
      ctx.beginPath();
      ctx.arc(x, y, 1.8, 0, Math.PI * 2);
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

const animations = [...document.querySelectorAll('[data-worlds]')].map(createWorlds);
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
