import { describe, it, expect } from 'vitest';
import { TIME_COLORS, TRANSPORT_MODES, DEFAULT_CENTER, DEFAULT_ZOOM } from '../src/config.js';

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
      expect(TRANSPORT_MODES).toHaveProperty('driving-car');
      expect(TRANSPORT_MODES).toHaveProperty('public-transport');
      expect(TRANSPORT_MODES).toHaveProperty('cycling-regular');
      expect(TRANSPORT_MODES).toHaveProperty('foot-walking');
    });

    it('marks public-transport as unsupported', () => {
      expect(TRANSPORT_MODES['public-transport'].unsupported).toBe(true);
    });

    it('does not mark other modes as unsupported', () => {
      expect(TRANSPORT_MODES['driving-car'].unsupported).toBeUndefined();
      expect(TRANSPORT_MODES['cycling-regular'].unsupported).toBeUndefined();
      expect(TRANSPORT_MODES['foot-walking'].unsupported).toBeUndefined();
    });

    it('each mode has label and emoji', () => {
      Object.values(TRANSPORT_MODES).forEach((mode) => {
        expect(mode).toHaveProperty('label');
        expect(mode).toHaveProperty('emoji');
      });
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
});
