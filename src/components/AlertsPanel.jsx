import { memo, useEffect, useRef, useState } from 'react';
import { Bell, BellOff, X } from 'lucide-react';
import { ALERT_TYPES, evaluateAlerts } from '../lib/weather';

const STORE = 'wx-alerts';

function loadEnabled() {
  try {
    const raw = localStorage.getItem(STORE);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { rain: false, uv: false, germ: false, gust: false, stargaze: false };
}

/**
 * Threshold alert panel — client-side evaluation + Web Notifications.
 * Only fires when Notification permission granted; dedupes per hour.
 */
function AlertsPanel({ data, c, germ, stars, nowIdx, loc }) {
  const [enabled, setEnabled] = useState(loadEnabled);
  const [open, setOpen] = useState(false);
  const [perm, setPerm] = useState(() => (typeof Notification !== 'undefined' ? Notification.permission : 'denied'));
  const [lastFired, setLastFired] = useState({});
  const firedRef = useRef(lastFired);

  useEffect(() => {
    localStorage.setItem(STORE, JSON.stringify(enabled));
  }, [enabled]);

  useEffect(() => { firedRef.current = lastFired; }, [lastFired]);

  // Evaluate on data change (and every minute via nowIdx parent tick)
  useEffect(() => {
    if (!data || !c) return;
    const active = ALERT_TYPES.filter((t) => enabled[t.id]);
    if (!active.length) return;
    const hits = evaluateAlerts({
      hourly: data.raw.hourly,
      nowIdx,
      c,
      germ,
      stars,
      isDay: c.is_day === 1,
    }).filter((h) => enabled[h.id]);
    if (!hits.length) return;
    const now = Date.now();
    const next = { ...firedRef.current };
    let changed = false;
    for (const h of hits) {
      const key = `${loc.name}:${h.id}`;
      if (next[key] && now - next[key] < 60 * 60 * 1000) continue; // 1h cooldown
      next[key] = now;
      changed = true;
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        try {
          new Notification(h.title, { body: `${h.body} · ${loc.name}`, tag: `skylux-${h.id}` });
        } catch { /* notification blocked in some contexts */ }
      }
    }
    if (changed) setLastFired(next);
  }, [data, c, germ, stars, nowIdx, enabled, loc.name]);

  const requestPerm = async () => {
    if (typeof Notification === 'undefined') return;
    try {
      const p = await Notification.requestPermission();
      setPerm(p);
    } catch { /* ignore */ }
  };

  const toggle = (id) => {
    setEnabled((e) => ({ ...e, [id]: !e[id] }));
    if (!enabled[id] && perm !== 'granted') requestPerm();
  };

  const anyOn = Object.values(enabled).some(Boolean);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Weather alerts"
        title="Threshold alerts"
        className={`relative h-10 w-10 grid place-items-center rounded-2xl border transition ${
          anyOn
            ? 'bg-rose-400/20 border-rose-300/50 text-rose-200'
            : 'bg-black/35 border-white/15 text-white/70 hover:bg-black/50'
        }`}
      >
        {anyOn ? <Bell size={15} /> : <BellOff size={15} />}
        {anyOn && (
          <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-rose-400" aria-hidden="true" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-[min(340px,calc(100vw-1.5rem))] glass rounded-2xl p-4 shadow-2xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-white/60">Threshold alerts</span>
            <button onClick={() => setOpen(false)} aria-label="Close alerts" className="p-1 text-white/50 hover:text-white">
              <X size={14} />
            </button>
          </div>
          <p className="text-[11px] text-white/50 mb-2.5">
            {perm === 'granted'
              ? 'Notifications on · 1h cooldown per type.'
              : perm === 'denied'
                ? 'Browser notifications blocked — in-app banner still works.'
                : 'Allow notifications when prompted to get push-style alerts.'}
          </p>
          <ul className="space-y-1.5">
            {ALERT_TYPES.map((t) => (
              <li key={t.id}>
                <label className="flex items-center gap-2.5 rounded-xl px-2 py-2 hover:bg-white/5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!enabled[t.id]}
                    onChange={() => toggle(t.id)}
                    className="h-4 w-4 rounded accent-rose-400"
                    aria-label={t.label}
                  />
                  <span className="text-sm text-white/90 flex-1">{t.icon} {t.label}</span>
                </label>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[10px] text-white/35 leading-snug">
            Evaluated locally from live Open-Meteo data — no server, no tracking.
          </p>
        </div>
      )}
    </div>
  );
}

export default memo(AlertsPanel);
