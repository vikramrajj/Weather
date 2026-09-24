// RainViewer free radar tiles — no API key.
// Metadata: https://api.rainviewer.com/public/weather-maps.json
// Tiles:   https://tilecache.rainviewer.com/v2/radar/{ts}/256/{z}/{x}/{y}/2/1_1.png

export async function fetchRadarFrames() {
  try {
    const r = await fetch('https://api.rainviewer.com/public/weather-maps.json');
    if (!r.ok) throw new Error(`radar ${r.status}`);
    const j = await r.json();
    const host = j.host || 'https://tilecache.rainviewer.com';
    const past = j.radar?.past || [];
    const nowcast = j.radar?.nowcast || [];
    const frames = [...past, ...nowcast].map((f) => ({
      time: f.time,
      path: f.path,
      label: f.time
        ? new Date(f.time * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '',
    }));
    if (!frames.length) throw new Error('no frames');
    return { ok: true, host, frames, pastCount: past.length, attribution: 'RainViewer' };
  } catch {
    return { ok: false, host: null, frames: [], pastCount: 0, attribution: 'RainViewer' };
  }
}

export function tileUrl(radar, z, x, y) {
  if (!radar?.ok || !radar.frames?.length) return null;
  const f = radar.frames[radar.frames.length - 1]; // latest (nowcast tip) or mid
  return `${radar.host}/v2/radar/${f.path}/256/${z}/${x}/${y}/2/1_1.png`;
}

export function frameTileUrl(radar, frameIdx, z, x, y) {
  if (!radar?.ok?.frames?.length) return null;
  const f = radar.frames[Math.min(frameIdx, radar.frames.length - 1)];
  return `${radar.host}/v2/radar/${f.path}/256/${z}/${x}/${y}/2/1_1.png`;
}

// Web Mercator helpers for lat/lon → tile XYZ at zoom z.
export function lonLatToTile(lon, lat, z) {
  const n = 2 ** z;
  const x = Math.floor(((lon + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  return { x: Math.max(0, Math.min(n - 1, x)), y: Math.max(0, Math.min(n - 1, y)) };
}
