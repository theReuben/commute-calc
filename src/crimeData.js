import { POLICE_API_URL } from './config.js';

/**
 * Fetch street-level crime data from the UK Police API within a polygon.
 * The API accepts a polygon of lat/lon points and returns crimes within it.
 * Limited to the most recent month of available data.
 *
 * @param {Object} params
 * @param {Object} params.geojson - GeoJSON FeatureCollection (isochrone result).
 * @returns {Promise<Array<{category: string, lat: number, lon: number, month: string, location: string}>>}
 */
export async function fetchCrimeData({ geojson }) {
  if (!geojson || !geojson.features || geojson.features.length === 0) {
    throw new Error('Isochrone GeoJSON is required');
  }

  // Use the outermost isochrone (largest time interval) for the query area
  const outerFeature = getOuterFeature(geojson);
  if (!outerFeature) {
    throw new Error('Could not extract polygon from isochrone');
  }

  const polyString = extractPolyString(outerFeature);
  if (!polyString) {
    throw new Error('Could not extract coordinates from isochrone polygon');
  }

  const response = await fetch(`${POLICE_API_URL}/crimes-street/all-crime`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `poly=${polyString}`,
  });

  if (!response.ok) {
    if (response.status === 503) {
      throw new Error('Police API area too large — try a shorter commute time');
    }
    throw new Error(`Crime data request failed: ${response.status}`);
  }

  const crimes = await response.json();

  return crimes.map((crime) => ({
    category: crime.category || 'unknown',
    lat: parseFloat(crime.location?.latitude),
    lon: parseFloat(crime.location?.longitude),
    month: crime.month || '',
    location: crime.location?.street?.name || '',
  })).filter((c) => !isNaN(c.lat) && !isNaN(c.lon));
}

/**
 * Get the outermost (largest area) feature from an isochrone FeatureCollection.
 * The outermost isochrone has the highest time value.
 * @param {Object} geojson
 * @returns {Object|null} GeoJSON Feature
 */
export function getOuterFeature(geojson) {
  if (!geojson.features || geojson.features.length === 0) return null;

  return geojson.features.reduce((outer, feature) => {
    const outerValue = outer.properties?.value || 0;
    const featureValue = feature.properties?.value || 0;
    return featureValue > outerValue ? feature : outer;
  }, geojson.features[0]);
}

/**
 * Extract a simplified polygon string for the Police API from a GeoJSON feature.
 * The Police API accepts: lat,lon:lat,lon:lat,lon
 * Simplifies the polygon to max ~80 points to stay within API limits.
 *
 * @param {Object} feature - GeoJSON Feature with Polygon/MultiPolygon geometry.
 * @returns {string|null} Polygon string for the Police API.
 */
export function extractPolyString(feature) {
  if (!feature?.geometry?.coordinates) return null;

  let coords;
  const geomType = feature.geometry.type;

  if (geomType === 'Polygon') {
    coords = feature.geometry.coordinates[0]; // outer ring
  } else if (geomType === 'MultiPolygon') {
    // Use the largest polygon ring
    let maxLen = 0;
    feature.geometry.coordinates.forEach((polygon) => {
      if (polygon[0] && polygon[0].length > maxLen) {
        coords = polygon[0];
        maxLen = polygon[0].length;
      }
    });
  }

  if (!coords || coords.length < 3) return null;

  // Simplify to ~80 points to avoid API limits
  const simplified = simplifyCoords(coords, 80);

  // Police API format: lat,lon:lat,lon:...
  return simplified.map((c) => `${c[1]},${c[0]}`).join(':');
}

/**
 * Simplify a coordinate array by sampling evenly spaced points.
 * @param {Array<[number, number]>} coords - GeoJSON coordinates [lon, lat].
 * @param {number} maxPoints - Maximum number of points to keep.
 * @returns {Array<[number, number]>}
 */
export function simplifyCoords(coords, maxPoints) {
  if (coords.length <= maxPoints) return coords;

  const step = (coords.length - 1) / (maxPoints - 1);
  const result = [];
  for (let i = 0; i < maxPoints; i++) {
    result.push(coords[Math.round(i * step)]);
  }
  return result;
}

/**
 * Aggregate crimes into a grid for heatmap-style display.
 * Groups crimes by rounded lat/lon into grid cells and returns counts.
 *
 * @param {Array<{category: string, lat: number, lon: number}>} crimes
 * @param {number} [precision=3] - Decimal places for grid rounding (3 ≈ 110m cells).
 * @returns {Array<{lat: number, lon: number, count: number, categories: Object}>}
 */
export function aggregateCrimes(crimes, precision = 3) {
  const grid = new Map();
  const factor = Math.pow(10, precision);

  crimes.forEach((crime) => {
    const key = `${Math.round(crime.lat * factor)}:${Math.round(crime.lon * factor)}`;
    if (!grid.has(key)) {
      grid.set(key, {
        lat: Math.round(crime.lat * factor) / factor,
        lon: Math.round(crime.lon * factor) / factor,
        count: 0,
        categories: {},
      });
    }
    const cell = grid.get(key);
    cell.count++;
    cell.categories[crime.category] = (cell.categories[crime.category] || 0) + 1;
  });

  return Array.from(grid.values());
}

/**
 * Classify a grid cell's crime density for visual display.
 * @param {number} count - Number of crimes in the cell.
 * @param {number} maxCount - Maximum count across all cells.
 * @returns {'low'|'medium'|'high'|'very-high'}
 */
export function classifyCrimeDensity(count, maxCount) {
  if (maxCount === 0) return 'low';
  const ratio = count / maxCount;
  if (ratio <= 0.25) return 'low';
  if (ratio <= 0.5) return 'medium';
  if (ratio <= 0.75) return 'high';
  return 'very-high';
}

/** Color scheme for crime density levels. */
export const CRIME_COLORS = {
  'low': { fillColor: '#2b8a3e', color: '#1b5e20', label: 'Low crime' },
  'medium': { fillColor: '#f59f00', color: '#e67700', label: 'Medium crime' },
  'high': { fillColor: '#e03131', color: '#c92a2a', label: 'High crime' },
  'very-high': { fillColor: '#7b2d8e', color: '#5c0a72', label: 'Very high crime' },
};
