import { GEOAPIFY_ISOLINE_URL } from './config.js';

/**
 * Fetch isochrone polygons from Geoapify Isoline API.
 * Makes parallel requests for each time interval and combines results.
 *
 * @param {Object} params
 * @param {string} params.apiKey - Geoapify API key.
 * @param {number} params.lat - Latitude of the origin.
 * @param {number} params.lon - Longitude of the origin.
 * @param {string} params.profile - Transport mode (e.g., 'drive', 'transit', 'bicycle', 'walk').
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

  const sortedIntervals = [...intervals].sort((a, b) => a - b);

  const promises = sortedIntervals.map(async (minutes) => {
    const seconds = minutes * 60;
    const params = new URLSearchParams({
      lat: lat.toString(),
      lon: lon.toString(),
      type: 'time',
      mode: profile,
      range: seconds.toString(),
      apiKey,
    });

    const response = await fetch(`${GEOAPIFY_ISOLINE_URL}?${params}`);

    if (!response.ok) {
      const errorBody = await response.text();
      let message = `Isochrone request failed: ${response.status}`;
      try {
        const parsed = JSON.parse(errorBody);
        if (parsed.message) {
          message = parsed.message;
        }
      } catch {
        // use default message
      }
      throw new Error(message);
    }

    const data = await response.json();

    // Normalize: ensure each feature has value in seconds for consistent handling
    (data.features || []).forEach((f) => {
      f.properties = f.properties || {};
      f.properties.value = seconds;
    });

    return data.features || [];
  });

  const allFeatures = await Promise.all(promises);

  return {
    type: 'FeatureCollection',
    features: allFeatures.flat(),
  };
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
