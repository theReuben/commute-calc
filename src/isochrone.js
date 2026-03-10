import { ORS_ISOCHRONE_URL } from './config.js';

/**
 * Fetch isochrone polygons from OpenRouteService.
 *
 * @param {Object} params
 * @param {string} params.apiKey - ORS API key.
 * @param {number} params.lat - Latitude of the origin.
 * @param {number} params.lon - Longitude of the origin.
 * @param {string} params.profile - Transport profile (e.g., 'driving-car').
 * @param {number[]} params.intervals - Time intervals in minutes.
 * @returns {Promise<Object>} GeoJSON FeatureCollection with isochrone polygons.
 */
export async function fetchIsochrones({ apiKey, lat, lon, profile, intervals }) {
  if (!apiKey) {
    throw new Error('API key is required');
  }
  if (lat == null || lon == null) {
    throw new Error('Location coordinates are required');
  }
  if (!intervals || intervals.length === 0) {
    throw new Error('At least one time interval is required');
  }

  const rangeSeconds = intervals
    .map((m) => m * 60)
    .sort((a, b) => a - b);

  const body = {
    locations: [[lon, lat]],
    range: rangeSeconds,
    range_type: 'time',
  };

  const response = await fetch(`${ORS_ISOCHRONE_URL}/${profile}`, {
    method: 'POST',
    headers: {
      'Authorization': apiKey,
      'Content-Type': 'application/json; charset=utf-8',
      'Accept': 'application/json, application/geo+json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    let message = `Isochrone request failed: ${response.status}`;
    try {
      const parsed = JSON.parse(errorBody);
      if (parsed.error && parsed.error.message) {
        message = parsed.error.message;
      }
    } catch {
      // use default message
    }
    throw new Error(message);
  }

  return response.json();
}

/**
 * Parse the value (in seconds) from an isochrone feature into minutes.
 * @param {Object} feature - GeoJSON feature from isochrone response.
 * @returns {number} Time in minutes.
 */
export function getFeatureMinutes(feature) {
  const seconds = feature.properties?.value;
  return seconds != null ? Math.round(seconds / 60) : 0;
}
