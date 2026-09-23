// Night-sky helpers: visible planets (aurora.you) + meteor showers (skytime.live).
// Both free, no API key. Aurora requires a visible "data by aurora.you" credit.

export async function fetchNightSky(lat, lon) {
  try {
    const r = await fetch(`https://www.aurora.you/api/sky?lat=${lat}&lon=${lon}`);
    if (!r.ok) throw new Error(`sky ${r.status}`);
    const j = await r.json();
    const planets = Array.isArray(j.planets) ? j.planets : [];
    const nakedEye = planets.filter((p) => p.magnitude != null && p.magnitude <= 5.5 && p.altitude > 3);
    return {
      ok: true,
      attribution: j.attribution || 'data by aurora.you',
      sunset: j.sunset ?? null,
      astronomicalDusk: j.astronomicalDusk ?? null,
      moon: j.moon ?? null,
      planets,
      nakedEye,
    };
  } catch {
    return { ok: false, attribution: 'data by aurora.you', planets: [], nakedEye: [], moon: null };
  }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function daysUntil(month, day) {
  const now = new Date();
  let target = new Date(now.getFullYear(), month, day);
  if (target < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
    target = new Date(now.getFullYear() + 1, month, day);
  }
  return Math.ceil((target - now) / 86400e3);
}

export async function fetchMeteorShowers() {
  try {
    const r = await fetch('https://skytime.live/api/v1/meteor-showers');
    if (!r.ok) throw new Error(`showers ${r.status}`);
    const j = await r.json();
    const showers = (j.data?.showers || []).map((s) => ({
      ...s,
      peakLabel: `${s.peakDay} ${MONTHS[s.peakMonth] ?? ''}`.trim(),
      daysOut: daysUntil(s.peakMonth, s.peakDay),
    }));
    showers.sort((a, b) => a.daysOut - b.daysOut);
    return { ok: true, showers: showers.slice(0, 3) };
  } catch {
    return { ok: false, showers: [] };
  }
}
