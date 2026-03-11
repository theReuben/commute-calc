import { createMap } from './map.js';
import { geocodeAddress } from './geocode.js';
import { fetchIsochrones } from './isochrone.js';
import { fetchCrimeData, aggregateCrimes, classifyCrimeDensity, CRIME_COLORS } from './crimeData.js';
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
  setupCrimeOverlayToggle,
  showCrimeStatus,
  hideCrimeStatus,
  showCrimeLegend,
  hideCrimeLegend,
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
   * Load crime data and display the overlay on the map.
   * @param {Object} geojson - Isochrone GeoJSON FeatureCollection.
   */
  async function loadCrimeOverlay(geojson) {
    try {
      showCrimeStatus('Loading crime data...');
      const crimes = await fetchCrimeData({ geojson });
      const grid = aggregateCrimes(crimes);
      const maxCount = grid.reduce((max, cell) => Math.max(max, cell.count), 0);

      const gridWithDensity = grid.map((cell) => ({
        ...cell,
        density: classifyCrimeDensity(cell.count, maxCount),
      }));

      mapInstance.showCrimeOverlay(gridWithDensity, CRIME_COLORS);

      if (crimes.length > 0) {
        showCrimeLegend(CRIME_COLORS);
        mapInstance.showCrimeMapLegend(CRIME_COLORS);
        showCrimeStatus(`${crimes.length} crime${crimes.length !== 1 ? 's' : ''} reported in commute area`);
      } else {
        hideCrimeLegend();
        mapInstance.clearCrimeMapLegend();
        showCrimeStatus('No recent crime data available for this area');
      }
    } catch (err) {
      showCrimeStatus(`Crime data: ${err.message}`);
    }
  }

  // Crime overlay toggle
  setupCrimeOverlayToggle((enabled) => {
    if (enabled && lastGeojson) {
      loadCrimeOverlay(lastGeojson);
    } else {
      mapInstance.clearCrimeOverlay();
      mapInstance.clearCrimeMapLegend();
      hideCrimeStatus();
      hideCrimeLegend();
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
