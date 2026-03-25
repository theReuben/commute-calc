import L from 'leaflet';
import 'leaflet.heat';
import { DEFAULT_CENTER, DEFAULT_ZOOM, TIME_COLORS, LOCATION_COLORS } from './config.js';
import { getFeatureMinutes } from './isochrone.js';

/**
 * Create and manage the Leaflet map and its overlays.
 */
export function createMap(elementId) {
  const map = L.map(elementId).setView(DEFAULT_CENTER, DEFAULT_ZOOM);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  }).addTo(map);

  let workMarker = null;
  let isochroneLayer = L.featureGroup().addTo(map);
  let crimeLayer = L.layerGroup().addTo(map);
  let liveabilityLayer = L.layerGroup().addTo(map);
  let crimeControl = null;
  let liveabilityControl = null;
  let markerDragCallback = null;

  /** Map of locationId -> L.circleMarker for multi-location support */
  const locationMarkers = new Map();
  /** Callback for when a map click should set a location */
  let pendingMapClickLocationId = null;
  let mapClickLocationCallback = null;

  function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  /**
   * Escape HTML special characters to prevent XSS.
   * @param {string} str
   * @returns {string}
   */
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * Set or move the work location marker.
   * @param {number} lat
   * @param {number} lon
   * @param {string} [label]
   */
  function setWorkLocation(lat, lon, label) {
    if (workMarker) {
      workMarker.setLatLng([lat, lon]);
    } else {
      workMarker = L.marker([lat, lon], {
        draggable: true,
        title: 'Work Location',
      }).addTo(map);

      // Register dragend listener when marker is first created
      workMarker.on('dragend', () => {
        const pos = workMarker.getLatLng();
        if (markerDragCallback) {
          markerDragCallback(pos.lat, pos.lng);
        }
      });
    }

    const popupText = label
      ? escapeHtml(label)
      : `Work Location<br>${lat.toFixed(5)}, ${lon.toFixed(5)}`;
    workMarker.bindPopup(popupText).openPopup();
    map.setView([lat, lon], Math.max(map.getZoom(), 12));

    return workMarker;
  }

  /**
   * Get the current work location coordinates.
   * @returns {{lat: number, lon: number} | null}
   */
  function getWorkLocation() {
    if (!workMarker) return null;
    const latlng = workMarker.getLatLng();
    return { lat: latlng.lat, lon: latlng.lng };
  }

  /**
   * Display isochrone GeoJSON on the map.
   * Features are sorted so larger (longer time) polygons render behind smaller ones.
   * @param {Object} geojson - GeoJSON FeatureCollection from Geoapify.
   */
  function showIsochrones(geojson) {
    clearIsochrones();

    const features = [...geojson.features].sort((a, b) => {
      return (b.properties?.value || 0) - (a.properties?.value || 0);
    });

    features.forEach((feature) => {
      const minutes = getFeatureMinutes(feature);
      const colorConfig = TIME_COLORS[minutes] || {
        color: '#495057',
        fillColor: '#adb5bd',
      };

      L.geoJSON(feature, {
        style: {
          color: colorConfig.color,
          fillColor: colorConfig.fillColor,
          fillOpacity: 0.3,
          weight: 2,
          opacity: 0.8,
        },
      }).addTo(isochroneLayer);
    });

    // Fit map to isochrone bounds
    const bounds = isochroneLayer.getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [30, 30] });
    }
  }

  /**
   * Remove all isochrone overlays from the map.
   */
  function clearIsochrones() {
    isochroneLayer.clearLayers();
  }

  /**
   * Register a callback for map click events.
   * @param {function} callback - Called with (lat, lon) on map click.
   */
  function onMapClick(callback) {
    map.on('click', (e) => {
      callback(e.latlng.lat, e.latlng.lng);
    });
  }

  /**
   * Register a callback for when the work marker is dragged.
   * The callback is stored and automatically attached when the marker is created.
   * @param {function} callback - Called with (lat, lon) after drag.
   */
  function onMarkerDrag(callback) {
    markerDragCallback = callback;
  }

  /**
   * Display crime density heatmap on the map.
   * @param {Array<{lat: number, lon: number, count: number, density: string, categories: Object}>} gridCells
   * @param {Object} colorMap - Maps density levels to {fillColor, color}.
   * @param {Array} [rawCrimes] - Raw crime records for smooth heat density.
   */
  function showCrimeOverlay(gridCells, colorMap, rawCrimes) {
    clearCrimeOverlay();

    if (gridCells.length === 0) return;

    // Use individual crime points for smooth heat density, fall back to grid cells
    const heatPoints = rawCrimes && rawCrimes.length > 0
      ? rawCrimes.map((c) => [c.lat, c.lon, 1])
      : gridCells.map((cell) => [cell.lat, cell.lon, cell.count]);

    L.heatLayer(heatPoints, {
      radius: 22,
      blur: 18,
      maxZoom: 18,
      max: 1.0,
      minOpacity: 0.35,
      gradient: {
        0.0: '#2b8a3e',
        0.4: '#f59f00',
        1.0: '#e03131',
      },
    }).addTo(crimeLayer);

    // Invisible interactive markers for tooltips and popups on each grid cell
    gridCells.forEach((cell) => {
      const marker = L.circleMarker([cell.lat, cell.lon], {
        radius: 16,
        fillOpacity: 0,
        opacity: 0,
        weight: 0,
        interactive: true,
      }).addTo(crimeLayer);

      const sortedCategories = Object.entries(cell.categories)
        .sort((a, b) => b[1] - a[1]);

      const topCat = sortedCategories[0];
      const tooltipText = topCat
        ? `${cell.count} crime${cell.count !== 1 ? 's' : ''} — ${escapeHtml(formatCrimeCategory(topCat[0]))}`
        : `${cell.count} crime${cell.count !== 1 ? 's' : ''}`;
      marker.bindTooltip(tooltipText, { direction: 'top', offset: [0, -6] });

      const allCategories = sortedCategories
        .map(([cat, n]) => `${escapeHtml(formatCrimeCategory(cat))}: ${n}`)
        .join('<br>');
      marker.bindPopup(
        `<strong>${cell.count} crime${cell.count !== 1 ? 's' : ''}</strong><br>${allCategories}`
      );
    });
  }

  /**
   * Remove all crime overlay markers from the map.
   */
  function clearCrimeOverlay() {
    crimeLayer.clearLayers();
  }

  /**
   * Add a legend control to the map showing crime density gradient.
   * @param {Object} colorMap - Accepted for compat but not used.
   */
  function showCrimeMapLegend(colorMap) {
    clearCrimeMapLegend();
    crimeControl = L.control({ position: 'bottomright' });
    crimeControl.onAdd = function () {
      const container = document.createElement('div');
      container.className = 'leaflet-control crime-map-legend';

      const title = document.createElement('strong');
      title.textContent = 'Crime density';
      container.appendChild(title);

      const gradientBar = document.createElement('div');
      gradientBar.style.cssText =
        'height:10px;border-radius:3px;margin:5px 0 3px;' +
        'background:linear-gradient(to right,#2b8a3e,#f59f00,#e03131);';
      container.appendChild(gradientBar);

      const labels = document.createElement('div');
      labels.style.cssText = 'display:flex;justify-content:space-between;font-size:10px;';
      labels.innerHTML = '<span>Safe</span><span>Moderate</span><span>High</span>';
      container.appendChild(labels);

      return container;
    };
    crimeControl.addTo(map);
  }

  /**
   * Remove the crime legend control from the map.
   */
  function clearCrimeMapLegend() {
    if (crimeControl) {
      crimeControl.remove();
      crimeControl = null;
    }
  }

  /**
   * Format a crime category slug into a readable label.
   * @param {string} category
   * @returns {string}
   */
  function formatCrimeCategory(category) {
    return category
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  /**
   * Display liveability heatmap on the map using leaflet.heat for smooth gradients.
   * An invisible interactive layer provides tooltips and popups on hover/click.
   * @param {Array<{lat: number, lon: number, score: number, level: string, commuteScore: number, crimeScore: number, crimeCount: number}>} gridCells
   * @param {Object} colorMap - Maps liveability levels to {fillColor, color}.
   * @param {number} cellSize - Grid cell size in degrees.
   */
  function showLiveabilityOverlay(gridCells, colorMap, cellSize) {
    clearLiveabilityOverlay();

    if (gridCells.length === 0) return;

    // Build weighted points for heat layer: [lat, lng, intensity]
    const heatPoints = gridCells.map((cell) => [cell.lat, cell.lon, cell.score]);

    // Scale radius based on cell size so heat blobs cover the grid properly
    const approxPixelsPerDegree = 111320 * Math.cos((gridCells[0].lat * Math.PI) / 180);
    const zoom = map.getZoom();
    const metersPerPixel = (40075016.686 * Math.cos((gridCells[0].lat * Math.PI) / 180)) / Math.pow(2, zoom + 8);
    const cellMeters = cellSize * approxPixelsPerDegree;
    const radiusPx = Math.max(12, Math.round((cellMeters / metersPerPixel) * 0.8));

    const heatLayer = L.heatLayer(heatPoints, {
      radius: radiusPx,
      blur: Math.round(radiusPx * 0.6),
      maxZoom: 18,
      max: 1.0,
      minOpacity: 0.35,
      gradient: {
        0.0: '#e03131',
        0.25: '#f76707',
        0.5: '#f59f00',
        0.75: '#74b816',
        1.0: '#2b8a3e',
      },
    }).addTo(liveabilityLayer);

    // Interactive layer: invisible circle markers for tooltips and popups
    gridCells.forEach((cell) => {
      const marker = L.circleMarker([cell.lat, cell.lon], {
        radius: Math.max(6, radiusPx / 2),
        fillOpacity: 0,
        opacity: 0,
        weight: 0,
        interactive: true,
      }).addTo(liveabilityLayer);

      const pct = (cell.score * 100).toFixed(0);
      const tooltipText = `Liveability: ${pct}%`;
      marker.bindTooltip(tooltipText, { direction: 'top', offset: [0, -6] });

      const commutePct = (cell.commuteScore * 100).toFixed(0);
      const crimePct = (cell.crimeScore * 100).toFixed(0);
      let popupHtml = `<strong>Liveability: ${pct}%</strong><br>` +
        `Commute: ${commutePct}%<br>`;
      if (cell.perLocation && cell.perLocation.length > 1) {
        cell.perLocation.forEach((loc) => {
          const locPct = (loc.commuteScore * 100).toFixed(0);
          popupHtml += `&nbsp;&nbsp;${escapeHtml(loc.name)}: ${locPct}%<br>`;
        });
      }
      popupHtml += `Safety: ${crimePct}%<br>Crimes nearby: ${cell.crimeCount}`;
      marker.bindPopup(popupHtml);
    });
  }

  /**
   * Remove all liveability overlay layers from the map.
   */
  function clearLiveabilityOverlay() {
    liveabilityLayer.clearLayers();
  }

  /**
   * Add a legend control to the map showing a liveability gradient.
   * @param {Object} colorMap - Maps level names to {fillColor, color, label}.
   */
  function showLiveabilityMapLegend(colorMap) {
    clearLiveabilityMapLegend();
    liveabilityControl = L.control({ position: 'bottomright' });
    liveabilityControl.onAdd = function () {
      const container = document.createElement('div');
      container.className = 'leaflet-control liveability-map-legend';
      const title = document.createElement('strong');
      title.textContent = 'Liveability';
      container.appendChild(title);

      // Gradient bar
      const gradientBar = document.createElement('div');
      gradientBar.className = 'liveability-gradient-bar';
      gradientBar.style.cssText = 'height:12px;border-radius:3px;margin:6px 0 4px;' +
        'background:linear-gradient(to right, #e03131, #f76707, #f59f00, #74b816, #2b8a3e);';
      container.appendChild(gradientBar);

      // Labels under gradient
      const labels = document.createElement('div');
      labels.className = 'liveability-gradient-labels';
      labels.style.cssText = 'display:flex;justify-content:space-between;font-size:10px;';
      labels.innerHTML = '<span>Poor</span><span>Fair</span><span>Good</span><span>Excellent</span>';
      container.appendChild(labels);

      return container;
    };
    liveabilityControl.addTo(map);
  }

  /**
   * Remove the liveability legend control from the map.
   */
  function clearLiveabilityMapLegend() {
    if (liveabilityControl) {
      liveabilityControl.remove();
      liveabilityControl = null;
    }
  }

  /**
   * Get the current zoom level of the map.
   * @returns {number}
   */
  function getZoom() {
    return map.getZoom();
  }

  /**
   * Register a callback for when the map zoom level changes.
   * @param {function} callback - Called with the new zoom level after zooming ends.
   */
  function onZoomEnd(callback) {
    map.on('zoomend', () => {
      callback(map.getZoom());
    });
  }

  /**
   * Add or update a location marker on the map.
   * @param {string} locationId
   * @param {number} lat
   * @param {number} lon
   * @param {number} colorIndex - Index into LOCATION_COLORS.
   * @param {string} [label]
   */
  function setLocationMarker(locationId, lat, lon, colorIndex, label) {
    const markerColor = LOCATION_COLORS[colorIndex % LOCATION_COLORS.length];
    if (locationMarkers.has(locationId)) {
      const existing = locationMarkers.get(locationId);
      existing.setLatLng([lat, lon]);
      existing.setStyle({ color: markerColor.color, fillColor: markerColor.fillColor });
    } else {
      const marker = L.circleMarker([lat, lon], {
        radius: 10,
        fillColor: markerColor.fillColor,
        color: markerColor.color,
        weight: 3,
        opacity: 1,
        fillOpacity: 0.8,
      }).addTo(map);
      locationMarkers.set(locationId, marker);
    }
    const marker = locationMarkers.get(locationId);
    const popupText = label ? escapeHtml(label) : `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
    marker.bindPopup(popupText);
    marker._locationLabel = popupText;
    map.setView([lat, lon], Math.max(map.getZoom(), 12));
  }

  /**
   * Remove a location marker from the map.
   * @param {string} locationId
   */
  function removeLocationMarker(locationId) {
    if (locationMarkers.has(locationId)) {
      locationMarkers.get(locationId).remove();
      locationMarkers.delete(locationId);
    }
  }

  /**
   * Clear all location markers from the map.
   */
  function clearLocationMarkers() {
    locationMarkers.forEach((marker) => marker.remove());
    locationMarkers.clear();
  }

  /**
   * Display isochrone outlines for multiple locations.
   * Each location's isochrone is drawn with its marker color.
   * @param {Array<{colorIndex: number, geojson: Object}>} locationIsochrones
   */
  function showMultiIsochrones(locationIsochrones) {
    clearIsochrones();

    locationIsochrones.forEach(({ colorIndex, geojson }) => {
      const markerColor = LOCATION_COLORS[colorIndex % LOCATION_COLORS.length];
      const features = [...(geojson.features || [])].sort((a, b) => {
        return (b.properties?.value || 0) - (a.properties?.value || 0);
      });

      features.forEach((feature) => {
        L.geoJSON(feature, {
          style: {
            color: markerColor.color,
            fillColor: markerColor.fillColor,
            fillOpacity: 0.12,
            weight: 2,
            opacity: 0.6,
          },
        }).addTo(isochroneLayer);
      });
    });

    const bounds = isochroneLayer.getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [30, 30] });
    }
  }

  /**
   * Set a pending map click handler for setting a location.
   * @param {string|null} locationId - The location to set on next click, or null to cancel.
   * @param {function} [callback] - Called with (lat, lon, locationId).
   */
  function setPendingMapClickLocation(locationId, callback) {
    pendingMapClickLocationId = locationId;
    mapClickLocationCallback = callback || null;
    if (locationId) {
      map.getContainer().style.cursor = 'crosshair';
    } else {
      map.getContainer().style.cursor = '';
    }
  }

  /**
   * Get the pending map click location ID.
   * @returns {string|null}
   */
  function getPendingMapClickLocationId() {
    return pendingMapClickLocationId;
  }

  /**
   * Update a location marker's popup with nearby crime data.
   * @param {string} locationId
   * @param {number} lat
   * @param {number} lon
   * @param {Array} crimes - Raw crime records.
   */
  function updateLocationMarkerWithCrimes(locationId, lat, lon, crimes) {
    if (!locationMarkers.has(locationId)) return;
    const marker = locationMarkers.get(locationId);
    const RADIUS_M = 1000;

    const nearby = crimes
      .map((c) => ({ ...c, dist: haversineDistance(lat, lon, c.lat, c.lon) }))
      .filter((c) => c.dist <= RADIUS_M)
      .sort((a, b) => a.dist - b.dist);

    const baseLabel = marker._locationLabel || `${lat.toFixed(4)}, ${lon.toFixed(4)}`;

    if (nearby.length === 0) {
      marker.bindPopup(`${baseLabel}<br><em>No crimes recorded within 1km</em>`);
      return;
    }

    const categories = {};
    nearby.forEach((c) => {
      categories[c.category] = (categories[c.category] || 0) + 1;
    });
    const sortedCats = Object.entries(categories).sort((a, b) => b[1] - a[1]);
    const catsHtml = sortedCats
      .slice(0, 6)
      .map(([cat, n]) => `${escapeHtml(formatCrimeCategory(cat))}: ${n}`)
      .join('<br>');

    const nearest = nearby[0];
    const farthest = nearby[nearby.length - 1];

    marker.bindPopup(
      `${baseLabel}<br>` +
      `<strong>${nearby.length} crime${nearby.length !== 1 ? 's' : ''} within 1km</strong><br>` +
      `Nearest: ${Math.round(nearest.dist)}m &nbsp; Farthest: ${Math.round(farthest.dist)}m<br>` +
      `<br>${catsHtml}`
    );
  }

  return {
    map,
    setWorkLocation,
    getWorkLocation,
    showIsochrones,
    clearIsochrones,
    showCrimeOverlay,
    clearCrimeOverlay,
    showCrimeMapLegend,
    clearCrimeMapLegend,
    showLiveabilityOverlay,
    clearLiveabilityOverlay,
    showLiveabilityMapLegend,
    clearLiveabilityMapLegend,
    onMapClick,
    onMarkerDrag,
    getZoom,
    onZoomEnd,
    setLocationMarker,
    removeLocationMarker,
    clearLocationMarkers,
    showMultiIsochrones,
    setPendingMapClickLocation,
    getPendingMapClickLocationId,
    updateLocationMarkerWithCrimes,
  };
}
