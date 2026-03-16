import { createMap } from './map.js';
import { geocodeAddress } from './geocode.js';
import { fetchIsochrones } from './isochrone.js';
import { fetchCrimeData, aggregateCrimes, classifyCrimeDensity, getGridPrecision, CRIME_COLORS } from './crimeData.js';
import { buildLiveabilityGrid, buildMultiLocationGrid, classifyLiveability } from './liveability.js';
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
  createLocationCard,
  showLocationSearchResults,
  setLocationCoords,
  getAllLocations,
  removeLocationCard,
  updateMultiLocationLegend,
} from './ui.js';

/**
 * Initialize the commute calculator application.
 */
export function initApp() {
  const mapInstance = createMap('map');

  // Pre-populate API key from environment variable if available
  initApiKey();

  // Set up transport mode switching (kept for backward compat, not used in multi-location)
  setupModeButtons();

  // Track which location is being set via map click
  let activeMapClickLocationId = null;

  // Handle map click - either set location for active card or legacy behavior
  mapInstance.onMapClick((lat, lon) => {
    if (activeMapClickLocationId) {
      const locationId = activeMapClickLocationId;
      activeMapClickLocationId = null;
      mapInstance.setPendingMapClickLocation(null);

      // Find the card's color index
      const cards = document.querySelectorAll('.location-card');
      let colorIndex = 0;
      cards.forEach((card, idx) => {
        if (card.dataset.locationId === locationId) colorIndex = idx;
      });

      mapInstance.setLocationMarker(locationId, lat, lon, colorIndex);
      setLocationCoords(locationId, lat, lon);
      hideStatus();
    }
  });

  // Location card management
  const locationsList = document.getElementById('locations-list');
  const addLocationBtn = document.getElementById('add-location-btn');

  function addLocation(name) {
    const { element, id } = createLocationCard({
      name,
      onSearch: async (query, locationId) => {
        showStatus('Searching...', 'info');
        try {
          const results = await geocodeAddress(query);
          hideStatus();
          showLocationSearchResults(locationId, results, (result, locId) => {
            const cards = document.querySelectorAll('.location-card');
            let colorIndex = 0;
            cards.forEach((card, idx) => {
              if (card.dataset.locationId === locId) colorIndex = idx;
            });
            mapInstance.setLocationMarker(locId, result.lat, result.lon, colorIndex, result.displayName);
            setLocationCoords(locId, result.lat, result.lon, result.displayName);
          });
        } catch (err) {
          showStatus(`Search error: ${err.message}`, 'error');
        }
      },
      onRemove: (locationId) => {
        mapInstance.removeLocationMarker(locationId);
        removeLocationCard(locationId);
        if (activeMapClickLocationId === locationId) {
          activeMapClickLocationId = null;
          mapInstance.setPendingMapClickLocation(null);
        }
      },
      onSetOnMap: (locationId) => {
        // Toggle map click mode for this location
        if (activeMapClickLocationId === locationId) {
          activeMapClickLocationId = null;
          mapInstance.setPendingMapClickLocation(null);
          showStatus('', 'info');
          hideStatus();
        } else {
          activeMapClickLocationId = locationId;
          mapInstance.setPendingMapClickLocation(locationId);
          showStatus('Click on the map to set this location', 'info');
        }
        // Update button active states
        document.querySelectorAll('.location-set-map-btn').forEach((btn) => {
          const card = btn.closest('.location-card');
          btn.classList.toggle('active', card?.dataset.locationId === activeMapClickLocationId);
        });
      },
    });

    locationsList.appendChild(element);
    return id;
  }

  addLocationBtn.addEventListener('click', () => addLocation(''));

  // Add initial default location
  addLocation('Work');

  // Calculate button
  const calculateBtn = document.getElementById('calculate-btn');
  let lastLocationData = null;
  let lastRawCrimes = null;

  calculateBtn.addEventListener('click', async () => {
    const locations = getAllLocations();
    if (locations.length === 0) {
      showStatus('Please add at least one location with coordinates set.', 'error');
      return;
    }

    const apiKey = getApiKey();
    if (!apiKey) {
      showStatus('Please enter your Geoapify API key.', 'error');
      return;
    }

    calculateBtn.disabled = true;
    showStatus('Calculating commute areas for all locations...', 'info');

    try {
      // Fetch isochrones for each location in parallel
      const isochronePromises = locations.map((loc) =>
        fetchIsochrones({
          apiKey,
          lat: loc.lat,
          lon: loc.lon,
          profile: loc.mode,
          intervals: [loc.maxMinutes],
        }).then((geojson) => ({
          locationId: loc.id,
          name: loc.name,
          colorIndex: loc.colorIndex,
          geojson,
        }))
      );

      const locationResults = await Promise.all(isochronePromises);

      // Show all isochrones on map
      mapInstance.showMultiIsochrones(locationResults);

      // Update legend
      updateMultiLocationLegend(locations);

      // Store for crime/liveability overlay
      lastLocationData = locationResults;

      // Fetch crime data overlay if enabled
      if (isCrimeOverlayEnabled()) {
        // Combine all isochrone features for crime data fetching
        const combinedGeojson = {
          type: 'FeatureCollection',
          features: locationResults.flatMap((r) => r.geojson.features || []),
        };
        await loadCrimeOverlay(combinedGeojson);
      }

      if (locations.length === 1) {
        showStatus('Commute area calculated!', 'success');
      } else {
        showStatus(`Optimal areas calculated for ${locations.length} locations!`, 'success');
      }
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
   * Render the liveability heatmap using multi-location data.
   */
  function renderLiveabilityOverlay() {
    if (!lastLocationData || !lastRawCrimes) return;

    const zoom = mapInstance.getZoom();
    const precision = zoom <= 10 ? 1 : zoom <= 12 ? 2 : 3;

    let grid;
    if (lastLocationData.length === 1) {
      // Single location: use original algorithm
      grid = buildLiveabilityGrid({
        geojson: lastLocationData[0].geojson,
        crimes: lastRawCrimes,
        precision,
      });
    } else {
      // Multiple locations: use multi-location algorithm
      grid = buildMultiLocationGrid({
        locationData: lastLocationData,
        crimes: lastRawCrimes,
        precision,
      });
    }

    const cellSize = 1 / Math.pow(10, precision);
    const gridWithLevels = grid.map((cell) => ({
      ...cell,
      level: classifyLiveability(cell.score),
    }));

    mapInstance.showLiveabilityOverlay(gridWithLevels, LIVEABILITY_COLORS, cellSize);
  }

  /**
   * Load crime data and display the appropriate overlay on the map.
   * @param {Object} geojson - Combined isochrone GeoJSON FeatureCollection.
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
        showCrimeStatus(`${crimes.length} crime${crimes.length !== 1 ? 's' : ''} reported in area`);
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
      } else if (mode === 'liveability' && lastLocationData) {
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

    if (lastLocationData && lastRawCrimes) {
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
    } else if (lastLocationData) {
      const combinedGeojson = {
        type: 'FeatureCollection',
        features: lastLocationData.flatMap((r) => r.geojson.features || []),
      };
      loadCrimeOverlay(combinedGeojson);
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
