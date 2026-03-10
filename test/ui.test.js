import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  showStatus,
  hideStatus,
  updateLegend,
  getSelectedMode,
  getSelectedIntervals,
  getApiKey,
  initApiKey,
  showSearchResults,
  hideSearchResults,
  setupModeButtons,
  isCrimeOverlayEnabled,
  setupCrimeOverlayToggle,
  showCrimeStatus,
  hideCrimeStatus,
  showCrimeLegend,
  hideCrimeLegend,
} from '../src/ui.js';

function setupDOM() {
  document.body.innerHTML = `
    <div id="status" class="status" hidden></div>
    <div id="legend" hidden>
      <div id="legend-items"></div>
    </div>
    <div class="transport-modes" id="transport-mode">
      <button class="mode-btn active" data-mode="drive">Car</button>
      <button class="mode-btn" data-mode="bicycle">Cycle</button>
    </div>
    <div id="time-intervals">
      <label><input type="checkbox" value="10" checked /> 10 min</label>
      <label><input type="checkbox" value="20" checked /> 20 min</label>
      <label><input type="checkbox" value="30" /> 30 min</label>
    </div>
    <input type="text" id="api-key" value="" />
    <div id="search-results" hidden></div>
    <div id="crime-section" class="crime-section">
      <label class="checkbox-label crime-overlay-toggle">
        <input type="checkbox" id="crime-overlay" checked />
        Show crime data on map
      </label>
      <div id="crime-status" class="crime-status" hidden></div>
      <div id="crime-legend" class="crime-legend" hidden>
        <div id="crime-legend-items"></div>
      </div>
    </div>
  `;
}

describe('ui', () => {
  beforeEach(() => {
    setupDOM();
  });

  describe('showStatus', () => {
    it('displays a message with the correct type', () => {
      showStatus('Loading...', 'info');
      const el = document.getElementById('status');
      expect(el.textContent).toBe('Loading...');
      expect(el.className).toContain('info');
      expect(el.hidden).toBe(false);
    });

    it('shows error type', () => {
      showStatus('Something went wrong', 'error');
      const el = document.getElementById('status');
      expect(el.className).toContain('error');
    });
  });

  describe('hideStatus', () => {
    it('hides the status element', () => {
      showStatus('test', 'info');
      hideStatus();
      expect(document.getElementById('status').hidden).toBe(true);
    });
  });

  describe('updateLegend', () => {
    it('shows legend items for given intervals', () => {
      updateLegend([10, 30]);
      const legend = document.getElementById('legend');
      expect(legend.hidden).toBe(false);
      const items = document.querySelectorAll('.legend-item');
      expect(items.length).toBe(2);
    });

    it('hides legend when intervals are empty', () => {
      updateLegend([]);
      expect(document.getElementById('legend').hidden).toBe(true);
    });
  });

  describe('getSelectedMode', () => {
    it('returns the active mode', () => {
      expect(getSelectedMode()).toBe('drive');
    });

    it('returns drive as default when no active button', () => {
      document.querySelectorAll('.mode-btn').forEach((b) => b.classList.remove('active'));
      expect(getSelectedMode()).toBe('drive');
    });
  });

  describe('getSelectedIntervals', () => {
    it('returns checked interval values', () => {
      const intervals = getSelectedIntervals();
      expect(intervals).toEqual([10, 20]);
    });
  });

  describe('getApiKey', () => {
    it('returns trimmed API key', () => {
      document.getElementById('api-key').value = '  my-key  ';
      expect(getApiKey()).toBe('my-key');
    });

    it('returns empty string for empty input when no env var', () => {
      expect(getApiKey()).toBe('');
    });
  });

  describe('initApiKey', () => {
    it('does not throw when called', () => {
      expect(() => initApiKey()).not.toThrow();
    });
  });

  describe('showSearchResults', () => {
    it('displays results in the container', () => {
      const results = [
        { displayName: 'London, UK', lat: 51.5, lon: -0.1 },
        { displayName: 'London, ON, Canada', lat: 42.9, lon: -81.2 },
      ];

      showSearchResults(results, () => {});
      const container = document.getElementById('search-results');
      expect(container.hidden).toBe(false);
      expect(container.querySelectorAll('.result-item').length).toBe(2);
    });

    it('shows no results message for empty array', () => {
      showSearchResults([], () => {});
      const container = document.getElementById('search-results');
      expect(container.hidden).toBe(false);
      expect(container.textContent).toContain('No results found');
    });
  });

  describe('hideSearchResults', () => {
    it('hides the search results container', () => {
      showSearchResults([{ displayName: 'Test', lat: 0, lon: 0 }], () => {});
      hideSearchResults();
      expect(document.getElementById('search-results').hidden).toBe(true);
    });
  });

  describe('setupModeButtons', () => {
    it('adds active class to clicked button and removes from others', () => {
      setupModeButtons();
      const buttons = document.querySelectorAll('.mode-btn');
      // Initially first button is active
      expect(buttons[0].classList.contains('active')).toBe(true);
      expect(buttons[1].classList.contains('active')).toBe(false);

      // Click second button
      buttons[1].click();
      expect(buttons[0].classList.contains('active')).toBe(false);
      expect(buttons[1].classList.contains('active')).toBe(true);
    });

    it('calls onChange callback with the selected mode', () => {
      const onChange = vi.fn();
      setupModeButtons(onChange);
      const buttons = document.querySelectorAll('.mode-btn');

      buttons[1].click();
      expect(onChange).toHaveBeenCalledWith('bicycle');
    });

    it('does not throw when onChange is not provided', () => {
      setupModeButtons();
      const buttons = document.querySelectorAll('.mode-btn');
      expect(() => buttons[1].click()).not.toThrow();
    });
  });

  describe('isCrimeOverlayEnabled', () => {
    it('returns true when checkbox is checked', () => {
      expect(isCrimeOverlayEnabled()).toBe(true);
    });

    it('returns false when checkbox is unchecked', () => {
      document.getElementById('crime-overlay').checked = false;
      expect(isCrimeOverlayEnabled()).toBe(false);
    });
  });

  describe('setupCrimeOverlayToggle', () => {
    it('calls onChange with checked state when toggled', () => {
      const onChange = vi.fn();
      setupCrimeOverlayToggle(onChange);
      const checkbox = document.getElementById('crime-overlay');
      checkbox.checked = false;
      checkbox.dispatchEvent(new Event('change'));
      expect(onChange).toHaveBeenCalledWith(false);
    });
  });

  describe('showCrimeStatus', () => {
    it('displays text in the status element', () => {
      showCrimeStatus('42 crimes reported');
      const el = document.getElementById('crime-status');
      expect(el.textContent).toBe('42 crimes reported');
      expect(el.hidden).toBe(false);
    });
  });

  describe('hideCrimeStatus', () => {
    it('hides the status element', () => {
      showCrimeStatus('test');
      hideCrimeStatus();
      expect(document.getElementById('crime-status').hidden).toBe(true);
    });
  });

  describe('showCrimeLegend', () => {
    it('displays legend items for each density level', () => {
      const colorMap = {
        low: { fillColor: '#2b8a3e', label: 'Low crime' },
        medium: { fillColor: '#f59f00', label: 'Medium crime' },
        high: { fillColor: '#e03131', label: 'High crime' },
        'very-high': { fillColor: '#7b2d8e', label: 'Very high crime' },
      };
      showCrimeLegend(colorMap);
      const legend = document.getElementById('crime-legend');
      expect(legend.hidden).toBe(false);
      const items = legend.querySelectorAll('.legend-item');
      expect(items.length).toBe(4);
    });
  });

  describe('hideCrimeLegend', () => {
    it('hides the crime legend', () => {
      showCrimeLegend({ low: { fillColor: '#2b8a3e', label: 'Low' } });
      hideCrimeLegend();
      expect(document.getElementById('crime-legend').hidden).toBe(true);
    });
  });
});
