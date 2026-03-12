import { POLICE_API_URL } from './config.js';

/** Maximum concurrent Police API requests. */
const MAX_CONCURRENT = 5;

/** Spacing between sample points in degrees (~8.8km at UK latitudes). */
const SAMPLE_SPACING = 0.08;

/**
 * Fetch crime data grouped by police neighbourhood within an isochrone area.
 *
 * 1. Samples points inside the isochrone bounding box
 * 2. Discovers which police neighbourhoods they belong to
 * 3. Fetches each neighbourhood's boundary, name, and crime data
 * 4. Classifies each neighbourhood's crime density
 *
 * @param {Object} params
 * @param {Object} params.geojson - GeoJSON FeatureCollection (isochrone result).
 * @returns {Promise<{neighbourhoods: Array, totalCrimes: number}>}
 */
export async function fetchCrimeData({ geojson }) {
  if (!geojson || !geojson.features || geojson.features.length === 0) {
    throw new Error('Isochrone GeoJSON is required');
  }

  const outerFeature = getOuterFeature(geojson);
  if (!outerFeature) {
    throw new Error('Could not extract polygon from isochrone');
  }

  const bbox = getBoundingBox(outerFeature);
  if (!bbox) {
    throw new Error('Could not extract coordinates from isochrone polygon');
  }

  // 1. Sample points across the area and discover neighbourhoods
  const samplePoints = createSampleGrid(bbox, SAMPLE_SPACING);
  const neighbourhoods = await discoverNeighbourhoods(samplePoints, MAX_CONCURRENT);

  if (neighbourhoods.length === 0) {
    return { neighbourhoods: [], totalCrimes: 0 };
  }

  // 2. Fetch boundary + name for each neighbourhood
  await enrichNeighbourhoods(neighbourhoods, MAX_CONCURRENT);

  // 3. Remove any without a valid boundary
  const valid = neighbourhoods.filter((n) => n.boundary.length >= 3);

  // 4. Fetch crimes per neighbourhood
  await fetchAllNeighbourhoodCrimes(valid, MAX_CONCURRENT);

  // 5. Classify density relative to the group
  const maxCount = valid.reduce((max, n) => Math.max(max, n.crimeCount), 0);
  valid.forEach((n) => {
    n.density = classifyCrimeDensity(n.crimeCount, maxCount);
  });

  const totalCrimes = valid.reduce((sum, n) => sum + n.crimeCount, 0);
  return { neighbourhoods: valid, totalCrimes };
}

/**
 * Get the outermost (largest area) feature from an isochrone FeatureCollection.
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
 * Compute the bounding box of a GeoJSON Polygon or MultiPolygon feature.
 * @param {Object} feature
 * @returns {{minLat: number, maxLat: number, minLon: number, maxLon: number}|null}
 */
export function getBoundingBox(feature) {
  if (!feature?.geometry?.coordinates) return null;

  const geomType = feature.geometry.type;
  let rings;

  if (geomType === 'Polygon') {
    rings = feature.geometry.coordinates;
  } else if (geomType === 'MultiPolygon') {
    rings = feature.geometry.coordinates.flat();
  } else {
    return null;
  }

  let minLon = Infinity, maxLon = -Infinity;
  let minLat = Infinity, maxLat = -Infinity;

  rings.forEach((ring) => {
    ring.forEach(([lon, lat]) => {
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    });
  });

  if (!isFinite(minLon)) return null;

  return { minLat, maxLat, minLon, maxLon };
}

/**
 * Create a grid of sample points covering a bounding box.
 * @param {{minLat: number, maxLat: number, minLon: number, maxLon: number}} bbox
 * @param {number} spacing - Grid spacing in degrees.
 * @returns {Array<{lat: number, lon: number}>}
 */
export function createSampleGrid(bbox, spacing) {
  const points = [];
  for (let lat = bbox.minLat; lat <= bbox.maxLat; lat += spacing) {
    for (let lon = bbox.minLon; lon <= bbox.maxLon; lon += spacing) {
      points.push({ lat, lon });
    }
  }
  return points;
}

/**
 * Look up the police neighbourhood for a single lat/lon point.
 * Returns null if the point is outside England/Wales or on error.
 * @param {number} lat
 * @param {number} lon
 * @returns {Promise<{force: string, neighbourhood: string}|null>}
 */
export async function locateNeighbourhood(lat, lon) {
  try {
    const response = await fetch(`${POLICE_API_URL}/locate-neighbourhood?q=${lat},${lon}`);
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

/**
 * Discover unique police neighbourhoods by sampling points.
 * @param {Array<{lat: number, lon: number}>} points
 * @param {number} maxConcurrent
 * @returns {Promise<Array<{id: string, force: string, name: string, boundary: Array, crimeCount: number, categories: Object, density: string}>>}
 */
export async function discoverNeighbourhoods(points, maxConcurrent) {
  const results = [];

  for (let i = 0; i < points.length; i += maxConcurrent) {
    const batch = points.slice(i, i + maxConcurrent);
    const batchResults = await Promise.all(
      batch.map((p) => locateNeighbourhood(p.lat, p.lon))
    );
    results.push(...batchResults.filter(Boolean));
  }

  // Deduplicate by force + neighbourhood ID
  const seen = new Map();
  results.forEach((r) => {
    const key = `${r.force}:${r.neighbourhood}`;
    if (!seen.has(key)) seen.set(key, r);
  });

  return Array.from(seen.values()).map(({ force, neighbourhood }) => ({
    id: neighbourhood,
    force,
    name: '',
    boundary: [],
    crimeCount: 0,
    categories: {},
    density: 'low',
  }));
}

/**
 * Fetch boundary polygon and name for each neighbourhood.
 * @param {Array} neighbourhoods
 * @param {number} maxConcurrent
 */
export async function enrichNeighbourhoods(neighbourhoods, maxConcurrent) {
  for (let i = 0; i < neighbourhoods.length; i += maxConcurrent) {
    const batch = neighbourhoods.slice(i, i + maxConcurrent);
    await Promise.all(batch.map(async (n) => {
      try {
        const [boundaryRes, detailRes] = await Promise.all([
          fetch(`${POLICE_API_URL}/${n.force}/${n.id}/boundary`),
          fetch(`${POLICE_API_URL}/${n.force}/${n.id}`),
        ]);

        if (boundaryRes.ok) {
          const points = await boundaryRes.json();
          n.boundary = points.map((p) => [parseFloat(p.latitude), parseFloat(p.longitude)]);
        }

        if (detailRes.ok) {
          const data = await detailRes.json();
          n.name = data.name || '';
        }
      } catch {
        // Skip neighbourhoods that fail
      }
    }));
  }
}

/**
 * Fetch street-level crimes within each neighbourhood's boundary.
 * @param {Array} neighbourhoods - Must already have boundary populated.
 * @param {number} maxConcurrent
 */
export async function fetchAllNeighbourhoodCrimes(neighbourhoods, maxConcurrent) {
  for (let i = 0; i < neighbourhoods.length; i += maxConcurrent) {
    const batch = neighbourhoods.slice(i, i + maxConcurrent);
    await Promise.all(batch.map(async (n) => {
      if (n.boundary.length < 3) return;

      const polyString = n.boundary.map(([lat, lon]) => `${lat},${lon}`).join(':');
      try {
        const response = await fetch(`${POLICE_API_URL}/crimes-street/all-crime`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ poly: polyString }).toString(),
        });

        if (!response.ok) return;

        const crimes = await response.json();
        n.crimeCount = crimes.length;
        crimes.forEach((crime) => {
          const cat = crime.category || 'unknown';
          n.categories[cat] = (n.categories[cat] || 0) + 1;
        });
      } catch {
        // Skip on error — crimeCount stays 0
      }
    }));
  }
}

/**
 * Classify a neighbourhood's crime density for visual display.
 * @param {number} count - Number of crimes.
 * @param {number} maxCount - Maximum count across all neighbourhoods.
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
