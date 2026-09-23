# SkyLux Weather

A weather app that goes far beyond temperature and icons — **live sky simulation, sunlight lux intensity, air germ index, pollen, skin/UV exposure, night-sky planet visibility, stargazing scores, migraine risk, rooftop solar yield**, and more. Built with React 19 + Vite + Tailwind CSS v4, powered entirely by **free, keyless APIs**.

![stack](https://img.shields.io/badge/React-19-61dafb) ![vite](https://img.shields.io/badge/Vite-8-646cff) ![tailwind](https://img.shields.io/badge/Tailwind-v4-38bdf8) ![api](https://img.shields.io/badge/APIs-Open--Meteo%20%7C%20aurora.you%20%7C%20skytime-green)

---

## Why this app?

Most weather apps stop at “28° · Partly cloudy”. SkyLux answers the questions people actually have about the air and light around them:

| Question | Feature |
|---|---|
| How bright is it *right now*? | **Live lux intensity** (GHI × 120 estimate) |
| Is the air full of germs / mold? | **Air Germ Index** (0–100 heuristic) |
| Will pollen ruin my day? | **Plant pollination** (CAMS pollen, Europe) |
| Will my skin burn / tan? | **Skin & sun exposure** (burn time, SPF, Fitzpatrick type) |
| What planets are up tonight? | **Tonight’s sky** (aurora.you + meteor showers) |
| Is it a good night for stars? | **Stargazing score** (clouds + moon) |
| Will I get a migraine? | **Headache / migraine risk** (pressure trend) |
| How much solar power today? | **Rooftop solar calculator** (kWh yield) |

---

## Feature highlights

### ☀️ Live sunlight · Lux intensity
- Real-time **lux** estimate from solar shortwave radiation: `lux ≈ GHI × 120`
- Categorical badge (night → desert noon) with practical hints
- Gradient meter + GHI / DNI / diffuse / UV breakdown
- Drives plant light (PPFD), vitamin-D, and circadian/melatonin hints

### 🦠 Air biology · Germs & Pollen
- **Germ Index (0–100)**: transparent heuristic from PM2.5, PM10, humidity, temperature, and AQI — labeled as an estimate, not a medical germ count
- **Plant pollination**: grass, birch, alder, olive, mugwort, ragweed pollen grains/m³ from Open-Meteo CAMS (Europe coverage; shown honestly as “No data” elsewhere)
- Progress bar + Low / Moderate / High tiers with actionable advice

### 🧴 Skin & sun exposure
- **Time to burn** and **safe tan window** from UV index + Fitzpatrick skin type (I–VI selector, persisted)
- Suggested **SPF** tier and plain-language advice (midday avoidance, cover-up)
- Night state shows “Safe — no UV”
- Complements the existing vitamin-D and Health tile

### 🌌 Tonight’s sky · Planets
- Visible planets above the horizon with **magnitude, altitude, direction**
- Moon phase + illumination
- Next **meteor shower** countdown (peak date, days out, ZHR)
- Data: [aurora.you](https://www.aurora.you) (attribution shown in-app) + [skytime.live](https://skytime.live)

### 📈 Day progression graph
- Interactive SVG chart: temperature curve + lux fill + sun elevation arc
- **Highlighted sunrise / sunset** with time pills, golden-hour / civil-twilight bands, night wash
- Hover / tap-to-pin hour readout, unit-aware (°C/°F)

### 📍 Pinned locations
- Pin up to **8 cities** you care about (localStorage `wx-pins`) — no static hard-coded list
- Search any city (Open-Meteo geocoding) or use GPS, then tap the pin icon
- Chips with one-tap unpin; first location restored on reload

### 🌤 Live sky canvas
- Full-screen canvas background driven by weather code, cloud cover, sun/moon position
- Rain, snow, lightning, stars, parallax clouds — performance-capped (viewport-sized, 30 fps, pauses when tab hidden)

### Rare “normal weather” extras
- What to wear · headache/migraine risk (6h pressure drop) · stargazing score
- Rooftop solar calculator (kW slider → kWh/day) · 7-day forecast with daily solar MJ
- AQI color badges · wind direction arrow · count-up hero temperature
- °C/°F toggle · demo scenario console (storm night, desert noon, …)

---

## Tech stack

| Layer | Choice |
|---|---|
| UI | React 19, Vite 8, Tailwind CSS v4 (`@tailwindcss/vite`) |
| Icons | lucide-react |
| Astronomy | suncalc (sun times, moon, elevation) |
| Lint | oxlint |
| Sky rendering | Hand-rolled canvas (no heavy WebGL dep) |

---

## Data sources (all free, no API key)

| Source | Used for |
|---|---|
| [Open-Meteo Forecast](https://open-meteo.com) | Current weather, hourly, 7-day, UV, radiation |
| [Open-Meteo Air Quality](https://open-meteo.com/en/docs/air-quality-api) | AQI, PM2.5/PM10, pollen species (CAMS) |
| [Open-Meteo Geocoding](https://open-meteo.com/en/docs/geocoding-api) | City search |
| [aurora.you](https://www.aurora.you/developers) | Visible planets, moon (attribution required) |
| [skytime.live](https://skytime.live/api/docs) | Meteor shower calendar |

Lux, germ index, skin exposure, and solar kWh are **client-side estimates** derived from the above raw values (documented in `src/lib/weather.js`).

---

## Quick start

```bash
# install
npm install

# dev server (http://localhost:5173)
npm run dev

# production build → dist/
npm run build

# lint
npm run lint

# preview production build
npm run preview
```

No `.env` or API keys required.

---

## Project structure

```
src/
  App.jsx                 # main UI, pins, cards, header
  main.jsx
  index.css               # glass UI, shimmer, sky-text, Tailwind theme
  components/
    SkyCanvas.jsx         # live sky background (canvas)
    DayProgressGraph.jsx  # interactive day temperature/lux graph
  lib/
    weather.js            # Open-Meteo fetch, lux, germ, pollen, skin, advice
    nightsky.js           # aurora.you planets + skytime meteor showers
```

### localStorage keys

| Key | Purpose |
|---|---|
| `wx-pins` | Pinned locations JSON |
| `wx-units` | `metric` / `imperial` |
| `wx-skin` | Fitzpatrick skin type 1–6 |

---

## Accessibility & performance notes

- Semantic labels, `aria-label` on icon buttons, progressbar roles on meters
- Skeleton shimmer on first load; reduced-motion respected in CSS
- Canvas: DPR capped, 30 fps, pauses when `document.hidden`
- Components memoized; hooks run before early returns

---

## Screenshots / demo

Use the floating **Demo** pill (bottom-right) to instantly switch skies: Desert noon, Overcast, Monsoon, Storm night, Snow, Clear midnight — sky, lux, and cards all react live.

---

## License

MIT — free to use and modify. Please keep third-party attribution (aurora.you, Open-Meteo, skytime.live) when you display their data.
