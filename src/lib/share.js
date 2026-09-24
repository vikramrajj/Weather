// Canvas-rendered shareable daily card (no external deps).

export async function renderShareCard({
  city,
  temp,
  condition,
  lux,
  luxLabel,
  germ,
  sunsetScore,
  brief,
  units,
  accentHex = '#38bdf8',
}) {
  const W = 800;
  const H = 1000;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');

  // Background gradient (sky-ish)
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0f172a');
  bg.addColorStop(0.45, '#1e293b');
  bg.addColorStop(1, '#020617');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);

  // Accent glow
  const glow = g.createRadialGradient(W / 2, 180, 20, W / 2, 180, 420);
  glow.addColorStop(0, `${accentHex}55`);
  glow.addColorStop(1, 'transparent');
  g.fillStyle = glow;
  g.fillRect(0, 0, W, 500);

  // Brand
  g.fillStyle = 'rgba(248,250,252,0.7)';
  g.font = '600 22px SF Pro Display, system-ui, sans-serif';
  g.textAlign = 'center';
  g.fillText('SkyLux Weather', W / 2, 64);

  // City
  g.fillStyle = '#f8fafc';
  g.font = '500 36px SF Pro Display, system-ui, sans-serif';
  g.fillText(city, W / 2, 130);

  // Temp
  g.font = '200 160px SF Pro Display, system-ui, sans-serif';
  g.fillText(`${temp}°`, W / 2, 320);

  // Condition
  g.font = '400 32px SF Pro Display, system-ui, sans-serif';
  g.fillStyle = 'rgba(248,250,252,0.88)';
  g.fillText(condition, W / 2, 370);

  // Brief line
  if (brief) {
    g.font = '500 26px SF Pro Display, system-ui, sans-serif';
    g.fillStyle = accentHex;
    wrapText(g, brief, W / 2, 430, W - 120, 34);
  }

  // Metric chips
  const metrics = [
    { label: 'Lux', value: lux != null ? lux.toLocaleString() : '—', sub: luxLabel || '' },
    { label: 'Germ index', value: germ != null ? `${germ.score}/100` : '—', sub: germ?.label || '' },
    { label: 'Sunset', value: sunsetScore != null ? `${sunsetScore.score}/100` : '—', sub: sunsetScore?.label || '' },
  ];
  const chipW = 220;
  const gap = 24;
  const totalW = metrics.length * chipW + (metrics.length - 1) * gap;
  const startX = (W - totalW) / 2;
  metrics.forEach((m, i) => {
    const x = startX + i * (chipW + gap);
    const y = 520;
    roundRect(g, x, y, chipW, 160, 24);
    g.fillStyle = 'rgba(15,23,42,0.75)';
    g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.12)';
    g.stroke();
    g.fillStyle = 'rgba(248,250,252,0.55)';
    g.font = '500 18px SF Pro Display, system-ui, sans-serif';
    g.textAlign = 'center';
    g.fillText(m.label, x + chipW / 2, y + 40);
    g.fillStyle = '#f8fafc';
    g.font = '300 40px SF Pro Display, system-ui, sans-serif';
    g.fillText(m.value, x + chipW / 2, y + 95);
    g.fillStyle = 'rgba(248,250,252,0.5)';
    g.font = '400 16px SF Pro Display, system-ui, sans-serif';
    g.fillText(m.sub.slice(0, 24), x + chipW / 2, y + 130);
  });

  // Footer
  g.fillStyle = 'rgba(248,250,252,0.4)';
  g.font = '400 18px SF Pro Display, system-ui, sans-serif';
  g.textAlign = 'center';
  g.fillText(`Units: ${units === 'imperial' ? '°F' : '°C'} · data: Open-Meteo`, W / 2, H - 48);
  g.fillText(new Date().toLocaleString(), W / 2, H - 22);

  return new Promise((resolve) => {
    c.toBlob((blob) => resolve({ blob, canvas: c }), 'image/png');
  });
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function wrapText(g, text, x, y, maxW, lineH) {
  const words = String(text).split(' ');
  let line = '';
  let yy = y;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (g.measureText(test).width > maxW && line) {
      g.fillText(line, x, yy);
      line = w;
      yy += lineH;
    } else line = test;
  }
  if (line) g.fillText(line, x, yy);
}

export async function downloadShareCard(payload) {
  const { blob } = await renderShareCard(payload);
  if (!blob) return { ok: false };
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `skylux-${(payload.city || 'weather').toLowerCase().replace(/\s+/g, '-')}.png`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return { ok: true, url };
}
