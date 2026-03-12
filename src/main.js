import { createMap } from './map.js';
import { geocodeAddress } from './geocode.js';
import { fetchIsochrones } from './isochrone.js';
import { fetchCrimeData, aggregateCrimes, classifyCrimeDensity, getGridPrecision, CRIME_COLORS } from './crimeData.js';
import { buildLiveabilityGrid, classifyLiveability } from './liveability.js';
import { LIVEABILITY_COLORS } from './config.js';
import {
  showStatus,
  hideStatus,
  updateLegend,
  getSelectedMode,
  getSelectedIntervals,
  getApiKey,
  initApiKey,
  setupModeButtons,
  showSearchResults,
  hideSearchResults,
  isCrimeOverlayEnabled,
  getOverlayMode,
  setupOverlayModeButtons,
  showCrimeStatus,
  hideCrimeStatus,
  showCrimeLegend,
  hideCrimeLegend,
  showLiveabilityLegend,
  hideLiveabilityLegend,
} from './ui.js';

/**
 * Initialize the commute calculator application.
 */
export function initApp() {
  const mapInstance = createMap('map');

  // Pre-populate API key from environment variable if available
  initApiKey();

  // Set up transport mode switching
  setupModeButtons();

  // Handle marker drag to update work location
  mapInstance.onMarkerDrag((lat, lon) => {
    mapInstance.setWorkLocation(lat, lon);
  });

  // Map click to set work location
  mapInstance.onMapClick((lat, lon) => {
    mapInstance.setWorkLocation(lat, lon);
    hideStatus();
  });

  // Search functionality
  const searchInput = document.getElementById('location-search');
  const searchBtn = document.getElementById('search-btn');

  async function performSearch() {
    const query = searchInput.value;
    if (!query.trim()) return;

    showStatus('Searching...', 'info');
    try {
      const results = await geocodeAddress(query);
      hideStatus();
      showSearchResults(results, (result) => {
        mapInstance.setWorkLocation(result.lat, result.lon, result.displayName);
        searchInput.value = result.displayName;
      });
    } catch (err) {
      showStatus(`Search error: ${err.message}`, 'error');
    }
  }

  searchBtn.addEventListener('click', performSearch);
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      performSearch();
    }
  });

  // Close search results when clicking outside
  document.addEventListener('click', (e) => {
    const resultsEl = document.getElementById('search-results');
    if (resultsEl && !resultsEl.contains(e.target) && e.target !== searchInput && e.target !== searchBtn) {
      hideSearchResults();
    }
  });

  // Calculate button
  const calculateBtn = document.getElementById('calculate-btn');
  let lastGeojson = null;
  let lastRawCrimes = null;

  calculateBtn.addEventListener('click', async () => {
    const location = mapInstance.getWorkLocation();
    if (!location) {
      showStatus('Please set a work location first (click on the map or search).', 'error');
      return;
    }

    const apiKey = getApiKey();
    if (!apiKey) {
      showStatus('Please enter your Geoapify API key.', 'error');
      return;
    }

    const intervals = getSelectedIntervals();
    if (intervals.length === 0) {
      showStatus('Please select at least one time interval.', 'error');
      return;
    }

    const profile = getSelectedMode();

    calculateBtn.disabled = true;
    showStatus('Calculating commute areas...', 'info');

    try {
      const geojson = await fetchIsochrones({
        apiKey,
        lat: location.lat,
        lon: location.lon,
        profile,
        intervals,
      });

      mapInstance.showIsochrones(geojson);
      updateLegend(intervals);
      lastGeojson = geojson;

      // Fetch crime data overlay if enabled
      if (isCrimeOverlayEnabled()) {
        await loadCrimeOverlay(geojson);
      }

      showStatus('Commute areas calculated successfully!', 'success');
    } catch (err) {
      showStatus(`Error: ${err.message}`, 'error');
    } finally {
      calculateBtn.disabled = false;
    }
  });

  /**
   * Render the crime overlay from already-fetched raw crimes using the current zoom level.
   * @param {Array} crimes - Raw crime records.
   */
  function renderCrimeOverlay(crimes) {
    const precision = getGridPrecision(mapInstance.getZoom());
    const grid = aggregateCrimes(crimes, precision);
    const maxCount = grid.reduce((max, cell) => Math.max(max, cell.count), 0);

    const gridWithDensity = grid.map((cell) => ({
      ...cell,
      density: classifyCrimeDensity(cell.count, maxCount),
    }));

    mapInstance.showCrimeOverlay(gridWithDensity, CRIME_COLORS);
  }

  /**
   * Render the liveability heatmap from isochrone GeoJSON and raw crimes.
   */
  function renderLiveabilityOverlay() {
    if (!lastGeojson || !lastRawCrimes) return;

    const zoom = mapInstance.getZoom();
    const precision = zoom <= 10 ? 1 : zoom <= 12 ? 2 : 3;
    const grid = buildLiveabilityGrid({
      geojson: lastGeojson,
      crimes: lastRawCrimes,
      precision,
    });

    const cellSize = 1 / Math.pow(10, precision);
    const gridWithLevels = grid.map((cell) => ({
      ...cell,
      level: classifyLiveability(cell.score),
    }));

    mapInstance.showLiveabilityOverlay(gridWithLevels, LIVEABILITY_COLORS, cellSize);
  }

  /**
   * Load crime data and display the appropriate overlay on the map.
   * @param {Object} geojson - Isochrone GeoJSON FeatureCollection.
   */
  async function loadCrimeOverlay(geojson) {
    try {
      showCrimeStatus('Loading crime data...');
      const crimes = await fetchCrimeData({ geojson });
      lastRawCrimes = crimes;

      const mode = getOverlayMode();
      if (mode === 'crime') {
        renderCrimeOverlay(crimes);
        if (crimes.length > 0) {
          showCrimeLegend(CRIME_COLORS);
          mapInstance.showCrimeMapLegend(CRIME_COLORS);
        }
      } else if (mode === 'liveability') {
        renderLiveabilityOverlay();
        showLiveabilityLegend(LIVEABILITY_COLORS);
        mapInstance.showLiveabilityMapLegend(LIVEABILITY_COLORS);
      }

      if (crimes.length > 0) {
        showCrimeStatus(`${crimes.length} crime${crimes.length !== 1 ? 's' : ''} reported in commute area`);
      } else {
        showCrimeStatus('No recent crime data available for this area');
      }
    } catch (err) {
      showCrimeStatus(`Crime data: ${err.message}`);
    }
  }

  /**
   * Clear all overlay layers and legends.
   */
  function clearAllOverlays() {
    lastRawCrimes = null;
    mapInstance.clearCrimeOverlay();
    mapInstance.clearCrimeMapLegend();
    mapInstance.clearLiveabilityOverlay();
    mapInstance.clearLiveabilityMapLegend();
    hideCrimeStatus();
    hideCrimeLegend();
    hideLiveabilityLegend();
  }

  // Re-aggregate overlays when zoom level changes
  mapInstance.onZoomEnd(() => {
    const mode = getOverlayMode();
    if (lastRawCrimes && lastRawCrimes.length > 0) {
      if (mode === 'crime') {
        renderCrimeOverlay(lastRawCrimes);
      } else if (mode === 'liveability' && lastGeojson) {
        renderLiveabilityOverlay();
      }
    }
  });

  // Overlay mode selector
  setupOverlayModeButtons((mode) => {
    // Clear existing overlays first
    mapInstance.clearCrimeOverlay();
    mapInstance.clearCrimeMapLegend();
    mapInstance.clearLiveabilityOverlay();
    mapInstance.clearLiveabilityMapLegend();
    hideCrimeLegend();
    hideLiveabilityLegend();

    if (mode === 'none') {
      hideCrimeStatus();
      return;
    }

    if (lastGeojson && lastRawCrimes) {
      // Re-render with existing data
      if (mode === 'crime') {
        renderCrimeOverlay(lastRawCrimes);
        showCrimeLegend(CRIME_COLORS);
        mapInstance.showCrimeMapLegend(CRIME_COLORS);
      } else if (mode === 'liveability') {
        renderLiveabilityOverlay();
        showLiveabilityLegend(LIVEABILITY_COLORS);
        mapInstance.showLiveabilityMapLegend(LIVEABILITY_COLORS);
      }
    } else if (lastGeojson) {
      loadCrimeOverlay(lastGeojson);
    }
  });
}

// Auto-initialize when the DOM is ready
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
}
