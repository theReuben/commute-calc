import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchCrimeData,
  getOuterFeature,
  extractPolyString,
  simplifyCoords,
  aggregateCrimes,
  classifyCrimeDensity,
  CRIME_COLORS,
} from '../src/crimeData.js';

describe('crimeData', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('simplifyCoords', () => {
    it('returns coords unchanged when below maxPoints', () => {
      const coords = [[0, 1], [2, 3], [4, 5]];
      expect(simplifyCoords(coords, 10)).toEqual(coords);
    });

    it('simplifies to the requested number of points', () => {
      const coords = Array.from({ length: 100 }, (_, i) => [i, i]);
      const result = simplifyCoords(coords, 10);
      expect(result).toHaveLength(10);
      expect(result[0]).toEqual([0, 0]);
      expect(result[result.length - 1]).toEqual([99, 99]);
    });
  });

  describe('getOuterFeature', () => {
    it('returns the feature with the highest value', () => {
      const geojson = {
        features: [
          { properties: { value: 600 }, geometry: { type: 'Polygon', coordinates: [[[0, 0]]] } },
          { properties: { value: 1800 }, geometry: { type: 'Polygon', coordinates: [[[1, 1]]] } },
          { properties: { value: 1200 }, geometry: { type: 'Polygon', coordinates: [[[2, 2]]] } },
        ],
      };
      const outer = getOuterFeature(geojson);
      expect(outer.properties.value).toBe(1800);
    });

    it('returns null for empty features', () => {
      expect(getOuterFeature({ features: [] })).toBeNull();
    });

    it('returns the single feature when only one exists', () => {
      const geojson = {
        features: [{ properties: { value: 600 } }],
      };
      expect(getOuterFeature(geojson)).toBe(geojson.features[0]);
    });
  });

  describe('extractPolyString', () => {
    it('converts Polygon coordinates to Police API format', () => {
      const feature = {
        geometry: {
          type: 'Polygon',
          coordinates: [[[-0.1, 51.5], [-0.2, 51.6], [-0.15, 51.55], [-0.1, 51.5]]],
        },
      };
      const result = extractPolyString(feature);
      expect(result).toContain('51.5,-0.1');
      expect(result).toContain(':');
    });

    it('handles MultiPolygon by using largest ring', () => {
      const feature = {
        geometry: {
          type: 'MultiPolygon',
          coordinates: [
            [[[-0.1, 51.5], [-0.2, 51.6], [-0.1, 51.5]]],
            [[[-0.3, 51.4], [-0.4, 51.7], [-0.5, 51.5], [-0.6, 51.6], [-0.3, 51.4]]],
          ],
        },
      };
      const result = extractPolyString(feature);
      expect(result).toBeDefined();
      // Should use the polygon with more points
      expect(result.split(':').length).toBeGreaterThanOrEqual(4);
    });

    it('returns null for missing geometry', () => {
      expect(extractPolyString({})).toBeNull();
      expect(extractPolyString({ geometry: {} })).toBeNull();
    });

    it('returns null for too few coordinates', () => {
      const feature = {
        geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 1]]] },
      };
      expect(extractPolyString(feature)).toBeNull();
    });
  });

  describe('aggregateCrimes', () => {
    it('groups crimes by grid cell', () => {
      const crimes = [
        { category: 'burglary', lat: 51.500, lon: -0.100 },
        { category: 'burglary', lat: 51.500, lon: -0.100 },
        { category: 'theft', lat: 51.510, lon: -0.110 },
      ];
      const grid = aggregateCrimes(crimes);
      expect(grid.length).toBeGreaterThanOrEqual(1);
      const totalCount = grid.reduce((sum, cell) => sum + cell.count, 0);
      expect(totalCount).toBe(3);
    });

    it('returns empty array for no crimes', () => {
      expect(aggregateCrimes([])).toEqual([]);
    });

    it('tracks category counts per cell', () => {
      const crimes = [
        { category: 'burglary', lat: 51.500, lon: -0.100 },
        { category: 'burglary', lat: 51.500, lon: -0.100 },
        { category: 'theft', lat: 51.500, lon: -0.100 },
      ];
      const grid = aggregateCrimes(crimes);
      const cell = grid[0];
      expect(cell.categories.burglary).toBe(2);
      expect(cell.categories.theft).toBe(1);
    });
  });

  describe('classifyCrimeDensity', () => {
    it('returns low for zero count', () => {
      expect(classifyCrimeDensity(0, 100)).toBe('low');
    });

    it('returns low for zero maxCount', () => {
      expect(classifyCrimeDensity(0, 0)).toBe('low');
    });

    it('classifies based on ratio to max', () => {
      expect(classifyCrimeDensity(10, 100)).toBe('low');
      expect(classifyCrimeDensity(30, 100)).toBe('medium');
      expect(classifyCrimeDensity(60, 100)).toBe('high');
      expect(classifyCrimeDensity(90, 100)).toBe('very-high');
    });

    it('returns very-high at max count', () => {
      expect(classifyCrimeDensity(100, 100)).toBe('very-high');
    });
  });

  describe('CRIME_COLORS', () => {
    it('has all four density levels', () => {
      expect(CRIME_COLORS).toHaveProperty('low');
      expect(CRIME_COLORS).toHaveProperty('medium');
      expect(CRIME_COLORS).toHaveProperty('high');
      expect(CRIME_COLORS).toHaveProperty('very-high');
    });

    it('each level has fillColor, color, and label', () => {
      Object.values(CRIME_COLORS).forEach((entry) => {
        expect(entry).toHaveProperty('fillColor');
        expect(entry).toHaveProperty('color');
        expect(entry).toHaveProperty('label');
      });
    });
  });

  describe('fetchCrimeData', () => {
    it('throws if no GeoJSON provided', async () => {
      await expect(fetchCrimeData({ geojson: null })).rejects.toThrow('Isochrone GeoJSON is required');
    });

    it('throws for empty features', async () => {
      await expect(fetchCrimeData({ geojson: { features: [] } })).rejects.toThrow('Isochrone GeoJSON is required');
    });

    it('sends correct POST request to Police API', async () => {
      const mockCrimes = [
        {
          category: 'burglary',
          location: { latitude: '51.5', longitude: '-0.1', street: { name: 'High Street' } },
          month: '2025-01',
        },
      ];

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockCrimes),
      });
      vi.stubGlobal('fetch', mockFetch);

      const geojson = {
        features: [{
          properties: { value: 1800 },
          geometry: {
            type: 'Polygon',
            coordinates: [[[-0.2, 51.4], [0.0, 51.6], [0.1, 51.5], [-0.2, 51.4]]],
          },
        }],
      };

      const result = await fetchCrimeData({ geojson });

      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('data.police.uk');
      expect(opts.method).toBe('POST');
      expect(opts.body).toContain('poly=');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        category: 'burglary',
        lat: 51.5,
        lon: -0.1,
        month: '2025-01',
        location: 'High Street',
      });
    });

    it('filters out crimes with invalid coordinates', async () => {
      const mockCrimes = [
        { category: 'theft', location: { latitude: '51.5', longitude: '-0.1', street: {} }, month: '' },
        { category: 'theft', location: { latitude: 'NaN', longitude: 'NaN', street: {} }, month: '' },
      ];

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockCrimes),
      }));

      const geojson = {
        features: [{
          properties: { value: 600 },
          geometry: {
            type: 'Polygon',
            coordinates: [[[-0.2, 51.4], [0.0, 51.6], [0.1, 51.5], [-0.2, 51.4]]],
          },
        }],
      };

      const result = await fetchCrimeData({ geojson });
      expect(result).toHaveLength(1);
    });

    it('throws on 503 with area too large message', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
      }));

      const geojson = {
        features: [{
          properties: { value: 3600 },
          geometry: {
            type: 'Polygon',
            coordinates: [[[-1, 50], [1, 52], [0, 51], [-1, 50]]],
          },
        }],
      };

      await expect(fetchCrimeData({ geojson })).rejects.toThrow('area too large');
    });

    it('throws on other API errors', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      }));

      const geojson = {
        features: [{
          properties: { value: 600 },
          geometry: {
            type: 'Polygon',
            coordinates: [[[-0.2, 51.4], [0.0, 51.6], [0.1, 51.5], [-0.2, 51.4]]],
          },
        }],
      };

      await expect(fetchCrimeData({ geojson })).rejects.toThrow('500');
    });
  });
});
