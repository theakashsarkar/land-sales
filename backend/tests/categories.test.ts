import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app, makeCategory, resetDb, saContext, userContext } from "./helpers.js";
import { prisma } from "../src/lib/prisma.js";

beforeEach(resetDb);

const route = "/api/v1/categories";

describe("POST /categories", () => {
  it("creates a category", async () => {
    const sa = await saContext();
    const res = await request(app)
      .post(route)
      .set("Authorization", `Bearer ${sa.accessToken}`)
      .send({ name: "Plot Sale", description: "Residential plot sales" });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: "Plot Sale", isActive: true });
  });

  it("rejects duplicate names (409) and is super-admin only", async () => {
    const sa = await saContext();
    await makeCategory({ name: "Installment" });
    const dup = await request(app)
      .post(route)
      .set("Authorization", `Bearer ${sa.accessToken}`)
      .send({ name: "installment" });
    expect(dup.status).toBe(409);

    const user = await userContext();
    const forbidden = await request(app)
      .post(route)
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ name: "Whatever" });
    expect(forbidden.status).toBe(403);

    const unauth = await request(app).post(route).send({ name: "X" });
    expect(unauth.status).toBe(401);
  });
});

describe("GET /categories + dropdown", () => {
  it("lists with search and pagination meta", async () => {
    const sa = await saContext();
    await makeCategory({ name: "Plot Sale" });
    await makeCategory({ name: "Installment Collection" });
    await makeCategory({ name: "Registration Fee" });

    const all = await request(app).get(route).set("Authorization", `Bearer ${sa.accessToken}`);
    expect(all.body.meta.total).toBe(3);

    const search = await request(app)
      .get(route)
      .query({ search: "install" })
      .set("Authorization", `Bearer ${sa.accessToken}`);
    expect(search.body.data).toHaveLength(1);
    expect(search.body.data[0].name).toBe("Installment Collection");
  });

  it("dropdown returns only active categories sorted by name", async () => {
    const sa = await saContext();
    await makeCategory({ name: "Inactive One", isActive: false });
    await makeCategory({ name: "Beta" });
    await makeCategory({ name: "Alpha" });

    const res = await request(app).get(`${route}/dropdown`).set("Authorization", `Bearer ${sa.accessToken}`);
    expect(res.body.data.map((c: { name: string }) => c.name)).toEqual(["Alpha", "Beta"]);
  });

  it("is available to any authenticated user", async () => {
    const user = await userContext();
    const res = await request(app).get(`${route}/dropdown`).set("Authorization", `Bearer ${user.accessToken}`);
    expect(res.status).toBe(200);
  });
});

describe("PATCH /categories/:id + status", () => {
  it("updates with field history, toggles status, 404s unknown", async () => {
    const sa = await saContext();
    const category = await makeCategory({ name: "Before" });

    const upd = await request(app)
      .patch(`${route}/${category.id}`)
      .set("Authorization", `Bearer ${sa.accessToken}`)
      .send({ name: "After", description: "Updated" });
    expect(upd.status).toBe(200);
    expect(upd.body.name).toBe("After");

    const changes = await prisma.recordHistory.findMany({
      where: { entityType: "Category", entityId: category.id, action: "UPDATED" },
    });
    expect(changes.map((c) => c.field).sort()).toEqual(["description", "name"]);

    const off = await request(app)
      .patch(`${route}/${category.id}/status`)
      .set("Authorization", `Bearer ${sa.accessToken}`)
      .send({ isActive: false });
    expect(off.body.isActive).toBe(false);

    const missing = await request(app)
      .patch(`${route}/ghost/status`)
      .set("Authorization", `Bearer ${sa.accessToken}`)
      .send({ isActive: true });
    expect(missing.status).toBe(404);
  });

  it("mutations are super-admin only", async () => {
    const category = await makeCategory();
    const user = await userContext();
    const res = await request(app)
      .patch(`${route}/${category.id}`)
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ name: "Hack" });
    expect(res.status).toBe(403);
  });
});
