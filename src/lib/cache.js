// Local cache helpers — last weather payload per location for instant open.

const KEY = 'wx-cache-v1';

export function cacheKey(lat, lon) {
  return `${lat.toFixed(3)},${lon.toFixed(3)}`;
}

export function readCache(lat, lon) {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const all = JSON.parse(raw);
    const hit = all[cacheKey(lat, lon)];
    if (!hit?.data) return null;
    // Stale after 30 min
    if (Date.now() - hit.at > 30 * 60 * 1000) return null;
    return hit;
  } catch {
    return null;
  }
}

export function writeCache(lat, lon, data) {
  try {
    const raw = localStorage.getItem(KEY);
    const all = raw ? JSON.parse(raw) : {};
    all[cacheKey(lat, lon)] = { at: Date.now(), data };
    // Keep only 6 locations
    const keys = Object.keys(all);
    if (keys.length > 6) {
      keys.sort((a, b) => (all[a].at || 0) - (all[b].at || 0));
      for (const k of keys.slice(0, keys.length - 6)) delete all[k];
    }
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* quota / private mode */
  }
}
