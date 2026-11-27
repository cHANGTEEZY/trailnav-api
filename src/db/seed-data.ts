import { env } from "../config/env";
import type {
  BoundingBox,
  Position4D,
  RegionalPackManifest,
  SafetyReport,
  Trail,
  Waypoint,
} from "../contracts";

export const SYSTEM_VERIFIER_USER = {
  id: "system-trailnav-verified",
  name: "TrailNav Nepal Cartography",
  email: "verified@trailnav.np",
  emailVerified: true,
  role: "admin" as const,
};

export const POON_HILL_TRAIL_ID = "trail-ghorepani-poon-hill-loop";
export const POON_HILL_TRAIL_SLUG = "ghorepani-poon-hill-loop";
export const POON_HILL_PACK_REGION_ID = "poon-hill";
export const POON_HILL_HAZARD_ID = "hazard-poon-hill-stairs-snow-ice";

const SEED_TIMESTAMP = "2026-10-15T06:00:00.000Z";
const PACK_CATALOG_UPDATED_AT = "2026-10-15T00:00:00.000Z";

const POON_HILL_COORDINATES: Position4D[] = [
  [83.7769, 28.3008, 1070, 0],
  [83.7672, 28.3134, 1185, 1950],
  [83.7545, 28.3292, 1430, 4800],
  [83.7429, 28.3484, 1540, 7400],
  [83.7332, 28.3556, 2050, 9600],
  [83.7235, 28.3688, 2210, 12100],
  [83.7118, 28.3845, 2430, 14800],
  [83.6992, 28.4017, 2874, 17900],
  [83.6938, 28.4011, 3065, 18650],
  [83.6894, 28.4004, 3210, 19400],
  [83.6998, 28.4012, 2874, 20900],
  [83.7224, 28.3976, 3090, 24200],
  [83.7475, 28.3965, 2660, 27300],
  [83.7654, 28.3972, 2630, 29800],
  [83.7881, 28.3879, 2410, 32600],
  [83.8069, 28.3767, 1940, 36200],
];

const POON_HILL_BBOX: BoundingBox = [83.6894, 28.3008, 83.8069, 28.4017];

export const SEED_POON_HILL_TRAIL: Trail = {
  id: POON_HILL_TRAIL_ID,
  title: "Ghorepani / Poon Hill Loop",
  slug: POON_HILL_TRAIL_SLUG,
  region: "Annapurna",
  description:
    "Classic Annapurna Conservation Area circuit climbing stone staircases through Magar and Gurung villages, rhododendron forest, and the 3,210m Poon Hill sunrise ridge with panoramic views of Dhaulagiri and Annapurna I.",
  difficulty: "moderate",
  distanceKm: 36.2,
  elevationGainM: 2356,
  elevationLossM: 1486,
  minAltitudeM: 1070,
  maxAltitudeM: 3210,
  bbox: POON_HILL_BBOX,
  geom: {
    type: "LineString",
    coordinates: POON_HILL_COORDINATES,
  },
  status: "verified",
  packRegionId: POON_HILL_PACK_REGION_ID,
  createdBy: SYSTEM_VERIFIER_USER.id,
  createdAt: SEED_TIMESTAMP,
  updatedAt: SEED_TIMESTAMP,
};

export const SEED_POON_HILL_WAYPOINTS: Waypoint[] = [
  {
    id: "wp-poon-hill-nayapul",
    trailId: POON_HILL_TRAIL_ID,
    region: "Annapurna",
    category: "teahouse",
    name: "Nayapul Trailhead & ACAP Checkpost",
    description:
      "Primary trailhead village along the Modi Khola with teahouses, gear shops, and Annapurna permit checkpost.",
    geom: { type: "Point", coordinates: [83.7769, 28.3008, 1070] },
    altitudeM: 1070,
    photoUrls: [],
    createdAt: "2026-10-15T06:01:00.000Z",
    updatedAt: SEED_TIMESTAMP,
  },
  {
    id: "wp-poon-hill-tikhedhunga",
    trailId: POON_HILL_TRAIL_ID,
    region: "Annapurna",
    category: "teahouse",
    name: "Tikhedhunga Riverside Lodges",
    description:
      "Suspension bridge crossing and cluster of teahouses immediately below the steep stone ascent to Ulleri.",
    geom: { type: "Point", coordinates: [83.7429, 28.3484, 1540] },
    altitudeM: 1540,
    photoUrls: [],
    createdAt: "2026-10-15T06:02:00.000Z",
    updatedAt: SEED_TIMESTAMP,
  },
  {
    id: "wp-poon-hill-ulleri",
    trailId: POON_HILL_TRAIL_ID,
    region: "Annapurna",
    category: "teahouse",
    name: "Ulleri Magar Village Teahouses",
    description:
      "Terraced hillside settlement at the top of the 3,200 stone steps with lodges, hot meals, and Annapurna South views.",
    geom: { type: "Point", coordinates: [83.7332, 28.3556, 2050] },
    altitudeM: 2050,
    photoUrls: [],
    createdAt: "2026-10-15T06:03:00.000Z",
    updatedAt: SEED_TIMESTAMP,
  },
  {
    id: "wp-poon-hill-nangethanti-water",
    trailId: POON_HILL_TRAIL_ID,
    region: "Annapurna",
    category: "water_source",
    name: "Nangethanti Safe Drinking Water Station",
    description:
      "Community filtered drinking water refill tap nestled inside the oak and rhododendron forest.",
    geom: { type: "Point", coordinates: [83.7118, 28.3845, 2430] },
    altitudeM: 2430,
    photoUrls: [],
    createdAt: "2026-10-15T06:04:00.000Z",
    updatedAt: SEED_TIMESTAMP,
  },
  {
    id: "wp-poon-hill-ghorepani",
    trailId: POON_HILL_TRAIL_ID,
    region: "Annapurna",
    category: "teahouse",
    name: "Ghorepani Upper Village Teahouses",
    description:
      "Major ridge settlement with heated dining halls, lodges, and emergency shelter serving the Poon Hill sunrise trail.",
    geom: { type: "Point", coordinates: [83.6992, 28.4017, 2874] },
    altitudeM: 2874,
    photoUrls: [],
    createdAt: "2026-10-15T06:05:00.000Z",
    updatedAt: SEED_TIMESTAMP,
  },
  {
    id: "wp-poon-hill-viewpoint",
    trailId: POON_HILL_TRAIL_ID,
    region: "Annapurna",
    category: "viewpoint",
    name: "Poon Hill Sunrise Viewpoint",
    description:
      "Iconic 3,210m vantage point offering sweeping sunrise panoramas across Dhaulagiri I (8,167m), Annapurna I (8,091m), and Machapuchare.",
    geom: { type: "Point", coordinates: [83.6894, 28.4004, 3210] },
    altitudeM: 3210,
    photoUrls: [],
    createdAt: "2026-10-15T06:06:00.000Z",
    updatedAt: SEED_TIMESTAMP,
  },
  {
    id: "wp-poon-hill-deurali-pass",
    trailId: POON_HILL_TRAIL_ID,
    region: "Annapurna",
    category: "pass",
    name: "Deurali Ridge Pass",
    description:
      "Wind-exposed forested ridge pass at 3,090m linking Ghorepani eastward toward Banthanti and Tadapani.",
    geom: { type: "Point", coordinates: [83.7224, 28.3976, 3090] },
    altitudeM: 3090,
    photoUrls: [],
    createdAt: "2026-10-15T06:07:00.000Z",
    updatedAt: SEED_TIMESTAMP,
  },
  {
    id: "wp-poon-hill-ghandruk",
    trailId: POON_HILL_TRAIL_ID,
    region: "Annapurna",
    category: "teahouse",
    name: "Ghandruk Gurung Village Teahouses",
    description:
      "Historic slate-roofed Gurung village with established teahouses, health post, and close-up views of Hiunchuli and Machapuchare.",
    geom: { type: "Point", coordinates: [83.8069, 28.3767, 1940] },
    altitudeM: 1940,
    photoUrls: [],
    createdAt: "2026-10-15T06:08:00.000Z",
    updatedAt: SEED_TIMESTAMP,
  },
];

export const SEED_POON_HILL_HAZARD: SafetyReport = {
  id: POON_HILL_HAZARD_ID,
  trailId: POON_HILL_TRAIL_ID,
  userId: SYSTEM_VERIFIER_USER.id,
  hazardType: "snow_ice",
  severity: "moderate",
  description:
    "Packed morning frost and black ice on the shaded upper stone stairs between Ghorepani and Poon Hill viewpoint before 07:00. Microspikes and trekking poles recommended.",
  geom: { type: "Point", coordinates: [83.6938, 28.4011] },
  altitudeM: 3065,
  photoUrls: [],
  syncStatus: "synced",
  isResolved: false,
  createdAt: SEED_TIMESTAMP,
  updatedAt: SEED_TIMESTAMP,
};

export function buildSeedRegionalPacks(
  cdnBaseUrl = env.PACK_CDN_BASE_URL,
): RegionalPackManifest[] {
  const base = cdnBaseUrl.replace(/\/$/, "");
  return [
    {
      id: "poon-hill",
      name: "Ghorepani Poon Hill",
      region: "Annapurna Foothills",
      description:
        "Classic rhododendron ridge loop from Nayapul through Ulleri, Ghorepani, Poon Hill (3,210m), Tadapani, and Ghandruk.",
      version: "2026.10.1",
      bounds: [83.63, 28.31, 83.86, 28.47],
      center: [83.6892, 28.4004],
      defaultZoom: 12.2,
      totalSizeBytes: 44_040_192,
      trailCount: 14,
      waypointCount: 64,
      artifacts: [
        {
          type: "vector_mbtiles",
          fileName: "poon-hill-vector.mbtiles",
          downloadUrl: `${base}/poon-hill/poon-hill-vector.mbtiles`,
          sizeBytes: 27_262_976,
          sha256:
            "7a4f21c8e3d901a4b67c5f12890ab432c1d7e8f90123456789abcdef01234567",
          minZoom: 8,
          maxZoom: 15,
        },
        {
          type: "dem_mbtiles",
          fileName: "poon-hill-dem.mbtiles",
          downloadUrl: `${base}/poon-hill/poon-hill-dem.mbtiles`,
          sizeBytes: 16_777_216,
          sha256:
            "2b8e49d1a7c563f0e2198b4d7c3f10a9e8b7c6d543210fedcba9876543210fed",
          minZoom: 8,
          maxZoom: 12,
        },
      ],
      updatedAt: PACK_CATALOG_UPDATED_AT,
    },
    {
      id: "annapurna-circuit",
      name: "Annapurna Circuit",
      region: "Annapurna Conservation Area",
      description:
        "Full Marsyangdi to Kali Gandaki traverse including Manang, Tilicho Lake spur, Thorong La Pass (5,416m), and Muktinath.",
      version: "2026.10.1",
      bounds: [83.6, 28.2, 84.55, 28.95],
      center: [84.0203, 28.6632],
      defaultZoom: 10.4,
      totalSizeBytes: 176_160_768,
      trailCount: 32,
      waypointCount: 185,
      artifacts: [
        {
          type: "vector_mbtiles",
          fileName: "annapurna-circuit-vector.mbtiles",
          downloadUrl: `${base}/annapurna-circuit/annapurna-circuit-vector.mbtiles`,
          sizeBytes: 113_246_208,
          sha256:
            "9c1d3e5f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d",
          minZoom: 8,
          maxZoom: 15,
        },
        {
          type: "dem_mbtiles",
          fileName: "annapurna-circuit-dem.mbtiles",
          downloadUrl: `${base}/annapurna-circuit/annapurna-circuit-dem.mbtiles`,
          sizeBytes: 62_914_560,
          sha256:
            "4f5e6d7c8b9a0f1e2d3c4b5a69788796a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0",
          minZoom: 8,
          maxZoom: 12,
        },
      ],
      updatedAt: PACK_CATALOG_UPDATED_AT,
    },
    {
      id: "khumbu-ebc",
      name: "Khumbu & Everest Base Camp",
      region: "Sagarmatha National Park",
      description:
        "Lukla to Namche Bazaar, Tengboche, Dingboche, Kala Patthar (5,545m), EBC, Gokyo Lakes, and Cho La high pass routes.",
      version: "2026.10.1",
      bounds: [86.55, 27.64, 87.02, 28.08],
      center: [86.785, 27.882],
      defaultZoom: 11.1,
      totalSizeBytes: 140_509_184,
      trailCount: 28,
      waypointCount: 162,
      artifacts: [
        {
          type: "vector_mbtiles",
          fileName: "khumbu-ebc-vector.mbtiles",
          downloadUrl: `${base}/khumbu-ebc/khumbu-ebc-vector.mbtiles`,
          sizeBytes: 90_177_536,
          sha256:
            "1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7f809",
          minZoom: 8,
          maxZoom: 15,
        },
        {
          type: "dem_mbtiles",
          fileName: "khumbu-ebc-dem.mbtiles",
          downloadUrl: `${base}/khumbu-ebc/khumbu-ebc-dem.mbtiles`,
          sizeBytes: 50_331_648,
          sha256:
            "8f7e6d5c4b3a291807f6e5d4c3b2a1908f7e6d5c4b3a291807f6e5d4c3b2a190",
          minZoom: 8,
          maxZoom: 12,
        },
      ],
      updatedAt: PACK_CATALOG_UPDATED_AT,
    },
    {
      id: "langtang-valley",
      name: "Langtang Valley & Gosainkunda",
      region: "Langtang National Park",
      description:
        "Syabrubesi through Lama Hotel, Langtang Village, Kyanjin Gompa, Tserko Ri (4,984m), and alpine lakes of Gosainkunda.",
      version: "2026.10.1",
      bounds: [85.22, 28.0, 85.72, 28.33],
      center: [85.5145, 28.213],
      defaultZoom: 11.4,
      totalSizeBytes: 81_788_928,
      trailCount: 18,
      waypointCount: 92,
      artifacts: [
        {
          type: "vector_mbtiles",
          fileName: "langtang-valley-vector.mbtiles",
          downloadUrl: `${base}/langtang-valley/langtang-valley-vector.mbtiles`,
          sizeBytes: 52_428_800,
          sha256:
            "3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f0123456789abcdef0123456789abcdef",
          minZoom: 8,
          maxZoom: 15,
        },
        {
          type: "dem_mbtiles",
          fileName: "langtang-valley-dem.mbtiles",
          downloadUrl: `${base}/langtang-valley/langtang-valley-dem.mbtiles`,
          sizeBytes: 29_360_128,
          sha256:
            "5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0bfedcba9876543210fedcba9876543210",
          minZoom: 8,
          maxZoom: 12,
        },
      ],
      updatedAt: PACK_CATALOG_UPDATED_AT,
    },
    {
      id: "manaslu-circuit",
      name: "Manaslu Circuit & Larkya La",
      region: "Manaslu Conservation Area",
      description:
        "Remote Budhi Gandaki gorge trek via Jagat, Sama Gaon, Manaslu Base Camp, and the 5,106m Larkya La Pass to Dharapani.",
      version: "2026.10.1",
      bounds: [84.3, 28.22, 85.05, 28.76],
      center: [84.721, 28.545],
      defaultZoom: 10.7,
      totalSizeBytes: 117_440_512,
      trailCount: 21,
      waypointCount: 118,
      artifacts: [
        {
          type: "vector_mbtiles",
          fileName: "manaslu-circuit-vector.mbtiles",
          downloadUrl: `${base}/manaslu-circuit/manaslu-circuit-vector.mbtiles`,
          sizeBytes: 75_497_472,
          sha256:
            "6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e",
          minZoom: 8,
          maxZoom: 15,
        },
        {
          type: "dem_mbtiles",
          fileName: "manaslu-circuit-dem.mbtiles",
          downloadUrl: `${base}/manaslu-circuit/manaslu-circuit-dem.mbtiles`,
          sizeBytes: 41_943_040,
          sha256:
            "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90",
          minZoom: 8,
          maxZoom: 12,
        },
      ],
      updatedAt: PACK_CATALOG_UPDATED_AT,
    },
  ];
}
