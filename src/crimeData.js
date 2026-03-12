import { POLICE_API_URL } from './config.js';

/** Tile size in degrees (~5.5km at UK latitudes). */
const TILE_SIZE = 0.05;

/** Minimum tile size before giving up on subdivision (≈550m). */
const MIN_TILE_SIZE = 0.005;

/** Maximum concurrent Police API requests. */
const MAX_CONCURRENT = 5;

/**
 * Fetch street-level crime data from the UK Police API within an isochrone area.
 * Splits the area into small rectangular tiles to avoid the API's area-size limit.
 *
 * @param {Object} params
 * @param {Object} params.geojson - GeoJSON FeatureCollection (isochrone result).
 * @returns {Promise<Array<{category: string, lat: number, lon: number, month: string, location: string}>>}
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

  const tiles = createTiles(bbox, TILE_SIZE);
  const allCrimes = await fetchCrimesInTiles(tiles, MAX_CONCURRENT);
  return deduplicateCrimes(allCrimes);
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
 * Compute the bounding box of a GeoJSON Polygon or MultiPolygon feature.
 * @param {Object} feature - GeoJSON Feature.
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
 * Split a bounding box into rectangular tiles of a given size.
 * Each tile is a small bbox suitable for a single Police API request.
 * @param {{minLat: number, maxLat: number, minLon: number, maxLon: number}} bbox
 * @param {number} size - Tile size in degrees.
 * @returns {Array<{minLat: number, maxLat: number, minLon: number, maxLon: number}>}
 */
export function createTiles(bbox, size) {
  const tiles = [];
  for (let lat = bbox.minLat; lat < bbox.maxLat; lat += size) {
    for (let lon = bbox.minLon; lon < bbox.maxLon; lon += size) {
      tiles.push({
        minLat: lat,
        maxLat: Math.min(lat + size, bbox.maxLat),
        minLon: lon,
        maxLon: Math.min(lon + size, bbox.maxLon),
      });
    }
  }
  return tiles;
}

/**
 * Convert a tile bounding box to a Police API polygon string.
 * @param {{minLat: number, maxLat: number, minLon: number, maxLon: number}} tile
 * @returns {string} Polygon string in "lat,lon:lat,lon:..." format.
 */
export function tileToPolyString(tile) {
  return [
    `${tile.minLat},${tile.minLon}`,
    `${tile.maxLat},${tile.minLon}`,
    `${tile.maxLat},${tile.maxLon}`,
    `${tile.minLat},${tile.maxLon}`,
  ].join(':');
}

/**
 * Split a single tile into 4 equal sub-tiles.
 * @param {{minLat: number, maxLat: number, minLon: number, maxLon: number}} tile
 * @returns {Array<{minLat: number, maxLat: number, minLon: number, maxLon: number}>}
 */
export function subdivideTile(tile) {
  const midLat = (tile.minLat + tile.maxLat) / 2;
  const midLon = (tile.minLon + tile.maxLon) / 2;
  return [
    { minLat: tile.minLat, maxLat: midLat, minLon: tile.minLon, maxLon: midLon },
    { minLat: tile.minLat, maxLat: midLat, minLon: midLon, maxLon: tile.maxLon },
    { minLat: midLat, maxLat: tile.maxLat, minLon: tile.minLon, maxLon: midLon },
    { minLat: midLat, maxLat: tile.maxLat, minLon: midLon, maxLon: tile.maxLon },
  ];
}

/**
 * Fetch crime data for a single tile polygon.
 * On 503 (area too large), subdivides into smaller tiles and retries.
 * Returns an empty array if the request ultimately fails (graceful degradation).
 * @param {{minLat: number, maxLat: number, minLon: number, maxLon: number}} tile
 * @returns {Promise<Array>} Raw crime objects from the API.
 */
async function fetchSingleTile(tile) {
  const polyString = tileToPolyString(tile);
  const response = await fetch(`${POLICE_API_URL}/crimes-street/all-crime`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ poly: polyString }).toString(),
  });

  if (response.status === 503) {
    // Area too large — subdivide and retry if tile is still splittable
    const tileWidth = tile.maxLon - tile.minLon;
    const tileHeight = tile.maxLat - tile.minLat;
    if (tileWidth > MIN_TILE_SIZE || tileHeight > MIN_TILE_SIZE) {
      const subTiles = subdivideTile(tile);
      const subResults = await Promise.all(subTiles.map(fetchSingleTile));
      return subResults.flat();
    }
    return [];
  }

  if (!response.ok) {
    return [];
  }

  return response.json();
}

/**
 * Fetch crimes across all tiles with a concurrency limit.
 * Tiles that return 503 are automatically subdivided and retried.
 * @param {Array} tiles - Array of tile bounding boxes.
 * @param {number} maxConcurrent - Maximum parallel requests.
 * @returns {Promise<Array<{category: string, lat: number, lon: number, month: string, location: string}>>}
 */
export async function fetchCrimesInTiles(tiles, maxConcurrent) {
  const results = [];

  for (let i = 0; i < tiles.length; i += maxConcurrent) {
    const batch = tiles.slice(i, i + maxConcurrent);
    const batchResults = await Promise.all(
      batch.map((tile) => fetchSingleTile(tile))
    );

    for (const crimes of batchResults) {
      for (const crime of crimes) {
        const lat = parseFloat(crime.location?.latitude);
        const lon = parseFloat(crime.location?.longitude);
        if (isNaN(lat) || isNaN(lon)) continue;

        results.push({
          category: crime.category || 'unknown',
          lat,
          lon,
          month: crime.month || '',
          location: crime.location?.street?.name || '',
        });
      }
    }
  }

  return results;
}

/**
 * Remove duplicate crime records that appear in overlapping tiles.
 * Deduplicates by category + lat + lon + month.
 * @param {Array} crimes
 * @returns {Array}
 */
export function deduplicateCrimes(crimes) {
  const seen = new Set();
  return crimes.filter((crime) => {
    const key = `${crime.category}|${crime.lat}|${crime.lon}|${crime.month}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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

/**
 * Map a Leaflet zoom level to an appropriate grid precision for crime aggregation.
 * Lower zoom (zoomed out) uses coarser grids; higher zoom (zoomed in) uses finer grids.
 *
 * @param {number} zoom - Current map zoom level.
 * @returns {number} Decimal places for grid rounding.
 */
export function getGridPrecision(zoom) {
  if (zoom <= 10) return 1;  // ~11km cells
  if (zoom <= 12) return 2;  // ~1.1km cells
  if (zoom <= 14) return 3;  // ~110m cells
  return 4;                   // ~11m cells
}

/** Color scheme for crime density levels. */
export const CRIME_COLORS = {
  'low': { fillColor: '#2b8a3e', color: '#1b5e20', label: 'Low crime' },
  'medium': { fillColor: '#f59f00', color: '#e67700', label: 'Medium crime' },
  'high': { fillColor: '#e03131', color: '#c92a2a', label: 'High crime' },
  'very-high': { fillColor: '#7b2d8e', color: '#5c0a72', label: 'Very high crime' },
};
