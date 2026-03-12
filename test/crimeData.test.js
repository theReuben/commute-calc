import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchCrimeData,
  getOuterFeature,
  getBoundingBox,
  createTiles,
  tileToPolyString,
  subdivideTile,
  fetchCrimesInTiles,
  deduplicateCrimes,
  aggregateCrimes,
  classifyCrimeDensity,
  getGridPrecision,
  CRIME_COLORS,
} from '../src/crimeData.js';

describe('crimeData', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
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

  describe('getBoundingBox', () => {
    it('computes bounding box for a Polygon', () => {
      const feature = {
        geometry: {
          type: 'Polygon',
          coordinates: [[[-0.2, 51.4], [0.0, 51.6], [0.1, 51.5], [-0.2, 51.4]]],
        },
      };
      const bbox = getBoundingBox(feature);
      expect(bbox.minLat).toBeCloseTo(51.4);
      expect(bbox.maxLat).toBeCloseTo(51.6);
      expect(bbox.minLon).toBeCloseTo(-0.2);
      expect(bbox.maxLon).toBeCloseTo(0.1);
    });

    it('computes bounding box for a MultiPolygon', () => {
      const feature = {
        geometry: {
          type: 'MultiPolygon',
          coordinates: [
            [[[-0.1, 51.5], [-0.2, 51.6], [-0.1, 51.5]]],
            [[[-0.3, 51.4], [-0.4, 51.7], [-0.3, 51.4]]],
          ],
        },
      };
      const bbox = getBoundingBox(feature);
      expect(bbox.minLat).toBeCloseTo(51.4);
      expect(bbox.maxLat).toBeCloseTo(51.7);
      expect(bbox.minLon).toBeCloseTo(-0.4);
      expect(bbox.maxLon).toBeCloseTo(-0.1);
    });

    it('returns null for missing geometry', () => {
      expect(getBoundingBox({})).toBeNull();
      expect(getBoundingBox({ geometry: {} })).toBeNull();
    });

    it('returns null for unsupported geometry type', () => {
      expect(getBoundingBox({ geometry: { type: 'Point', coordinates: [0, 0] } })).toBeNull();
    });
  });

  describe('createTiles', () => {
    it('creates tiles covering the bounding box', () => {
      const bbox = { minLat: 51.4, maxLat: 51.5, minLon: -0.2, maxLon: -0.1 };
      const tiles = createTiles(bbox, 0.05);
      expect(tiles.length).toBeGreaterThanOrEqual(4);
      // Every tile should be within the bounding box
      tiles.forEach((tile) => {
        expect(tile.minLat).toBeGreaterThanOrEqual(bbox.minLat - 0.001);
        expect(tile.maxLat).toBeLessThanOrEqual(bbox.maxLat + 0.001);
        expect(tile.minLon).toBeGreaterThanOrEqual(bbox.minLon - 0.001);
        expect(tile.maxLon).toBeLessThanOrEqual(bbox.maxLon + 0.001);
      });
    });

    it('creates a single tile for a small area', () => {
      const bbox = { minLat: 51.5, maxLat: 51.51, minLon: -0.1, maxLon: -0.09 };
      const tiles = createTiles(bbox, 0.05);
      expect(tiles.length).toBe(1);
    });
  });

  describe('tileToPolyString', () => {
    it('converts a tile to Police API polygon format', () => {
      const tile = { minLat: 51.4, maxLat: 51.5, minLon: -0.2, maxLon: -0.1 };
      const result = tileToPolyString(tile);
      expect(result).toBe('51.4,-0.2:51.5,-0.2:51.5,-0.1:51.4,-0.1');
    });
  });

  describe('deduplicateCrimes', () => {
    it('removes duplicate crimes', () => {
      const crimes = [
        { category: 'theft', lat: 51.5, lon: -0.1, month: '2025-01', location: 'A St' },
        { category: 'theft', lat: 51.5, lon: -0.1, month: '2025-01', location: 'A St' },
        { category: 'burglary', lat: 51.5, lon: -0.1, month: '2025-01', location: 'A St' },
      ];
      const result = deduplicateCrimes(crimes);
      expect(result).toHaveLength(2);
    });

    it('keeps crimes with different locations', () => {
      const crimes = [
        { category: 'theft', lat: 51.5, lon: -0.1, month: '2025-01', location: 'A' },
        { category: 'theft', lat: 51.6, lon: -0.2, month: '2025-01', location: 'B' },
      ];
      expect(deduplicateCrimes(crimes)).toHaveLength(2);
    });

    it('returns empty array for empty input', () => {
      expect(deduplicateCrimes([])).toEqual([]);
    });
  });

  describe('fetchCrimesInTiles', () => {
    it('fetches crimes from multiple tiles and merges results', async () => {
      const mockCrimes1 = [
        { category: 'theft', location: { latitude: '51.5', longitude: '-0.1', street: { name: 'A St' } }, month: '2025-01' },
      ];
      const mockCrimes2 = [
        { category: 'burglary', location: { latitude: '51.6', longitude: '-0.2', street: { name: 'B St' } }, month: '2025-01' },
      ];

      vi.stubGlobal('fetch', vi.fn()
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockCrimes1) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockCrimes2) }));

      const tiles = [
        { minLat: 51.4, maxLat: 51.5, minLon: -0.2, maxLon: -0.1 },
        { minLat: 51.5, maxLat: 51.6, minLon: -0.2, maxLon: -0.1 },
      ];

      const result = await fetchCrimesInTiles(tiles, 5);
      expect(result).toHaveLength(2);
      const categories = result.map((c) => c.category).sort();
      expect(categories).toEqual(['burglary', 'theft']);
    });

    it('skips tiles that return non-503 errors', async () => {
      vi.stubGlobal('fetch', vi.fn()
        .mockResolvedValueOnce({ ok: false, status: 404 })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([
            { category: 'theft', location: { latitude: '51.5', longitude: '-0.1', street: {} }, month: '' },
          ]),
        }));

      const tiles = [
        { minLat: 51.4, maxLat: 51.5, minLon: -0.2, maxLon: -0.1 },
        { minLat: 51.5, maxLat: 51.6, minLon: -0.2, maxLon: -0.1 },
      ];

      const result = await fetchCrimesInTiles(tiles, 5);
      expect(result).toHaveLength(1);
    });

    it('subdivides tiles on 503 and retries', async () => {
      // First call returns 503, subsequent subdivision calls succeed
      vi.stubGlobal('fetch', vi.fn()
        .mockResolvedValueOnce({ ok: false, status: 503 })
        .mockResolvedValue({
          ok: true,
          json: () => Promise.resolve([
            { category: 'theft', location: { latitude: '51.45', longitude: '-0.15', street: {} }, month: '' },
          ]),
        }));

      const tiles = [
        { minLat: 51.4, maxLat: 51.5, minLon: -0.2, maxLon: -0.1 },
      ];

      const result = await fetchCrimesInTiles(tiles, 5);
      // The 503 tile gets subdivided into 4, each returning 1 crime
      expect(result.length).toBeGreaterThanOrEqual(1);
      // Should have made more than 1 fetch call (original + subdivision)
      expect(fetch).toHaveBeenCalledTimes(5); // 1 original + 4 sub-tiles
    });

    it('filters out crimes with invalid coordinates', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([
          { category: 'theft', location: { latitude: '51.5', longitude: '-0.1', street: {} }, month: '' },
          { category: 'theft', location: { latitude: 'NaN', longitude: 'NaN', street: {} }, month: '' },
        ]),
      }));

      const tiles = [{ minLat: 51.4, maxLat: 51.5, minLon: -0.2, maxLon: -0.1 }];
      const result = await fetchCrimesInTiles(tiles, 5);
      expect(result).toHaveLength(1);
    });

    it('respects concurrency limit', async () => {
      let maxConcurrent = 0;
      let inFlight = 0;

      vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
        inFlight++;
        maxConcurrent = Math.max(maxConcurrent, inFlight);
        return new Promise((resolve) => {
          setTimeout(() => {
            inFlight--;
            resolve({ ok: true, json: () => Promise.resolve([]) });
          }, 10);
        });
      }));

      const tiles = Array.from({ length: 10 }, (_, i) => ({
        minLat: 51.0 + i * 0.05, maxLat: 51.05 + i * 0.05,
        minLon: -0.2, maxLon: -0.1,
      }));

      await fetchCrimesInTiles(tiles, 3);
      expect(maxConcurrent).toBeLessThanOrEqual(3);
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

  describe('getGridPrecision', () => {
    it('returns precision 1 for very low zoom levels', () => {
      expect(getGridPrecision(8)).toBe(1);
      expect(getGridPrecision(10)).toBe(1);
    });

    it('returns precision 2 for medium zoom levels', () => {
      expect(getGridPrecision(11)).toBe(2);
      expect(getGridPrecision(12)).toBe(2);
    });

    it('returns precision 3 for default zoom levels', () => {
      expect(getGridPrecision(13)).toBe(3);
      expect(getGridPrecision(14)).toBe(3);
    });

    it('returns precision 4 for high zoom levels', () => {
      expect(getGridPrecision(15)).toBe(4);
      expect(getGridPrecision(18)).toBe(4);
    });
  });

  describe('aggregateCrimes with different precisions', () => {
    it('produces fewer cells with lower precision', () => {
      const crimes = [
        { category: 'theft', lat: 51.501, lon: -0.101 },
        { category: 'theft', lat: 51.502, lon: -0.102 },
        { category: 'theft', lat: 51.509, lon: -0.109 },
      ];
      const fineCells = aggregateCrimes(crimes, 3);
      const coarseCells = aggregateCrimes(crimes, 2);
      expect(coarseCells.length).toBeLessThanOrEqual(fineCells.length);
    });

    it('merges all crimes into one cell at very low precision', () => {
      const crimes = [
        { category: 'theft', lat: 51.501, lon: -0.101 },
        { category: 'burglary', lat: 51.509, lon: -0.109 },
      ];
      const grid = aggregateCrimes(crimes, 1);
      expect(grid.length).toBe(1);
      expect(grid[0].count).toBe(2);
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

    it('fetches crime data using tile-based approach', async () => {
      const mockCrimes = [
        {
          category: 'burglary',
          location: { latitude: '51.5', longitude: '-0.1', street: { name: 'High Street' } },
          month: '2025-01',
        },
      ];

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockCrimes),
      }));

      const geojson = {
        features: [{
          properties: { value: 1800 },
          geometry: {
            type: 'Polygon',
            coordinates: [[[-0.12, 51.49], [-0.08, 51.51], [-0.10, 51.50], [-0.12, 51.49]]],
          },
        }],
      };

      const result = await fetchCrimeData({ geojson });

      // Should have made at least one fetch call
      expect(fetch).toHaveBeenCalled();
      const [url, opts] = fetch.mock.calls[0];
      expect(url).toContain('data.police.uk');
      expect(opts.method).toBe('POST');
      expect(opts.body).toMatch(/^poly=/);

      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0]).toMatchObject({
        category: 'burglary',
        lat: 51.5,
        lon: -0.1,
        month: '2025-01',
        location: 'High Street',
      });
    });

    it('deduplicates crimes across tiles', async () => {
      const sameCrime = {
        category: 'burglary',
        location: { latitude: '51.5', longitude: '-0.1', street: { name: 'A St' } },
        month: '2025-01',
      };

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([sameCrime]),
      }));

      const geojson = {
        features: [{
          properties: { value: 600 },
          geometry: {
            type: 'Polygon',
            coordinates: [[[-0.12, 51.49], [-0.08, 51.51], [-0.10, 51.50], [-0.12, 51.49]]],
          },
        }],
      };

      const result = await fetchCrimeData({ geojson });
      // Even if multiple tiles return the same crime, it should appear only once
      const matching = result.filter((c) => c.category === 'burglary' && c.lat === 51.5 && c.lon === -0.1);
      expect(matching).toHaveLength(1);
    });

    it('handles tile failures gracefully without throwing', async () => {
      let callNum = 0;
      vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
        callNum++;
        if (callNum === 1) {
          return Promise.resolve({ ok: false, status: 503 });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            { category: 'theft', location: { latitude: '51.5', longitude: '-0.1', street: {} }, month: '2025-01' },
          ]),
        });
      }));

      const geojson = {
        features: [{
          properties: { value: 3600 },
          geometry: {
            type: 'Polygon',
            coordinates: [[[-0.15, 51.45], [-0.05, 51.55], [-0.10, 51.50], [-0.15, 51.45]]],
          },
        }],
      };

      // Should NOT throw — gracefully degrades by skipping failed tiles
      const result = await fetchCrimeData({ geojson });
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
