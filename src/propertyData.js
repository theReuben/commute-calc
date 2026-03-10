import { GEOAPIFY_PLACES_URL } from './config.js';

/**
 * Fetch property-related points of interest from the Geoapify Places API.
 * Searches within the bounding box of the provided isochrone GeoJSON.
 *
 * @param {Object} params
 * @param {string} params.apiKey - Geoapify API key.
 * @param {Object} params.geojson - GeoJSON FeatureCollection (isochrone result).
 * @param {'buy'|'rent'} [params.listingType='buy'] - Listing type for labelling.
 * @returns {Promise<Array<{name: string, lat: number, lon: number, address: string, website: string, phone: string, type: string}>>}
 */
export async function fetchPropertyMarkers({ apiKey, geojson }) {
  if (!apiKey) {
    throw new Error('API key is required');
  }
  if (!geojson || !geojson.features || geojson.features.length === 0) {
    throw new Error('Isochrone GeoJSON is required');
  }

  const bounds = computeBounds(geojson);
  if (!bounds) {
    throw new Error('Could not compute bounds from isochrone');
  }

  const categories = [
    'commercial.real_estate.agency',
    'commercial.real_estate.property',
  ].join(',');

  const params = new URLSearchParams({
    categories,
    filter: `rect:${bounds.west},${bounds.south},${bounds.east},${bounds.north}`,
    limit: '50',
    apiKey,
  });

  const response = await fetch(`${GEOAPIFY_PLACES_URL}?${params}`);

  if (!response.ok) {
    const errorBody = await response.text();
    let message = `Property search failed: ${response.status}`;
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

  return (data.features || []).map((feature) => {
    const props = feature.properties || {};
    const coords = feature.geometry?.coordinates || [];
    return {
      name: props.name || props.address_line1 || 'Property',
      lat: coords[1] || props.lat,
      lon: coords[0] || props.lon,
      address: props.formatted || props.address_line2 || '',
      website: props.website || '',
      phone: props.contact?.phone || '',
      type: formatCategory(props.categories),
    };
  }).filter((m) => m.lat != null && m.lon != null);
}

/**
 * Compute a bounding box from a GeoJSON FeatureCollection.
 * @param {Object} geojson - GeoJSON FeatureCollection.
 * @returns {{north: number, south: number, east: number, west: number} | null}
 */
export function computeBounds(geojson) {
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLon = Infinity;
  let maxLon = -Infinity;
  let hasCoords = false;

  function processCoords(coords) {
    if (typeof coords[0] === 'number') {
      // [lon, lat]
      const lon = coords[0];
      const lat = coords[1];
      if (lat != null && lon != null) {
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
        minLon = Math.min(minLon, lon);
        maxLon = Math.max(maxLon, lon);
        hasCoords = true;
      }
    } else if (Array.isArray(coords)) {
      coords.forEach(processCoords);
    }
  }

  (geojson.features || []).forEach((feature) => {
    if (feature.geometry && feature.geometry.coordinates) {
      processCoords(feature.geometry.coordinates);
    }
  });

  if (!hasCoords) return null;

  return {
    north: maxLat,
    south: minLat,
    east: maxLon,
    west: minLon,
  };
}

/**
 * Format a Geoapify category array into a readable type label.
 * @param {string[]} categories
 * @returns {string}
 */
function formatCategory(categories) {
  if (!categories || categories.length === 0) return 'Property';
  for (const cat of categories) {
    if (cat.includes('property')) return 'Property';
    if (cat.includes('agency')) return 'Estate Agent';
  }
  return 'Real Estate';
}
