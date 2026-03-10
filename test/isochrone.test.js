import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchIsochrones, getFeatureMinutes } from '../src/isochrone.js';

describe('isochrone', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('fetchIsochrones', () => {
    it('throws if no API key provided', async () => {
      await expect(
        fetchIsochrones({ apiKey: '', lat: 51.5, lon: -0.1, profile: 'driving-car', intervals: [10] })
      ).rejects.toThrow('API key is required');
    });

    it('throws if no coordinates provided', async () => {
      await expect(
        fetchIsochrones({ apiKey: 'test-key', lat: null, lon: null, profile: 'driving-car', intervals: [10] })
      ).rejects.toThrow('Location coordinates are required');
    });

    it('throws if no intervals provided', async () => {
      await expect(
        fetchIsochrones({ apiKey: 'test-key', lat: 51.5, lon: -0.1, profile: 'driving-car', intervals: [] })
      ).rejects.toThrow('At least one time interval is required');
    });

    it('sends correct request to ORS API', async () => {
      const mockGeojson = { type: 'FeatureCollection', features: [] };
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockGeojson),
      });
      vi.stubGlobal('fetch', mockFetch);

      const result = await fetchIsochrones({
        apiKey: 'my-api-key',
        lat: 51.505,
        lon: -0.09,
        profile: 'driving-car',
        intervals: [10, 20, 30],
      });

      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain('isochrones/driving-car');
      expect(options.method).toBe('POST');
      expect(options.headers['Authorization']).toBe('my-api-key');

      const body = JSON.parse(options.body);
      expect(body.locations).toEqual([[-0.09, 51.505]]);
      expect(body.range).toEqual([600, 1200, 1800]); // sorted seconds
      expect(body.range_type).toBe('time');

      expect(result).toEqual(mockGeojson);
    });

    it('throws on API error response', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: () => Promise.resolve(JSON.stringify({ error: { message: 'Invalid API key' } })),
      }));

      await expect(
        fetchIsochrones({ apiKey: 'bad-key', lat: 51.5, lon: -0.1, profile: 'driving-car', intervals: [10] })
      ).rejects.toThrow('Invalid API key');
    });
  });

  describe('getFeatureMinutes', () => {
    it('converts seconds to minutes', () => {
      expect(getFeatureMinutes({ properties: { value: 600 } })).toBe(10);
      expect(getFeatureMinutes({ properties: { value: 1800 } })).toBe(30);
      expect(getFeatureMinutes({ properties: { value: 2700 } })).toBe(45);
    });

    it('returns 0 for missing value', () => {
      expect(getFeatureMinutes({ properties: {} })).toBe(0);
      expect(getFeatureMinutes({})).toBe(0);
    });
  });
});
