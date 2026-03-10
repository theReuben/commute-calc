import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock leaflet — vi.mock factory is hoisted so all values must be defined inline
vi.mock('leaflet', () => {
  const mockOn = vi.fn();
  const mockMarker = {
    setLatLng: vi.fn(),
    bindPopup: vi.fn().mockReturnValue({ openPopup: vi.fn() }),
    getLatLng: vi.fn().mockReturnValue({ lat: 51.5, lng: -0.1 }),
    addTo: vi.fn().mockReturnThis(),
    on: mockOn,
  };

  const mockLayerGroup = {
    clearLayers: vi.fn(),
    getBounds: vi.fn().mockReturnValue({ isValid: () => false }),
    addTo: vi.fn().mockReturnThis(),
  };

  return {
    default: {
      map: vi.fn().mockReturnValue({
        setView: vi.fn().mockReturnThis(),
        on: vi.fn(),
        getZoom: vi.fn().mockReturnValue(13),
        fitBounds: vi.fn(),
      }),
      tileLayer: vi.fn().mockReturnValue({ addTo: vi.fn() }),
      marker: vi.fn().mockReturnValue(mockMarker),
      layerGroup: vi.fn().mockReturnValue(mockLayerGroup),
      geoJSON: vi.fn().mockReturnValue({ addTo: vi.fn() }),
      _mockMarker: mockMarker,
      _mockLayerGroup: mockLayerGroup,
    },
  };
});

import L from 'leaflet';
import { createMap } from '../src/map.js';

describe('map', () => {
  let mapInstance;
  let mockMarker;
  let mockLayerGroup;

  beforeEach(() => {
    // Access the shared mock objects
    mockMarker = L._mockMarker;
    mockLayerGroup = L._mockLayerGroup;

    // Reset mock state
    vi.clearAllMocks();
    mockMarker.addTo.mockReturnValue(mockMarker);
    mockMarker.bindPopup.mockReturnValue({ openPopup: vi.fn() });
    mockMarker.getLatLng.mockReturnValue({ lat: 51.5, lng: -0.1 });

    mockLayerGroup.addTo.mockReturnValue(mockLayerGroup);

    document.body.innerHTML = '<div id="map"></div>';
    mapInstance = createMap('map');
  });

  describe('setWorkLocation', () => {
    it('creates a marker and returns it', () => {
      const marker = mapInstance.setWorkLocation(51.5, -0.1);
      expect(marker).toBeDefined();
    });

    it('moves existing marker on second call', () => {
      mapInstance.setWorkLocation(51.5, -0.1);
      mapInstance.setWorkLocation(52.0, -0.2);
      expect(mockMarker.setLatLng).toHaveBeenCalledWith([52.0, -0.2]);
    });

    it('escapes HTML in label to prevent XSS', () => {
      mapInstance.setWorkLocation(51.5, -0.1, '<script>alert("xss")</script>');
      const popupArg = mockMarker.bindPopup.mock.calls[0][0];
      expect(popupArg).not.toContain('<script>');
      expect(popupArg).toContain('&lt;script&gt;');
    });

    it('uses coordinate text when no label provided', () => {
      mapInstance.setWorkLocation(51.505, -0.09);
      const popupArg = mockMarker.bindPopup.mock.calls[0][0];
      expect(popupArg).toContain('Work Location');
      expect(popupArg).toContain('51.50500');
    });
  });

  describe('getWorkLocation', () => {
    it('returns null when no marker is set', () => {
      expect(mapInstance.getWorkLocation()).toBeNull();
    });

    it('returns lat/lon after setting work location', () => {
      mapInstance.setWorkLocation(51.5, -0.1);
      const loc = mapInstance.getWorkLocation();
      expect(loc).toEqual({ lat: 51.5, lon: -0.1 });
    });
  });

  describe('clearIsochrones', () => {
    it('clears the isochrone layer', () => {
      mapInstance.clearIsochrones();
      expect(mockLayerGroup.clearLayers).toHaveBeenCalled();
    });
  });

  describe('onMapClick', () => {
    it('registers a click handler on the map', () => {
      const callback = vi.fn();
      mapInstance.onMapClick(callback);
      // The map's on method should be called by the map instance (from createMap)
      // It's called via map.on('click', ...)
      expect(mapInstance.map.on).toHaveBeenCalledWith('click', expect.any(Function));
    });
  });

  describe('onMarkerDrag', () => {
    it('stores the callback and fires it on dragend', () => {
      const dragCallback = vi.fn();
      mapInstance.onMarkerDrag(dragCallback);

      // Create marker, which registers the dragend listener
      mapInstance.setWorkLocation(51.5, -0.1);

      // Find the dragend handler that was registered on the marker
      const dragendCall = mockMarker.on.mock.calls.find((c) => c[0] === 'dragend');
      expect(dragendCall).toBeDefined();

      // Simulate dragend event
      dragendCall[1]();
      expect(dragCallback).toHaveBeenCalledWith(51.5, -0.1);
    });

    it('works when callback is set after marker creation', () => {
      mapInstance.setWorkLocation(51.5, -0.1);

      const dragCallback = vi.fn();
      mapInstance.onMarkerDrag(dragCallback);

      // Fire the dragend handler
      const dragendCall = mockMarker.on.mock.calls.find((c) => c[0] === 'dragend');
      dragendCall[1]();
      expect(dragCallback).toHaveBeenCalledWith(51.5, -0.1);
    });
  });

  describe('showIsochrones', () => {
    it('clears existing isochrones before adding new ones', () => {
      const geojson = {
        features: [
          { properties: { value: 600 }, type: 'Feature', geometry: { type: 'Polygon', coordinates: [] } },
        ],
      };
      mapInstance.showIsochrones(geojson);
      expect(mockLayerGroup.clearLayers).toHaveBeenCalled();
    });
  });
});
