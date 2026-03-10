import { describe, it, expect, vi, beforeEach } from 'vitest';
import { geocodeAddress } from '../src/geocode.js';

describe('geocode', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns empty array for empty query', async () => {
    const result = await geocodeAddress('');
    expect(result).toEqual([]);
  });

  it('returns empty array for whitespace-only query', async () => {
    const result = await geocodeAddress('   ');
    expect(result).toEqual([]);
  });

  it('returns parsed results from Nominatim', async () => {
    const mockResponse = [
      {
        display_name: 'London, England, United Kingdom',
        lat: '51.5074',
        lon: '-0.1278',
      },
    ];

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    }));

    const results = await geocodeAddress('London');

    expect(results).toEqual([
      {
        displayName: 'London, England, United Kingdom',
        lat: 51.5074,
        lon: -0.1278,
      },
    ]);

    expect(fetch).toHaveBeenCalledOnce();
    const url = fetch.mock.calls[0][0];
    expect(url).toContain('nominatim.openstreetmap.org');
    expect(url).toContain('q=London');

    const options = fetch.mock.calls[0][1];
    expect(options.headers['User-Agent']).toBe('commute-calc/1.0');
  });

  it('throws on HTTP error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    }));

    await expect(geocodeAddress('test')).rejects.toThrow('Geocoding failed');
  });
});
