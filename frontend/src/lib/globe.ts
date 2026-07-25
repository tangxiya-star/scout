/**
 * Globe entry-screen data — all pre-baked, no external API calls (demo guardrail).
 *
 * Three tiers of coverage, matching the product narrative:
 *  1. Grain belts   — large polygons, "where the world grows food" (amber)
 *  2. Vineyard hubs — point markers for major wine regions (green)
 *  3. Pilot farm    — the one Scout-enabled site that opens the mission cockpit
 *
 * Region shapes are intentionally coarse — they read at globe zoom (z1–4) and
 * are stand-ins for real ESA WorldCereal / USDA CDL layers in production.
 */

export interface RegionProps {
  id: string;
  kind: "grain" | "vineyard" | "pilot";
  name: string;
  country: string;
  crops: string;
  note: string;
}

type Ring = [number, number][];

const belt = (
  id: string,
  name: string,
  country: string,
  crops: string,
  note: string,
  ring: Ring,
): GeoJSON.Feature<GeoJSON.Polygon, RegionProps> => ({
  type: "Feature",
  properties: { id, kind: "grain", name, country, crops, note },
  geometry: { type: "Polygon", coordinates: [[...ring, ring[0]]] },
});

export const GRAIN_BELTS: GeoJSON.FeatureCollection<GeoJSON.Polygon, RegionProps> = {
  type: "FeatureCollection",
  features: [
    belt("corn-belt", "US Corn Belt", "United States", "Corn · Soybean", "≈ 75% of US corn + soy production", [
      [-97.5, 39.8], [-97.5, 44.6], [-92, 45.3], [-87, 44.2], [-82.6, 41.6], [-83.2, 39.6], [-89, 38.4],
    ]),
    belt("great-plains", "Great Plains Wheat Belt", "United States", "Winter & spring wheat", "The US breadbasket, Texas → North Dakota", [
      [-103.8, 33.2], [-104, 48.7], [-97.5, 48.7], [-97.8, 39.8], [-99.5, 33.5],
    ]),
    belt("pampas", "Pampas", "Argentina", "Soybean · Corn · Wheat", "One of the world's deepest topsoils", [
      [-64.5, -38.5], [-58.2, -38.8], [-57, -33.5], [-61.5, -31.2], [-65.2, -33.8],
    ]),
    belt("cerrado", "Cerrado", "Brazil", "Soybean · Corn · Cotton", "Brazil's fastest-growing cropland frontier", [
      [-56.5, -15.5], [-46.5, -13.5], [-44.8, -8], [-49, -6.5], [-55.5, -10.5],
    ]),
    belt("black-earth", "Black Earth Belt", "Ukraine / Russia", "Wheat · Sunflower · Barley", "Chernozem soils — major global wheat exporter", [
      [25, 45.8], [39.5, 45.5], [41.5, 50.5], [33, 52.3], [24.5, 50.5],
    ]),
    belt("paris-basin", "Paris Basin", "France", "Wheat · Barley · Rapeseed", "Western Europe's highest wheat yields", [
      [-1.8, 46.8], [4.8, 46.8], [5.8, 49.8], [0.5, 49.8],
    ]),
    belt("north-china-plain", "North China Plain", "China", "Wheat · Corn", "Feeds ~20% of China's population", [
      [112.8, 32], [119.8, 32.2], [121.8, 37], [117.8, 39.8], [113, 37.5],
    ]),
    belt("indo-gangetic", "Indo-Gangetic Plain", "India / Pakistan", "Wheat · Rice", "The Green Revolution heartland", [
      [72.5, 29.5], [79.5, 25.2], [87.8, 24], [89, 26.3], [77, 31.3],
    ]),
    belt("au-wheat-west", "Western Wheatbelt", "Australia", "Wheat · Barley · Canola", "Export-oriented dryland grain", [
      [114.8, -34.8], [119.2, -34.2], [122.2, -31.2], [117.5, -28.2], [114.2, -30],
    ]),
    belt("au-wheat-se", "SE Grain Belt", "Australia", "Wheat · Barley", "Victoria / NSW cropping zone", [
      [140.2, -37], [147.2, -36.2], [146.5, -32.8], [141, -32.5],
    ]),
  ],
};

const vine = (
  id: string,
  name: string,
  country: string,
  note: string,
  lng: number,
  lat: number,
): GeoJSON.Feature<GeoJSON.Point, RegionProps> => ({
  type: "Feature",
  properties: { id, kind: "vineyard", name, country, crops: "Wine grapes", note },
  geometry: { type: "Point", coordinates: [lng, lat] },
});

export const VINEYARD_HUBS: GeoJSON.FeatureCollection<GeoJSON.Point, RegionProps> = {
  type: "FeatureCollection",
  features: [
    vine("central-valley", "California Central Valley", "United States", "Largest US grape acreage; table + wine", -119.9, 36.7),
    vine("willamette", "Willamette Valley", "United States", "Cool-climate Pinot Noir country", -123.1, 45.2),
    vine("bordeaux", "Bordeaux", "France", "Downy mildew was first studied here (1878)", -0.5, 44.85),
    vine("burgundy", "Burgundy", "France", "High-value, disease-pressure-prone parcels", 4.85, 47.05),
    vine("tuscany", "Tuscany", "Italy", "Sangiovese hills, humid-summer fungal risk", 11.3, 43.3),
    vine("rioja", "La Rioja", "Spain", "Spain's flagship wine region", -2.5, 42.45),
    vine("douro", "Douro Valley", "Portugal", "Steep terraced vineyards — hard to scout on foot", -7.6, 41.15),
    vine("mosel", "Mosel", "Germany", "Some of Europe's steepest vineyard slopes", 7.1, 49.9),
    vine("mendoza", "Mendoza", "Argentina", "High-altitude Malbec, 900–1500 m", -68.85, -32.95),
    vine("barossa", "Barossa Valley", "Australia", "Historic Shiraz region", 138.95, -34.55),
    vine("margaret-river", "Margaret River", "Australia", "Maritime-climate premium wines", 115.07, -33.95),
    vine("stellenbosch", "Stellenbosch", "South Africa", "Cape winelands hub", 18.85, -33.93),
    vine("marlborough", "Marlborough", "New Zealand", "Sauvignon Blanc capital", 173.9, -41.5),
    vine("ningxia", "Ningxia", "China", "China's fastest-rising wine region", 105.9, 38.4),
  ],
};

/**
 * The one Scout-enabled site. Clicking it flies in and opens the mission cockpit.
 * Coordinates point at a real vineyard block in Carneros / Napa — the same spot
 * the cockpit's satellite feed renders, so the globe fly-in lands seamlessly.
 */
export const PILOT_FARM = {
  id: "napa-pilot",
  name: "Napa Valley Pilot Vineyard",
  country: "United States",
  crops: "Grapevine (Cabernet Sauvignon)",
  note: "Scout-enabled · live drone + reasoning engine",
  lng: -122.4103,
  lat: 38.4269,
};
