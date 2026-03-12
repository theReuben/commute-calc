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

  const mockCrimeLayerGroup = {
    clearLayers: vi.fn(),
    addTo: vi.fn().mockReturnThis(),
  };

  const mockPolygon = {
    addTo: vi.fn().mockReturnThis(),
    bindPopup: vi.fn().mockReturnThis(),
    bindTooltip: vi.fn().mockReturnThis(),
  };

  const mockControl = {
    addTo: vi.fn().mockReturnThis(),
    remove: vi.fn(),
    onAdd: null,
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
      featureGroup: vi.fn().mockReturnValue(mockLayerGroup),
      layerGroup: vi.fn().mockReturnValue(mockCrimeLayerGroup),
      geoJSON: vi.fn().mockReturnValue({ addTo: vi.fn() }),
      polygon: vi.fn().mockReturnValue(mockPolygon),
      control: vi.fn().mockReturnValue(mockControl),
      _mockMarker: mockMarker,
      _mockLayerGroup: mockLayerGroup,
      _mockCrimeLayerGroup: mockCrimeLayerGroup,
      _mockPolygon: mockPolygon,
      _mockControl: mockControl,
    },
  };
});

import L from 'leaflet';
import { createMap } from '../src/map.js';

describe('map', () => {
  let mapInstance;
  let mockMarker;
  let mockLayerGroup;
  let mockCrimeLayerGroup;
  let mockPolygon;
  let mockControl;

  beforeEach(() => {
    // Access the shared mock objects
    mockMarker = L._mockMarker;
    mockLayerGroup = L._mockLayerGroup;
    mockCrimeLayerGroup = L._mockCrimeLayerGroup;
    mockPolygon = L._mockPolygon;
    mockControl = L._mockControl;

    // Reset mock state
    vi.clearAllMocks();
    mockMarker.addTo.mockReturnValue(mockMarker);
    mockMarker.bindPopup.mockReturnValue({ openPopup: vi.fn() });
    mockMarker.getLatLng.mockReturnValue({ lat: 51.5, lng: -0.1 });

    mockLayerGroup.addTo.mockReturnValue(mockLayerGroup);
    mockCrimeLayerGroup.addTo.mockReturnValue(mockCrimeLayerGroup);
    mockPolygon.addTo.mockReturnValue(mockPolygon);
    mockPolygon.bindPopup.mockReturnValue(mockPolygon);
    mockPolygon.bindTooltip.mockReturnValue(mockPolygon);
    mockControl.addTo.mockReturnValue(mockControl);
    L.featureGroup.mockReturnValue(mockLayerGroup);
    L.layerGroup.mockReturnValue(mockCrimeLayerGroup);

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
      expect(mapInstance.map.on).toHaveBeenCalledWith('click', expect.any(Function));
    });
  });

  describe('onMarkerDrag', () => {
    it('stores the callback and fires it on dragend', () => {
      const dragCallback = vi.fn();
      mapInstance.onMarkerDrag(dragCallback);

      mapInstance.setWorkLocation(51.5, -0.1);

      const dragendCall = mockMarker.on.mock.calls.find((c) => c[0] === 'dragend');
      expect(dragendCall).toBeDefined();

      dragendCall[1]();
      expect(dragCallback).toHaveBeenCalledWith(51.5, -0.1);
    });

    it('works when callback is set after marker creation', () => {
      mapInstance.setWorkLocation(51.5, -0.1);

      const dragCallback = vi.fn();
      mapInstance.onMarkerDrag(dragCallback);

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

  describe('showCrimeOverlay', () => {
    const makeNeighbourhood = (overrides = {}) => ({
      name: 'Test Ward',
      boundary: [[51.5, -0.1], [51.6, -0.1], [51.6, -0.2], [51.5, -0.2]],
      crimeCount: 5,
      density: 'low',
      categories: { burglary: 3, theft: 2 },
      ...overrides,
    });

    it('creates a polygon for each neighbourhood', () => {
      const neighbourhoods = [
        makeNeighbourhood({ name: 'Ward A', density: 'low' }),
        makeNeighbourhood({ name: 'Ward B', density: 'high' }),
      ];
      const colorMap = {
        low: { fillColor: '#2b8a3e', color: '#1b5e20' },
        high: { fillColor: '#e03131', color: '#c92a2a' },
      };
      mapInstance.showCrimeOverlay(neighbourhoods, colorMap);
      expect(L.polygon).toHaveBeenCalledTimes(2);
      expect(mockPolygon.bindPopup).toHaveBeenCalledTimes(2);
      expect(mockPolygon.bindTooltip).toHaveBeenCalledTimes(2);
    });

    it('clears existing crime layers before adding new ones', () => {
      mapInstance.showCrimeOverlay([], {});
      expect(mockCrimeLayerGroup.clearLayers).toHaveBeenCalled();
    });

    it('passes boundary coordinates to L.polygon', () => {
      const boundary = [[51.5, -0.1], [51.6, -0.1], [51.6, -0.2]];
      mapInstance.showCrimeOverlay(
        [makeNeighbourhood({ boundary })],
        { low: { fillColor: '#2b8a3e', color: '#1b5e20' } }
      );
      expect(L.polygon).toHaveBeenCalledWith(boundary, expect.any(Object));
    });

    it('includes neighbourhood name and crime count in popup', () => {
      mapInstance.showCrimeOverlay(
        [makeNeighbourhood({ name: 'Westminster', crimeCount: 42 })],
        { low: { fillColor: '#2b8a3e', color: '#1b5e20' } }
      );
      const popupHtml = mockPolygon.bindPopup.mock.calls[0][0];
      expect(popupHtml).toContain('Westminster');
      expect(popupHtml).toContain('42 crimes');
    });

    it('shows all categories in popup', () => {
      mapInstance.showCrimeOverlay(
        [makeNeighbourhood({ categories: { burglary: 4, theft: 3, 'anti-social-behaviour': 2 } })],
        { low: { fillColor: '#2b8a3e', color: '#1b5e20' } }
      );
      const popupHtml = mockPolygon.bindPopup.mock.calls[0][0];
      expect(popupHtml).toContain('Burglary: 4');
      expect(popupHtml).toContain('Theft: 3');
      expect(popupHtml).toContain('Anti Social Behaviour: 2');
    });

    it('shows neighbourhood name and count in tooltip', () => {
      mapInstance.showCrimeOverlay(
        [makeNeighbourhood({ name: 'Camden Town', crimeCount: 8 })],
        { low: { fillColor: '#2b8a3e', color: '#1b5e20' } }
      );
      const tooltipText = mockPolygon.bindTooltip.mock.calls[0][0];
      expect(tooltipText).toContain('Camden Town');
      expect(tooltipText).toContain('8 crimes');
    });

    it('uses sticky tooltip', () => {
      mapInstance.showCrimeOverlay(
        [makeNeighbourhood()],
        { low: { fillColor: '#2b8a3e', color: '#1b5e20' } }
      );
      const tooltipOpts = mockPolygon.bindTooltip.mock.calls[0][1];
      expect(tooltipOpts.sticky).toBe(true);
    });

    it('escapes HTML in neighbourhood name to prevent XSS', () => {
      mapInstance.showCrimeOverlay(
        [makeNeighbourhood({ name: '<script>xss</script>' })],
        { low: { fillColor: '#2b8a3e', color: '#1b5e20' } }
      );
      const popupHtml = mockPolygon.bindPopup.mock.calls[0][0];
      expect(popupHtml).not.toContain('<script>');
      const tooltipText = mockPolygon.bindTooltip.mock.calls[0][0];
      expect(tooltipText).not.toContain('<script>');
    });

    it('uses singular "crime" for count of 1', () => {
      mapInstance.showCrimeOverlay(
        [makeNeighbourhood({ crimeCount: 1 })],
        { low: { fillColor: '#2b8a3e', color: '#1b5e20' } }
      );
      const tooltipText = mockPolygon.bindTooltip.mock.calls[0][0];
      expect(tooltipText).toContain('1 crime');
      expect(tooltipText).not.toContain('1 crimes');
    });

    it('skips neighbourhoods with fewer than 3 boundary points', () => {
      mapInstance.showCrimeOverlay(
        [makeNeighbourhood({ boundary: [[51.5, -0.1], [51.6, -0.2]] })],
        { low: { fillColor: '#2b8a3e', color: '#1b5e20' } }
      );
      expect(L.polygon).not.toHaveBeenCalled();
    });

    it('uses "Unknown area" when name is empty', () => {
      mapInstance.showCrimeOverlay(
        [makeNeighbourhood({ name: '' })],
        { low: { fillColor: '#2b8a3e', color: '#1b5e20' } }
      );
      const popupHtml = mockPolygon.bindPopup.mock.calls[0][0];
      expect(popupHtml).toContain('Unknown area');
    });
  });

  describe('clearCrimeOverlay', () => {
    it('clears the crime layer', () => {
      mapInstance.clearCrimeOverlay();
      expect(mockCrimeLayerGroup.clearLayers).toHaveBeenCalled();
    });
  });

  describe('showCrimeMapLegend', () => {
    const colorMap = {
      low: { fillColor: '#2b8a3e', color: '#1b5e20', label: 'Low crime' },
      medium: { fillColor: '#f59f00', color: '#e67700', label: 'Medium crime' },
      high: { fillColor: '#e03131', color: '#c92a2a', label: 'High crime' },
      'very-high': { fillColor: '#7b2d8e', color: '#5c0a72', label: 'Very high crime' },
    };

    it('adds a control to the map at bottom-right', () => {
      mapInstance.showCrimeMapLegend(colorMap);
      expect(L.control).toHaveBeenCalledWith({ position: 'bottomright' });
      expect(mockControl.addTo).toHaveBeenCalled();
    });

    it('removes existing control before adding a new one', () => {
      mapInstance.showCrimeMapLegend(colorMap);
      mapInstance.showCrimeMapLegend(colorMap);
      expect(mockControl.remove).toHaveBeenCalledTimes(1);
    });

    it('renders an item for each density level', () => {
      mapInstance.showCrimeMapLegend(colorMap);
      const container = mockControl.onAdd();
      expect(container.querySelectorAll('.crime-legend-item').length).toBe(4);
    });

    it('includes the correct labels in the rendered legend', () => {
      mapInstance.showCrimeMapLegend(colorMap);
      const container = mockControl.onAdd();
      expect(container.textContent).toContain('Low crime');
      expect(container.textContent).toContain('Medium crime');
      expect(container.textContent).toContain('High crime');
      expect(container.textContent).toContain('Very high crime');
    });
  });

  describe('clearCrimeMapLegend', () => {
    it('removes the control when one exists', () => {
      const colorMap = { low: { fillColor: '#2b8a3e', color: '#1b5e20', label: 'Low crime' } };
      mapInstance.showCrimeMapLegend(colorMap);
      mapInstance.clearCrimeMapLegend();
      expect(mockControl.remove).toHaveBeenCalled();
    });

    it('does nothing when no control is active', () => {
      expect(() => mapInstance.clearCrimeMapLegend()).not.toThrow();
    });
  });
});
