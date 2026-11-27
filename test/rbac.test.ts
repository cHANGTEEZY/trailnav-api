import { describe, expect, it } from "bun:test";
import { Hono } from "hono";
import type { UserRole } from "../src/db/schema/auth";
import { requireRole } from "../src/middleware/require-role";
import type { AppVariables } from "../src/shared/types/app.types";

function buildTestApp(role: UserRole | null) {
  const testApp = new Hono<{ Variables: AppVariables }>();

  testApp.use("*", async (c, next) => {
    c.set("requestId", "req-test-1");
    c.set(
      "user",
      role
        ? ({
            id: "user-1",
            name: "Maya Sherpa",
            email: "maya@trailnav.np",
            emailVerified: true,
            image: null,
            role,
            createdAt: new Date(),
            updatedAt: new Date(),
          } as AppVariables["user"])
        : null,
    );
    c.set("session", null);
    await next();
  });

  testApp.get("/mod", requireRole("moderator", "admin"), (c) =>
    c.json({ ok: true }),
  );

  return testApp;
}

describe("requireRole middleware", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await buildTestApp(null).request("/mod");
    expect(res.status).toBe(401);
  });

  it("returns 403 for trekker role on moderator route", async () => {
    const res = await buildTestApp("trekker").request("/mod");
    expect(res.status).toBe(403);
  });

  it("allows moderator and admin roles", async () => {
    expect((await buildTestApp("moderator").request("/mod")).status).toBe(200);
    expect((await buildTestApp("admin").request("/mod")).status).toBe(200);
  });
});
