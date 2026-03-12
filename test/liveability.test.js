import { describe, it, expect } from 'vitest';
import {
  pointInRing,
  pointInGeometry,
  getCommuteScore,
  buildLiveabilityGrid,
  classifyLiveability,
} from '../src/liveability.js';

describe('liveability', () => {
  describe('pointInRing', () => {
    const square = [
      [-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1],
    ];

    it('returns true for a point inside the ring', () => {
      expect(pointInRing(0, 0, square)).toBe(true);
    });

    it('returns false for a point outside the ring', () => {
      expect(pointInRing(2, 2, square)).toBe(false);
    });

    it('returns false for a point far outside', () => {
      expect(pointInRing(10, 10, square)).toBe(false);
    });
  });

  describe('pointInGeometry', () => {
    it('works with Polygon geometry', () => {
      const geometry = {
        type: 'Polygon',
        coordinates: [[[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]]],
      };
      expect(pointInGeometry(0, 0, geometry)).toBe(true);
      expect(pointInGeometry(2, 2, geometry)).toBe(false);
    });

    it('works with MultiPolygon geometry', () => {
      const geometry = {
        type: 'MultiPolygon',
        coordinates: [
          [[[-1, -1], [0, -1], [0, 0], [-1, 0], [-1, -1]]],
          [[[1, 1], [2, 1], [2, 2], [1, 2], [1, 1]]],
        ],
      };
      expect(pointInGeometry(-0.5, -0.5, geometry)).toBe(true);
      expect(pointInGeometry(1.5, 1.5, geometry)).toBe(true);
      expect(pointInGeometry(0.5, 0.5, geometry)).toBe(false);
    });

    it('returns false for unsupported geometry types', () => {
      expect(pointInGeometry(0, 0, { type: 'Point', coordinates: [0, 0] })).toBe(false);
    });

    it('handles polygon with holes', () => {
      const geometry = {
        type: 'Polygon',
        coordinates: [
          [[-2, -2], [2, -2], [2, 2], [-2, 2], [-2, -2]],   // outer
          [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5], [-0.5, 0.5]], // hole
        ],
      };
      // Inside outer, outside hole
      expect(pointInGeometry(1.5, 1.5, geometry)).toBe(true);
      // Inside hole → should be false
      expect(pointInGeometry(0, 0, geometry)).toBe(false);
    });
  });

  describe('getCommuteScore', () => {
    const features = [
      {
        properties: { value: 600 },  // 10 min
        geometry: { type: 'Polygon', coordinates: [[[-0.01, -0.01], [0.01, -0.01], [0.01, 0.01], [-0.01, 0.01], [-0.01, -0.01]]] },
      },
      {
        properties: { value: 1200 }, // 20 min
        geometry: { type: 'Polygon', coordinates: [[[-0.02, -0.02], [0.02, -0.02], [0.02, 0.02], [-0.02, 0.02], [-0.02, -0.02]]] },
      },
      {
        properties: { value: 1800 }, // 30 min
        geometry: { type: 'Polygon', coordinates: [[[-0.05, -0.05], [0.05, -0.05], [0.05, 0.05], [-0.05, 0.05], [-0.05, -0.05]]] },
      },
    ];

    it('returns 1.0 for a point in the 10-minute zone', () => {
      expect(getCommuteScore(0, 0, features)).toBe(1.0);
    });

    it('returns 0.8 for a point in the 20-minute zone only', () => {
      expect(getCommuteScore(0.015, 0.015, features)).toBe(0.8);
    });

    it('returns 0.6 for a point in the 30-minute zone only', () => {
      expect(getCommuteScore(0.04, 0.04, features)).toBe(0.6);
    });

    it('returns 0 for a point outside all zones', () => {
      expect(getCommuteScore(1, 1, features)).toBe(0);
    });
  });

  describe('classifyLiveability', () => {
    it('returns excellent for high scores', () => {
      expect(classifyLiveability(0.9)).toBe('excellent');
      expect(classifyLiveability(0.75)).toBe('excellent');
    });

    it('returns good for medium-high scores', () => {
      expect(classifyLiveability(0.6)).toBe('good');
      expect(classifyLiveability(0.5)).toBe('good');
    });

    it('returns fair for medium-low scores', () => {
      expect(classifyLiveability(0.4)).toBe('fair');
      expect(classifyLiveability(0.25)).toBe('fair');
    });

    it('returns poor for low scores', () => {
      expect(classifyLiveability(0.1)).toBe('poor');
      expect(classifyLiveability(0)).toBe('poor');
    });
  });

  describe('buildLiveabilityGrid', () => {
    const geojson = {
      features: [{
        properties: { value: 1800 }, // 30 min
        geometry: {
          type: 'Polygon',
          coordinates: [[[-0.1, 51.4], [0.1, 51.4], [0.1, 51.6], [-0.1, 51.6], [-0.1, 51.4]]],
        },
      }],
    };

    it('returns grid cells within the isochrone area', () => {
      const grid = buildLiveabilityGrid({ geojson, crimes: [], precision: 1 });
      expect(grid.length).toBeGreaterThan(0);
      grid.forEach((cell) => {
        expect(cell).toHaveProperty('score');
        expect(cell).toHaveProperty('commuteScore');
        expect(cell).toHaveProperty('crimeScore');
        expect(cell).toHaveProperty('crimeCount');
        expect(cell.score).toBeGreaterThan(0);
        expect(cell.score).toBeLessThanOrEqual(1);
      });
    });

    it('reduces scores in cells with crime', () => {
      const crimes = [
        { category: 'theft', lat: 51.5, lon: 0.0 },
        { category: 'theft', lat: 51.5, lon: 0.0 },
        { category: 'theft', lat: 51.5, lon: 0.0 },
      ];
      const gridNoCrime = buildLiveabilityGrid({ geojson, crimes: [], precision: 1 });
      const gridWithCrime = buildLiveabilityGrid({ geojson, crimes, precision: 1 });

      // The cell containing the crimes should have a lower score
      const crimeCell = gridWithCrime.find((c) => c.crimeCount > 0);
      const sameNoCrime = gridNoCrime.find((c) => c.lat === crimeCell?.lat && c.lon === crimeCell?.lon);
      if (crimeCell && sameNoCrime) {
        expect(crimeCell.score).toBeLessThan(sameNoCrime.score);
      }
    });

    it('returns empty array for empty geojson', () => {
      expect(buildLiveabilityGrid({ geojson: { features: [] }, crimes: [] })).toEqual([]);
      expect(buildLiveabilityGrid({ geojson: null, crimes: [] })).toEqual([]);
    });

    it('respects custom weights', () => {
      const crimes = [{ category: 'theft', lat: 51.5, lon: 0.0 }];
      const commuteOnly = buildLiveabilityGrid({
        geojson, crimes, precision: 1,
        weights: { commute: 1, crime: 0 },
      });
      const crimeOnly = buildLiveabilityGrid({
        geojson, crimes, precision: 1,
        weights: { commute: 0, crime: 1 },
      });
      // With commute-only weights, crime shouldn't affect score
      const commCell = commuteOnly.find((c) => c.crimeCount > 0);
      if (commCell) {
        expect(commCell.score).toBe(commCell.commuteScore);
      }
      // With crime-only weights, score should equal crime score
      const crimeCell = crimeOnly.find((c) => c.crimeCount > 0);
      if (crimeCell) {
        expect(crimeCell.score).toBeCloseTo(crimeCell.crimeScore, 5);
      }
    });
  });
});
