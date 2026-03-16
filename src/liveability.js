import { getFeatureMinutes } from './isochrone.js';

/**
 * Default weights for liveability score components.
 * Each weight is 0–1 and they should sum to 1.
 */
export const DEFAULT_WEIGHTS = {
  commute: 0.5,
  crime: 0.5,
};

/**
 * Commute score by isochrone band (minutes → 0–1 score, higher = more liveable).
 */
const COMMUTE_SCORES = {
  10: 1.0,
  20: 0.8,
  30: 0.6,
  45: 0.4,
  60: 0.2,
};

/**
 * Test if a point is inside a polygon ring using ray-casting algorithm.
 * Coordinates are [lon, lat] (GeoJSON order).
 * @param {number} lon
 * @param {number} lat
 * @param {Array<[number, number]>} ring - Array of [lon, lat] coordinate pairs.
 * @returns {boolean}
 */
export function pointInRing(lon, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    const intersect = ((yi > lat) !== (yj > lat)) &&
      (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Test if a point is inside a GeoJSON Polygon or MultiPolygon geometry.
 * Handles holes (interior rings) correctly.
 * @param {number} lon
 * @param {number} lat
 * @param {Object} geometry - GeoJSON geometry object.
 * @returns {boolean}
 */
export function pointInGeometry(lon, lat, geometry) {
  if (geometry.type === 'Polygon') {
    return pointInPolygonRings(lon, lat, geometry.coordinates);
  }
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.some((polyCoords) =>
      pointInPolygonRings(lon, lat, polyCoords)
    );
  }
  return false;
}

/**
 * Test if a point is inside a polygon defined by rings (outer + optional holes).
 * @param {number} lon
 * @param {number} lat
 * @param {Array<Array<[number, number]>>} rings - [outerRing, ...holeRings]
 * @returns {boolean}
 */
function pointInPolygonRings(lon, lat, rings) {
  // Must be inside the outer ring
  if (!pointInRing(lon, lat, rings[0])) return false;
  // Must not be inside any hole
  for (let i = 1; i < rings.length; i++) {
    if (pointInRing(lon, lat, rings[i])) return false;
  }
  return true;
}

/**
 * Determine the commute score for a point based on isochrone features.
 * Returns the score for the smallest (shortest time) isochrone that contains the point.
 * Points outside all isochrones return 0.
 *
 * @param {number} lon
 * @param {number} lat
 * @param {Array<Object>} sortedFeatures - Isochrone features sorted by time ascending.
 * @returns {number} Score 0–1 (higher = shorter commute = more liveable).
 */
export function getCommuteScore(lon, lat, sortedFeatures) {
  for (const feature of sortedFeatures) {
    if (pointInGeometry(lon, lat, feature.geometry)) {
      const minutes = getFeatureMinutes(feature);
      return COMMUTE_SCORES[minutes] || 0.2;
    }
  }
  return 0;
}

/**
 * Build a liveability grid from isochrone GeoJSON and crime data.
 *
 * @param {Object} params
 * @param {Object} params.geojson - Isochrone GeoJSON FeatureCollection.
 * @param {Array<{category: string, lat: number, lon: number}>} params.crimes - Crime records.
 * @param {number} [params.precision=2] - Grid precision (decimal places for rounding).
 * @param {{commute: number, crime: number}} [params.weights] - Scoring weights.
 * @returns {Array<{lat: number, lon: number, score: number, commuteScore: number, crimeScore: number, crimeCount: number}>}
 */
export function buildLiveabilityGrid({ geojson, crimes, precision = 2, weights = DEFAULT_WEIGHTS }) {
  if (!geojson || !geojson.features || geojson.features.length === 0) return [];

  // Sort features by time ascending (smallest/shortest first) for commute scoring
  const sortedFeatures = [...geojson.features].sort((a, b) => {
    return (a.properties?.value || 0) - (b.properties?.value || 0);
  });

  // Get bounding box of outermost isochrone
  const outerFeature = geojson.features.reduce((outer, f) => {
    return (f.properties?.value || 0) > (outer.properties?.value || 0) ? f : outer;
  }, geojson.features[0]);

  const bbox = getBBoxFromFeature(outerFeature);
  if (!bbox) return [];

  const factor = Math.pow(10, precision);
  const step = 1 / factor;

  // Build crime density lookup
  const crimeGrid = new Map();
  for (const crime of crimes) {
    const key = `${Math.round(crime.lat * factor)}:${Math.round(crime.lon * factor)}`;
    crimeGrid.set(key, (crimeGrid.get(key) || 0) + 1);
  }
  const maxCrime = Math.max(1, ...crimeGrid.values());

  // Build liveability grid
  const cells = [];
  for (let lat = bbox.minLat; lat <= bbox.maxLat; lat += step) {
    for (let lon = bbox.minLon; lon <= bbox.maxLon; lon += step) {
      const roundedLat = Math.round(lat * factor) / factor;
      const roundedLon = Math.round(lon * factor) / factor;

      const commuteScore = getCommuteScore(roundedLon, roundedLat, sortedFeatures);
      if (commuteScore === 0) continue; // Outside all isochrones

      const crimeKey = `${Math.round(roundedLat * factor)}:${Math.round(roundedLon * factor)}`;
      const crimeCount = crimeGrid.get(crimeKey) || 0;
      // Crime score: 1 = no crime (best), 0 = max crime (worst)
      const crimeScore = 1 - (crimeCount / maxCrime);

      const score = (weights.commute * commuteScore) + (weights.crime * crimeScore);

      cells.push({
        lat: roundedLat,
        lon: roundedLon,
        score,
        commuteScore,
        crimeScore,
        crimeCount,
      });
    }
  }

  return cells;
}

/**
 * Classify a liveability score into a display level.
 * @param {number} score - Liveability score 0–1.
 * @returns {'excellent'|'good'|'fair'|'poor'}
 */
export function classifyLiveability(score) {
  if (score >= 0.75) return 'excellent';
  if (score >= 0.5) return 'good';
  if (score >= 0.25) return 'fair';
  return 'poor';
}

/**
 * Build a multi-location liveability grid.
 * Each cell is scored based on commute to ALL locations — only cells reachable
 * from every location are included.
 *
 * @param {Object} params
 * @param {Array<{geojson: Object, name: string}>} params.locationData - Per-location isochrone data.
 * @param {Array<{category: string, lat: number, lon: number}>} params.crimes - Crime records.
 * @param {number} [params.precision=2] - Grid precision.
 * @param {{commute: number, crime: number}} [params.weights] - Scoring weights.
 * @returns {Array<{lat: number, lon: number, score: number, commuteScore: number, crimeScore: number, crimeCount: number, perLocation: Array<{name: string, commuteScore: number}>}>}
 */
export function buildMultiLocationGrid({ locationData, crimes, precision = 2, weights = DEFAULT_WEIGHTS }) {
  if (!locationData || locationData.length === 0) return [];

  // Prepare sorted features per location
  const perLocation = locationData.map((loc) => {
    const sorted = [...(loc.geojson.features || [])].sort((a, b) =>
      (a.properties?.value || 0) - (b.properties?.value || 0)
    );
    return { name: loc.name, features: sorted };
  });

  // Compute combined bounding box from all locations' outermost isochrones
  let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
  for (const loc of locationData) {
    if (!loc.geojson.features || loc.geojson.features.length === 0) continue;
    const outerFeature = loc.geojson.features.reduce((outer, f) =>
      (f.properties?.value || 0) > (outer.properties?.value || 0) ? f : outer,
      loc.geojson.features[0]
    );
    const bbox = getBBoxFromFeature(outerFeature);
    if (!bbox) continue;
    if (bbox.minLat < minLat) minLat = bbox.minLat;
    if (bbox.maxLat > maxLat) maxLat = bbox.maxLat;
    if (bbox.minLon < minLon) minLon = bbox.minLon;
    if (bbox.maxLon > maxLon) maxLon = bbox.maxLon;
  }
  if (!isFinite(minLat)) return [];

  const factor = Math.pow(10, precision);
  const step = 1 / factor;

  // Build crime density lookup
  const crimeGrid = new Map();
  for (const crime of crimes) {
    const key = `${Math.round(crime.lat * factor)}:${Math.round(crime.lon * factor)}`;
    crimeGrid.set(key, (crimeGrid.get(key) || 0) + 1);
  }
  const maxCrime = Math.max(1, ...crimeGrid.values());

  const cells = [];
  for (let lat = minLat; lat <= maxLat; lat += step) {
    for (let lon = minLon; lon <= maxLon; lon += step) {
      const roundedLat = Math.round(lat * factor) / factor;
      const roundedLon = Math.round(lon * factor) / factor;

      // Get commute score for each location; skip if any returns 0 (unreachable)
      const scores = [];
      let reachableFromAll = true;
      for (const loc of perLocation) {
        const score = getCommuteScore(roundedLon, roundedLat, loc.features);
        if (score === 0) { reachableFromAll = false; break; }
        scores.push({ name: loc.name, commuteScore: score });
      }
      if (!reachableFromAll) continue;

      // Combined commute score is the average across all locations
      const commuteScore = scores.reduce((sum, s) => sum + s.commuteScore, 0) / scores.length;

      const crimeKey = `${Math.round(roundedLat * factor)}:${Math.round(roundedLon * factor)}`;
      const crimeCount = crimeGrid.get(crimeKey) || 0;
      const crimeScore = 1 - (crimeCount / maxCrime);
      const score = (weights.commute * commuteScore) + (weights.crime * crimeScore);

      cells.push({
        lat: roundedLat,
        lon: roundedLon,
        score,
        commuteScore,
        crimeScore,
        crimeCount,
        perLocation: scores,
      });
    }
  }

  return cells;
}

/**
 * Compute the bounding box from a GeoJSON feature.
 * @param {Object} feature
 * @returns {{minLat: number, maxLat: number, minLon: number, maxLon: number}|null}
 */
function getBBoxFromFeature(feature) {
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
