import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as SunCalc from 'suncalc';
import {
  Search, MapPin, Sun, Droplets, Wind, Eye, Gauge, Leaf, Sprout, Zap,
  Moon, Sunrise, Sunset, Shirt, Brain, Telescope, FlaskConical, X, ChevronDown,
  RefreshCw, CloudSun, CloudMoon, Cloud, CloudFog,
  CloudRain, CloudLightning, CloudSnow, ArrowUp, Pin, ShieldAlert, Sparkles,
  Share2, Download, Radar, Activity, LayoutGrid, Wind as WindIcon,
} from 'lucide-react';
import SkyCanvas from './components/SkyCanvas';
import DayProgressGraph from './components/DayProgressGraph';
import RadarMap from './components/RadarMap';
import AlertsPanel from './components/AlertsPanel';
import {
  fetchWeather, WMO, luxCategory, deriveExtras, ghiToLux,
  clothingAdvice, headacheRisk, stargazingScore, solarDayKwh, DEMOS,
  conditionAccent, conditionIconKey, aqiInfo, toTemp, fmtTemp, toSpeed, speedUnit, windDir,
  germIndex, pollenInfo, skinExposure, SKIN_TYPES,
  decisionBrief, sunsetQuality, outdoorWindow, fetchModelConfidence,
} from './lib/weather';
import { fetchNightSky, fetchMeteorShowers } from './lib/nightsky';
import { fetchAuroraKp, auroraLatHint } from './lib/aurora';
import { downloadShareCard } from './lib/share';
import { readCache, writeCache } from './lib/cache';

const DEFAULT_PINS = [
  { name: 'Mumbai', lat: 19.076, lon: 72.8777 },
];
const MAX_PINS = 8;

const TABS = [
  { id: 'today', label: 'Today', icon: Sun },
  { id: 'air', label: 'Air', icon: Leaf },
  { id: 'sky', label: 'Sky', icon: Sparkles },
  { id: 'health', label: 'Health', icon: Activity },
];

function loadPins() {
  try {
    const raw = localStorage.getItem('wx-pins');
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length) return arr;
    }
  } catch { /* fall through */ }
  return DEFAULT_PINS;
}

const HERO_ICONS = {
  sun: Sun, 'cloud-sun': CloudSun, 'cloud-moon': CloudMoon, moon: Moon,
  cloud: Cloud, 'cloud-fog': CloudFog, 'cloud-rain': CloudRain,
  'cloud-lightning': CloudLightning, 'cloud-snow': CloudSnow, sunset: Sunrise,
};

function Card({ children, className = '', accent }) {
  const style = accent
    ? {
        borderColor: `rgba(${accent.rgb}, 0.28)`,
        boxShadow: `0 8px 28px rgb(2 6 23 / 0.22), inset 0 1px 0 rgb(255 255 255 / 0.06), 0 0 24px -8px rgba(${accent.rgb}, 0.35)`,
      }
    : undefined;
  return (
    <section className={`glass rounded-3xl p-4 sm:p-5 ${className}`} style={style}>
      {children}
    </section>
  );
}

function Label({ icon: Icon, text }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-white/55">
      <Icon size={13} className="shrink-0" />
      <span className="truncate">{text}</span>
    </div>
  );
}

function StatTile({ icon: Icon, label, value, unit, hint, accent }) {
  return (
    <Card className="min-w-0" accent={accent}>
      <Label icon={Icon} text={label} />
      <div className="mt-2 text-2xl sm:text-3xl font-light tracking-tight sky-text tabular-nums">
        {value}
        {unit && <span className="ml-1 text-xs sm:text-sm text-white/55 font-normal">{unit}</span>}
      </div>
      {hint && <div className="mt-1 text-xs text-white/55 leading-snug">{hint}</div>}
    </Card>
  );
}

function SkeletonScreen() {
  return (
    <div className="min-h-screen relative" role="status" aria-label="Loading weather">
      <div className="fixed inset-0 bg-gradient-to-b from-slate-800 via-slate-900 to-slate-950" aria-hidden="true" />
      <div className="relative z-10 mx-auto max-w-3xl px-3 sm:px-4 pt-4 pb-16">
        <div className="h-11 rounded-2xl bg-white/8 shimmer" />
        <div className="mt-3 flex gap-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-8 w-20 rounded-full bg-white/8 shimmer" />
          ))}
        </div>
        <div className="mt-8 text-center space-y-3">
          <div className="mx-auto h-4 w-32 rounded bg-white/10 shimmer" />
          <div className="mx-auto h-24 w-48 rounded-2xl bg-white/10 shimmer" />
          <div className="mx-auto h-5 w-40 rounded bg-white/8 shimmer" />
        </div>
        <div className="mt-8 h-44 rounded-3xl bg-white/8 shimmer" />
        <div className="mt-4 h-48 rounded-3xl bg-white/8 shimmer" />
        <p className="mt-6 text-center text-sm text-white/45">Loading sky…</p>
      </div>
    </div>
  );
}

function useCountUp(target, ms = 550) {
  const [val, setVal] = useState(target);
  const from = useRef(target);
  const raf = useRef(0);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    const b = target;
    if (a === b) return;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / ms);
      const e = 1 - Math.pow(1 - t, 3);
      setVal(Math.round(a + (b - a) * e));
      if (t < 1) raf.current = requestAnimationFrame(tick);
      else from.current = b;
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, ms]);
  useEffect(() => { from.current = val; }, [val]);
  return val;
}

const TONE_COLORS = {
  alert: 'text-rose-200 bg-rose-400/15 border-rose-300/40',
  warn: 'text-amber-200 bg-amber-400/12 border-amber-300/40',
  ok: 'text-emerald-200 bg-emerald-400/12 border-emerald-300/40',
  neutral: 'text-white/70 bg-white/8 border-white/15',
};

export default function App() {
  const [pins, setPins] = useState(loadPins);
  const [loc, setLoc] = useState(() => loadPins()[0] || DEFAULT_PINS[0]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [demoId, setDemoId] = useState(null);
  const [demoOpen, setDemoOpen] = useState(false);
  const [sysKw, setSysKw] = useState(3);
  const [units, setUnits] = useState(() => localStorage.getItem('wx-units') || 'metric');
  const [skinType, setSkinType] = useState(() => {
    const n = Number(localStorage.getItem('wx-skin'));
    return n >= 1 && n <= 6 ? n : 3;
  });
  const [nightSky, setNightSky] = useState(null);
  const [showers, setShowers] = useState([]);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [updatedAt, setUpdatedAt] = useState(null);
  const [scrolled, setScrolled] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [tab, setTab] = useState('today');
  const [modelConf, setModelConf] = useState(null);
  const [aurora, setAurora] = useState(null);
  const [sharing, setSharing] = useState(false);
  const [shareMsg, setShareMsg] = useState('');
  const [pullY, setPullY] = useState(0);
  const heroRef = useRef(null);
  const touchStartY = useRef(0);
  const touchActive = useRef(false);
  const swipeRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('wx-units', units);
  }, [units]);

  useEffect(() => {
    localStorage.setItem('wx-skin', String(skinType));
  }, [skinType]);

  useEffect(() => {
    localStorage.setItem('wx-pins', JSON.stringify(pins));
  }, [pins]);

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 72);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const d = await fetchWeather(loc.lat, loc.lon);
      setData(d);
      setUpdatedAt(Date.now());
      writeCache(loc.lat, loc.lon, d);
    } catch {
      setError('Could not reach Open-Meteo. Check your connection.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loc]);

  useEffect(() => {
    let dead = false;
    setLoading(true);
    setError(null);
    // Instant paint from cache (if fresh)
    const cached = readCache(loc.lat, loc.lon);
    if (cached?.data) {
      setData(cached.data);
      setLoading(false);
      setUpdatedAt(cached.at);
    }
    fetchWeather(loc.lat, loc.lon)
      .then((d) => {
        if (!dead) {
          setData(d);
          setLoading(false);
          setUpdatedAt(Date.now());
          writeCache(loc.lat, loc.lon, d);
        }
      })
      .catch(() => {
        if (!dead && !cached?.data) {
          setError('Could not reach Open-Meteo. Check your connection.');
          setLoading(false);
        } else if (!dead) {
          setLoading(false);
        }
      });
    return () => { dead = true; };
  }, [loc, reloadKey]);

  useEffect(() => {
    let dead = false;
    setNightSky(null);
    fetchNightSky(loc.lat, loc.lon).then((d) => { if (!dead) setNightSky(d); });
    return () => { dead = true; };
  }, [loc, reloadKey]);

  useEffect(() => {
    let dead = false;
    fetchMeteorShowers().then((d) => { if (!dead && d.ok) setShowers(d.showers); });
    return () => { dead = true; };
  }, []);

  // Aurora Kp (once + on reload)
  useEffect(() => {
    let dead = false;
    fetchAuroraKp().then((d) => { if (!dead) setAurora(d); });
    return () => { dead = true; };
  }, [reloadKey]);

  // Multi-model confidence (throttled — on location change only)
  useEffect(() => {
    let dead = false;
    setModelConf(null);
    fetchModelConfidence(loc.lat, loc.lon).then((d) => { if (!dead) setModelConf(d); });
    return () => { dead = true; };
  }, [loc, reloadKey]);

  useEffect(() => {
    if (q.length < 2) { setResults([]); return; }
    const ctrl = new AbortController();
    const id = setTimeout(async () => {
      try {
        const r = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=5&language=en&format=json`,
          { signal: ctrl.signal },
        );
        const j = await r.json();
        setResults(j.results || []);
      } catch { /* aborted */ }
    }, 350);
    return () => { clearTimeout(id); ctrl.abort(); };
  }, [q]);

  const sunTimes = useMemo(() => SunCalc.getTimes(new Date(nowMs), loc.lat, loc.lon), [nowMs, loc]);
  const moon = useMemo(() => SunCalc.getMoonIllumination(new Date(nowMs)), [nowMs]);

  const demo = useMemo(() => DEMOS.find((dm) => dm.id === demoId), [demoId]);
  const c = useMemo(
    () => (data ? (demo ? { ...data.raw.current, ...demo.values } : data.raw.current) : null),
    [data, demo],
  );
  const lux = useMemo(() => (c ? ghiToLux(c.shortwave_radiation, c.is_day) : 0), [c]);
  const luxInfo = useMemo(() => luxCategory(lux), [lux]);
  const extras = useMemo(
    () => (c
      ? deriveExtras({ lux, ghi: c.shortwave_radiation, uvIndex: c.uv_index, sunshineDuration: c.sunshine_duration })
      : null),
    [c, lux],
  );
  const nowIdx = useMemo(
    () => (data ? Math.max(0, data.raw.hourly.time.findIndex((t) => new Date(t).getTime() > nowMs - 3600e3)) : 0),
    [data, nowMs],
  );
  const clothes = useMemo(
    () => (c ? clothingAdvice(c) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [c?.weather_code, c?.apparent_temperature, c?.wind_speed_10m, c?.precipitation, c?.uv_index],
  );
  const head = useMemo(() => (data ? headacheRisk(data.raw.hourly, nowIdx) : null), [data, nowIdx]);
  const stars = useMemo(
    () => (c ? stargazingScore({ cloudCover: c.cloud_cover - (1 - moon.fraction) * 15, isDay: c.is_day }) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [c?.cloud_cover, c?.is_day, moon.fraction],
  );
  const solar = useMemo(
    () => (data ? solarDayKwh(data.raw.daily.shortwave_radiation_sum[0], sysKw) : null),
    [data, sysKw],
  );
  const accent = useMemo(
    () => (c ? conditionAccent(c.weather_code, c.is_day) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [c?.weather_code, c?.is_day],
  );
  const germ = useMemo(
    () => (data?.aqi && c
      ? germIndex({
          pm25: data.aqi.pm2_5,
          pm10: data.aqi.pm10,
          humidity: c.relative_humidity_2m,
          temperature: c.temperature_2m,
          aqi: data.aqi.us_aqi,
        })
      : null),
    [data, c],
  );
  const pollen = useMemo(() => pollenInfo(data?.aqi), [data]);
  const skin = useMemo(
    () => skinExposure({ uv: c?.uv_index ?? 0, skinType }),
    [c?.uv_index, skinType],
  );
  const luxPct = Math.min(100, (Math.log10(lux + 1) / 5) * 100);

  const brief = useMemo(
    () => decisionBrief({
      c,
      hourly: data?.raw?.hourly,
      nowIdx,
      skin,
      germ,
      luxInfo,
      isDemo: !!demo,
    }),
    [c, data, nowIdx, skin, germ, luxInfo, demo],
  );

  const sunScore = useMemo(() => {
    if (!c || !data) return null;
    // Quality near sunset: cloud cover now (proxy), humidity, wind, visibility
    const h = data.raw.hourly;
    // find hour near sunset if available, else current
    return sunsetQuality({
      cloudCover: c.cloud_cover,
      humidity: c.relative_humidity_2m,
      windSpeed: c.wind_speed_10m,
      ghiNearSet: c.shortwave_radiation,
      visibility: h?.visibility?.[nowIdx],
    });
  }, [c, data, nowIdx]);

  const outdoor = useMemo(
    () => (data ? outdoorWindow(data.raw.hourly, nowIdx, { units }) : null),
    [data, nowIdx, units],
  );

  const isPinned = (l) => pins.some((p) => p.name === l.name && Math.abs(p.lat - l.lat) < 0.05 && Math.abs(p.lon - l.lon) < 0.05);

  const togglePin = (l) => {
    setPins((prev) => {
      const idx = prev.findIndex((p) => p.name === l.name && Math.abs(p.lat - l.lat) < 0.05 && Math.abs(p.lon - l.lon) < 0.05);
      if (idx >= 0) return prev.filter((_, i) => i !== idx);
      if (prev.length >= MAX_PINS) return prev;
      return [...prev, { name: l.name, lat: l.lat, lon: l.lon }];
    });
  };

  const pickLoc = (next) => {
    setLoc(next);
    setDemoId(null);
    setResults([]);
    setQ('');
    setSearchOpen(false);
    setReloadKey((k) => k + 1);
  };

  // Horizontal swipe between pins (ignore vertical scroll / interactive elements)
  const onPointerDown = (e) => {
    if (pins.length < 2) return;
    const t = e.target;
    if (t.closest('input,button,a,select,textarea,[role="slider"]')) return;
    touchActive.current = true;
    touchStartY.current = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
  };
  const onPointerUp = (e) => {
    if (!touchActive.current || pins.length < 2) return;
    touchActive.current = false;
    const endX = e.clientX ?? e.changedTouches?.[0]?.clientX ?? 0;
    const dx = endX - touchStartY.current;
    if (Math.abs(dx) < 60) return; // threshold
    const idx = pins.findIndex((p) => p.name === loc.name);
    if (idx < 0) return;
    const next = dx < 0
      ? pins[(idx + 1) % pins.length]
      : pins[(idx - 1 + pins.length) % pins.length];
    pickLoc(next);
  };

  // Pull-to-refresh (top of page only)
  const onTouchStartPull = (e) => {
    if (window.scrollY > 4) return;
    touchStartY.current = e.touches[0].clientY;
    touchActive.current = true;
  };
  const onTouchMovePull = (e) => {
    if (!touchActive.current || window.scrollY > 4) return;
    const dy = e.touches[0].clientY - touchStartY.current;
    if (dy > 0) setPullY(Math.min(72, dy * 0.45));
  };
  const onTouchEndPull = () => {
    if (!touchActive.current) return;
    touchActive.current = false;
    if (pullY > 56) load(true);
    setPullY(0);
  };

  const onShare = async () => {
    if (!c || sharing) return;
    setSharing(true);
    setShareMsg('');
    try {
      const res = await downloadShareCard({
        city: loc.name,
        temp: fmtTemp(c.temperature_2m, units).replace('°', ''),
        condition: WMO[c.weather_code] ?? '',
        lux,
        luxLabel: luxInfo.label,
        germ,
        sunsetScore: sunScore,
        brief: brief.line,
        units,
        accentHex: accent?.hex,
      });
      setShareMsg(res.ok ? 'Card downloaded ✓' : 'Share failed');
    } catch {
      setShareMsg('Share failed');
    } finally {
      setSharing(false);
      setTimeout(() => setShareMsg(''), 2500);
    }
  };

  const heroTemp = c ? toTemp(c.temperature_2m, units) : 0;
  const shownTemp = useCountUp(heroTemp);
  const feelsDelta = c ? Math.round(c.apparent_temperature) - Math.round(c.temperature_2m) : 0;
  const aq = aqiInfo(data?.aqi?.us_aqi);
  const wd = c ? windDir(c.wind_direction_10m) : { name: '—', rotate: 0 };
  const IconKey = c ? conditionIconKey(c.weather_code, c.is_day, new Date(nowMs).getHours()) : 'sun';
  const HeroIcon = HERO_ICONS[IconKey] || Sun;
  const auroraHint = aurora?.ok ? auroraLatHint(loc.lat, aurora.maxKp) : null;

  // Relevance: promote cards that matter *now*
  const relevance = useMemo(() => {
    if (!c) return {};
    const isDay = c.is_day === 1;
    const uv = c.uv_index ?? 0;
    const rainNow = c.precipitation > 0.2;
    const night = !isDay;
    return {
      lux: isDay,
      outdoor: isDay && !rainNow,
      sunset: isDay && sunScore && sunScore.score >= 40,
      germ: (germ?.score ?? 0) >= 40,
      skin: isDay && uv >= 3,
      stars: night,
      aurora: night,
      radar: true,
      models: true,
      migraine: (head?.level === 'High' || head?.level === 'Moderate'),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c, germ, sunScore, head, nowIdx, data]);

  if (loading && !data) return <SkeletonScreen />;

  if (error && !data) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-950 text-white px-4">
        <div className="text-center max-w-sm">
          <p className="mb-5 text-white/85">{error}</p>
          <button
            onClick={() => setReloadKey((k) => k + 1)}
            className="px-5 py-2.5 rounded-full bg-white text-slate-900 text-sm font-medium hover:bg-white/90 active:scale-95 transition"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }
  if (!c || !extras || !head || !stars || !solar || !accent) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-950 text-white">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 rounded-full border-2 border-white/25 border-t-white animate-spin" />
          <p className="text-sm text-white/70">Loading sky…</p>
        </div>
      </div>
    );
  }

  const { raw, aqi } = data;
  const d = raw.daily;
  const heroSm = fmtTemp(c.apparent_temperature, units);
  const hi = fmtTemp(d.temperature_2m_max[0], units);
  const lo = fmtTemp(d.temperature_2m_min[0], units);
  const windVal = toSpeed(c.wind_speed_10m, units);
  const gustVal = toSpeed(raw.current.wind_gusts_10m, units);
  const wUnit = speedUnit(units);

  return (
    <div
      className="relative min-h-screen text-white tabular-nums"
      onTouchStart={(e) => { onPointerDown(e); onTouchStartPull(e); }}
      onTouchMove={(e) => { onTouchMovePull(e); }}
      onTouchEnd={(e) => { onPointerUp(e); onTouchEndPull(e); }}
      onMouseDown={onPointerDown}
      onMouseUp={onPointerUp}
      role="region"
      aria-label="Weather app"
    >
      {/* pull-to-refresh indicator */}
      {pullY > 4 && (
        <div
          className="fixed top-0 left-0 right-0 z-50 flex justify-center pointer-events-none"
          style={{ transform: `translateY(${pullY - 8}px)`, opacity: Math.min(1, pullY / 40) }}
          aria-hidden="true"
        >
          <div className="mt-2 px-3 py-1 rounded-full bg-black/55 border border-white/20 text-xs text-white/85 flex items-center gap-1.5">
            <RefreshCw size={12} className={pullY > 56 ? 'animate-spin' : ''} />
            {pullY > 56 ? 'Release to refresh' : 'Pull to refresh'}
          </div>
        </div>
      )}

      <div className="fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
        <SkyCanvas weatherCode={c.weather_code} cloudCover={c.cloud_cover} isDay={c.is_day} lat={loc.lat} lon={loc.lon} dateMs={nowMs} />
        <div className="absolute inset-x-0 bottom-0 h-72 bg-gradient-to-t from-slate-950/70 via-slate-950/30 to-transparent pointer-events-none" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-3xl px-3 sm:px-4 pb-24" ref={swipeRef}>
        <header
          className={`sticky top-0 z-30 -mx-3 sm:-mx-4 px-3 sm:px-4 backdrop-blur-md bg-slate-950/35 supports-[backdrop-filter]:bg-slate-950/25 transition-[padding,box-shadow] ${
            scrolled ? 'pt-2 pb-2 shadow-lg shadow-black/20' : 'pt-3 pb-2'
          }`}
        >
          <div className="flex items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/50" />
              <input
                value={q}
                onChange={(e) => { setQ(e.target.value); setSearchOpen(true); }}
                onFocus={() => setSearchOpen(true)}
                placeholder="Search city…"
                aria-label="Search city"
                className="w-full rounded-2xl bg-black/35 border border-white/15 pl-10 pr-9 py-2.5 text-sm outline-none placeholder:text-white/40 focus:border-white/35 focus:bg-black/45 transition"
              />
              {q && (
                <button
                  onClick={() => { setQ(''); setResults([]); }}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-white/50 hover:text-white hover:bg-white/10"
                >
                  <X size={14} />
                </button>
              )}
              {searchOpen && results.length > 0 && (
                <ul className="absolute left-0 right-0 mt-2 rounded-2xl bg-slate-900/95 border border-white/10 overflow-hidden shadow-2xl z-50">
                  {results.map((r) => (
                    <li key={r.id}>
                      <button
                        onClick={() => pickLoc({ name: r.name, lat: r.latitude, lon: r.longitude })}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-white/10 focus:bg-white/10 outline-none"
                      >
                        {r.name}
                        <span className="text-white/45"> · {r.region ? `${r.region}, ` : ''}{r.country}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <button
              onClick={() => togglePin(loc)}
              disabled={!isPinned(loc) && pins.length >= MAX_PINS}
              aria-label={isPinned(loc) ? `Unpin ${loc.name}` : `Pin ${loc.name}`}
              title={isPinned(loc) ? 'Unpin this location' : pins.length >= MAX_PINS ? 'Pin list is full' : 'Pin this location'}
              className={`shrink-0 h-10 w-10 grid place-items-center rounded-2xl border transition disabled:opacity-40 ${
                isPinned(loc)
                  ? 'bg-amber-300/20 border-amber-300/50 text-amber-200'
                  : 'bg-black/35 border-white/15 text-white/70 hover:bg-black/50'
              }`}
            >
              <Pin size={15} fill={isPinned(loc) ? 'currentColor' : 'none'} />
            </button>
            <AlertsPanel data={data} c={c} germ={germ} stars={stars} nowIdx={nowIdx} loc={loc} />
            <button
              onClick={onShare}
              disabled={sharing}
              aria-label="Share daily card"
              title="Download shareable card"
              className="shrink-0 h-10 w-10 grid place-items-center rounded-2xl bg-black/35 border border-white/15 hover:bg-black/50 disabled:opacity-50"
            >
              {sharing ? <Download size={15} className="animate-pulse" /> : <Share2 size={15} />}
            </button>
            <button
              onClick={() => load(true)}
              disabled={refreshing}
              aria-label="Refresh weather"
              className="shrink-0 h-10 w-10 grid place-items-center rounded-2xl bg-black/35 border border-white/15 hover:bg-black/50 disabled:opacity-50"
            >
              <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={() => setUnits((u) => (u === 'metric' ? 'imperial' : 'metric'))}
              aria-label="Toggle temperature units"
              title={units === 'metric' ? 'Switch to °F' : 'Switch to °C'}
              className="shrink-0 h-10 px-3 rounded-2xl bg-black/35 border border-white/15 text-xs font-semibold hover:bg-black/50"
            >
              {units === 'metric' ? '°C' : '°F'}
            </button>
          </div>

          <div className={`mt-2 flex gap-1.5 overflow-x-auto hide-scrollbar pb-0.5 ${scrolled ? 'hidden sm:flex' : ''}`}>
            <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-slate-950/50 to-transparent sm:hidden" aria-hidden="true" />
            {pins.length === 0 && (
              <span className="shrink-0 px-3 py-1.5 rounded-full text-xs text-white/45 border border-dashed border-white/20">
                Search a city, then tap ⌖ to pin
              </span>
            )}
            {pins.map((ct) => (
              <span key={`${ct.name}-${ct.lat}`} className="relative shrink-0">
                <button
                  onClick={() => pickLoc(ct)}
                  className={`pl-3 pr-7 py-1.5 rounded-full text-xs border transition ${
                    ct.name === loc.name && !demo
                      ? 'bg-white text-slate-900 border-white font-medium'
                      : 'bg-black/30 border-white/15 text-white/80 hover:bg-black/45 hover:border-white/30'
                  }`}
                >
                  {ct.name}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); togglePin(ct); }}
                  aria-label={`Unpin ${ct.name}`}
                  title={`Unpin ${ct.name}`}
                  className="absolute right-0.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-current opacity-45 hover:opacity-100"
                  style={{ color: ct.name === loc.name && !demo ? '#0f172a' : '#fff' }}
                >
                  <X size={11} />
                </button>
              </span>
            ))}
            <button
              onClick={() => navigator.geolocation?.getCurrentPosition(
                (p) => pickLoc({ name: 'My location', lat: p.coords.latitude, lon: p.coords.longitude }),
                () => setError('Location permission denied. Search a city instead.'),
              )}
              className="shrink-0 px-3 py-1.5 rounded-full text-xs bg-black/30 border border-white/15 text-white/80 hover:bg-black/45 flex items-center gap-1"
            >
              <MapPin size={12} /> GPS
            </button>
            {pins.length > 1 && (
              <span className="shrink-0 self-center pl-1 text-[10px] text-white/35 hidden sm:inline">← swipe ↔</span>
            )}
          </div>

          {scrolled && (
            <div className="hidden sm:flex items-center gap-2 mt-1.5 text-[11px] text-white/50">
              <span className="font-medium text-white/75">{loc.name}</span>
              <span>·</span>
              <span className="tabular-nums">{fmtTemp(c.temperature_2m, units)}</span>
              <span>·</span>
              <span>{WMO[c.weather_code]}</span>
            </div>
          )}
        </header>

        {/* Hero */}
        <div ref={heroRef} className="text-center pt-6 pb-2 sm:pt-10 sm:pb-4">
          <div className="text-sm sm:text-base text-white/75 sky-text">
            {demo ? `${loc.name} · ${demo.name}` : loc.name}
          </div>
          <div className="mt-2 flex items-center justify-center gap-3">
            <HeroIcon size={44} strokeWidth={1.4} className="text-white/90 sky-text shrink-0" aria-hidden="true" />
            <div className="text-[84px] sm:text-[112px] leading-[0.95] font-extralight tracking-tight sky-text tabular-nums">
              {shownTemp}°
            </div>
          </div>
          <div className="mt-1 text-base sm:text-lg text-white/90 sky-text flex items-center justify-center gap-2">
            {WMO[c.weather_code] ?? ''}
          </div>
          <div className="mt-0.5 text-sm text-white/65 sky-text tabular-nums">
            Feels {heroSm}
            <span className={`ml-1.5 ${feelsDelta > 0 ? 'text-amber-200/90' : feelsDelta < 0 ? 'text-sky-200/90' : 'text-white/50'}`}>
              ({feelsDelta > 0 ? `+${units === 'imperial' ? Math.round(feelsDelta * 9 / 5) : feelsDelta}` : units === 'imperial' ? Math.round(feelsDelta * 9 / 5) : feelsDelta}°)
            </span>
            {' · '}H:{hi} L:{lo}
          </div>

          {/* ★ Decision brief — the one-line answer */}
          <div
            className="mt-3 mx-auto max-w-md px-3.5 py-2 rounded-2xl border text-sm font-medium sky-text"
            role="status"
            aria-live="polite"
            style={{
              background: brief.tone === 'alert' ? 'rgb(244 63 94 / 0.18)'
                : brief.tone === 'warn' ? 'rgb(251 191 36 / 0.16)'
                : 'rgb(52 211 153 / 0.14)',
              borderColor: brief.tone === 'alert' ? 'rgb(251 113 133 / 0.45)'
                : brief.tone === 'warn' ? 'rgb(253 230 138 / 0.4)'
                : 'rgb(110 231 183 / 0.35)',
            }}
          >
            {brief.line}
          </div>
          <div className="mt-2 flex flex-wrap justify-center gap-1.5" aria-label="Quick decisions">
            {brief.chips.map((ch, i) => (
              <span
                key={i}
                className={`text-[11px] px-2.5 py-1 rounded-full border ${TONE_COLORS[ch.tone] || TONE_COLORS.neutral}`}
              >
                {ch.text}
              </span>
            ))}
          </div>

          {updatedAt && (
            <div className="mt-2 text-[11px] text-white/40" aria-live="polite">
              Updated {new Date(updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              {shareMsg && <span className="ml-2 text-emerald-300/90">{shareMsg}</span>}
            </div>
          )}
        </div>

        {/* Section tabs */}
        <nav
          className="sticky top-[52px] z-20 -mx-1 px-1 py-1.5 flex gap-1 overflow-x-auto hide-scrollbar"
          role="tablist"
          aria-label="Weather sections"
        >
          {TABS.map((t) => {
            const TIcon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={active}
                aria-controls={`panel-${t.id}`}
                onClick={() => setTab(t.id)}
                className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-medium border transition ${
                  active
                    ? 'bg-white text-slate-900 border-white shadow-lg'
                    : 'bg-black/35 border-white/15 text-white/80 hover:bg-black/50'
                }`}
              >
                <TIcon size={13} />
                {t.label}
              </button>
            );
          })}
        </nav>

        {/* ========== TAB PANELS ========== */}
        <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={tab} className="pt-2">
          {/* --- TODAY --- */}
          {tab === 'today' && (
            <div className="space-y-3 sm:space-y-4">
              <Card accent={accent}>
                <Label icon={Sun} text="Live sunlight · Lux intensity" />
                <div className="mt-2 flex flex-wrap items-end gap-x-4 gap-y-2">
                  <div className="text-4xl sm:text-5xl font-light tracking-tight sky-text tabular-nums">
                    {lux.toLocaleString()}
                    <span className="ml-1.5 text-base text-white/55 font-normal">lux</span>
                  </div>
                  <span
                    className="text-xs px-2.5 py-1 rounded-full border"
                    style={{ background: `${luxInfo.color}22`, color: luxInfo.color, borderColor: `${luxInfo.color}55` }}
                  >
                    {luxInfo.label}
                  </span>
                </div>
                <p className="mt-1.5 text-sm text-white/70">{luxInfo.hint}</p>
                <p className="text-[11px] text-white/45 mt-0.5">GHI {c.shortwave_radiation} W/m² × 120 ≈ lux</p>
                <div
                  className="mt-4 h-2.5 rounded-full bg-black/45 overflow-hidden"
                  role="progressbar"
                  aria-valuenow={Math.round(lux)}
                  aria-valuemin={0}
                  aria-valuemax={100000}
                  aria-label="Lux intensity"
                >
                  <div
                    className="h-full rounded-full transition-[width] duration-700 ease-out"
                    style={{ width: `${luxPct}%`, background: 'linear-gradient(90deg,#818cf8,#38bdf8,#fcd34d,#fb923c)' }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-white/45 mt-1 tabular-nums">
                  <span>0 night</span><span>1k</span><span>10k overcast</span><span>100k+ noon</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-sm">
                  {[
                    ['GHI solar', `${c.shortwave_radiation} W/m²`],
                    ['DNI beam', `${c.direct_normal_irradiance} W/m²`],
                    ['Diffuse', `${c.diffuse_radiation} W/m²`],
                    ['UV index', c.uv_index],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-xl bg-black/25 px-3 py-2">
                      <div className="text-[11px] text-white/45">{k}</div>
                      <b className="text-sm font-medium tabular-nums">{v}</b>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Outdoor activity window */}
              {outdoor && (
                <Card accent={accent}>
                  <Label icon={LayoutGrid} text="Best outdoor window · next 12h" />
                  <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-1">
                    <div className="text-2xl font-light sky-text tabular-nums">{outdoor.label}</div>
                    <span
                      className="text-xs px-2.5 py-1 rounded-full border font-medium"
                      style={{ background: `${outdoor.color}22`, color: outdoor.color, borderColor: `${outdoor.color}55` }}
                    >
                      {outdoor.verdict}
                    </span>
                    <span className="text-xs text-white/50 tabular-nums">score {outdoor.avg}/100 · {outdoor.len}h run</span>
                  </div>
                  <p className="mt-1.5 text-sm text-white/70">
                    Peak at {String(outdoor.peak.hour).padStart(2, '0')}:00 (score {outdoor.peak.score}) · walk, run, or picnic pick.
                  </p>
                  {/* hour strip */}
                  <div className="mt-3 flex gap-0.5 overflow-x-auto hide-scrollbar" aria-hidden="true">
                    {outdoor.hours.map((h) => (
                      <div key={h.i} className="shrink-0 w-9 text-center" title={`${h.hour}:00 · ${h.score}`}>
                        <div
                          className="h-10 rounded-md flex items-end justify-center"
                          style={{
                            background: `linear-gradient(to top, ${h.score >= 70 ? '#34d399' : h.score >= 50 ? '#fbbf24' : '#f87171'}${Math.round((h.score / 100) * 180 + 40).toString(16)}, transparent)`,
                          }}
                        >
                          <span className="text-[9px] text-white/70 mb-0.5">{h.score}</span>
                        </div>
                        <span className="text-[9px] text-white/40">{String(h.hour).padStart(2, '0')}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Sunset quality */}
              {sunScore && (
                <Card>
                  <Label icon={Sunset} text="Sunset / golden-hour quality" />
                  <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-1">
                    <div className="text-4xl font-light sky-text tabular-nums">
                      {sunScore.score}
                      <span className="ml-1 text-xs text-white/50 font-normal">/100</span>
                    </div>
                    <span
                      className="text-xs px-2.5 py-1 rounded-full border"
                      style={{ background: `${sunScore.color}22`, color: sunScore.color, borderColor: `${sunScore.color}55` }}
                    >
                      {sunScore.label}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm text-white/85">{sunScore.detail}</p>
                  <p className="mt-1.5 text-[11px] text-white/45 tabular-nums">
                    Sets {new Date(d.sunset[0]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {' · golden ends '}
                    {sunTimes.goldenHourEnd?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </Card>
              )}

              <Card className="" accent={accent}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label icon={Sun} text="Day progression · temperature & lux" />
                  <span className="text-[11px] text-white/40 tabular-nums">
                    {new Date(d.sunrise[0]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ↑ rise
                    {' · '}
                    {new Date(d.sunset[0]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ↓ set
                  </span>
                </div>
                <div className="mt-2">
                  <DayProgressGraph
                    hourly={raw.hourly}
                    nowIdx={nowIdx}
                    sunrise={d.sunrise[0]}
                    sunset={d.sunset[0]}
                    nowMs={nowMs}
                    lat={loc.lat}
                    lon={loc.lon}
                    units={units}
                  />
                </div>
              </Card>

              {/* Radar */}
              {relevance.radar && (
                <Card>
                  <Label icon={Radar} text="Precipitation radar" />
                  <RadarMap lat={loc.lat} lon={loc.lon} />
                </Card>
              )}

              {/* Model confidence */}
              <Card>
                <Label icon={Activity} text="Forecast confidence · multi-model" />
                {modelConf?.ok ? (
                  <>
                    <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-1">
                      <span
                        className="text-lg font-semibold"
                        style={{ color: modelConf.confidence.color }}
                      >
                        {modelConf.confidence.label} confidence
                      </span>
                      <span className="text-xs text-white/55 tabular-nums">
                        avg spread {modelConf.avgSpread}° · max {modelConf.maxSpread}° over 48h
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-white/75">{modelConf.confidence.note}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {modelConf.series.map((s) => {
                        const t = s.temps?.[nowIdx] ?? s.temps?.[0];
                        return (
                          <span key={s.id} className="text-[11px] px-2 py-0.5 rounded-full bg-white/10 border border-white/15 tabular-nums">
                            {s.name} {t != null ? `${Math.round(t)}°` : '—'}
                          </span>
                        );
                      })}
                    </div>
                    <p className="mt-1.5 text-[10px] text-white/35">ECMWF · GFS · ICON via Open-Meteo — disagreement = lower confidence.</p>
                  </>
                ) : (
                  <p className="mt-2.5 text-sm text-white/50">{modelConf === null ? 'Comparing models…' : 'Model comparison unavailable.'}</p>
                )}
              </Card>

              <div className="mt-3 sm:mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <StatTile
                  icon={Sunrise}
                  label="Sun path"
                  value={new Date(d.sunrise[0]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  hint={`↓ ${new Date(d.sunset[0]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · golden ${sunTimes.goldenHourEnd?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                  accent={accent}
                />
                <StatTile
                  icon={Droplets}
                  label="Humidity"
                  value={c.relative_humidity_2m ?? raw.current.relative_humidity_2m}
                  unit="%"
                  hint={`${c.precipitation} mm rain`}
                />
                <StatTile
                  icon={Wind}
                  label="Wind"
                  value={
                    <span className="inline-flex items-center gap-2">
                      <span>{windVal}</span>
                      <ArrowUp size={18} className="text-white/70" style={{ transform: `rotate(${wd.rotate}deg)` }} aria-label={`From ${wd.name}`} />
                    </span>
                  }
                  unit={wUnit}
                  hint={`From ${wd.name} · gusts ${gustVal} ${wUnit}`}
                  accent={accent}
                />
                <StatTile
                  icon={Gauge}
                  label="Pressure"
                  value={Math.round(raw.current.pressure_msl)}
                  unit="hPa"
                  hint={`Clouds ${c.cloud_cover}% · ${extras.sunHours}h sun`}
                />
                <StatTile
                  icon={Sprout}
                  label="Plant light"
                  value={extras.ppfd}
                  unit="µmol PPFD"
                  hint={extras.ppfd > 500 ? 'Full-sun plants happy' : extras.ppfd > 100 ? 'OK for leafy greens' : 'Too dark for plants'}
                  accent={accent}
                />
                <StatTile
                  icon={Zap}
                  label="Solar now"
                  value={extras.solarKwPerM2}
                  unit="kW/m²"
                  hint={extras.solarKwPerM2 > 0.6 ? 'Excellent generation' : extras.solarKwPerM2 > 0.2 ? 'Moderate output' : 'Low output now'}
                  accent={accent}
                />
                <StatTile
                  icon={Eye}
                  label="Health"
                  value={c.uv_index >= 5 ? 'High UV' : c.uv_index >= 3 ? 'Moderate UV' : c.is_day ? 'Low UV' : 'Night'}
                  hint={
                    <>
                      {extras.vitD}
                      <span className="flex items-center gap-1 mt-1">
                        <Moon size={11} className="shrink-0" />
                        {lux < 50 ? 'Melatonin safe' : 'Circadian boost'}
                      </span>
                    </>
                  }
                />
                <StatTile
                  icon={Leaf}
                  label="Air quality"
                  value={aqi?.us_aqi ?? '—'}
                  unit="US AQI"
                  hint={
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span
                        className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold border"
                        style={{ background: `${aq.color}22`, color: aq.color, borderColor: `${aq.color}55` }}
                      >
                        {aq.label}
                      </span>
                      <span>PM2.5 {aqi?.pm2_5 ?? '—'} µg/m³</span>
                    </span>
                  }
                />
              </div>

              <Card accent={accent}>
                <Label icon={Sunset} text="7-day forecast" />
                <ul className="mt-2">
                  {d.time.map((t, i) => (
                    <li key={t} className="flex items-center justify-between gap-2 py-2.5 border-b border-white/10 last:border-0 text-sm">
                      <span className="w-14 shrink-0 text-white/85">
                        {i === 0 ? 'Today' : new Date(t).toLocaleDateString([], { weekday: 'short' })}
                      </span>
                      <span className="flex-1 min-w-0 truncate text-white/50 text-xs hidden sm:block">
                        {WMO[d.weather_code[i]]}
                      </span>
                      <span className="text-amber-200/90 text-xs shrink-0 tabular-nums">
                        ☀ {d.shortwave_radiation_sum[i].toFixed(1)} MJ
                      </span>
                      <span className="w-24 text-right shrink-0 tabular-nums">
                        {fmtTemp(d.temperature_2m_min[i], units)} — <b className="font-semibold">{fmtTemp(d.temperature_2m_max[i], units)}</b>
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          )}

          {/* --- AIR --- */}
          {tab === 'air' && (
            <div className="space-y-3 sm:space-y-4">
              <Card>
                <Label icon={ShieldAlert} text="Air biology · germs & pollen" />
                {germ ? (
                  <>
                    <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-1">
                      <div className="text-3xl font-light sky-text tabular-nums">
                        {germ.score}
                        <span className="ml-1 text-xs text-white/50 font-normal">/100 germ risk</span>
                      </div>
                      <span
                        className="text-xs px-2.5 py-1 rounded-full border"
                        style={{ background: `${germ.color}22`, color: germ.color, borderColor: `${germ.color}55` }}
                      >
                        {germ.label}
                      </span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-black/45 overflow-hidden" role="progressbar" aria-valuenow={germ.score} aria-valuemin={0} aria-valuemax={100} aria-label="Germ risk index">
                      <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${germ.score}%`, background: `linear-gradient(90deg,#34d399,${germ.color})` }} />
                    </div>
                    <p className="mt-1.5 text-xs text-white/70 leading-snug">{germ.hint}</p>
                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] uppercase tracking-wider text-white/45">Pollen</span>
                      <span
                        className="text-[11px] px-2 py-0.5 rounded-full border"
                        style={{ background: `${pollen.color}22`, color: pollen.color, borderColor: `${pollen.color}55` }}
                      >
                        {pollen.level}
                      </span>
                      {pollen.available && pollen.items.filter((it) => it.value > 0.5).map((it) => (
                        <span key={it.name} className="text-[11px] px-2 py-0.5 rounded-full bg-white/10 text-white/70 tabular-nums">
                          {it.name} {it.value}
                        </span>
                      ))}
                    </div>
                    <p className="mt-1.5 text-[10px] text-white/35">{pollen.hint} · {germ.note}</p>
                  </>
                ) : (
                  <p className="mt-2.5 text-sm text-white/50">Air-quality data loading…</p>
                )}
              </Card>

              <Card>
                <Label icon={Leaf} text="Pollutants breakdown" />
                <div className="mt-2.5 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  {[
                    ['US AQI', aqi?.us_aqi ?? '—'],
                    ['PM2.5', aqi?.pm2_5 != null ? `${aqi.pm2_5}` : '—'],
                    ['PM10', aqi?.pm10 != null ? `${aqi.pm10}` : '—'],
                    ['Ozone', aqi?.ozone != null ? `${aqi.ozone}` : '—'],
                    ['NO₂', aqi?.nitrogen_dioxide != null ? `${aqi.nitrogen_dioxide}` : '—'],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-xl bg-black/25 px-3 py-2">
                      <div className="text-[11px] text-white/45">{k}</div>
                      <b className="tabular-nums">{v}</b>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-white/45">{aq.label} · {aq.note}</p>
              </Card>

              <Card>
                <Label icon={Sprout} text="Plant light & garden" />
                <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl bg-black/25 px-3 py-2">
                    <div className="text-[11px] text-white/45">PPFD now</div>
                    <b className="tabular-nums">{extras.ppfd} µmol</b>
                  </div>
                  <div className="rounded-xl bg-black/25 px-3 py-2">
                    <div className="text-[11px] text-white/45">Daily sun energy</div>
                    <b className="tabular-nums">{d.shortwave_radiation_sum[0].toFixed(1)} MJ/m²</b>
                  </div>
                </div>
                <p className="mt-2 text-sm text-white/75">
                  {extras.ppfd > 500 ? 'Full sun — tomatoes & herbs love it.' : extras.ppfd > 100 ? 'Partial light — leafy greens OK.' : 'Low light — mostly shade plants.'}
                </p>
              </Card>
            </div>
          )}

          {/* --- SKY --- */}
          {tab === 'sky' && (
            <div className="space-y-3 sm:space-y-4">
              <Card>
                <Label icon={Telescope} text="Stargazing score" />
                <div className="mt-2 flex items-baseline gap-2 tabular-nums">
                  <span className="text-4xl font-light sky-text">{c.is_day ? '—' : stars.score}</span>
                  <span className="text-sm text-white/50">/100 · {c.is_day ? 'daytime' : stars.label}</span>
                </div>
                <p className="mt-1.5 text-sm text-white/85">{stars.detail}</p>
                <p className="mt-2 text-[11px] text-white/45 tabular-nums">
                  Moon {(moon.fraction * 100).toFixed(0)}% lit · clouds {Math.max(0, Math.round(c.cloud_cover))}%
                </p>
              </Card>

              <Card>
                <Label icon={Sparkles} text="Tonight's sky · planets" />
                {!nightSky && <p className="mt-2.5 text-sm text-white/50">Loading sky map…</p>}
                {nightSky?.ok && (
                  <>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                      {nightSky.moon && (
                        <span className="px-2 py-0.5 rounded-full bg-white/10 border border-white/15 text-xs">
                          🌗 {nightSky.moon.phase} · {Math.round(nightSky.moon.illumination * 100)}%
                        </span>
                      )}
                      <span className="text-xs text-white/45 tabular-nums">
                        {nightSky.nakedEye.length} naked-eye up now
                      </span>
                    </div>
                    <ul className="mt-2.5 space-y-1.5 text-sm">
                      {(nightSky.nakedEye.length ? nightSky.nakedEye : nightSky.planets.slice(0, 4)).map((p) => (
                        <li key={p.name} className="flex items-center justify-between gap-2">
                          <span className="text-white/90">{p.name}</span>
                          <span className="text-xs text-white/50 tabular-nums">
                            mag {p.magnitude?.toFixed(1)} · {p.altitude}° {p.direction}
                          </span>
                        </li>
                      ))}
                      {nightSky.nakedEye.length === 0 && nightSky.planets.length === 0 && (
                        <li className="text-white/50">No planets above the horizon right now.</li>
                      )}
                    </ul>
                    {showers.length > 0 && (
                      <p className="mt-2.5 text-[11px] text-amber-200/70 tabular-nums">
                        ☄ Next: {showers[0].name} peak {showers[0].peakLabel}
                        {showers[0].daysOut > 0 ? ` · ${showers[0].daysOut}d` : ' · now'}
                      </p>
                    )}
                    <p className="mt-2 text-[10px] text-white/35">{nightSky.attribution}</p>
                  </>
                )}
                {nightSky && !nightSky.ok && (
                  <p className="mt-2.5 text-sm text-white/50">Sky data unavailable — check connection.</p>
                )}
              </Card>

              {/* Aurora */}
              <Card>
                <Label icon={WindIcon} text="Aurora / geomagnetic (Kp)" />
                {aurora?.ok ? (
                  <>
                    <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-1">
                      <div className="text-3xl font-light sky-text tabular-nums">
                        Kp {aurora.kp?.toFixed(1)}
                      </div>
                      <span
                        className="text-xs px-2.5 py-1 rounded-full border"
                        style={{ background: `${aurora.color}22`, color: aurora.color, borderColor: `${aurora.color}55` }}
                      >
                        {aurora.chance}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm text-white/85">{aurora.label}</p>
                    <p className="mt-1 text-[11px] text-white/50 tabular-nums">
                      48h peak Kp {aurora.maxKp?.toFixed(1)}
                      {aurora.peakTime ? ` around ${String(aurora.peakTime).slice(5, 16)}` : ''}
                    </p>
                    {auroraHint && (
                      <p className="mt-1.5 text-xs text-white/70 flex items-start gap-1.5">
                        <span aria-hidden="true">📍</span>
                        <span>{auroraHint.text}</span>
                      </p>
                    )}
                    <p className="mt-2 text-[10px] text-white/35">{aurora.note} · {aurora.source}</p>
                  </>
                ) : (
                  <p className="mt-2.5 text-sm text-white/50">{aurora === null ? 'Loading Kp…' : 'Kp forecast unavailable.'}</p>
                )}
              </Card>

              {sunScore && (
                <Card>
                  <Label icon={Sunset} text="Sunset quality (tonight)" />
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-3xl font-light sky-text tabular-nums">{sunScore.score}/100</span>
                    <span className="text-sm" style={{ color: sunScore.color }}>{sunScore.label}</span>
                  </div>
                  <p className="mt-1 text-sm text-white/80">{sunScore.detail}</p>
                </Card>
              )}
            </div>
          )}

          {/* --- HEALTH --- */}
          {tab === 'health' && (
            <div className="space-y-3 sm:space-y-4">
              <Card>
                <Label icon={Eye} text="Skin & sun exposure" />
                <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-1">
                  <div className="text-3xl font-light sky-text tabular-nums">
                    {skin.burnLabel ?? (skin.burnMin != null ? `${skin.burnMin}m` : '—')}
                    <span className="ml-1 text-xs text-white/50 font-normal">to burn</span>
                  </div>
                  <span
                    className="text-xs px-2.5 py-1 rounded-full border"
                    style={{ background: `${skin.color}22`, color: skin.color, borderColor: `${skin.color}55` }}
                  >
                    {skin.level}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-xl bg-black/25 px-3 py-2">
                    <div className="text-[11px] text-white/45">Safe tan window</div>
                    <b className="tabular-nums">{skin.tanLabel ?? (skin.tanMin != null ? `~${skin.tanMin}m` : '—')}</b>
                  </div>
                  <div className="rounded-xl bg-black/25 px-3 py-2">
                    <div className="text-[11px] text-white/45">Suggested SPF</div>
                    <b className="tabular-nums">{skin.spf}</b>
                  </div>
                </div>
                <p className="mt-2 text-xs text-white/75 leading-snug">{skin.advice}</p>
                <label className="mt-2.5 flex items-center justify-between text-[11px] text-white/60">
                  <span>Skin type (Fitzpatrick)</span>
                </label>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {SKIN_TYPES.map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setSkinType(st.id)}
                      title={st.name}
                      aria-pressed={skinType === st.id}
                      className={`px-2 py-1 rounded-lg text-[11px] border transition ${
                        skinType === st.id
                          ? 'bg-white text-slate-900 border-white font-medium'
                          : 'bg-black/30 border-white/15 text-white/75 hover:border-white/35'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-[10px] text-white/35">{skin.note}</p>
              </Card>

              <Card>
                <Label icon={Brain} text="Headache / migraine risk" />
                <div className="mt-2.5">
                  <span
                    className="inline-block px-3 py-1 rounded-full text-sm font-semibold border"
                    style={{ background: `${head.color}22`, color: head.color, borderColor: `${head.color}55` }}
                  >
                    {head.level} risk
                  </span>
                </div>
                <p className="mt-2.5 text-sm text-white/85 leading-snug">{head.detail}</p>
                <p className="mt-2 text-[11px] text-white/45">Falling pressure is a known migraine trigger.</p>
              </Card>

              <Card>
                <Label icon={Shirt} text="What to wear" />
                <ul className="mt-2.5 space-y-1.5 text-sm">
                  {clothes.map((x, i) => (
                    <li key={i} className="flex gap-2 leading-snug">
                      <span className="text-white/35 select-none">·</span>
                      <span className="text-white/90">{x}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2.5 text-[11px] text-white/45 tabular-nums">
                  Feels {heroSm} · wind {windVal} {wUnit} · rain {c.precipitation} mm · UV {c.uv_index}
                </p>
              </Card>

              <Card>
                <Label icon={Zap} text="Rooftop solar calculator" />
                <label className="mt-2.5 flex items-center justify-between text-sm text-white/75">
                  <span>System size</span>
                  <b className="text-white tabular-nums">{sysKw} kW</b>
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={sysKw}
                  onChange={(e) => setSysKw(+e.target.value)}
                  className="w-full mt-2"
                  aria-label="Solar system size in kilowatts"
                />
                <div className="mt-2 text-3xl font-light sky-text tabular-nums">
                  {solar.system}
                  <span className="ml-1.5 text-sm text-white/50 font-normal">kWh today</span>
                </div>
                <p className="mt-1.5 text-[11px] text-white/45 tabular-nums">
                  {d.shortwave_radiation_sum[0].toFixed(1)} MJ/m² sun · {solar.perKw} kWh per kW
                </p>
              </Card>
            </div>
          )}
        </div>

        <footer className="mt-8 text-center text-[11px] text-white/35 leading-relaxed">
          Data: Open-Meteo (free, no key) · Lux ≈ GHI×120 estimate
          <br className="sm:hidden" />
          {' '}· Night sky: data by aurora.you · Showers: skytime.live · Radar: RainViewer · Kp: NOAA SWPC
          <br />
          <span className="text-white/30">← swipe or use chips to switch pinned cities · tabs above reorganize cards</span>
        </footer>
      </div>

      {/* Demo console */}
      <div className="fixed z-40 bottom-4 right-4 left-4 sm:left-auto sm:right-6 sm:bottom-6 flex flex-col items-end gap-2">
        {demoOpen && (
          <div className="glass rounded-3xl p-4 w-full sm:w-[min(420px,calc(100vw-2rem))] border !border-amber-300/40">
            <div className="flex items-center justify-between mb-2.5">
              <Label icon={FlaskConical} text="Demo scenarios" />
              <button
                onClick={() => setDemoOpen(false)}
                aria-label="Close demo"
                className="rounded-full p-1 text-white/50 hover:text-white hover:bg-white/10"
              >
                <X size={14} />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {DEMOS.map((dm) => (
                <button
                  key={dm.id}
                  onClick={() => setDemoId(dm.id)}
                  className={`px-3 py-1.5 rounded-full text-xs border transition ${
                    demoId === dm.id
                      ? 'bg-amber-300 text-slate-900 border-amber-300 font-medium'
                      : 'bg-black/30 border-white/15 hover:border-white/35'
                  }`}
                >
                  {dm.name}
                </button>
              ))}
            </div>
            <div className="mt-2.5 flex items-start justify-between gap-3">
              <p className="text-[11px] text-white/50 leading-relaxed">
                {demo
                  ? 'Sky, lux & cards react live. Try Storm night → Clear midnight.'
                  : 'Simulate any sky instantly — no waiting on real weather.'}
              </p>
              {demo && (
                <button
                  onClick={() => setDemoId(null)}
                  className="shrink-0 text-[11px] flex items-center gap-1 px-2.5 py-1 rounded-full bg-white text-slate-900 hover:bg-white/90"
                >
                  <X size={11} /> Live
                </button>
              )}
            </div>
          </div>
        )}
        <button
          onClick={() => setDemoOpen((v) => !v)}
          aria-expanded={demoOpen}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-medium shadow-xl border transition ${
            demo
              ? 'bg-amber-300 text-slate-900 border-amber-300'
              : 'glass !rounded-full border-white/25 text-white/90 hover:bg-white/15'
          }`}
        >
          <FlaskConical size={14} />
          {demo ? demo.name : 'Demo'}
          <ChevronDown size={14} className={`transition-transform ${demoOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>
    </div>
  );
}
