import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchIsochrones, getFeatureMinutes } from '../src/isochrone.js';

describe('isochrone', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('fetchIsochrones', () => {
    it('throws if no API key provided', async () => {
      await expect(
        fetchIsochrones({ apiKey: '', lat: 51.5, lon: -0.1, profile: 'drive', intervals: [10] })
      ).rejects.toThrow('API key is required');
    });

    it('throws if no coordinates provided', async () => {
      await expect(
        fetchIsochrones({ apiKey: 'test-key', lat: null, lon: null, profile: 'drive', intervals: [10] })
      ).rejects.toThrow('Location coordinates are required');
    });

    it('throws if no intervals provided', async () => {
      await expect(
        fetchIsochrones({ apiKey: 'test-key', lat: 51.5, lon: -0.1, profile: 'drive', intervals: [] })
      ).rejects.toThrow('At least one time interval is required');
    });

    it('sends correct request to Geoapify Isoline API', async () => {
      const mockGeojson = {
        type: 'FeatureCollection',
        features: [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [] } }],
      };
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockGeojson),
      });
      vi.stubGlobal('fetch', mockFetch);

      const result = await fetchIsochrones({
        apiKey: 'my-api-key',
        lat: 51.505,
        lon: -0.09,
        profile: 'transit',
        intervals: [10],
      });

      expect(mockFetch).toHaveBeenCalledOnce();
      const url = new URL(mockFetch.mock.calls[0][0]);
      expect(url.origin + url.pathname).toContain('geoapify.com');
      expect(url.searchParams.get('lat')).toBe('51.505');
      expect(url.searchParams.get('lon')).toBe('-0.09');
      expect(url.searchParams.get('type')).toBe('time');
      expect(url.searchParams.get('mode')).toBe('transit');
      expect(url.searchParams.get('range')).toBe('600');
      expect(url.searchParams.get('apiKey')).toBe('my-api-key');

      expect(result.type).toBe('FeatureCollection');
      expect(result.features).toHaveLength(1);
      expect(result.features[0].properties.value).toBe(600);
    });

    it('makes parallel requests for multiple intervals', async () => {
      const makeMock = () => ({
        type: 'FeatureCollection',
        features: [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [] } }],
      });

      const mockFetch = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(makeMock()) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(makeMock()) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(makeMock()) });
      vi.stubGlobal('fetch', mockFetch);

      const result = await fetchIsochrones({
        apiKey: 'my-api-key',
        lat: 51.505,
        lon: -0.09,
        profile: 'drive',
        intervals: [10, 20, 30],
      });

      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(result.features).toHaveLength(3);

      // Features should have correct value properties (sorted: 600, 1200, 1800)
      const values = result.features.map((f) => f.properties.value);
      expect(values).toEqual([600, 1200, 1800]);
    });

    it('throws on API error response', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve(JSON.stringify({ message: 'Unauthorized' })),
      }));

      await expect(
        fetchIsochrones({ apiKey: 'bad-key', lat: 51.5, lon: -0.1, profile: 'drive', intervals: [10] })
      ).rejects.toThrow('Unauthorized');
    });

    it('handles non-JSON error response', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      }));

      await expect(
        fetchIsochrones({ apiKey: 'key', lat: 51.5, lon: -0.1, profile: 'drive', intervals: [10] })
      ).rejects.toThrow('Isochrone request failed: 500');
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
