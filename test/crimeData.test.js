import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchCrimeData,
  getOuterFeature,
  getBoundingBox,
  createSampleGrid,
  locateNeighbourhood,
  discoverNeighbourhoods,
  enrichNeighbourhoods,
  fetchAllNeighbourhoodCrimes,
  classifyCrimeDensity,
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

  describe('createSampleGrid', () => {
    it('creates grid points covering the bounding box', () => {
      const bbox = { minLat: 51.4, maxLat: 51.5, minLon: -0.2, maxLon: -0.1 };
      const points = createSampleGrid(bbox, 0.05);
      expect(points.length).toBeGreaterThanOrEqual(4);
      points.forEach((p) => {
        expect(p.lat).toBeGreaterThanOrEqual(bbox.minLat - 0.001);
        expect(p.lat).toBeLessThanOrEqual(bbox.maxLat + 0.001);
        expect(p.lon).toBeGreaterThanOrEqual(bbox.minLon - 0.001);
        expect(p.lon).toBeLessThanOrEqual(bbox.maxLon + 0.001);
      });
    });

    it('creates a single point for a small area', () => {
      const bbox = { minLat: 51.5, maxLat: 51.51, minLon: -0.1, maxLon: -0.09 };
      const points = createSampleGrid(bbox, 0.08);
      expect(points.length).toBe(1);
    });
  });

  describe('locateNeighbourhood', () => {
    it('returns force and neighbourhood on success', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ force: 'metropolitan', neighbourhood: '00BK17N' }),
      }));
      const result = await locateNeighbourhood(51.5, -0.1);
      expect(result).toEqual({ force: 'metropolitan', neighbourhood: '00BK17N' });
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('locate-neighbourhood?q=51.5,-0.1'));
    });

    it('returns null on 404', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));
      expect(await locateNeighbourhood(55.0, -3.0)).toBeNull();
    });

    it('returns null on network error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
      expect(await locateNeighbourhood(51.5, -0.1)).toBeNull();
    });
  });

  describe('discoverNeighbourhoods', () => {
    it('discovers and deduplicates neighbourhoods from sample points', async () => {
      vi.stubGlobal('fetch', vi.fn()
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ force: 'met', neighbourhood: 'A' }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ force: 'met', neighbourhood: 'B' }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ force: 'met', neighbourhood: 'A' }) }));

      const points = [{ lat: 51.5, lon: -0.1 }, { lat: 51.6, lon: -0.2 }, { lat: 51.5, lon: -0.1 }];
      const result = await discoverNeighbourhoods(points, 5);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('A');
      expect(result[1].id).toBe('B');
      expect(result[0].force).toBe('met');
    });

    it('skips points that return null', async () => {
      vi.stubGlobal('fetch', vi.fn()
        .mockResolvedValueOnce({ ok: false, status: 404 })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ force: 'met', neighbourhood: 'X' }) }));

      const points = [{ lat: 55.0, lon: -3.0 }, { lat: 51.5, lon: -0.1 }];
      const result = await discoverNeighbourhoods(points, 5);
      expect(result).toHaveLength(1);
    });

    it('returns empty array when all points fail', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));
      const points = [{ lat: 55.0, lon: -3.0 }];
      expect(await discoverNeighbourhoods(points, 5)).toEqual([]);
    });
  });

  describe('enrichNeighbourhoods', () => {
    it('fetches boundary and name for each neighbourhood', async () => {
      vi.stubGlobal('fetch', vi.fn().mockImplementation((url) => {
        if (url.includes('/boundary')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([
              { latitude: '51.5', longitude: '-0.1' },
              { latitude: '51.6', longitude: '-0.2' },
              { latitude: '51.5', longitude: '-0.3' },
            ]),
          });
        }
        // Details endpoint
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ name: 'Test Ward' }),
        });
      }));

      const neighbourhoods = [{ id: 'A', force: 'met', name: '', boundary: [], crimeCount: 0, categories: {}, density: 'low' }];
      await enrichNeighbourhoods(neighbourhoods, 5);

      expect(neighbourhoods[0].name).toBe('Test Ward');
      expect(neighbourhoods[0].boundary).toHaveLength(3);
      expect(neighbourhoods[0].boundary[0]).toEqual([51.5, -0.1]);
    });

    it('leaves boundary empty on error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));

      const neighbourhoods = [{ id: 'X', force: 'met', name: '', boundary: [], crimeCount: 0, categories: {}, density: 'low' }];
      await enrichNeighbourhoods(neighbourhoods, 5);

      expect(neighbourhoods[0].boundary).toEqual([]);
      expect(neighbourhoods[0].name).toBe('');
    });
  });

  describe('fetchAllNeighbourhoodCrimes', () => {
    it('fetches and counts crimes per neighbourhood', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([
          { category: 'burglary' },
          { category: 'burglary' },
          { category: 'theft' },
        ]),
      }));

      const neighbourhoods = [{
        id: 'A', force: 'met', name: 'Test', crimeCount: 0, categories: {},
        boundary: [[51.5, -0.1], [51.6, -0.2], [51.5, -0.3]],
        density: 'low',
      }];
      await fetchAllNeighbourhoodCrimes(neighbourhoods, 5);

      expect(neighbourhoods[0].crimeCount).toBe(3);
      expect(neighbourhoods[0].categories.burglary).toBe(2);
      expect(neighbourhoods[0].categories.theft).toBe(1);
    });

    it('sends POST with neighbourhood boundary as poly', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      }));

      const neighbourhoods = [{
        id: 'A', force: 'met', name: 'Test', crimeCount: 0, categories: {},
        boundary: [[51.5, -0.1], [51.6, -0.2], [51.5, -0.3]],
        density: 'low',
      }];
      await fetchAllNeighbourhoodCrimes(neighbourhoods, 5);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('crimes-street/all-crime'),
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('skips neighbourhoods with no boundary', async () => {
      vi.stubGlobal('fetch', vi.fn());
      const neighbourhoods = [{
        id: 'A', force: 'met', name: '', crimeCount: 0, categories: {},
        boundary: [],
        density: 'low',
      }];
      await fetchAllNeighbourhoodCrimes(neighbourhoods, 5);
      expect(fetch).not.toHaveBeenCalled();
    });

    it('handles API errors gracefully', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));
      const neighbourhoods = [{
        id: 'A', force: 'met', name: '', crimeCount: 0, categories: {},
        boundary: [[51.5, -0.1], [51.6, -0.2], [51.5, -0.3]],
        density: 'low',
      }];
      await fetchAllNeighbourhoodCrimes(neighbourhoods, 5);
      expect(neighbourhoods[0].crimeCount).toBe(0);
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

    it('returns neighbourhood-level crime data', async () => {
      // Mock: locate-neighbourhood, then boundary, details, then crimes
      const fetchMock = vi.fn().mockImplementation((url) => {
        if (url.includes('locate-neighbourhood')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ force: 'met', neighbourhood: 'W1' }),
          });
        }
        if (url.includes('/boundary')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([
              { latitude: '51.5', longitude: '-0.1' },
              { latitude: '51.6', longitude: '-0.1' },
              { latitude: '51.6', longitude: '-0.2' },
            ]),
          });
        }
        if (url.includes('crimes-street/all-crime')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([
              { category: 'burglary' },
              { category: 'theft' },
            ]),
          });
        }
        // Details endpoint
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ name: 'Westminster' }),
        });
      });
      vi.stubGlobal('fetch', fetchMock);

      const geojson = {
        features: [{
          properties: { value: 600 },
          geometry: {
            type: 'Polygon',
            coordinates: [[[-0.12, 51.49], [-0.08, 51.51], [-0.10, 51.50], [-0.12, 51.49]]],
          },
        }],
      };

      const { neighbourhoods, totalCrimes } = await fetchCrimeData({ geojson });

      expect(neighbourhoods.length).toBeGreaterThanOrEqual(1);
      expect(totalCrimes).toBeGreaterThanOrEqual(1);

      const n = neighbourhoods[0];
      expect(n.name).toBe('Westminster');
      expect(n.crimeCount).toBe(2);
      expect(n.categories.burglary).toBe(1);
      expect(n.categories.theft).toBe(1);
      expect(n.boundary.length).toBe(3);
      expect(['low', 'medium', 'high', 'very-high']).toContain(n.density);
    });

    it('returns empty result when no neighbourhoods found', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));

      const geojson = {
        features: [{
          properties: { value: 600 },
          geometry: {
            type: 'Polygon',
            coordinates: [[[-0.12, 51.49], [-0.08, 51.51], [-0.10, 51.50], [-0.12, 51.49]]],
          },
        }],
      };

      const { neighbourhoods, totalCrimes } = await fetchCrimeData({ geojson });
      expect(neighbourhoods).toEqual([]);
      expect(totalCrimes).toBe(0);
    });
  });
});
