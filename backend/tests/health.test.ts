import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "./helpers.js";

describe("GET /api/v1/health", () => {
  it("responds with ok", async () => {
    const res = await request(app).get("/api/v1/health");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, service: "bhumilandmarks-backend" });
  });

  it("returns 404 envelope for unknown routes", async () => {
    const res = await request(app).get("/api/v1/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});
