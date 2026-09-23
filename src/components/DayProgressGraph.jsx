import { memo, useEffect, useMemo, useRef, useState } from 'react';
import * as SunCalc from 'suncalc';
import { ghiToLux } from '../lib/weather';

// Interactive day graph: temperature curve + lux fill + sun arc,
// highlighted sunrise/sunset + golden-hour bands, hover/touch pin.
const PAD = { t: 26, r: 14, b: 28, l: 36 };
const H = 190;

function smoothPath(pts) {
  if (pts.length < 2) return '';
  let d = `M ${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i === 0 ? 0 : i - 1];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x},${c1y} ${c2x},${c2y} ${p2[0]},${p2[1]}`;
  }
  return d;
}

function fmtLux(n) {
  if (n >= 10000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function fmtTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function DayProgressGraph({ hourly, nowIdx, sunrise, sunset, nowMs, lat, lon, units }) {
  const wrapRef = useRef(null);
  const [hover, setHover] = useState(null);
  const [pinned, setPinned] = useState(false);
  const [width, setWidth] = useState(640);
  const tUnit = units === 'imperial' ? 'F' : 'C';

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(280, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const series = useMemo(() => {
    if (!hourly?.time?.length) return null;
    const todayKey = new Date(nowMs).toDateString();
    let start = hourly.time.findIndex((t) => new Date(t).toDateString() === todayKey);
    if (start < 0) start = Math.max(0, nowIdx);
    const pts = [];
    for (let i = 0; i < 24 && start + i < hourly.time.length; i++) {
      const k = start + i;
      const t = new Date(hourly.time[k]);
      const ghi = hourly.shortwave_radiation[k] ?? 0;
      const lux = ghiToLux(ghi, hourly.is_day[k]);
      const tempC = hourly.temperature_2m[k];
      const temp = units === 'imperial' ? tempC * 9 / 5 + 32 : tempC;
      let elev = 0;
      try { elev = SunCalc.getPosition(t, lat, lon).altitude; }
      catch { elev = hourly.is_day[k] ? 0.4 : -0.4; }
      pts.push({ k, t, hour: t.getHours(), temp, lux, ghi, elev, isDay: hourly.is_day[k] === 1 });
    }
    if (!pts.length) return null;
    const tMin = Math.min(...pts.map((p) => p.temp)) - 1;
    const tMax = Math.max(...pts.map((p) => p.temp)) + 1;
    const luxMax = Math.max(1000, ...pts.map((p) => p.lux));
    return { pts, tMin, tMax, luxMax, start };
  }, [hourly, nowIdx, nowMs, lat, lon, units]);

  // Golden-hour / civil-twilight (sun ≈ −6°) — computed with series, no extra hook after early return
  const goldens = useMemo(() => {
    if (!series) return { dawnCivX: null, duskCivX: null, dayStartH: 0, dayEndH: 1 };
    const dayStart = series.pts[0].t.getTime();
    const dayEnd = series.pts[23].t.getTime() + 3600e3;
    const toFrac = (d) => {
      if (!d) return null;
      const x = new Date(d);
      if (Number.isNaN(x.getTime())) return null;
      return Math.min(1, Math.max(0, (x.getTime() - dayStart) / (dayEnd - dayStart)));
    };
    try {
      const times = SunCalc.getTimes(new Date(dayStart + 12 * 3600e3), lat, lon);
      const dawn = toFrac(times.civilDawn);
      const dusk = toFrac(times.civilDusk);
      const iwLocal = width - PAD.l - PAD.r;
      return {
        dawnCivX: dawn != null ? PAD.l + dawn * iwLocal : null,
        duskCivX: dusk != null ? PAD.l + dusk * iwLocal : null,
        dayStartH: dayStart,
        dayEndH: dayEnd,
      };
    } catch {
      return { dawnCivX: null, duskCivX: null, dayStartH: dayStart, dayEndH: dayEnd };
    }
  }, [series, lat, lon, width]);

  if (!series) return null;

  const { pts, tMin, tMax, luxMax } = series;
  const iw = width - PAD.l - PAD.r;
  const ih = H - PAD.t - PAD.b;
  const xAt = (i) => PAD.l + (i / 23) * iw;
  const yTemp = (v) => PAD.t + ih - ((v - tMin) / (tMax - tMin || 1)) * ih;
  const yLux = (v) => PAD.t + ih - (v / luxMax) * ih;

  const tempD = smoothPath(pts.map((p, i) => [xAt(i), yTemp(p.temp)]));
  const luxD = smoothPath(pts.map((p, i) => [xAt(i), yLux(p.lux)]));
  const luxArea = `${luxD} L ${xAt(23)},${PAD.t + ih} L ${xAt(0)},${PAD.t + ih} Z`;

  const dayStartH = pts[0].t.getTime();
  const dayEndH = pts[23].t.getTime() + 3600e3;
  const frac = (d) => {
    if (!d) return null;
    const x = new Date(d);
    if (Number.isNaN(x.getTime())) return null;
    return Math.min(1, Math.max(0, (x.getTime() - dayStartH) / (dayEndH - dayStartH)));
  };
  const srX = frac(sunrise) != null ? PAD.l + frac(sunrise) * iw : null;
  const ssX = frac(sunset) != null ? PAD.l + frac(sunset) * iw : null;

  const nowFrac = Math.min(1, Math.max(0, (nowMs - dayStartH) / (dayEndH - dayStartH)));
  const nowX = PAD.l + nowFrac * iw;
  const sunArcY = (e) => PAD.t + 10 + (1 - Math.min(1, Math.max(0, (e + 0.2) / 1.2))) * (ih * 0.35);
  const allLuxZero = luxMax <= 1 || pts.every((p) => p.lux === 0);

  const setIdxFromEvent = (e) => {
    const rect = wrapRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const x = clientX - rect.left;
    const i = Math.round(((x - PAD.l) / iw) * 23);
    setHover(Math.min(23, Math.max(0, i)));
  };
  const onMove = (e) => { if (!pinned) setIdxFromEvent(e); };
  const onDown = (e) => {
    setIdxFromEvent(e);
    setPinned((v) => !v);
  };

  const hv = hover != null ? pts[hover] : null;
  const ticks = pts.filter((_, i) => i % 3 === 0);
  const riseLabel = fmtTime(sunrise);
  const setLabel = fmtTime(sunset);

  const srPillX = srX != null ? Math.min(PAD.l + iw - 4, Math.max(PAD.l + 2, srX)) : null;
  const ssPillX = ssX != null ? Math.min(PAD.l + iw - 4, Math.max(PAD.l + 2, ssX)) : null;

  return (
    <div
      ref={wrapRef}
      className="relative select-none touch-pan-y"
      onMouseMove={onMove}
      onMouseLeave={() => { if (!pinned) setHover(null); }}
      onTouchStart={onDown}
      onTouchMove={(e) => { if (!pinned) setIdxFromEvent(e); }}
    >
      <svg
        viewBox={`0 0 ${width} ${H}`}
        width="100%"
        height={H}
        role="img"
        aria-label={`Day progression: sunrise ${riseLabel}, sunset ${setLabel}, temperature and lux`}
        className="block overflow-visible"
      >
        <defs>
          <linearGradient id="luxFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.5" />
            <stop offset="55%" stopColor="#fb923c" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="tempStroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#7dd3fc" />
            <stop offset="50%" stopColor="#fde68a" />
            <stop offset="100%" stopColor="#fdba74" />
          </linearGradient>
          <linearGradient id="dayBand" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.22" />
            <stop offset="50%" stopColor="#fde68a" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.22" />
          </linearGradient>
          <linearGradient id="nightBand" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1e1b4b" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#0f172a" stopOpacity="0.35" />
          </linearGradient>
          <linearGradient id="goldenUp" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#fde68a" stopOpacity="0" />
            <stop offset="50%" stopColor="#fbbf24" stopOpacity="0.38" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.08" />
          </linearGradient>
          <linearGradient id="goldenDown" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.08" />
            <stop offset="50%" stopColor="#fb923c" stopOpacity="0.38" />
            <stop offset="100%" stopColor="#fde68a" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="sunG" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fff7ed" />
            <stop offset="100%" stopColor="#fbbf24" />
          </linearGradient>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* night wash outside day band */}
        <rect x={PAD.l} y={PAD.t} width={iw} height={ih} rx="8" fill="url(#nightBand)" />
        {/* day band sunrise → sunset */}
        {srX != null && ssX != null && ssX > srX && (
          <rect x={srX} y={PAD.t} width={ssX - srX} height={ih} fill="url(#dayBand)" />
        )}
        {/* golden-hour / civil-twilight strips */}
        {goldens.dawnCivX != null && srX != null && srX > goldens.dawnCivX && (
          <rect x={goldens.dawnCivX} y={PAD.t} width={srX - goldens.dawnCivX} height={ih} fill="url(#goldenUp)" />
        )}
        {ssX != null && goldens.duskCivX != null && goldens.duskCivX > ssX && (
          <rect x={ssX} y={PAD.t} width={goldens.duskCivX - ssX} height={ih} fill="url(#goldenDown)" />
        )}

        {[0, 0.5, 1].map((f) => {
          const y = PAD.t + f * ih;
          const tv = tMax - f * (tMax - tMin);
          return (
            <g key={f}>
              <line x1={PAD.l} x2={PAD.l + iw} y1={y} y2={y} stroke="rgb(255 255 255 / 0.08)" strokeDasharray="3 4" />
              <text x={PAD.l - 6} y={y + 3} textAnchor="end" fontSize="9" fill="rgb(255 255 255 / 0.4)">
                {Math.round(tv)}°
              </text>
            </g>
          );
        })}

        <path d={luxArea} fill="url(#luxFill)" />
        <path
          d={smoothPath(pts.map((p, i) => [xAt(i), sunArcY(p.elev)]))}
          fill="none"
          stroke="rgb(253 224 71 / 0.35)"
          strokeWidth="1.5"
          strokeDasharray="2 3"
        />
        <path d={tempD} fill="none" stroke="url(#tempStroke)" strokeWidth="2.5" strokeLinecap="round" />

        {/* Sunrise marker: gradient line + icon + time pill */}
        {srX != null && (
          <g filter="url(#glow)">
            <line x1={srX} x2={srX} y1={PAD.t} y2={PAD.t + ih} stroke="#fbbf24" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.9" />
            <circle cx={srX} cy={PAD.t + ih} r="3.5" fill="#fbbf24" />
            <g transform={`translate(${srPillX}, ${PAD.t - 6})`}>
              <rect x="-34" y="-12" width="68" height="16" rx="8" fill="rgb(120 53 15 / 0.92)" stroke="rgb(251 191 36 / 0.55)" />
              <text textAnchor="middle" y="0" fontSize="9" fill="#fde68a" fontWeight="600">
                ↑ {riseLabel} rise
              </text>
            </g>
          </g>
        )}
        {/* Sunset marker */}
        {ssX != null && (
          <g filter="url(#glow)">
            <line x1={ssX} x2={ssX} y1={PAD.t} y2={PAD.t + ih} stroke="#fb923c" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.9" />
            <circle cx={ssX} cy={PAD.t + ih} r="3.5" fill="#fb923c" />
            <g transform={`translate(${ssPillX}, ${PAD.t - 6})`}>
              <rect x="-34" y="-12" width="68" height="16" rx="8" fill="rgb(124 45 18 / 0.92)" stroke="rgb(251 146 60 / 0.55)" />
              <text textAnchor="middle" y="0" fontSize="9" fill="#ffedd5" fontWeight="600">
                ↓ {setLabel} set
              </text>
            </g>
          </g>
        )}

        {(() => {
          const i = Math.min(23, Math.max(0, Math.round(nowFrac * 23)));
          const p = pts[i];
          if (!p) return null;
          const sx = nowX;
          const sy = sunArcY(p.elev);
          const night = p.elev < -0.05;
          return (
            <g>
              <circle cx={sx} cy={sy} r="7" fill={night ? '#e2e8f0' : 'url(#sunG)'} opacity="0.95" filter="url(#glow)" />
              {!night && <circle cx={sx} cy={sy} r="11" fill="none" stroke="rgb(253 224 71 / 0.35)" strokeWidth="2" />}
              <line x1={sx} x2={sx} y1={PAD.t} y2={PAD.t + ih} stroke="rgb(255 255 255 / 0.4)" strokeWidth="1" />
              <g transform={`translate(${sx}, ${PAD.t + ih + 14})`}>
                <rect x="-18" y="-9" width="36" height="14" rx="7" fill="rgb(15 23 42 / 0.9)" stroke="rgb(255 255 255 / 0.2)" />
                <text textAnchor="middle" y="1" fontSize="8" fill="#e2e8f0" fontWeight="600">now</text>
              </g>
            </g>
          );
        })()}

        {hover != null && hv && (
          <g pointerEvents="none">
            <line x1={xAt(hover)} x2={xAt(hover)} y1={PAD.t} y2={PAD.t + ih} stroke="rgb(255 255 255 / 0.4)" strokeWidth="1" />
            <circle cx={xAt(hover)} cy={yLux(hv.lux)} r="3.5" fill="#fbbf24" />
            <circle cx={xAt(hover)} cy={yTemp(hv.temp)} r="4" fill="#fff" stroke="#38bdf8" strokeWidth="2" />
            <g transform={`translate(${xAt(hover)},${PAD.t - 4})`}>
              <rect x="-30" y="-12" width="60" height="16" rx="8" fill="rgb(15 23 42 / 0.92)" stroke="rgb(255 255 255 / 0.18)" />
              <text textAnchor="middle" y="0" fontSize="9" fill="#fff">
                {String(hv.hour).padStart(2, '0')}:00 · {Math.round(hv.temp)}°{tUnit}
              </text>
            </g>
          </g>
        )}

        {ticks.map((p, ti) => (
          <text key={p.hour} x={xAt(ti * 3)} y={H - 8} textAnchor="middle" fontSize="9" fill="rgb(255 255 255 / 0.4)">
            {String(p.hour).padStart(2, '0')}
          </text>
        ))}
      </svg>

      {allLuxZero && (
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center pointer-events-none">
          <span className="text-[11px] text-white/55 bg-slate-950/50 px-3 py-1 rounded-full">
            Sun returns {riseLabel}
          </span>
        </div>
      )}

      <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[11px] text-white/55">
        <div className="flex flex-wrap gap-3">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-4 rounded-full" style={{ background: 'linear-gradient(90deg,#7dd3fc,#fde68a,#fdba74)' }} />
            Temp {Math.round(pts[0].temp)}° → peak {Math.round(tMax)}°{tUnit}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-4 rounded-full bg-gradient-to-b from-amber-400/70 to-amber-600/20" />
            Lux 0 → {fmtLux(luxMax)}
          </span>
          <span className="flex items-center gap-1.5 text-amber-200/80">
            <span className="inline-block h-2 w-4 rounded-full" style={{ background: 'linear-gradient(90deg,#fde68a88,#fbbf24,#fb923c)' }} />
            Golden hour
          </span>
        </div>
        <div className="flex items-center gap-2 tabular-nums text-white/70">
          {hv ? (
            <>
              <span>
                <b className="text-white">{String(hv.hour).padStart(2, '0')}:00</b>
                {' · '}{Math.round(hv.temp)}°{tUnit} · {fmtLux(hv.lux)} lux
                {hv.elev > 0 ? ` · sun ${Math.round((hv.elev * 180) / Math.PI)}°` : ' · night'}
              </span>
              {pinned && (
                <button
                  onClick={() => { setPinned(false); setHover(null); }}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-white/15 hover:bg-white/25 text-white/80"
                  aria-label="Dismiss pin"
                >
                  ✕
                </button>
              )}
            </>
          ) : (
            <span className="text-white/40">Hover / tap to pin hour</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(DayProgressGraph);
