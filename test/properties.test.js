import { describe, it, expect } from 'vitest';
import { PROPERTY_PROVIDERS, getPropertySearchLinks } from '../src/properties.js';

describe('properties', () => {
  describe('PROPERTY_PROVIDERS', () => {
    it('has at least one provider', () => {
      expect(PROPERTY_PROVIDERS.length).toBeGreaterThan(0);
    });

    it('each provider has name, emoji, forSale, and toRent', () => {
      PROPERTY_PROVIDERS.forEach((provider) => {
        expect(typeof provider.name).toBe('string');
        expect(typeof provider.emoji).toBe('string');
        expect(typeof provider.forSale).toBe('function');
        expect(typeof provider.toRent).toBe('function');
      });
    });

    it('includes Rightmove, Zoopla, and OnTheMarket', () => {
      const names = PROPERTY_PROVIDERS.map((p) => p.name);
      expect(names).toContain('Rightmove');
      expect(names).toContain('Zoopla');
      expect(names).toContain('OnTheMarket');
    });

    it('generates valid URLs with encoded location', () => {
      const location = 'London SW1A 1AA';
      PROPERTY_PROVIDERS.forEach((provider) => {
        const saleUrl = provider.forSale(location);
        const rentUrl = provider.toRent(location);
        expect(saleUrl).toContain(encodeURIComponent(location));
        expect(rentUrl).toContain(encodeURIComponent(location));
        expect(saleUrl).toMatch(/^https:\/\//);
        expect(rentUrl).toMatch(/^https:\/\//);
      });
    });
  });

  describe('getPropertySearchLinks', () => {
    it('returns links for all providers', () => {
      const links = getPropertySearchLinks('London');
      expect(links.length).toBe(PROPERTY_PROVIDERS.length);
    });

    it('returns buy links by default', () => {
      const links = getPropertySearchLinks('London');
      const rightmoveLink = links.find((l) => l.name === 'Rightmove');
      expect(rightmoveLink.url).toContain('property-for-sale');
    });

    it('returns rent links when specified', () => {
      const links = getPropertySearchLinks('London', 'rent');
      const rightmoveLink = links.find((l) => l.name === 'Rightmove');
      expect(rightmoveLink.url).toContain('property-to-rent');
    });

    it('each link has name, emoji, and url', () => {
      const links = getPropertySearchLinks('London');
      links.forEach((link) => {
        expect(typeof link.name).toBe('string');
        expect(typeof link.emoji).toBe('string');
        expect(typeof link.url).toBe('string');
        expect(link.url).toMatch(/^https:\/\//);
      });
    });

    it('encodes the location in URLs', () => {
      const links = getPropertySearchLinks('London SW1A 1AA');
      links.forEach((link) => {
        expect(link.url).toContain(encodeURIComponent('London SW1A 1AA'));
      });
    });

    it('returns empty array for empty location', () => {
      expect(getPropertySearchLinks('')).toEqual([]);
      expect(getPropertySearchLinks('   ')).toEqual([]);
      expect(getPropertySearchLinks(null)).toEqual([]);
      expect(getPropertySearchLinks(undefined)).toEqual([]);
    });

    it('trims whitespace from location', () => {
      const links = getPropertySearchLinks('  London  ');
      const rightmoveLink = links.find((l) => l.name === 'Rightmove');
      expect(rightmoveLink.url).toContain(encodeURIComponent('London'));
      expect(rightmoveLink.url).not.toContain(encodeURIComponent('  London  '));
    });
  });
});
