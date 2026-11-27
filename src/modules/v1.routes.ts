import { Hono } from "hono";
import { healthRoutes } from "./health/health.routes";
import { mediaRoutes } from "./media/media.routes";
import { packsRoutes } from "./packs/packs.routes";
import { safetyRoutes } from "./safety/safety.routes";
import { syncRoutes } from "./sync/sync.routes";
import { tracksRoutes } from "./tracks/tracks.routes";
import { trailsRoutes } from "./trails/trails.routes";
import { usersRoutes } from "./users/users.routes";
import { searchRoutes, waypointsRoutes } from "./waypoints/waypoints.routes";

export const apiV1Router = new Hono();

apiV1Router.route("/health", healthRoutes);
apiV1Router.route("/users", usersRoutes);
apiV1Router.route("/trails", trailsRoutes);
apiV1Router.route("/tracks", tracksRoutes);
apiV1Router.route("/waypoints", waypointsRoutes);
apiV1Router.route("/search", searchRoutes);
apiV1Router.route("/safety-reports", safetyRoutes);
apiV1Router.route("/sync", syncRoutes);
apiV1Router.route("/packs", packsRoutes);
apiV1Router.route("/media", mediaRoutes);
