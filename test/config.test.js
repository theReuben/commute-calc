import { describe, it, expect } from 'vitest';
import { TIME_COLORS, TRANSPORT_MODES, DEFAULT_CENTER, DEFAULT_ZOOM, GEOAPIFY_ISOLINE_URL, ENV_GEOAPIFY_API_KEY } from '../src/config.js';

describe('config', () => {
  describe('TIME_COLORS', () => {
    it('has entries for all standard intervals', () => {
      expect(TIME_COLORS).toHaveProperty('10');
      expect(TIME_COLORS).toHaveProperty('20');
      expect(TIME_COLORS).toHaveProperty('30');
      expect(TIME_COLORS).toHaveProperty('45');
      expect(TIME_COLORS).toHaveProperty('60');
    });

    it('each entry has color, fillColor, and label', () => {
      Object.values(TIME_COLORS).forEach((entry) => {
        expect(entry).toHaveProperty('color');
        expect(entry).toHaveProperty('fillColor');
        expect(entry).toHaveProperty('label');
        expect(typeof entry.color).toBe('string');
        expect(typeof entry.fillColor).toBe('string');
        expect(typeof entry.label).toBe('string');
      });
    });
  });

  describe('TRANSPORT_MODES', () => {
    it('has entries for car, public transport, cycling, and walking', () => {
      expect(TRANSPORT_MODES).toHaveProperty('drive');
      expect(TRANSPORT_MODES).toHaveProperty('transit');
      expect(TRANSPORT_MODES).toHaveProperty('bicycle');
      expect(TRANSPORT_MODES).toHaveProperty('walk');
    });

    it('all modes are supported (no unsupported flag)', () => {
      Object.values(TRANSPORT_MODES).forEach((mode) => {
        expect(mode.unsupported).toBeUndefined();
      });
    });

    it('each mode has label and emoji', () => {
      Object.values(TRANSPORT_MODES).forEach((mode) => {
        expect(mode).toHaveProperty('label');
        expect(mode).toHaveProperty('emoji');
      });
    });

    it('includes public transport with transit mode', () => {
      expect(TRANSPORT_MODES['transit'].label).toBe('Public Transport');
    });
  });

  describe('GEOAPIFY_ISOLINE_URL', () => {
    it('points to Geoapify isoline API', () => {
      expect(GEOAPIFY_ISOLINE_URL).toContain('geoapify.com');
      expect(GEOAPIFY_ISOLINE_URL).toContain('isoline');
    });
  });

  describe('DEFAULT_CENTER', () => {
    it('is a valid lat/lon pair', () => {
      expect(DEFAULT_CENTER).toHaveLength(2);
      expect(DEFAULT_CENTER[0]).toBeGreaterThanOrEqual(-90);
      expect(DEFAULT_CENTER[0]).toBeLessThanOrEqual(90);
      expect(DEFAULT_CENTER[1]).toBeGreaterThanOrEqual(-180);
      expect(DEFAULT_CENTER[1]).toBeLessThanOrEqual(180);
    });
  });

  describe('DEFAULT_ZOOM', () => {
    it('is a reasonable zoom level', () => {
      expect(DEFAULT_ZOOM).toBeGreaterThanOrEqual(1);
      expect(DEFAULT_ZOOM).toBeLessThanOrEqual(20);
    });
  });

  describe('ENV_GEOAPIFY_API_KEY', () => {
    it('is a string (empty when no env var set)', () => {
      expect(typeof ENV_GEOAPIFY_API_KEY).toBe('string');
    });
  });
});
