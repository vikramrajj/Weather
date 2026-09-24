import { memo, useEffect, useState } from 'react';
import { MapPin, Loader2 } from 'lucide-react';
import { fetchRadarFrames, frameTileUrl, lonLatToTile } from '../lib/radar';

// Lightweight precip radar: RainViewer tiles centered on lat/lon, auto-rotating frames.
const Z = 7;

function RadarMap({ lat, lon }) {
  const [radar, setRadar] = useState(null);
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let dead = false;
    fetchRadarFrames().then((r) => {
      if (dead) return;
      if (r.ok) {
        setRadar(r);
        setErr(false);
        setFrame(0);
      } else {
        setRadar(null);
        setErr(true);
      }
    });
    return () => { dead = true; };
  }, [lat, lon]);

  useEffect(() => {
    if (!playing || !radar?.frames?.length) return;
    const id = setInterval(() => {
      setFrame((f) => (f + 1) % radar.frames.length);
    }, 700);
    return () => clearInterval(id);
  }, [playing, radar]);

  if (err) {
    return (
      <div className="mt-2 rounded-2xl bg-black/35 border border-white/10 p-6 text-center text-sm text-white/55">
        Radar unavailable — check connection or RainViewer status.
      </div>
    );
  }
  if (!radar) {
    return (
      <div className="mt-2 rounded-2xl bg-black/35 border border-white/10 p-6 flex items-center justify-center gap-2 text-sm text-white/55">
        <Loader2 size={14} className="animate-spin" /> Loading radar…
      </div>
    );
  }

  const { x, y } = lonLatToTile(lon, lat, Z);
  // 3×3 tile grid around center
  const tiles = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const tx = x + dx;
      const ty = y + dy;
      const url = frameTileUrl(radar, frame, Z, tx, ty);
      if (url) tiles.push({ key: `${tx}-${ty}`, url, dx, dy });
    }
  }
  // Center pixel offset of lat/lon within center tile
  const n = 2 ** Z;
  const fx = ((lon + 180) / 360) * n - x;
  const latRad = (lat * Math.PI) / 180;
  const fy = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n - y;

  const TILE = 192;
  const gridW = TILE * 3;
  const gridH = TILE * 3;
  // shift so lat/lon sits center
  const offX = gridW / 2 - (fx + 1) * TILE;
  const offY = gridH / 2 - (fy + 1) * TILE;

  return (
    <div className="mt-2">
      <div
        className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-950/80"
        style={{ height: 260 }}
        role="img"
        aria-label={`Precipitation radar near ${lat.toFixed(2)}, ${lon.toFixed(2)}`}
      >
        {/* OSM basemap opacity underlay via CSS grid of radar tiles */}
        <div className="absolute inset-0" style={{ opacity: 0.45 }}>
          <div
            style={{
              position: 'absolute',
              width: gridW,
              height: gridH,
              transform: `translate(${offX}px, ${offY}px)`,
              left: '50%',
              top: '50%',
              marginLeft: -gridW / 2,
              marginTop: -gridH / 2,
            }}
          >
            {tiles.map((t) => (
              <img
                key={t.key}
                src={t.url}
                alt=""
                draggable={false}
                width={TILE}
                height={TILE}
                style={{
                  position: 'absolute',
                  left: (t.dx + 1) * TILE,
                  top: (t.dy + 1) * TILE,
                  imageRendering: 'pixelated',
                }}
              />
            ))}
          </div>
        </div>
        {/* Simple street-ish grid + center pin (no external basemap dependency) */}
        <div className="absolute inset-0 opacity-20 pointer-events-none" aria-hidden="true" style={{
          backgroundImage:
            'linear-gradient(rgba(148,163,184,0.25) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.25) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }} />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          <MapPin size={22} className="text-white drop-shadow" fill="#38bdf8" />
        </div>
        <div className="absolute bottom-2 left-2 text-[10px] text-white/60 bg-black/50 px-2 py-0.5 rounded">
          {radar.frames[frame]?.label || 'now'} · RainViewer
        </div>
        <div className="absolute bottom-2 right-2 flex gap-1">
          <button
            onClick={() => setPlaying((p) => !p)}
            className="text-[10px] px-2 py-1 rounded bg-black/60 border border-white/20 text-white/90 hover:bg-black/80"
            aria-label={playing ? 'Pause radar' : 'Play radar'}
          >
            {playing ? '❚❚' : '▶'}
          </button>
          <button
            onClick={() => setFrame((f) => (f + 1) % radar.frames.length)}
            className="text-[10px] px-2 py-1 rounded bg-black/60 border border-white/20 text-white/90 hover:bg-black/80"
            aria-label="Next frame"
          >
            ⏭
          </button>
        </div>
      </div>
      {/* frame scrubber */}
      <input
        type="range"
        min={0}
        max={Math.max(0, radar.frames.length - 1)}
        value={frame}
        onChange={(e) => { setPlaying(false); setFrame(+e.target.value); }}
        className="w-full mt-2"
        aria-label="Radar timeline"
      />
      <div className="flex justify-between text-[10px] text-white/40 tabular-nums">
        <span>{radar.frames[0]?.label}</span>
        <span>past → nowcast ({radar.frames.length} frames)</span>
        <span>{radar.frames[radar.frames.length - 1]?.label}</span>
      </div>
    </div>
  );
}

export default memo(RadarMap);
