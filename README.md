# Pulse of America — US County Statistics Visualizer

An interactive county-level intelligence dashboard for the United States. Palantir-inspired aesthetic with real-time data overlays, choropleth mapping, and drill-down analytics per county.

## Stack

- **Framework:** React 18 + Vite
- **Mapping:** MapLibre GL JS
- **Data viz:** Recharts + D3 (scale, array, chromatic)
- **Geo processing:** TopoJSON Client
- **Styling:** Custom dark-mode Palantir-style UI

## Features

- **County-level choropleth map** — color-coded overlays across all 3,000+ US counties
- **Multiple data layers** — toggle between demographics, crime/police activity, economic indicators, and more
- **Drill-down panels** — click any county for detailed stats, charts, and trend lines via Recharts
- **D3 color scales** — perceptually uniform chromatic scales mapped to data ranges
- **TopoJSON rendering** — efficient boundary rendering without bloated GeoJSON payloads

## Getting Started

```bash
git clone https://github.com/Aditya1929/US-County-Statistics-Visualizer
cd US-County-Statistics-Visualizer
npm install
npm run dev
```

## Project Structure

```
src/
├── components/       # Map, sidebar panels, overlay toggles
├── data/             # TopoJSON county boundaries, static datasets
├── hooks/            # Data fetching, map state
└── lib/              # D3 scale config, color ramps, data utils
```

## Requirements

- Node.js 18+
- Modern browser with WebGL support (required for MapLibre)
