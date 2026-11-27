import type { GeoJsonLineStringZM } from "../../contracts";

const EARTH_RADIUS_M = 6_371_000;

export function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export type ElevationSpike = {
  pointIndex: number;
  deltaElevationM: number;
  horizontalDistanceM: number;
  gradePercent: number;
  latitude: number;
  longitude: number;
  altitudeM: number;
};

export type LineStringMetrics = {
  totalDistanceKm: number;
  elevationGainM: number;
  elevationLossM: number;
  minAltitudeM: number;
  maxAltitudeM: number;
  pointCount: number;
  elevationSpikes: ElevationSpike[];
};

/**
 * Computes distance, deadband-filtered elevation gain/loss (>3m threshold),
 * altitude extrema, and steep vertical anomalies (GPS altitude spikes) for a
 * GeoJSON LineStringZM track.
 */
export function analyzeLineStringMetrics(
  line: GeoJsonLineStringZM,
  options: {
    deadbandM?: number;
    spikeDeltaM?: number;
  } = {},
): LineStringMetrics {
  const deadbandM = options.deadbandM ?? 3;
  const spikeDeltaM = options.spikeDeltaM ?? 250;
  const coords = line.coordinates;

  let totalDistanceM = 0;
  let elevationGainM = 0;
  let elevationLossM = 0;
  let anchorAltitude = coords[0][2];
  let minAltitudeM = coords[0][2];
  let maxAltitudeM = coords[0][2];
  const elevationSpikes: ElevationSpike[] = [];

  for (let i = 1; i < coords.length; i++) {
    const [prevLon, prevLat, prevAlt] = coords[i - 1];
    const [lon, lat, alt] = coords[i];

    const segDistM = haversineDistanceMeters(prevLat, prevLon, lat, lon);
    totalDistanceM += segDistM;

    if (alt < minAltitudeM) minAltitudeM = alt;
    if (alt > maxAltitudeM) maxAltitudeM = alt;

    const deadbandDelta = alt - anchorAltitude;
    if (deadbandDelta > deadbandM) {
      elevationGainM += deadbandDelta;
      anchorAltitude = alt;
    } else if (deadbandDelta < -deadbandM) {
      elevationLossM += Math.abs(deadbandDelta);
      anchorAltitude = alt;
    }

    const rawVertDelta = Math.abs(alt - prevAlt);
    const gradePercent =
      segDistM > 1 ? Math.round((rawVertDelta / segDistM) * 100) : rawVertDelta > 0 ? 999 : 0;

    if (
      rawVertDelta >= spikeDeltaM ||
      (rawVertDelta >= 80 && segDistM < 50)
    ) {
      elevationSpikes.push({
        pointIndex: i,
        deltaElevationM: Math.round(alt - prevAlt),
        horizontalDistanceM: Math.round(segDistM),
        gradePercent,
        latitude: lat,
        longitude: lon,
        altitudeM: Math.round(alt),
      });
    }
  }

  return {
    totalDistanceKm: Math.round((totalDistanceM / 1000) * 100) / 100,
    elevationGainM: Math.round(elevationGainM),
    elevationLossM: Math.round(elevationLossM),
    minAltitudeM: Math.round(minAltitudeM),
    maxAltitudeM: Math.round(maxAltitudeM),
    pointCount: coords.length,
    elevationSpikes,
  };
}
