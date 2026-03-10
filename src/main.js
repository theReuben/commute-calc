import { createMap } from './map.js';
import { geocodeAddress } from './geocode.js';
import { fetchIsochrones } from './isochrone.js';
import { getPropertySearchLinks } from './properties.js';
import { fetchPropertyMarkers } from './propertyData.js';
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
  showPropertyLinks,
  hidePropertyLinks,
  getSelectedListingType,
  setupPropertyTypeToggle,
  isPropertyOverlayEnabled,
  setupPropertyOverlayToggle,
  showPropertyMarkerStatus,
  hidePropertyMarkerStatus,
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
  let lastSearchLocation = '';
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

      // Show property search links if a location name is available
      lastSearchLocation = searchInput.value.trim();
      if (lastSearchLocation) {
        const listingType = getSelectedListingType();
        const links = getPropertySearchLinks(lastSearchLocation, listingType);
        showPropertyLinks(links);
      } else {
        hidePropertyLinks();
      }

      // Fetch and display property markers on the map
      if (isPropertyOverlayEnabled()) {
        await loadPropertyMarkers(apiKey, geojson);
      }

      showStatus('Commute areas calculated successfully!', 'success');
    } catch (err) {
      showStatus(`Error: ${err.message}`, 'error');
    } finally {
      calculateBtn.disabled = false;
    }
  });

  /**
   * Load property markers onto the map from Geoapify Places API.
   * @param {string} apiKey
   * @param {Object} geojson - Isochrone GeoJSON FeatureCollection.
   */
  async function loadPropertyMarkers(apiKey, geojson) {
    try {
      showPropertyMarkerStatus('Loading property data...');
      const markers = await fetchPropertyMarkers({ apiKey, geojson });
      mapInstance.showPropertyMarkers(markers);
      if (markers.length > 0) {
        showPropertyMarkerStatus(`${markers.length} estate agent${markers.length !== 1 ? 's' : ''} found in commute area`);
      } else {
        showPropertyMarkerStatus('No estate agents found in this area');
      }
    } catch (err) {
      showPropertyMarkerStatus('Could not load property data');
    }
  }

  // Property overlay toggle
  setupPropertyOverlayToggle((enabled) => {
    if (enabled && lastGeojson) {
      const apiKey = getApiKey();
      if (apiKey) {
        loadPropertyMarkers(apiKey, lastGeojson);
      }
    } else {
      mapInstance.clearPropertyMarkers();
      hidePropertyMarkerStatus();
    }
  });

  // Property listing type toggle (buy/rent)
  setupPropertyTypeToggle(() => {
    if (lastSearchLocation) {
      const listingType = getSelectedListingType();
      const links = getPropertySearchLinks(lastSearchLocation, listingType);
      showPropertyLinks(links);
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
