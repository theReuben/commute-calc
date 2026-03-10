import { NOMINATIM_URL } from './config.js';

/**
 * Geocode an address string into coordinates using Nominatim.
 * @param {string} query - The address to search for.
 * @returns {Promise<Array<{displayName: string, lat: number, lon: number}>>}
 */
export async function geocodeAddress(query) {
  if (!query || !query.trim()) {
    return [];
  }

  const params = new URLSearchParams({
    q: query.trim(),
    format: 'json',
    limit: '5',
  });

  const response = await fetch(`${NOMINATIM_URL}?${params}`, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'commute-calc/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`Geocoding failed: ${response.status} ${response.statusText}`);
  }

  const results = await response.json();
  return results.map((r) => ({
    displayName: r.display_name,
    lat: parseFloat(r.lat),
    lon: parseFloat(r.lon),
  }));
}
