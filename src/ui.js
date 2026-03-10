import { TIME_COLORS, ENV_GEOAPIFY_API_KEY } from './config.js';

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
 * Show property search links in the sidebar.
 * @param {Array<{name: string, emoji: string, url: string}>} links
 */
export function showPropertyLinks(links) {
  const container = document.getElementById('property-links');
  if (!container) return;

  if (links.length === 0) {
    container.hidden = true;
    return;
  }

  const linksEl = container.querySelector('.property-links-list');
  if (!linksEl) return;

  linksEl.innerHTML = '';
  links.forEach((link) => {
    const a = document.createElement('a');
    a.href = link.url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.className = 'property-link';
    a.textContent = `${link.emoji} ${link.name}`;
    linksEl.appendChild(a);
  });

  container.hidden = false;
}

/**
 * Hide the property links section.
 */
export function hidePropertyLinks() {
  const container = document.getElementById('property-links');
  if (container) container.hidden = true;
}

/**
 * Get the currently selected property listing type (buy or rent).
 * @returns {'buy'|'rent'}
 */
export function getSelectedListingType() {
  const active = document.querySelector('.property-type-btn.active');
  return active ? active.dataset.listing : 'buy';
}

/**
 * Set up property listing type toggle (buy/rent) button handlers.
 * @param {function} [onChange] - Optional callback when listing type changes.
 */
export function setupPropertyTypeToggle(onChange) {
  const buttons = document.querySelectorAll('.property-type-btn');
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      buttons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      if (onChange) onChange(btn.dataset.listing);
    });
  });
}
