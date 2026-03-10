# Commute Calculator

Visualize commutable areas from your workplace on an interactive map. Enter your work location and see colored overlays showing how far you can travel within different time intervals by car, public transport, cycling, or walking.

## Features

- **Interactive map** — Click to set your work location, or search by address
- **Multiple transport modes** — Car, public transport, cycling, and walking
- **Configurable time intervals** — 10, 20, 30, 45, and 60 minute ranges
- **Colored overlays** — Isochrone polygons show reachable areas for each time interval
- **Draggable marker** — Reposition your work location by dragging the marker
- **Responsive design** — Works on desktop and mobile

## Quick Start

> **Prerequisites:** [Node.js](https://nodejs.org/) v18+ and a free [Geoapify](https://myprojects.geoapify.com/register) API key.

**One command** — installs dependencies (if needed) and opens the app in your browser:

```bash
./start.sh        # macOS / Linux
start.bat          # Windows
```

Or with npm:

```bash
npm install && npm start
```

### Other Commands

| Command | Description |
|---------|-------------|
| `npm start` | Start dev server and open browser |
| `npm run dev` | Start dev server (no auto-open) |
| `npm run build` | Build for production to `dist/` |
| `npm run preview` | Preview production build |
| `npm test` | Run tests |

## Usage

1. Enter your **work address** in the search box, or **click on the map** to place a marker
2. Select a **transport mode** (car, public transit, cycling, or walking)
3. Choose which **time intervals** to display (10, 20, 30, 45, 60 minutes)
4. Enter your **Geoapify API key**
5. Click **Calculate Commute Areas** to see colored overlays on the map

## Technology

- [Vite](https://vitejs.dev/) — Build tool
- [Leaflet](https://leafletjs.com/) — Interactive maps
- [Geoapify](https://www.geoapify.com/) — Isoline API for commute calculations (supports public transport)
- [OpenStreetMap](https://www.openstreetmap.org/) — Map tiles and geocoding
