/**
 * Color configuration for commute time intervals.
 * Colors progress from green (short commute) to purple (long commute).
 */
export const TIME_COLORS = {
  10: { color: '#2b8a3e', fillColor: '#69db7c', label: '10 minutes' },
  20: { color: '#e67700', fillColor: '#ffd43b', label: '20 minutes' },
  30: { color: '#d9480f', fillColor: '#ff922b', label: '30 minutes' },
  45: { color: '#c92a2a', fillColor: '#ff6b6b', label: '45 minutes' },
  60: { color: '#862e9c', fillColor: '#da77f2', label: '60 minutes' },
};

/**
 * Transport mode configuration with display labels.
 * Uses Geoapify profile names for the Isoline API.
 */
export const TRANSPORT_MODES = {
  'drive': { label: 'Car', emoji: '🚗' },
  'transit': { label: 'Public Transport', emoji: '🚌' },
  'bicycle': { label: 'Cycling', emoji: '🚲' },
  'walk': { label: 'Walking', emoji: '🚶' },
};

/** Default map center (London, UK) */
export const DEFAULT_CENTER = [51.505, -0.09];

/** Default map zoom level */
export const DEFAULT_ZOOM = 13;

/** Geoapify Isoline API URL */
export const GEOAPIFY_ISOLINE_URL = 'https://api.geoapify.com/v1/isoline';

/** Nominatim geocoding API URL */
export const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
