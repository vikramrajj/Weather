export const WMO = {
  0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Rime fog', 51: 'Light drizzle', 53: 'Drizzle', 55: 'Dense drizzle',
  56: 'Freezing drizzle', 57: 'Freezing drizzle', 61: 'Light rain', 63: 'Rain',
  65: 'Heavy rain', 66: 'Freezing rain', 67: 'Freezing rain',
  71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains',
  80: 'Light showers', 81: 'Showers', 82: 'Violent showers',
  85: 'Snow showers', 86: 'Snow showers',
  95: 'Thunderstorm', 96: 'Storm + hail', 99: 'Storm + hail',
};

export function conditionKind(code) {
  if (code === 0 || code === 1) return 'clear';
  if (code === 2) return 'partly';
  if (code === 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if ([51, 53, 55, 56, 57, 61, 80].includes(code)) return 'drizzle';
  if ([63, 65, 66, 67, 81, 82].includes(code)) return 'rain';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snow';
  if ([95, 96, 99].includes(code)) return 'storm';
  return 'partly';
}

// Accent hue per condition — drives card borders, glows, icons.
export function conditionAccent(code, isDay = 1) {
  const kind = conditionKind(code);
  if (!isDay) return { hue: 'indigo', hex: '#818cf8', rgb: '129,140,248' };
  switch (kind) {
    case 'clear': return { hue: 'amber', hex: '#fbbf24', rgb: '251,191,36' };
    case 'partly': return { hue: 'sky', hex: '#38bdf8', rgb: '56,189,248' };
    case 'cloudy': case 'fog': return { hue: 'slate', hex: '#94a3b8', rgb: '148,163,184' };
    case 'rain': case 'drizzle': return { hue: 'blue', hex: '#60a5fa', rgb: '96,165,250' };
    case 'storm': return { hue: 'violet', hex: '#a78bfa', rgb: '167,139,250' };
    case 'snow': return { hue: 'cyan', hex: '#67e8f9', rgb: '103,232,249' };
    default: return { hue: 'sky', hex: '#38bdf8', rgb: '56,189,248' };
  }
}

// Live condition icon key for hero (day/night aware).
export function conditionIconKey(code, isDay = 1, hour = 12) {
  const kind = conditionKind(code);
  if (!isDay) {
    if (kind === 'clear') return 'moon';
    if (kind === 'partly') return 'cloud-moon';
    if (kind === 'rain' || kind === 'drizzle') return 'cloud-rain';
    if (kind === 'storm') return 'cloud-lightning';
    if (kind === 'snow') return 'cloud-snow';
    return 'cloud';
  }
  switch (kind) {
    case 'clear': return hour < 7 || hour > 18 ? 'sunset' : 'sun';
    case 'partly': return 'cloud-sun';
    case 'cloudy': return 'cloud';
    case 'fog': return 'cloud-fog';
    case 'rain': case 'drizzle': return 'cloud-rain';
    case 'storm': return 'cloud-lightning';
    case 'snow': return 'cloud-snow';
    default: return 'sun';
  }
}

export function ghiToLux(ghi, isDay = 1) {
  if (!isDay || ghi == null || ghi <= 0.5) return 0;
  return Math.round(ghi * 120);
}

export function luxCategory(lux) {
  if (lux < 1) return { label: 'Night — pitch black', hint: 'Melatonin peak. Great for sleep.', color: '#818cf8' };
  if (lux < 50) return { label: 'Moonlight / dusk glow', hint: 'Streetlights dominate. Low circadian stimulus.', color: '#a5b4fc' };
  if (lux < 500) return { label: 'Very dim — deep overcast / twilight', hint: 'Indoor-like light. Turn lights on.', color: '#93c5fd' };
  if (lux < 3000) return { label: 'Dim day — heavy overcast', hint: 'Still enough for a walk; SAD lamp helps.', color: '#7dd3fc' };
  if (lux < 12000) return { label: 'Overcast daylight', hint: 'Good diffuse light for plants & mood.', color: '#fcd34d' };
  if (lux < 40000) return { label: 'Bright — hazy sun', hint: 'Sunglasses territory. Great solar window.', color: '#fbbf24' };
  if (lux < 90000) return { label: 'Full daylight', hint: 'Peak vitamin-D + solar window. Wear SPF.', color: '#fb923c' };
  return { label: 'Extreme — desert noon', hint: 'Avoid staring at sky. Max solar output.', color: '#f87171' };
}

export function deriveExtras({ lux, ghi, uvIndex, sunshineDuration }) {
  const ppfd = Math.round(lux / 54);
  const solarKwPerM2 = ghi != null ? +(ghi / 1000).toFixed(3) : 0;
  const vitD =
    uvIndex >= 5 ? '10–15 min sun = daily vitamin D' :
    uvIndex >= 3 ? '~20–30 min sun for vitamin D' :
    uvIndex > 0 ? 'Low UV — vitamin D slow today' : 'Night — no vitamin D now';
  return { ppfd, solarKwPerM2, vitD, sunHours: sunshineDuration != null ? +(sunshineDuration / 3600).toFixed(1) : null };
}

// AQI → EPA color scale
export function aqiInfo(aqi) {
  if (aqi == null) return { label: '—', color: '#94a3b8', note: 'No data' };
  if (aqi <= 50) return { label: 'Good', color: '#34d399', note: 'Air is clean' };
  if (aqi <= 100) return { label: 'Moderate', color: '#fbbf24', note: 'Acceptable for most' };
  if (aqi <= 150) return { label: 'Sensitive', color: '#fb923c', note: 'Reduce prolonged exertion' };
  if (aqi <= 200) return { label: 'Unhealthy', color: '#f87171', note: 'Limit time outside' };
  if (aqi <= 300) return { label: 'Very unhealthy', color: '#c084fc', note: 'Avoid outdoor activity' };
  return { label: 'Hazardous', color: '#991b1b', note: 'Stay indoors' };
}

export function clothingAdvice(c) {
  const feels = c.apparent_temperature, wind = c.wind_speed_10m, rain = c.precipitation > 0.2, code = c.weather_code;
  const out = [];
  if (feels >= 32) out.push('🥵 Linen / cotton, cap + SPF — heat stress risk');
  else if (feels >= 24) out.push('👕 T-shirt + sunglasses, carry water');
  else if (feels >= 16) out.push('🧥 Light jacket / full sleeves');
  else if (feels >= 8) out.push('🧣 Warm jacket + layers');
  else out.push('🧤 Heavy winter wear, cover ears/hands');
  if (rain || [61, 63, 65, 80, 81, 82, 95, 96, 99].includes(code)) out.push('☂ Umbrella / raincoat needed');
  if (wind >= 30) out.push('🧢 Windcheater — gusty winds');
  if (c.uv_index >= 6) out.push('🕶 UV high — avoid 12–3pm direct sun');
  return out;
}

export function headacheRisk(hourly, nowIdx) {
  if (!hourly?.pressure_msl || nowIdx < 0) return { level: 'Unknown', detail: 'No pressure trend data', color: '#94a3b8' };
  const now = hourly.pressure_msl[nowIdx];
  const past = hourly.pressure_msl[Math.max(0, nowIdx - 6)];
  const drop = now - past;
  if (drop <= -5) return { level: 'High', detail: `Pressure fell ${drop.toFixed(1)} hPa in 6h — migraine trigger likely`, color: '#f87171' };
  if (drop <= -2.5) return { level: 'Moderate', detail: `Pressure down ${drop.toFixed(1)} hPa — sensitive people may feel it`, color: '#fbbf24' };
  return { level: 'Low', detail: `Pressure stable (${drop >= 0 ? '+' : ''}${drop.toFixed(1)} hPa / 6h)`, color: '#34d399' };
}

export function stargazingScore({ cloudCover, isDay }) {
  let score = 100 - cloudCover;
  if (isDay) return { score: 0, label: 'Wait for night', detail: 'Sun is up — no stars visible' };
  const label = score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 35 ? 'Fair' : 'Poor';
  const detail = score >= 80 ? 'Milky-way class sky — go outside!' : score >= 60 ? 'Most constellations visible' : score >= 35 ? 'Only bright stars' : 'Clouds blocking the sky';
  return { score: Math.max(0, Math.round(score)), label, detail };
}

export function solarDayKwh(radiationSumMJ, systemKw = 3, efficiency = 0.8) {
  const kwhPerKw = (radiationSumMJ / 3.6) * efficiency;
  return { perKw: +kwhPerKw.toFixed(1), system: +(kwhPerKw * systemKw).toFixed(1) };
}

// Unit helpers
export function toTemp(c, units) {
  return units === 'imperial' ? Math.round(c * 9 / 5 + 32) : Math.round(c);
}
export function fmtTemp(c, units) {
  return `${toTemp(c, units)}°`;
}
export function toSpeed(kmh, units) {
  return units === 'imperial' ? +(kmh * 0.621371).toFixed(1) : +(kmh).toFixed(1);
}
export function speedUnit(units) {
  return units === 'imperial' ? 'mph' : 'km/h';
}

// Cardinal direction from degrees (with arrow rotation for UI)
export function windDir(deg) {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const i = Math.round(((deg % 360) / 22.5)) % 16;
  return { name: dirs[i], rotate: deg };
}

export async function geocodeCity(name) {
  const r = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=5&language=en&format=json`
  );
  const j = await r.json();
  return j.results || [];
}

// Heuristic germ / mold-risk score from particulates + climate (not a medical count).
export function germIndex({ pm25, pm10, humidity, temperature, aqi }) {
  let score = 0;
  if (pm25 != null) score += Math.min(35, pm25 * 1.1);
  if (pm10 != null) score += Math.min(20, pm10 * 0.45);
  if (humidity != null) {
    if (humidity >= 65) score += Math.min(25, (humidity - 65) * 0.7);
    else if (humidity < 35) score += Math.min(12, (35 - humidity) * 0.35);
  }
  if (temperature != null && temperature >= 15 && temperature <= 35) {
    score += 10 - Math.min(10, Math.abs(temperature - 25) * 0.5);
  }
  if (aqi != null && aqi > 100) score += Math.min(15, (aqi - 100) * 0.12);
  const value = Math.max(0, Math.min(100, Math.round(score)));
  const level =
    value >= 65 ? { label: 'High', color: '#f87171', hint: 'Humid + particulates favor airborne germs & mold. Ventilate and wash hands often.' }
    : value >= 40 ? { label: 'Moderate', color: '#fbbf24', hint: 'Fair conditions for microbial growth — normal hygiene is enough.' }
    : { label: 'Low', color: '#34d399', hint: 'Dry / clean air — germs and mold struggle to spread.' };
  return { score: value, ...level, note: 'Heuristic from PM, humidity & temperature — not a germ count.' };
}

const POLLEN_SPECIES = [
  ['grass', 'Grass'], ['birch', 'Birch'], ['alder', 'Alder'],
  ['olive', 'Olive'], ['mugwort', 'Mugwort'], ['ragweed', 'Ragweed'],
];

// Pollen is Europe-only (CAMS). Outside coverage all fields are null → available:false.
export function pollenInfo(current) {
  if (!current) return { available: false, level: '—', color: '#94a3b8', items: [], hint: 'No pollen data for this region.' };
  const items = POLLEN_SPECIES.map(([key, name]) => ({
    name,
    value: current[`${key}_pollen`],
  }));
  const hasAny = items.some((it) => it.value != null);
  if (!hasAny) {
    return {
      available: false, level: 'No data', color: '#94a3b8', items: [],
      hint: 'Pollen forecast covers Europe only (CAMS model).',
    };
  }
  const max = Math.max(...items.map((it) => it.value ?? 0));
  // grains/m³ rough bands
  const level =
    max >= 50 ? { level: 'Very high', color: '#f87171' }
    : max >= 10 ? { level: 'High', color: '#fb923c' }
    : max >= 3 ? { level: 'Moderate', color: '#fbbf24' }
    : max >= 0.5 ? { level: 'Low', color: '#34d399' }
    : { level: 'None / off-season', color: '#67e8f9' };
  return {
    available: true, ...level, items: items.filter((it) => it.value != null),
    hint: 'Grains/m³ from CAMS — Europe coverage.',
  };
}

// Fitzpatrick skin-type burn/tan guidance from UV index.
const SKIN_BURN_BASE = { 1: 45, 2: 90, 3: 135, 4: 180, 5: 270, 6: 450 };
export const SKIN_TYPES = [
  { id: 1, label: 'I', name: 'Very fair — always burns' },
  { id: 2, label: 'II', name: 'Fair — usually burns' },
  { id: 3, label: 'III', name: 'Medium — sometimes burns' },
  { id: 4, label: 'IV', name: 'Olive — rarely burns' },
  { id: 5, label: 'V', name: 'Brown — very rarely burns' },
  { id: 6, label: 'VI', name: 'Deep — seldom burns' },
];

export function skinExposure({ uv, skinType = 3 }) {
  const uvSafe = uv != null && uv > 0 ? uv : 0;
  if (uvSafe <= 0) {
    return {
      burnMin: null, tanMin: null, spf: '—', level: 'No UV now',
      color: '#818cf8', advice: 'Night — skin is safe from UV burn.',
      burnLabel: 'Safe', tanLabel: 'Safe',
    };
  }
  const base = SKIN_BURN_BASE[skinType] || 135;
  const burnMin = Math.max(1, Math.round(base / uvSafe));
  const tanMin = Math.max(1, Math.round(burnMin * 0.25));
  const level =
    uvSafe >= 11 ? { level: 'Extreme UV', color: '#f87171' }
    : uvSafe >= 8 ? { level: 'Very high UV', color: '#fb923c' }
    : uvSafe >= 6 ? { level: 'High UV', color: '#fbbf24' }
    : uvSafe >= 3 ? { level: 'Moderate UV', color: '#fde68a' }
    : { level: 'Low UV', color: '#34d399' };
  const spfNum = uvSafe >= 8 ? '50+' : uvSafe >= 6 ? '30–50' : uvSafe >= 3 ? '15–30' : '15';
  const advice =
    burnMin >= 90
      ? 'Slow to burn — brief exposure OK; still use SPF for long sessions.'
      : burnMin >= 30
        ? 'Moderate risk — apply SPF and seek shade near midday.'
        : 'Burns quickly — cover up, SPF 30+, avoid 11am–3pm direct sun.';
  return {
    burnMin, tanMin, spf: spfNum, ...level, advice,
    burnLabel: burnMin >= 120 ? '2h+' : `${burnMin}m`,
    tanLabel: `~${tanMin}m`,
    note: `Estimate for skin type ${skinType} at UV ${uvSafe.toFixed(1)} — individual variation is large.`,
  };
}

// One-line decision brief: what should I do about umbrella / UV / comfort?
export function decisionBrief({ c, hourly, nowIdx, skin, germ, luxInfo, isDemo }) {
  if (!c) return { line: 'Loading conditions…', chips: [], tone: 'neutral' };
  const chips = [];
  const code = c.weather_code;
  const kind = conditionKind(code);

  // Umbrella: rain now or high precip probability in next 6h
  let umbrella = null;
  if (kind === 'rain' || kind === 'drizzle' || kind === 'storm' || c.precipitation > 0.2) {
    umbrella = { text: 'Umbrella needed now', tone: 'alert' };
  } else if (hourly?.precipitation_probability) {
    let maxP = 0;
    let when = null;
    for (let i = nowIdx; i < Math.min(nowIdx + 7, hourly.precipitation_probability.length); i++) {
      const p = hourly.precipitation_probability[i] ?? 0;
      if (p > maxP) { maxP = p; when = new Date(hourly.time[i]).getHours(); }
    }
    if (maxP >= 60) umbrella = { text: `Rain likely by ${String(when).padStart(2, '0')}:00 (${maxP}%)`, tone: 'alert' };
    else if (maxP >= 30) umbrella = { text: `Possible shower ~${String(when).padStart(2, '0')}:00 (${maxP}%)`, tone: 'warn' };
    else umbrella = { text: 'Umbrella optional today', tone: 'ok' };
  }
  if (umbrella) chips.push(umbrella);

  // UV / skin
  const uv = c.uv_index ?? 0;
  if (c.is_day && uv >= 6) chips.push({ text: `UV ${uv.toFixed(1)} — burn in ~${skin?.burnMin ?? '?'}m (type ${skin?.note?.match(/\\d+/)?.[0] ?? '3'})`, tone: 'alert' });
  else if (c.is_day && uv >= 3) chips.push({ text: `Moderate UV ${uv.toFixed(1)} — SPF helps`, tone: 'warn' });
  else if (c.is_day) chips.push({ text: 'Low UV — brief outdoor time fine', tone: 'ok' });

  // Germ
  if (germ && germ.score >= 65) chips.push({ text: 'High germ risk — ventilate carefully', tone: 'alert' });
  else if (germ && germ.score >= 40) chips.push({ text: 'Moderate germ risk', tone: 'warn' });

  // Comfort / clothing one-liner
  const feels = c.apparent_temperature;
  let comfort;
  if (feels >= 32) comfort = { text: 'Heat stress — hydrate & shade', tone: 'alert' };
  else if (feels >= 24) comfort = { text: 'Warm & comfortable outside', tone: 'ok' };
  else if (feels >= 16) comfort = { text: 'Mild — light layer enough', tone: 'ok' };
  else if (feels >= 8) comfort = { text: 'Chilly — jacket recommended', tone: 'warn' };
  else comfort = { text: 'Cold — bundle up', tone: 'alert' };
  chips.push(comfort);

  if (!c.is_day) chips.push({ text: luxInfo?.label?.startsWith('Night') ? 'Clear night for sleep' : 'Night mode', tone: 'ok' });

  const primary = umbrella?.text || comfort.text;
  const line = isDemo ? `Demo · ${primary}` : primary;
  return { line, chips: chips.slice(0, 4), tone: umbrella?.tone || comfort.tone };
}

// Sunset / golden-hour quality score 0–100 (cloud layers, humidity, wind, clarity).
export function sunsetQuality({ cloudCover, humidity, windSpeed, ghiNearSet, visibility }) {
  if (cloudCover == null) return { score: 0, label: 'Unknown', detail: 'No data', color: '#94a3b8' };
  let score = 100;
  // Mid-level clouds help scatter red; solid overcast kills it; clear can be dull.
  const c = cloudCover;
  if (c < 20) score -= 15; // too clear — less scatter
  else if (c <= 55) score += 0; // sweet spot 20–55%
  else if (c <= 75) score -= 20;
  else score -= 55;
  if (humidity != null) {
    if (humidity > 85) score -= 20;
    else if (humidity > 70) score -= 8;
    else if (humidity < 30) score -= 10; // too dry — less aerosol glow
  }
  if (windSpeed != null && windSpeed > 40) score -= 15;
  if (visibility != null && visibility < 3000) score -= 15;
  if (ghiNearSet != null && ghiNearSet > 80) score += 5;
  score = Math.max(0, Math.min(100, Math.round(score)));
  const label = score >= 80 ? 'Spectacular' : score >= 60 ? 'Pretty good' : score >= 40 ? 'Average' : score >= 20 ? 'Muted' : 'Washed out';
  const color = score >= 80 ? '#fb923c' : score >= 60 ? '#fbbf24' : score >= 40 ? '#fde68a' : '#94a3b8';
  const detail =
    score >= 80 ? 'Scattered mid-level cloud + clean air — camera ready.'
    : score >= 60 ? 'Decent glow expected near the horizon.'
    : score >= 40 ? 'Some color, but clouds may flatten it.'
    : score >= 20 ? 'Thick cloud / haze will mute the show.'
    : 'Solid overcast — skip the sunset watch.';
  return { score, label, detail, color };
}

// Best outdoor activity window in next 12h: score each hour, pick best run.
export function outdoorWindow(hourly, nowIdx, { units: _units = 'metric' } = {}) {
  if (!hourly?.time?.length || nowIdx < 0) return null;
  const end = Math.min(nowIdx + 13, hourly.time.length);
  const scored = [];
  for (let i = nowIdx; i < end; i++) {
    const t = hourly.time[i];
    const hour = new Date(t).getHours();
    const temp = hourly.temperature_2m[i] ?? 20;
    const code = hourly.weather_code[i] ?? 1;
    const pop = hourly.precipitation_probability?.[i] ?? 0;
    const ghi = hourly.shortwave_radiation?.[i] ?? 0;
    const kind = conditionKind(code);
    let s = 100;
    if (kind === 'storm') s -= 70;
    else if (kind === 'rain') s -= 45;
    else if (kind === 'drizzle') s -= 25;
    else if (kind === 'snow') s -= 35;
    else if (kind === 'fog') s -= 20;
    if (pop >= 70) s -= 40;
    else if (pop >= 40) s -= 20;
    else if (pop >= 20) s -= 8;
    if (temp > 34) s -= 35;
    else if (temp > 30) s -= 15;
    else if (temp < -5) s -= 30;
    else if (temp < 0) s -= 12;
    else if (temp >= 14 && temp <= 26) s += 8;
    if (hour >= 11 && hour <= 15 && ghi > 500) s -= 10; // midday glare/heat
    if (hour >= 6 && hour <= 10) s += 6; // morning sweet spot
    if (hour >= 17 && hour <= 19) s += 6; // evening walk
    scored.push({ i, t, hour, score: Math.max(0, Math.min(100, Math.round(s))), temp, kind, pop });
  }
  // Find longest top run (score >= 70)
  let best = null, runStart = -1;
  for (let k = 0; k <= scored.length; k++) {
    const ok = k < scored.length && scored[k].score >= 70;
    if (ok && runStart < 0) runStart = k;
    if (!ok && runStart >= 0) {
      const len = k - runStart;
      const avg = Math.round(scored.slice(runStart, k).reduce((a, b) => a + b.score, 0) / len);
      if (!best || len > best.len || (len === best.len && avg > best.avg)) {
        best = { start: scored[runStart], end: scored[k - 1], len, avg };
      }
      runStart = -1;
    }
  }
  if (!best) {
    // fallback: single best hour
    const top = [...scored].sort((a, b) => b.score - a.score)[0];
    if (!top) return null;
    best = { start: top, end: top, len: 1, avg: top.score };
  }
  const fmt = (h) => `${String(h).padStart(2, '0')}:00`;
  const verdict = best.avg >= 80 ? 'Great window' : best.avg >= 65 ? 'Good window' : best.avg >= 50 ? 'OK window' : 'Poor — reschedule';
  const color = best.avg >= 70 ? '#34d399' : best.avg >= 50 ? '#fbbf24' : '#f87171';
  return {
    ...best,
    label: best.start.hour === best.end.hour ? fmt(best.start.hour) : `${fmt(best.start.hour)}–${fmt((best.end.hour + 1) % 24)}`,
    verdict,
    color,
    peak: [...scored].sort((a, b) => b.score - a.score)[0],
    hours: scored,
  };
}

// Multi-model confidence: compare near-term temps across ECMWF / GFS / ICON.
export async function fetchModelConfidence(lat, lon) {
  const models = ['ecmwf_ifs025', 'gfs_global', 'icon_global'];
  const names = { ecmwf_ifs025: 'ECMWF', gfs_global: 'GFS', icon_global: 'ICON' };
  try {
    const results = await Promise.all(
      models.map((m) =>
        fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m&forecast_days=2&models=${m}&timezone=auto`,
        ).then((r) => r.json()).catch(() => null),
      ),
    );
    const series = results.map((j, idx) => ({
      id: models[idx],
      name: names[models[idx]],
      temps: j?.hourly?.temperature_2m ?? null,
      times: j?.hourly?.time ?? null,
    })).filter((s) => s.temps?.length);
    if (series.length < 2) return { ok: false, series: [], spread: null, confidence: null };
    // Spread over next 48h where all overlap
    const n = Math.min(...series.map((s) => s.temps.length));
    let maxSpread = 0, sumSpread = 0, cnt = 0;
    for (let i = 0; i < n; i++) {
      const vals = series.map((s) => s.temps[i]).filter((v) => v != null);
      if (vals.length < 2) continue;
      const sp = Math.max(...vals) - Math.min(...vals);
      maxSpread = Math.max(maxSpread, sp);
      sumSpread += sp;
      cnt++;
    }
    const avgSpread = cnt ? sumSpread / cnt : 0;
    // Confidence: models agree within 1.5°C avg → high; >3.5 → low
    const confidence =
      avgSpread <= 1.5 ? { label: 'High', color: '#34d399', note: 'Models agree — trust the number.' }
      : avgSpread <= 2.5 ? { label: 'Medium', color: '#fbbf24', note: 'Slight model disagreement.' }
      : { label: 'Low', color: '#f87171', note: 'Models disagree — treat forecast with caution.' };
    return {
      ok: true,
      series,
      avgSpread: +avgSpread.toFixed(1),
      maxSpread: +maxSpread.toFixed(1),
      confidence,
    };
  } catch {
    return { ok: false, series: [], spread: null, confidence: null };
  }
}

// Threshold alert rules evaluated client-side → Notification API.
export const ALERT_TYPES = [
  { id: 'rain', label: 'Rain in next hour', icon: '☔' },
  { id: 'uv', label: 'UV ≥ 6 (high)', icon: '☀️' },
  { id: 'germ', label: 'Germ index ≥ 65', icon: '🦠' },
  { id: 'gust', label: 'Wind gusts ≥ 50 km/h', icon: '💨' },
  { id: 'stargaze', label: 'Stargazing score ≥ 80', icon: '🔭' },
];

export function evaluateAlerts({ hourly, nowIdx, c, germ, stars, isDay }) {
  const fired = [];
  if (!hourly || nowIdx < 0) return fired;
  // rain: precip prob or code in next 1–2h
  let rainSoon = false;
  for (let i = nowIdx; i < Math.min(nowIdx + 2, hourly.time.length); i++) {
    const p = hourly.precipitation_probability?.[i] ?? 0;
    const code = hourly.weather_code?.[i] ?? 0;
    if (p >= 60 || [61, 63, 65, 80, 81, 82, 95, 96, 99].includes(code)) rainSoon = true;
  }
  if (rainSoon || (c && c.precipitation > 0.5)) {
    fired.push({ id: 'rain', title: 'Rain expected soon', body: 'Precipitation likely within the next hour — grab an umbrella.' });
  }
  if (c && c.is_day && (c.uv_index ?? 0) >= 6) {
    fired.push({ id: 'uv', title: `High UV (${c.uv_index.toFixed(1)})`, body: 'Use SPF 30+ and limit direct midday sun.' });
  }
  if (germ && germ.score >= 65) {
    fired.push({ id: 'germ', title: `High germ risk (${germ.score}/100)`, body: germ.hint });
  }
  if (c && (c.wind_gusts_10m ?? 0) >= 50) {
    fired.push({ id: 'gust', title: `Strong gusts (${Math.round(c.wind_gusts_10m)} km/h)`, body: 'Secure loose objects and take care outdoors.' });
  }
  if (stars && !isDay && stars.score >= 80) {
    fired.push({ id: 'stargaze', title: `Excellent stargazing (${stars.score}/100)`, body: stars.detail });
  }
  return fired;
}

export async function fetchWeather(lat, lon) {
  const params = new URLSearchParams({
    latitude: lat, longitude: lon,
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m,shortwave_radiation,direct_radiation,diffuse_radiation,direct_normal_irradiance,sunshine_duration,uv_index',
    hourly: 'temperature_2m,weather_code,shortwave_radiation,is_day,precipitation_probability,pressure_msl',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,daylight_duration,sunshine_duration,uv_index_max,shortwave_radiation_sum,precipitation_probability_max',
    timezone: 'auto', forecast_days: '7',
  });
  const aqParams = new URLSearchParams({
    latitude: lat, longitude: lon, timezone: 'auto',
    current: 'us_aqi,pm2_5,pm10,ozone,nitrogen_dioxide,alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,olive_pollen,ragweed_pollen',
  });
  const [w, aq] = await Promise.all([
    fetch(`https://api.open-meteo.com/v1/forecast?${params}`).then(r => r.json()),
    fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?${aqParams}`).then(r => r.json()).catch(() => null),
  ]);

  const c = w.current;
  const lux = ghiToLux(c.shortwave_radiation, c.is_day);
  return { raw: w, aqi: aq?.current ?? null, lux, luxInfo: luxCategory(lux) };
}

export const DEMOS = [
  { id: 'noon', name: '☀️ Desert noon', values: { weather_code: 0, cloud_cover: 5, shortwave_radiation: 1000, direct_normal_irradiance: 900, diffuse_radiation: 100, is_day: 1, uv_index: 11, temperature_2m: 38, apparent_temperature: 40, precipitation: 0, wind_speed_10m: 8 } },
  { id: 'overcast', name: '☁️ Overcast day', values: { weather_code: 3, cloud_cover: 95, shortwave_radiation: 90, direct_normal_irradiance: 20, diffuse_radiation: 75, is_day: 1, uv_index: 1, temperature_2m: 22, apparent_temperature: 21, precipitation: 0, wind_speed_10m: 12 } },
  { id: 'rain', name: '🌧 Monsoon rain', values: { weather_code: 63, cloud_cover: 100, shortwave_radiation: 40, direct_normal_irradiance: 5, diffuse_radiation: 38, is_day: 1, uv_index: 0.5, temperature_2m: 25, apparent_temperature: 27, precipitation: 4.2, wind_speed_10m: 22 } },
  { id: 'storm-night', name: '⛈ Storm night', values: { weather_code: 95, cloud_cover: 100, shortwave_radiation: 0, direct_normal_irradiance: 0, diffuse_radiation: 0, is_day: 0, uv_index: 0, temperature_2m: 24, apparent_temperature: 25, precipitation: 8.5, wind_speed_10m: 45 } },
  { id: 'snow', name: '❄️ Snow', values: { weather_code: 73, cloud_cover: 88, shortwave_radiation: 110, direct_normal_irradiance: 30, diffuse_radiation: 95, is_day: 1, uv_index: 1, temperature_2m: -2, apparent_temperature: -8, precipitation: 1.5, wind_speed_10m: 18 } },
  { id: 'midnight', name: '🌙 Clear midnight', values: { weather_code: 0, cloud_cover: 0, shortwave_radiation: 0, direct_normal_irradiance: 0, diffuse_radiation: 0, is_day: 0, uv_index: 0, temperature_2m: 18, apparent_temperature: 17, precipitation: 0, wind_speed_10m: 6 } },
];
