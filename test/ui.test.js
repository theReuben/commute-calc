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
  getOverlayMode,
  setupOverlayModeButtons,
  setupCrimeOverlayToggle,
  showCrimeStatus,
  hideCrimeStatus,
  showCrimeLegend,
  hideCrimeLegend,
  showLiveabilityLegend,
  hideLiveabilityLegend,
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
      <div class="overlay-mode-selector" id="overlay-mode">
        <button class="overlay-mode-btn" data-overlay="none">Off</button>
        <button class="overlay-mode-btn" data-overlay="crime">Crime</button>
        <button class="overlay-mode-btn active" data-overlay="liveability">Liveability</button>
      </div>
      <div id="crime-status" class="crime-status" hidden></div>
      <div id="crime-legend" class="crime-legend" hidden>
        <div id="crime-legend-items"></div>
      </div>
      <div id="liveability-legend" class="crime-legend" hidden>
        <div id="liveability-legend-items"></div>
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

    it('returns empty string when input field is empty', () => {
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
    it('returns true when overlay mode is liveability (default)', () => {
      expect(isCrimeOverlayEnabled()).toBe(true);
    });

    it('returns true when overlay mode is crime', () => {
      const buttons = document.querySelectorAll('.overlay-mode-btn');
      buttons.forEach((b) => b.classList.remove('active'));
      document.querySelector('[data-overlay="crime"]').classList.add('active');
      expect(isCrimeOverlayEnabled()).toBe(true);
    });

    it('returns false when overlay mode is none', () => {
      const buttons = document.querySelectorAll('.overlay-mode-btn');
      buttons.forEach((b) => b.classList.remove('active'));
      document.querySelector('[data-overlay="none"]').classList.add('active');
      expect(isCrimeOverlayEnabled()).toBe(false);
    });
  });

  describe('getOverlayMode', () => {
    it('returns liveability by default', () => {
      expect(getOverlayMode()).toBe('liveability');
    });

    it('returns the active overlay mode', () => {
      const buttons = document.querySelectorAll('.overlay-mode-btn');
      buttons.forEach((b) => b.classList.remove('active'));
      document.querySelector('[data-overlay="crime"]').classList.add('active');
      expect(getOverlayMode()).toBe('crime');
    });
  });

  describe('setupOverlayModeButtons', () => {
    it('calls onChange with the selected mode when clicked', () => {
      const onChange = vi.fn();
      setupOverlayModeButtons(onChange);
      document.querySelector('[data-overlay="crime"]').click();
      expect(onChange).toHaveBeenCalledWith('crime');
    });

    it('switches active class to clicked button', () => {
      setupOverlayModeButtons(vi.fn());
      document.querySelector('[data-overlay="none"]').click();
      expect(document.querySelector('[data-overlay="none"]').classList.contains('active')).toBe(true);
      expect(document.querySelector('[data-overlay="liveability"]').classList.contains('active')).toBe(false);
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
    it('shows the crime legend with a gradient bar', () => {
      showCrimeLegend();
      const legend = document.getElementById('crime-legend');
      expect(legend.hidden).toBe(false);
      // New design uses a gradient bar; confirm Safe and High labels appear
      expect(legend.textContent).toContain('Safe');
      expect(legend.textContent).toContain('High crime');
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
