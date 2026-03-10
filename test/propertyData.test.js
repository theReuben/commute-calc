import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchPropertyMarkers, computeBounds } from '../src/propertyData.js';

describe('propertyData', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('computeBounds', () => {
    it('computes bounding box from GeoJSON features', () => {
      const geojson = {
        features: [
          {
            geometry: {
              type: 'Polygon',
              coordinates: [[[0, 10], [5, 15], [10, 10], [0, 10]]],
            },
          },
        ],
      };
      const bounds = computeBounds(geojson);
      expect(bounds).toEqual({
        north: 15,
        south: 10,
        east: 10,
        west: 0,
      });
    });

    it('handles multiple features', () => {
      const geojson = {
        features: [
          {
            geometry: {
              type: 'Polygon',
              coordinates: [[[-1, 50], [0, 51], [1, 50], [-1, 50]]],
            },
          },
          {
            geometry: {
              type: 'Polygon',
              coordinates: [[[-2, 49], [2, 52], [-2, 49]]],
            },
          },
        ],
      };
      const bounds = computeBounds(geojson);
      expect(bounds.north).toBe(52);
      expect(bounds.south).toBe(49);
      expect(bounds.east).toBe(2);
      expect(bounds.west).toBe(-2);
    });

    it('returns null for empty features', () => {
      expect(computeBounds({ features: [] })).toBeNull();
    });

    it('returns null for features with no geometry', () => {
      expect(computeBounds({ features: [{}] })).toBeNull();
    });
  });

  describe('fetchPropertyMarkers', () => {
    it('throws if no API key provided', async () => {
      await expect(
        fetchPropertyMarkers({ apiKey: '', geojson: { features: [{ geometry: { coordinates: [[0, 0]] } }] } })
      ).rejects.toThrow('API key is required');
    });

    it('throws if no GeoJSON provided', async () => {
      await expect(
        fetchPropertyMarkers({ apiKey: 'test-key', geojson: null })
      ).rejects.toThrow('Isochrone GeoJSON is required');
    });

    it('throws for empty features', async () => {
      await expect(
        fetchPropertyMarkers({ apiKey: 'test-key', geojson: { features: [] } })
      ).rejects.toThrow('Isochrone GeoJSON is required');
    });

    it('sends correct request to Geoapify Places API', async () => {
      const mockResponse = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [-0.1, 51.5] },
            properties: {
              name: 'Foxtons',
              formatted: '123 High Street, London',
              website: 'https://foxtons.co.uk',
              contact: { phone: '+44 20 1234 5678' },
              categories: ['commercial.real_estate.agency'],
            },
          },
        ],
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });
      vi.stubGlobal('fetch', mockFetch);

      const geojson = {
        features: [
          {
            geometry: {
              type: 'Polygon',
              coordinates: [[[-0.2, 51.4], [0.0, 51.6], [-0.2, 51.4]]],
            },
          },
        ],
      };

      const markers = await fetchPropertyMarkers({ apiKey: 'my-key', geojson });

      expect(mockFetch).toHaveBeenCalledOnce();
      const url = new URL(mockFetch.mock.calls[0][0]);
      expect(url.origin + url.pathname).toContain('geoapify.com');
      expect(url.searchParams.get('apiKey')).toBe('my-key');
      expect(url.searchParams.get('categories')).toContain('real_estate');
      expect(url.searchParams.get('filter')).toContain('rect:');
      expect(url.searchParams.get('limit')).toBe('50');

      expect(markers).toHaveLength(1);
      expect(markers[0]).toEqual({
        name: 'Foxtons',
        lat: 51.5,
        lon: -0.1,
        address: '123 High Street, London',
        website: 'https://foxtons.co.uk',
        phone: '+44 20 1234 5678',
        type: 'Estate Agent',
      });
    });

    it('filters out markers with no coordinates', async () => {
      const mockResponse = {
        features: [
          {
            geometry: { type: 'Point', coordinates: [-0.1, 51.5] },
            properties: { name: 'Good Agent' },
          },
          {
            geometry: null,
            properties: { name: 'No Coords' },
          },
        ],
      };

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      }));

      const geojson = {
        features: [{
          geometry: { type: 'Polygon', coordinates: [[[-1, 50], [1, 52], [-1, 50]]] },
        }],
      };

      const markers = await fetchPropertyMarkers({ apiKey: 'key', geojson });
      expect(markers).toHaveLength(1);
      expect(markers[0].name).toBe('Good Agent');
    });

    it('throws on API error response', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve(JSON.stringify({ message: 'Unauthorized' })),
      }));

      const geojson = {
        features: [{
          geometry: { type: 'Polygon', coordinates: [[[-1, 50], [1, 52], [-1, 50]]] },
        }],
      };

      await expect(
        fetchPropertyMarkers({ apiKey: 'bad-key', geojson })
      ).rejects.toThrow('Unauthorized');
    });

    it('handles empty results', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ features: [] }),
      }));

      const geojson = {
        features: [{
          geometry: { type: 'Polygon', coordinates: [[[-1, 50], [1, 52], [-1, 50]]] },
        }],
      };

      const markers = await fetchPropertyMarkers({ apiKey: 'key', geojson });
      expect(markers).toEqual([]);
    });
  });
});
