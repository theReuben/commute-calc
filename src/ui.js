import { TIME_COLORS, ENV_GEOAPIFY_API_KEY, LOCATION_COLORS } from './config.js';

/**
 * Show a status message in the sidebar.
 * @param {string} message
 * @param {'info'|'error'|'success'} type
 */
export function showStatus(message, type = 'info') {
  const el = document.getElementById('status');
  if (!el) return;
  el.textContent = message;
  el.className = `status ${type}`;
  el.hidden = false;
}

/**
 * Hide the status message.
 */
export function hideStatus() {
  const el = document.getElementById('status');
  if (!el) return;
  el.hidden = true;
}

/**
 * Update the legend to show the selected time intervals.
 * @param {number[]} intervals - Active time intervals in minutes.
 */
export function updateLegend(intervals) {
  const legend = document.getElementById('legend');
  const items = document.getElementById('legend-items');
  if (!legend || !items) return;

  if (intervals.length === 0) {
    legend.hidden = true;
    return;
  }

  items.innerHTML = '';
  const sorted = [...intervals].sort((a, b) => a - b);

  sorted.forEach((minutes) => {
    const config = TIME_COLORS[minutes];
    if (!config) return;

    const item = document.createElement('div');
    item.className = 'legend-item';
    item.innerHTML = `
      <span class="legend-color" style="background: ${config.fillColor}"></span>
      <span>${config.label}</span>
    `;
    items.appendChild(item);
  });

  legend.hidden = false;
}

/**
 * Get the currently selected transport mode from the UI.
 * @returns {string} Transport profile string.
 */
export function getSelectedMode() {
  const active = document.querySelector('.mode-btn.active');
  return active ? active.dataset.mode : 'drive';
}

/**
 * Get the currently checked time intervals from the UI.
 * @returns {number[]} Array of time values in minutes.
 */
export function getSelectedIntervals() {
  const checkboxes = document.querySelectorAll('#time-intervals input[type="checkbox"]:checked');
  return Array.from(checkboxes).map((cb) => parseInt(cb.value, 10));
}

/**
 * Get the API key from the input field, falling back to the environment variable.
 * @returns {string}
 */
export function getApiKey() {
  const el = document.getElementById('api-key');
  const inputValue = el ? el.value.trim() : '';
  return inputValue || ENV_GEOAPIFY_API_KEY;
}

/**
 * Pre-populate the API key input from the environment variable if available.
 */
export function initApiKey() {
  if (!ENV_GEOAPIFY_API_KEY) return;
  const el = document.getElementById('api-key');
  if (el && !el.value) {
    el.value = ENV_GEOAPIFY_API_KEY;
  }
}

/**
 * Set up transport mode button click handlers.
 * @param {function} [onChange] - Optional callback when mode changes.
 */
export function setupModeButtons(onChange) {
  const buttons = document.querySelectorAll('.mode-btn');
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      buttons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      if (onChange) onChange(btn.dataset.mode);
    });
  });
}

/**
 * Show search results in the dropdown.
 * @param {Array<{displayName: string, lat: number, lon: number}>} results
 * @param {function} onSelect - Called with the selected result.
 */
export function showSearchResults(results, onSelect) {
  const container = document.getElementById('search-results');
  if (!container) return;

  if (results.length === 0) {
    container.innerHTML = '<div class="result-item">No results found</div>';
    container.hidden = false;
    return;
  }

  container.innerHTML = '';
  results.forEach((result) => {
    const item = document.createElement('div');
    item.className = 'result-item';
    item.textContent = result.displayName;
    item.addEventListener('click', () => {
      onSelect(result);
      container.hidden = true;
    });
    container.appendChild(item);
  });
  container.hidden = false;
}

/**
 * Hide search results dropdown.
 */
export function hideSearchResults() {
  const container = document.getElementById('search-results');
  if (container) container.hidden = true;
}

/**
 * Check if the crime overlay checkbox is enabled.
 * @returns {boolean}
 */
export function isCrimeOverlayEnabled() {
  return getOverlayMode() === 'crime' || getOverlayMode() === 'liveability';
}

/**
 * Get the currently selected overlay mode.
 * @returns {'none'|'crime'|'liveability'}
 */
export function getOverlayMode() {
  const active = document.querySelector('.overlay-mode-btn.active');
  return active ? active.dataset.overlay : 'liveability';
}

/**
 * Set up overlay mode button handlers.
 * @param {function} onChange - Callback with (mode: string).
 */
export function setupOverlayModeButtons(onChange) {
  const buttons = document.querySelectorAll('.overlay-mode-btn');
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      buttons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      if (onChange) onChange(btn.dataset.overlay);
    });
  });
}

/**
 * Set up crime overlay toggle change handler.
 * @param {function} onChange - Callback with (enabled: boolean).
 * @deprecated Use setupOverlayModeButtons instead.
 */
export function setupCrimeOverlayToggle(onChange) {
  // Kept for backwards compat; new code uses setupOverlayModeButtons
}

/**
 * Show the crime data status text.
 * @param {string} text
 */
export function showCrimeStatus(text) {
  const el = document.getElementById('crime-status');
  if (el) {
    el.textContent = text;
    el.hidden = false;
  }
}

/**
 * Hide the crime data status text.
 */
export function hideCrimeStatus() {
  const el = document.getElementById('crime-status');
  if (el) el.hidden = true;
}

/**
 * Show the crime legend with density levels.
 * @param {Object} colorMap - Maps density names to {fillColor, label}.
 */
export function showCrimeLegend(colorMap) {
  const container = document.getElementById('crime-legend-items');
  if (!container) return;

  container.innerHTML = '';
  ['low', 'medium', 'high', 'very-high'].forEach((level) => {
    const config = colorMap[level];
    if (!config) return;
    const item = document.createElement('div');
    item.className = 'legend-item';
    item.innerHTML = `
      <span class="legend-color" style="background: ${config.fillColor}"></span>
      <span>${config.label}</span>
    `;
    container.appendChild(item);
  });

  const legend = document.getElementById('crime-legend');
  if (legend) legend.hidden = false;
}

/**
 * Hide the crime legend.
 */
export function hideCrimeLegend() {
  const legend = document.getElementById('crime-legend');
  if (legend) legend.hidden = true;
}

/**
 * Show the liveability legend with level colors.
 * @param {Object} colorMap - Maps level names to {fillColor, label}.
 */
export function showLiveabilityLegend(colorMap) {
  const container = document.getElementById('liveability-legend-items');
  if (!container) return;

  container.innerHTML = '';
  ['excellent', 'good', 'fair', 'poor'].forEach((level) => {
    const config = colorMap[level];
    if (!config) return;
    const item = document.createElement('div');
    item.className = 'legend-item';
    item.innerHTML = `
      <span class="legend-color" style="background: ${config.fillColor}"></span>
      <span>${config.label}</span>
    `;
    container.appendChild(item);
  });

  const legend = document.getElementById('liveability-legend');
  if (legend) legend.hidden = false;
}

/**
 * Hide the liveability legend.
 */
export function hideLiveabilityLegend() {
  const legend = document.getElementById('liveability-legend');
  if (legend) legend.hidden = true;
}

/** Counter for unique location IDs */
let locationIdCounter = 0;

/**
 * Create a location card element for the locations list.
 * @param {Object} [options]
 * @param {string} [options.name] - Pre-filled name.
 * @param {function} onSearch - Called with (query, locationId).
 * @param {function} onRemove - Called with (locationId).
 * @param {function} onSetOnMap - Called with (locationId).
 * @returns {{element: HTMLElement, id: string}}
 */
export function createLocationCard({ onSearch, onRemove, onSetOnMap, name } = {}) {
  const id = `loc-${locationIdCounter++}`;
  const colorIndex = (locationIdCounter - 1) % LOCATION_COLORS.length;
  const markerColor = LOCATION_COLORS[colorIndex];

  const card = document.createElement('div');
  card.className = 'location-card';
  card.dataset.locationId = id;
  card.style.borderLeftColor = markerColor.color;

  card.innerHTML = `
    <div class="location-card-header">
      <input type="text" class="location-name" placeholder="Location name (e.g. Work, Airport)" value="${name || ''}" />
      <button class="remove-location-btn" type="button" title="Remove location" aria-label="Remove location">&times;</button>
    </div>
    <div class="location-search-row">
      <input type="text" class="location-search-input" placeholder="Search address..." autocomplete="off" />
      <button class="location-search-btn" type="button" aria-label="Search">&#x1F50D;</button>
    </div>
    <div class="location-search-results search-results" hidden></div>
    <button class="location-set-map-btn secondary-btn" type="button">Click map to set</button>
    <div class="location-settings-row">
      <select class="location-mode-select">
        <option value="drive">&#x1F697; Car</option>
        <option value="transit">&#x1F68C; Transit</option>
        <option value="bicycle">&#x1F6B2; Cycle</option>
        <option value="walk">&#x1F6B6; Walk</option>
      </select>
      <select class="location-time-select">
        <option value="10">10 min</option>
        <option value="20">20 min</option>
        <option value="30" selected>30 min</option>
        <option value="45">45 min</option>
        <option value="60">60 min</option>
      </select>
    </div>
    <div class="location-coords" hidden></div>
  `;

  // Search button
  const searchBtn = card.querySelector('.location-search-btn');
  const searchInput = card.querySelector('.location-search-input');
  const doSearch = () => {
    const query = searchInput.value.trim();
    if (query && onSearch) onSearch(query, id);
  };
  searchBtn.addEventListener('click', doSearch);
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); doSearch(); }
  });

  // Remove button
  card.querySelector('.remove-location-btn').addEventListener('click', () => {
    if (onRemove) onRemove(id);
  });

  // Set on map button
  card.querySelector('.location-set-map-btn').addEventListener('click', () => {
    if (onSetOnMap) onSetOnMap(id);
  });

  return { element: card, id, colorIndex };
}

/**
 * Show search results inside a location card.
 * @param {string} locationId
 * @param {Array<{displayName: string, lat: number, lon: number}>} results
 * @param {function} onSelect - Called with (result, locationId).
 */
export function showLocationSearchResults(locationId, results, onSelect) {
  const card = document.querySelector(`[data-location-id="${locationId}"]`);
  if (!card) return;
  const container = card.querySelector('.location-search-results');
  if (!container) return;

  if (results.length === 0) {
    container.innerHTML = '<div class="result-item">No results found</div>';
    container.hidden = false;
    return;
  }

  container.innerHTML = '';
  results.forEach((result) => {
    const item = document.createElement('div');
    item.className = 'result-item';
    item.textContent = result.displayName;
    item.addEventListener('click', () => {
      onSelect(result, locationId);
      container.hidden = true;
    });
    container.appendChild(item);
  });
  container.hidden = false;
}

/**
 * Update a location card to show set coordinates.
 * @param {string} locationId
 * @param {number} lat
 * @param {number} lon
 * @param {string} [label]
 */
export function setLocationCoords(locationId, lat, lon, label) {
  const card = document.querySelector(`[data-location-id="${locationId}"]`);
  if (!card) return;
  const coordsEl = card.querySelector('.location-coords');
  if (coordsEl) {
    coordsEl.textContent = label || `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
    coordsEl.hidden = false;
    coordsEl.dataset.lat = lat;
    coordsEl.dataset.lon = lon;
  }
  if (label) {
    const searchInput = card.querySelector('.location-search-input');
    if (searchInput) searchInput.value = label;
  }
  // Deactivate "click map" mode
  card.querySelector('.location-set-map-btn')?.classList.remove('active');
}

/**
 * Get all configured locations from the UI.
 * @returns {Array<{id: string, name: string, lat: number, lon: number, mode: string, maxMinutes: number, colorIndex: number}>}
 */
export function getAllLocations() {
  const cards = document.querySelectorAll('.location-card');
  const locations = [];
  cards.forEach((card, index) => {
    const coordsEl = card.querySelector('.location-coords');
    if (!coordsEl || coordsEl.hidden) return;
    const lat = parseFloat(coordsEl.dataset.lat);
    const lon = parseFloat(coordsEl.dataset.lon);
    if (isNaN(lat) || isNaN(lon)) return;

    const name = card.querySelector('.location-name')?.value || `Location ${index + 1}`;
    const mode = card.querySelector('.location-mode-select')?.value || 'drive';
    const maxMinutes = parseInt(card.querySelector('.location-time-select')?.value || '30', 10);
    const colorIndex = index % LOCATION_COLORS.length;

    locations.push({
      id: card.dataset.locationId,
      name,
      lat,
      lon,
      mode,
      maxMinutes,
      colorIndex,
    });
  });
  return locations;
}

/**
 * Remove a location card from the DOM.
 * @param {string} locationId
 */
export function removeLocationCard(locationId) {
  const card = document.querySelector(`[data-location-id="${locationId}"]`);
  if (card) card.remove();
}

/**
 * Update the legend to show per-location isochrone info.
 * @param {Array<{name: string, maxMinutes: number, colorIndex: number}>} locations
 */
export function updateMultiLocationLegend(locations) {
  const legend = document.getElementById('legend');
  const items = document.getElementById('legend-items');
  if (!legend || !items) return;

  if (locations.length === 0) {
    legend.hidden = true;
    return;
  }

  items.innerHTML = '';
  locations.forEach((loc) => {
    const markerColor = LOCATION_COLORS[loc.colorIndex];
    const item = document.createElement('div');
    item.className = 'legend-item';
    item.innerHTML = `
      <span class="legend-color" style="background: ${markerColor.fillColor}"></span>
      <span>${loc.name} (${loc.maxMinutes} min)</span>
    `;
    items.appendChild(item);
  });

  legend.hidden = false;
}
