import { memo, useEffect, useRef } from 'react';
import * as SunCalc from 'suncalc';
import { conditionKind } from '../lib/weather';

// Performance budget: viewport-sized canvas, DPR capped, 30fps,
// cached sky + pre-rendered soft cloud sprites, paused when tab hidden.
const DPR_CAP = 1.5;
const FRAME_MS = 1000 / 30;
const TAU = Math.PI * 2;

function stopsFor(kind, elev) {
  if (elev > 0.35) {
    if (kind === 'clear') return ['#0ea5e9', '#38bdf8', '#bae6fd'];
    if (kind === 'partly') return ['#38bdf8', '#7dd3fc', '#e0f2fe'];
    if (kind === 'cloudy' || kind === 'fog') return ['#64748b', '#94a3b8', '#cbd5e1'];
    if (kind === 'rain' || kind === 'drizzle' || kind === 'storm') return ['#1e293b', '#475569', '#94a3b8'];
    return ['#94a3b8', '#cbd5e1', '#f1f5f9']; // snow
  }
  if (elev > -0.12) return ['#312e81', '#ea580c', '#fbbf24']; // golden hour
  if (elev > -0.35) return ['#0f172a', '#1e1b4b', '#4c1d95']; // blue hour
  return ['#020617', '#0f172a', '#1e1b4e']; // night
}

/**
 * Pre-render a soft cumulus cloud sprite (radial puffs, no hard ellipse edges).
 * tone: 'light' | 'dark'
 */
function makeCloudSprite(size, tone, seed) {
  const c = document.createElement('canvas');
  // soft sprite is smaller than display — browser scales smoothly
  const s = Math.round(size);
  c.width = s;
  c.height = Math.round(s * 0.55);
  const g = c.getContext('2d');
  const rnd = mulberry32(seed);
  const base = tone === 'dark'
    ? { r: 51, g: 65, b: 85, a: 0.55 }
    : { r: 255, g: 255, b: 255, a: 0.72 };
  const lit = tone === 'dark'
    ? { r: 100, g: 116, b: 139, a: 0.35 }
    : { r: 248, g: 250, b: 252, a: 0.85 };

  const w = c.width, h = c.height;
  const puffs = [];
  // main body — wide, low
  const n = 7 + Math.floor(rnd() * 5);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1 || 1);
    const px = w * (0.15 + t * 0.7 + (rnd() - 0.5) * 0.06);
    // taller in the middle → classic cumulus silhouette
    const bulge = Math.sin(t * Math.PI);
    const pr = h * (0.18 + bulge * 0.28 + rnd() * 0.08);
    const py = h * 0.68 - bulge * h * 0.28 + (rnd() - 0.5) * h * 0.06;
    puffs.push({ x: px, y: py, r: pr });
  }
  // top puffs
  for (let i = 0; i < 3; i++) {
    puffs.push({
      x: w * (0.35 + rnd() * 0.3),
      y: h * (0.28 + rnd() * 0.15),
      r: h * (0.16 + rnd() * 0.12),
    });
  }

  // soft under-shadow (bottom)
  for (const p of puffs) {
    const grad = g.createRadialGradient(p.x, p.y + p.r * 0.15, 0, p.x, p.y + p.r * 0.15, p.r);
    grad.addColorStop(0, `rgba(${base.r},${base.g},${base.b},${base.a})`);
    grad.addColorStop(0.65, `rgba(${base.r},${base.g},${base.b},${base.a * 0.55})`);
    grad.addColorStop(1, `rgba(${base.r},${base.g},${base.b},0)`);
    g.fillStyle = grad;
    g.beginPath();
    g.arc(p.x, p.y + p.r * 0.15, p.r, 0, TAU);
    g.fill();
  }
  // lit tops
  g.globalCompositeOperation = 'lighter';
  for (const p of puffs) {
    const grad = g.createRadialGradient(p.x - p.r * 0.2, p.y - p.r * 0.25, 0, p.x, p.y, p.r * 0.85);
    grad.addColorStop(0, `rgba(${lit.r},${lit.g},${lit.b},${lit.a * 0.5})`);
    grad.addColorStop(1, `rgba(${lit.r},${lit.g},${lit.b},0)`);
    g.fillStyle = grad;
    g.beginPath();
    g.arc(p.x - p.r * 0.1, p.y - p.r * 0.15, p.r * 0.8, 0, TAU);
    g.fill();
  }
  g.globalCompositeOperation = 'source-over';

  // feather the sprite edges once
  try {
    const id = g.getImageData(0, 0, c.width, c.height);
    // cheap edge fade: multiply alpha near borders
    const { data, width: W, height: Hh } = id;
    const m = Math.max(4, Math.round(Math.min(W, Hh) * 0.08));
    for (let y = 0; y < Hh; y++) {
      for (let x = 0; x < W; x++) {
        const edge = Math.min(x, W - 1 - x, y, Hh - 1 - y);
        if (edge < m) {
          const f = edge / m;
          data[(y * W + x) * 4 + 3] = Math.round(data[(y * W + x) * 4 + 3] * f);
        }
      }
    }
    g.putImageData(id, 0, 0);
  } catch { /* tainted or unsupported — still fine */ }

  return c;
}

function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function SkyCanvas({ weatherCode, cloudCover, lat, lon, dateMs, isDay }) {
  const ref = useRef(null);
  const sim = useRef(null);
  const coverBucket = Math.round(cloudCover / 10) * 10;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    const kind = conditionKind(weatherCode);
    const stormy = kind === 'storm' || kind === 'rain' || kind === 'drizzle';
    // Respect prefers-reduced-motion: static single paint, no loop
    const reduceMotion = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    let w = 0, h = 0, dpr = 1;

    // pre-rendered cloud sprites (rebuilt on resize)
    let sprites = [];
    let spriteW = 0;
    const bg = document.createElement('canvas');
    const bgCache = { key: '' };

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
      w = Math.max(1, Math.floor(window.innerWidth * dpr));
      h = Math.max(1, Math.floor(window.innerHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      bgCache.key = '';
      spriteW = 0; // force sprite rebuild at new scale
    };

    const nClouds = 3 + Math.round((coverBucket / 100) * 7); // 3–10
    const tone = stormy || kind === 'cloudy' || kind === 'fog' ? 'dark' : 'light';
    const S = (sim.current = {
      clouds: Array.from({ length: nClouds }, (_, i) => ({
        x: Math.random() * 1.2 - 0.1,
        y: 0.06 + Math.random() * 0.42,
        // parallax: higher clouds move slower
        depth: 0.45 + Math.random() * 0.55,
        scale: 0.55 + Math.random() * 0.95,
        v: (0.00008 + Math.random() * 0.00028) * (stormy ? 2.2 : 1),
        seed: (i * 9973 + 17) >>> 0,
        flip: Math.random() > 0.5 ? -1 : 1,
      })),
      drops: stormy
        ? Array.from({ length: kind === 'storm' ? 120 : 85 }, () => ({
            x: Math.random(), y: Math.random(), v: 0.010 + Math.random() * 0.016,
          }))
        : [],
      flakes: kind === 'snow'
        ? Array.from({ length: 90 }, () => ({
            x: Math.random(), y: Math.random(), v: 0.0012 + Math.random() * 0.0022, p: Math.random() * TAU,
          }))
        : [],
      stars: Array.from({ length: 70 }, () => ({
        x: Math.random(), y: Math.random() * 0.65, r: Math.random(), p: Math.random() * TAU,
      })),
      flash: 0,
      elev: 0, azim: 0, moonFrac: 0,
    });

    const baseSpriteW = () => Math.round(Math.min(420, Math.max(220, w * 0.38)));
    const buildSprites = () => {
      const sw = baseSpriteW();
      if (sw === spriteW && sprites.length) return;
      spriteW = sw;
      sprites = S.clouds.map((cl) => makeCloudSprite(sw, tone, cl.seed));
    };

    const computeAstro = () => {
      try {
        const pos = SunCalc.getPosition(new Date(dateMs), lat, lon);
        let elev = pos.altitude;
        if (isDay === 1 && elev < 0.08) elev = 0.55;
        if (isDay === 0 && elev > -0.15) elev = -0.35;
        S.elev = elev;
        S.azim = pos.azimuth;
        S.moonFrac = SunCalc.getMoonIllumination(new Date(dateMs)).fraction;
      } catch { /* keep last */ }
      bgCache.key = '';
    };
    computeAstro();
    const astroTimer = setInterval(computeAstro, 30000);

    const paintBg = () => {
      const stops = stopsFor(kind, S.elev);
      const key = stops.join('|') + `|${w}x${h}`;
      if (key === bgCache.key) return;
      bgCache.key = key;
      bg.width = w;
      bg.height = h;
      const b = bg.getContext('2d');
      const g = b.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, stops[0]);
      g.addColorStop(0.5, stops[1]);
      g.addColorStop(1, stops[2]);
      b.fillStyle = g;
      b.fillRect(0, 0, w, h);

      // atmospheric horizon haze
      const haze = b.createLinearGradient(0, h * 0.55, 0, h);
      haze.addColorStop(0, 'rgba(255,255,255,0)');
      haze.addColorStop(1, S.elev > 0 ? 'rgba(255,248,230,0.14)' : 'rgba(30,41,59,0.35)');
      b.fillStyle = haze;
      b.fillRect(0, h * 0.55, w, h * 0.45);

      if (S.elev < 0.05) {
        const a = Math.min(0.9, 0.1 - S.elev);
        b.fillStyle = '#fff';
        for (const s of S.stars) {
          b.globalAlpha = a * (0.35 + 0.65 * s.r);
          const r = Math.max(1, dpr * (0.6 + s.r));
          b.beginPath();
          b.arc(s.x * w, s.y * h, r, 0, TAU);
          b.fill();
        }
        b.globalAlpha = 1;
      }
    };

    let raf = 0, last = 0, t = 0;
    const night = () => S.elev <= -0.12;

    const draw = (now) => {
      raf = requestAnimationFrame(draw);
      if (document.hidden) { last = now; return; }
      if (now - last < FRAME_MS) return;
      last = now;
      t += 0.033;

      paintBg();
      buildSprites();
      ctx.drawImage(bg, 0, 0);

      // --- sun / moon ---
      const mx = w * 0.5 + Math.cos(S.azim) * w * 0.32;
      const my = h * (0.72 - (S.elev + 0.5) * 0.85);
      if (!night()) {
        const R = Math.max(50 * dpr, w * 0.22);
        const glow = ctx.createRadialGradient(mx, my, 0, mx, my, R);
        glow.addColorStop(0, 'rgba(255,255,240,0.95)');
        glow.addColorStop(0.2, 'rgba(255,230,140,0.55)');
        glow.addColorStop(0.5, 'rgba(255,200,80,0.2)');
        glow.addColorStop(1, 'rgba(255,200,80,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(mx - R, my - R, R * 2, R * 2);
        const disc = Math.max(12 * dpr, w * 0.034);
        ctx.fillStyle = '#fffbeb';
        ctx.beginPath();
        ctx.arc(mx, my, disc, 0, TAU);
        ctx.fill();
      } else {
        const mr = Math.max(9 * dpr, w * 0.024);
        // soft moon glow
        const mg = ctx.createRadialGradient(w * 0.72, h * 0.22, 0, w * 0.72, h * 0.22, mr * 4);
        mg.addColorStop(0, 'rgba(226,232,240,0.35)');
        mg.addColorStop(1, 'rgba(226,232,240,0)');
        ctx.fillStyle = mg;
        ctx.fillRect(w * 0.72 - mr * 4, h * 0.22 - mr * 4, mr * 8, mr * 8);
        ctx.fillStyle = '#f8fafc';
        ctx.beginPath();
        ctx.arc(w * 0.72, h * 0.22, mr, 0, TAU);
        ctx.fill();
        ctx.fillStyle = 'rgba(15,23,42,0.5)';
        ctx.beginPath();
        ctx.arc(w * 0.72 - mr * 0.45 * (1 - S.moonFrac), h * 0.215, mr * 0.9, 0, TAU);
        ctx.fill();
      }

      // --- star twinkle ---
      if (S.elev < 0.05) {
        ctx.fillStyle = '#fff';
        for (let i = 0; i < 24; i++) {
          const s = S.stars[i];
          ctx.globalAlpha = 0.2 + 0.55 * (0.5 + 0.5 * Math.sin(t * 1.7 + s.p));
          ctx.fillRect(s.x * w, s.y * h, Math.max(1, dpr), Math.max(1, dpr));
        }
        ctx.globalAlpha = 1;
      }

      // --- natural clouds (soft sprites, parallax, wrap) ---
      // far → near for depth
      const order = S.clouds
        .map((c, i) => ({ c, i }))
        .sort((a, b) => a.c.depth - b.c.depth);
      const show = Math.max(2, Math.round((coverBucket / 100) * S.clouds.length));
      let shown = 0;
      for (const { c: cl, i } of order) {
        if (shown >= show) break;
        shown++;
        cl.x += cl.v * cl.depth;
        if (cl.x > 1.35) cl.x = -0.35;
        const sprite = sprites[i];
        if (!sprite) continue;
        const drawW = spriteW * cl.scale;
        const drawH = drawW * (sprite.height / sprite.width);
        const cx = cl.x * w;
        const cy = cl.y * h + Math.sin(t * 0.15 + i) * 3 * dpr; // gentle bob
        ctx.save();
        ctx.translate(cx, cy);
        if (cl.flip < 0) ctx.scale(-1, 1);
        // distant clouds slightly faded
        ctx.globalAlpha = 0.55 + cl.depth * 0.45;
        ctx.drawImage(sprite, -drawW / 2, -drawH / 2, drawW, drawH);
        ctx.restore();
      }
      ctx.globalAlpha = 1;

      // --- rain (batched) ---
      if (S.drops.length) {
        ctx.strokeStyle = 'rgba(203,213,225,0.5)';
        ctx.lineWidth = Math.max(1, 1.1 * dpr);
        ctx.beginPath();
        const len = 18 * dpr;
        const wind = kind === 'storm' ? 8 : 4;
        for (const dr of S.drops) {
          dr.y += dr.v;
          if (dr.y > 1) { dr.y = -0.02; dr.x = Math.random(); }
          const px = dr.x * w, py = dr.y * h;
          ctx.moveTo(px, py);
          ctx.lineTo(px - wind * dpr, py + len);
        }
        ctx.stroke();
        if (kind === 'storm' && Math.random() < 0.03) S.flash = 1;
        if (S.flash > 0) {
          ctx.fillStyle = `rgba(255,255,255,${(S.flash * 0.38).toFixed(3)})`;
          ctx.fillRect(0, 0, w, h);
          S.flash -= 0.1;
        }
      }

      // --- snow ---
      if (S.flakes.length) {
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        ctx.beginPath();
        const fr = 2 * dpr;
        for (const f of S.flakes) {
          f.y += f.v;
          f.p += 0.03;
          if (f.y > 1) { f.y = 0; f.x = Math.random(); }
          const fx = f.x * w + Math.sin(f.p) * 12 * dpr;
          const fy = f.y * h;
          ctx.moveTo(fx + fr, fy);
          ctx.arc(fx, fy, fr, 0, TAU);
        }
        ctx.fill();
      }

      // --- fog banks ---
      if (kind === 'fog' || kind === 'cloudy') {
        for (let i = 0; i < 3; i++) {
          const fy = h * (0.52 + i * 0.15) + Math.sin(t * 0.4 + i * 1.7) * 8 * dpr;
          const fh = h * 0.12;
          const fog = ctx.createLinearGradient(0, fy, 0, fy + fh);
          fog.addColorStop(0, 'rgba(226,232,240,0)');
          fog.addColorStop(0.5, 'rgba(226,232,240,0.12)');
          fog.addColorStop(1, 'rgba(226,232,240,0)');
          ctx.fillStyle = fog;
          ctx.fillRect(0, fy, w, fh);
        }
      }
    };

    resize();
    window.addEventListener('resize', resize);
    if (reduceMotion) {
      // one static frame for reduced-motion users
      paintBg();
      buildSprites();
      ctx.drawImage(bg, 0, 0);
    } else {
      raf = requestAnimationFrame(draw);
    }
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(astroTimer);
      window.removeEventListener('resize', resize);
      sim.current = null;
      sprites = [];
    };
  }, [weatherCode, coverBucket, lat, lon, dateMs, isDay]);

  return <canvas ref={ref} className="block h-full w-full" aria-hidden="true" />;
}

export default memo(SkyCanvas);
