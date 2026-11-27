import { db, pool } from "../src/db";
import {
  regionalPacks,
  safetyReports,
  trails,
  user,
  waypoints,
} from "../src/db/schema";
import {
  buildSeedRegionalPacks,
  SEED_POON_HILL_HAZARD,
  SEED_POON_HILL_TRAIL,
  SEED_POON_HILL_WAYPOINTS,
  SYSTEM_VERIFIER_USER,
} from "../src/db/seed-data";

async function seed() {
  await db
    .insert(user)
    .values(SYSTEM_VERIFIER_USER)
    .onConflictDoNothing({ target: user.id });

  await db
    .insert(trails)
    .values({
      id: SEED_POON_HILL_TRAIL.id,
      title: SEED_POON_HILL_TRAIL.title,
      slug: SEED_POON_HILL_TRAIL.slug,
      region: SEED_POON_HILL_TRAIL.region,
      description: SEED_POON_HILL_TRAIL.description,
      difficulty: SEED_POON_HILL_TRAIL.difficulty,
      distanceKm: SEED_POON_HILL_TRAIL.distanceKm,
      elevationGainM: SEED_POON_HILL_TRAIL.elevationGainM,
      elevationLossM: SEED_POON_HILL_TRAIL.elevationLossM,
      minAltitudeM: SEED_POON_HILL_TRAIL.minAltitudeM,
      maxAltitudeM: SEED_POON_HILL_TRAIL.maxAltitudeM,
      bbox: SEED_POON_HILL_TRAIL.bbox,
      geom: SEED_POON_HILL_TRAIL.geom,
      status: SEED_POON_HILL_TRAIL.status,
      packRegionId: SEED_POON_HILL_TRAIL.packRegionId,
      createdBy: SEED_POON_HILL_TRAIL.createdBy,
      createdAt: new Date(SEED_POON_HILL_TRAIL.createdAt),
      updatedAt: new Date(SEED_POON_HILL_TRAIL.updatedAt),
    })
    .onConflictDoNothing({ target: trails.id });

  for (const wp of SEED_POON_HILL_WAYPOINTS) {
    await db
      .insert(waypoints)
      .values({
        id: wp.id,
        trailId: wp.trailId,
        region: wp.region,
        category: wp.category,
        name: wp.name,
        description: wp.description,
        geom: wp.geom,
        altitudeM: wp.altitudeM,
        photoUrls: wp.photoUrls,
        createdAt: new Date(wp.createdAt),
        updatedAt: new Date(wp.updatedAt),
      })
      .onConflictDoNothing({ target: waypoints.id });
  }

  await db
    .insert(safetyReports)
    .values({
      id: SEED_POON_HILL_HAZARD.id,
      trailId: SEED_POON_HILL_HAZARD.trailId,
      userId: SEED_POON_HILL_HAZARD.userId,
      hazardType: SEED_POON_HILL_HAZARD.hazardType,
      severity: SEED_POON_HILL_HAZARD.severity,
      description: SEED_POON_HILL_HAZARD.description,
      geom: SEED_POON_HILL_HAZARD.geom,
      altitudeM: SEED_POON_HILL_HAZARD.altitudeM,
      photoUrls: SEED_POON_HILL_HAZARD.photoUrls,
      isResolved: SEED_POON_HILL_HAZARD.isResolved,
      createdAt: new Date(SEED_POON_HILL_HAZARD.createdAt),
      updatedAt: new Date(SEED_POON_HILL_HAZARD.updatedAt),
    })
    .onConflictDoNothing({ target: safetyReports.id });

  const packs = buildSeedRegionalPacks();
  for (const pack of packs) {
    await db
      .insert(regionalPacks)
      .values({
        id: pack.id,
        name: pack.name,
        region: pack.region,
        description: pack.description,
        version: pack.version,
        bounds: pack.bounds,
        center: pack.center,
        defaultZoom: pack.defaultZoom,
        totalSizeBytes: pack.totalSizeBytes,
        trailCount: pack.trailCount,
        waypointCount: pack.waypointCount,
        artifacts: pack.artifacts,
        isPublished: true,
        updatedAt: new Date(pack.updatedAt),
      })
      .onConflictDoNothing({ target: regionalPacks.id });
  }

  console.log(
    `Seeded verifier user, 1 verified trail, ${SEED_POON_HILL_WAYPOINTS.length} waypoints, 1 safety report, and ${packs.length} regional packs.`,
  );
}

try {
  await seed();
} finally {
  await pool.end();
}
