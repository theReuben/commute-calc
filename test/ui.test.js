import { describe, it, expect, beforeEach } from 'vitest';
import {
  showStatus,
  hideStatus,
  updateLegend,
  getSelectedMode,
  getSelectedIntervals,
  getApiKey,
  showSearchResults,
  hideSearchResults,
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

    it('returns empty string for empty input', () => {
      expect(getApiKey()).toBe('');
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
});
