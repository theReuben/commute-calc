/**
 * Property search providers and URL generators.
 * Generates search URLs for popular UK property listing sites
 * so users can find properties within their commutable area.
 */

/**
 * @typedef {Object} PropertyProvider
 * @property {string} name - Display name of the provider.
 * @property {string} emoji - Emoji icon for the provider.
 * @property {function(string): string} forSale - Generate a "for sale" search URL.
 * @property {function(string): string} toRent - Generate a "to rent" search URL.
 */

/** @type {PropertyProvider[]} */
export const PROPERTY_PROVIDERS = [
  {
    name: 'Rightmove',
    emoji: '🏠',
    forSale: (location) =>
      `https://www.rightmove.co.uk/property-for-sale/find.html?searchLocation=${encodeURIComponent(location)}`,
    toRent: (location) =>
      `https://www.rightmove.co.uk/property-to-rent/find.html?searchLocation=${encodeURIComponent(location)}`,
  },
  {
    name: 'Zoopla',
    emoji: '🔍',
    forSale: (location) =>
      `https://www.zoopla.co.uk/for-sale/property/${encodeURIComponent(location)}/`,
    toRent: (location) =>
      `https://www.zoopla.co.uk/to-rent/property/${encodeURIComponent(location)}/`,
  },
  {
    name: 'OnTheMarket',
    emoji: '🏡',
    forSale: (location) =>
      `https://www.onthemarket.com/for-sale/property/${encodeURIComponent(location)}/`,
    toRent: (location) =>
      `https://www.onthemarket.com/to-rent/property/${encodeURIComponent(location)}/`,
  },
];

/**
 * Generate property search links for a given location.
 *
 * @param {string} location - The location query (address, postcode, or place name).
 * @param {'buy'|'rent'} listingType - Type of property listing.
 * @returns {Array<{name: string, emoji: string, url: string}>}
 */
export function getPropertySearchLinks(location, listingType = 'buy') {
  if (!location || !location.trim()) {
    return [];
  }

  const trimmed = location.trim();

  return PROPERTY_PROVIDERS.map((provider) => ({
    name: provider.name,
    emoji: provider.emoji,
    url: listingType === 'rent'
      ? provider.toRent(trimmed)
      : provider.forSale(trimmed),
  }));
}
