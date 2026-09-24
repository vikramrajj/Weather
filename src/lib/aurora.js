// Aurora / geomagnetic activity — free NOAA SWPC (no key).
// Kp forecast drives a simple "aurora visibility" card for mid/high latitudes.

export async function fetchAuroraKp() {
  try {
    // NOAA 3-day planetary K-index forecast (JSON) — array of objects or header+rows.
    const r = await fetch('https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json');
    if (!r.ok) throw new Error(`kp ${r.status}`);
    const j = await r.json();
    if (!Array.isArray(j) || !j.length) throw new Error('kp shape');

    let parsed = [];
    if (typeof j[0] === 'object' && j[0] !== null && !Array.isArray(j[0])) {
      // [{ time_tag, kp, observed|predicted }, …]
      parsed = j
        .map((row) => {
          const time = row.time_tag ?? row.time;
          const k = parseFloat(row.kp);
          if (!time || Number.isNaN(k)) return null;
          return { time: String(time), kp: k, predicted: row.observed === 'predicted' };
        })
        .filter(Boolean);
    } else {
      // header row + rows like ["2026-09-23 00:00:00", "2.33", …]
      const rows = j.slice(1);
      parsed = rows
        .map((row) => {
          const [time, kp] = row;
          const k = parseFloat(kp);
          if (!time || Number.isNaN(k)) return null;
          return { time: String(time), kp: k, predicted: false };
        })
        .filter(Boolean);
    }
    if (!parsed.length) throw new Error('kp empty');
    // Prefer nearest forecast from "now"; fall back to first observed row.
    const nowMs = Date.now();
    const current =
      parsed.find((row) => Date.parse(row.time) >= nowMs) || parsed[parsed.length - 1];
    const peak = parsed.reduce((a, b) => (b.kp > a.kp ? b : a), parsed[0]);
    const maxKp = peak.kp;
    const level =
      maxKp >= 7 ? { label: 'Storm — vivid aurora possible', color: '#f472b6', chance: 'High' }
      : maxKp >= 5 ? { label: 'Active — aurora likely at high lat', color: '#a78bfa', chance: 'Likely (high lat)' }
      : maxKp >= 4 ? { label: ' unsettled — faint glow possible north', color: '#818cf8', chance: 'Possible (north)' }
      : maxKp >= 3 ? { label: 'Quiet — mainly polar oval', color: '#60a5fa', chance: 'Polar only' }
      : { label: 'Very quiet', color: '#38bdf8', chance: 'Unlikely' };
    return {
      ok: true,
      kp: current.kp,
      maxKp,
      peakTime: peak.time,
      ...level,
      note: 'Planetary Kp from NOAA SWPC — higher Kp = stronger geomagnetic activity.',
      source: 'NOAA SWPC',
    };
  } catch {
    return { ok: false, kp: null, maxKp: null, label: 'Kp data unavailable', color: '#94a3b8', chance: '—', note: '', source: 'NOAA SWPC' };
  }
}

// Rough latitude band hint for aurora chance given user lat + Kp.
export function auroraLatHint(lat, kp) {
  if (kp == null) return null;
  // Approx aurora oval boundary: higher Kp → lower latitude
  const boundary = 67 - Math.max(0, kp - 3) * 2.5; // ~67° at Kp3, ~54° at Kp8
  const abs = Math.abs(lat);
  if (abs >= boundary) return { visible: true, text: 'You are inside the aurora oval — look north (or south in SH).' };
  if (abs >= boundary - 8) return { visible: false, text: 'Borderline latitude — strong substorm could lift the oval overhead.' };
  if (kp >= 6 && abs >= 45) return { visible: false, text: 'Unusual for your latitude — watch for rare low-latitude displays.' };
  return { visible: false, text: 'Too far from the oval for naked-eye aurora at this Kp.' };
}
