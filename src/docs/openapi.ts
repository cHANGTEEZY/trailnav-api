import { openAPIRouteHandler } from "hono-openapi";
import type { Hono } from "hono";
import type { AppVariables } from "../shared/types/app.types";

export function registerOpenApiDocs(app: Hono<{ Variables: AppVariables }>) {
  app.get(
    "/openapi.json",
    openAPIRouteHandler(app, {
      documentation: {
        info: {
          title: "TrailNav Nepal API",
          version: "1.0.0",
          description:
            "Geospatial REST API and offline-first sync backend for TrailNav Nepal.",
        },
        tags: [
          { name: "Health", description: "Service health endpoints" },
          { name: "Auth", description: "Better Auth endpoints" },
          { name: "Users", description: "User profile endpoints" },
          { name: "Trails", description: "Spatial Nepal trekking trails API" },
          { name: "Tracks", description: "Recorded GPS tracks and GPX 1.1 import/export" },
          { name: "Waypoints", description: "Nearby POIs, teahouses, and water sources" },
          { name: "Search", description: "Unified trail and waypoint search" },
          { name: "Safety", description: "Trail hazard reports and resolution" },
          { name: "Sync", description: "Offline-first two-way SQLite sync protocol" },
        ],
        components: {
          securitySchemes: {
            cookieAuth: {
              type: "apiKey",
              in: "cookie",
              name: "better-auth.session_token",
            },
          },
        },
      },
    }),
  );
}
