# Commute Calculator

Visualize commutable areas from your workplace on an interactive map. Enter your work location and see colored overlays showing how far you can travel within different time intervals by car, public transport, cycling, or walking.

## Features

- **Interactive map** — Click to set your work location, or search by address
- **Multiple transport modes** — Car, public transport, cycling, and walking
- **Configurable time intervals** — 10, 20, 30, 45, and 60 minute ranges
- **Colored overlays** — Isochrone polygons show reachable areas for each time interval
- **Draggable marker** — Reposition your work location by dragging the marker
- **Responsive design** — Works on desktop and mobile

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later)
- An [OpenRouteService](https://openrouteservice.org/dev/#/signup) API key (free)

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open the URL shown in the terminal (usually `http://localhost:5173`).

### Build

```bash
npm run build
```

The production build is output to the `dist/` directory.

### Tests

```bash
npm test
```

## Usage

1. Enter your **work address** in the search box, or **click on the map** to place a marker
2. Select a **transport mode** (car, public transit, cycling, or walking)
3. Choose which **time intervals** to display (10, 20, 30, 45, 60 minutes)
4. Enter your **OpenRouteService API key**
5. Click **Calculate Commute Areas** to see colored overlays on the map

## Technology

- [Vite](https://vitejs.dev/) — Build tool
- [Leaflet](https://leafletjs.com/) — Interactive maps
- [OpenRouteService](https://openrouteservice.org/) — Isochrone API for commute calculations
- [OpenStreetMap](https://www.openstreetmap.org/) — Map tiles and geocoding
