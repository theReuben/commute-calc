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
  showPropertyLinks,
  hidePropertyLinks,
  getSelectedListingType,
  setupPropertyTypeToggle,
  isPropertyOverlayEnabled,
  setupPropertyOverlayToggle,
  showPropertyMarkerStatus,
  hidePropertyMarkerStatus,
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
    <div id="property-links" class="property-section" hidden>
      <div class="property-type-toggle">
        <button class="property-type-btn active" data-listing="buy">Buy</button>
        <button class="property-type-btn" data-listing="rent">Rent</button>
      </div>
      <label class="checkbox-label property-overlay-toggle">
        <input type="checkbox" id="property-overlay" checked />
        Show estate agents on map
      </label>
      <div id="property-marker-status" class="property-marker-status"></div>
      <div class="property-links-list"></div>
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

  describe('initApiKey', () => {
    it('does not throw when env var is empty', () => {
      expect(() => initApiKey()).not.toThrow();
    });

    it('does not overwrite existing input value', () => {
      document.getElementById('api-key').value = 'user-key';
      initApiKey();
      expect(document.getElementById('api-key').value).toBe('user-key');
    });
  });

  describe('showPropertyLinks', () => {
    it('displays property links in the container', () => {
      const links = [
        { name: 'Rightmove', emoji: '🏠', url: 'https://rightmove.co.uk/test' },
        { name: 'Zoopla', emoji: '🔍', url: 'https://zoopla.co.uk/test' },
      ];
      showPropertyLinks(links);
      const container = document.getElementById('property-links');
      expect(container.hidden).toBe(false);
      const linkEls = container.querySelectorAll('.property-link');
      expect(linkEls.length).toBe(2);
      expect(linkEls[0].href).toContain('rightmove.co.uk');
      expect(linkEls[0].target).toBe('_blank');
      expect(linkEls[0].rel).toContain('noopener');
    });

    it('hides container when links array is empty', () => {
      showPropertyLinks([]);
      expect(document.getElementById('property-links').hidden).toBe(true);
    });
  });

  describe('hidePropertyLinks', () => {
    it('hides the property links container', () => {
      showPropertyLinks([{ name: 'Test', emoji: '🏠', url: 'https://test.com' }]);
      hidePropertyLinks();
      expect(document.getElementById('property-links').hidden).toBe(true);
    });
  });

  describe('getSelectedListingType', () => {
    it('returns buy by default', () => {
      expect(getSelectedListingType()).toBe('buy');
    });

    it('returns buy when no active button', () => {
      document.querySelectorAll('.property-type-btn').forEach((b) => b.classList.remove('active'));
      expect(getSelectedListingType()).toBe('buy');
    });
  });

  describe('setupPropertyTypeToggle', () => {
    it('toggles active class between buy and rent buttons', () => {
      setupPropertyTypeToggle();
      const buttons = document.querySelectorAll('.property-type-btn');
      expect(buttons[0].classList.contains('active')).toBe(true);
      expect(buttons[1].classList.contains('active')).toBe(false);

      buttons[1].click();
      expect(buttons[0].classList.contains('active')).toBe(false);
      expect(buttons[1].classList.contains('active')).toBe(true);
    });

    it('calls onChange callback with the selected listing type', () => {
      const onChange = vi.fn();
      setupPropertyTypeToggle(onChange);
      const buttons = document.querySelectorAll('.property-type-btn');

      buttons[1].click();
      expect(onChange).toHaveBeenCalledWith('rent');
    });
  });

  describe('isPropertyOverlayEnabled', () => {
    it('returns true when checkbox is checked', () => {
      expect(isPropertyOverlayEnabled()).toBe(true);
    });

    it('returns false when checkbox is unchecked', () => {
      document.getElementById('property-overlay').checked = false;
      expect(isPropertyOverlayEnabled()).toBe(false);
    });
  });

  describe('setupPropertyOverlayToggle', () => {
    it('calls onChange with checked state when toggled', () => {
      const onChange = vi.fn();
      setupPropertyOverlayToggle(onChange);
      const checkbox = document.getElementById('property-overlay');
      checkbox.checked = false;
      checkbox.dispatchEvent(new Event('change'));
      expect(onChange).toHaveBeenCalledWith(false);
    });
  });

  describe('showPropertyMarkerStatus', () => {
    it('displays text in the status element', () => {
      showPropertyMarkerStatus('3 estate agents found');
      const el = document.getElementById('property-marker-status');
      expect(el.textContent).toBe('3 estate agents found');
      expect(el.hidden).toBe(false);
    });
  });

  describe('hidePropertyMarkerStatus', () => {
    it('hides the status element', () => {
      showPropertyMarkerStatus('test');
      hidePropertyMarkerStatus();
      expect(document.getElementById('property-marker-status').hidden).toBe(true);
    });
  });
});
