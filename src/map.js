import L from 'leaflet';
import { DEFAULT_CENTER, DEFAULT_ZOOM, TIME_COLORS } from './config.js';
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
  let isochroneLayer = L.layerGroup().addTo(map);
  let crimeLayer = L.layerGroup().addTo(map);
  let markerDragCallback = null;

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
   * Display crime density markers on the map.
   * @param {Array<{lat: number, lon: number, count: number, density: string, categories: Object}>} gridCells
   * @param {Object} colorMap - Maps density levels to {fillColor, color}.
   */
  function showCrimeOverlay(gridCells, colorMap) {
    clearCrimeOverlay();

    gridCells.forEach((cell) => {
      const colors = colorMap[cell.density] || { fillColor: '#adb5bd', color: '#495057' };
      const radius = Math.min(4 + Math.log2(cell.count + 1) * 3, 16);

      const marker = L.circleMarker([cell.lat, cell.lon], {
        radius,
        fillColor: colors.fillColor,
        color: colors.color,
        weight: 1.5,
        opacity: 0.8,
        fillOpacity: 0.55,
      }).addTo(crimeLayer);

      // Build popup content
      const topCategories = Object.entries(cell.categories)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([cat, n]) => `${escapeHtml(formatCrimeCategory(cat))}: ${n}`)
        .join('<br>');

      marker.bindPopup(
        `<strong>${cell.count} crime${cell.count !== 1 ? 's' : ''}</strong><br>${topCategories}`
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
   * Format a crime category slug into a readable label.
   * @param {string} category
   * @returns {string}
   */
  function formatCrimeCategory(category) {
    return category
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  return {
    map,
    setWorkLocation,
    getWorkLocation,
    showIsochrones,
    clearIsochrones,
    showCrimeOverlay,
    clearCrimeOverlay,
    onMapClick,
    onMarkerDrag,
  };
}
