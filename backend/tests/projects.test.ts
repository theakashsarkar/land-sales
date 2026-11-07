import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app, makeProject, resetDb, saContext, uniqueEmail, userContext } from "./helpers.js";
import { prisma } from "../src/lib/prisma.js";

beforeEach(resetDb);

const route = "/api/v1/projects";

describe("POST /projects", () => {
  it("creates a project", async () => {
    const sa = await saContext();
    const res = await request(app)
      .post(route)
      .set("Authorization", `Bearer ${sa.accessToken}`)
      .send({ name: "Green Valley Township", code: "GVT", location: "Purbachal, Dhaka", description: "Flagship" });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: "Green Valley Township", code: "GVT", isActive: true });
    expect(res.body).toHaveProperty("id");
  });

  it("rejects duplicate code (409)", async () => {
    const sa = await saContext();
    await makeProject({ code: "DUP1" });
    const res = await request(app)
      .post(route)
      .set("Authorization", `Bearer ${sa.accessToken}`)
      .send({ name: "Another", code: "dup1" });
    expect(res.status).toBe(409);
  });

  it("validates required fields and is super-admin only", async () => {
    const sa = await saContext();
    const missing = await request(app)
      .post(route)
      .set("Authorization", `Bearer ${sa.accessToken}`)
      .send({ name: "No Code" });
    expect(missing.status).toBe(400);

    const unauth = await request(app).post(route).send({ name: "X", code: "X1" });
    expect(unauth.status).toBe(401);

    const user = await userContext();
    const forbidden = await request(app)
      .post(route)
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ name: "X", code: "X2" });
    expect(forbidden.status).toBe(403);
  });
});

describe("GET /projects", () => {
  it("lists projects with search + pagination", async () => {
    const sa = await saContext();
    await makeProject({ name: "Riverside Park", code: "RVP" });
    await makeProject({ name: "Lakeview Heights", code: "LVH" });
    await makeProject({ name: "Sunfield", code: "SFD" });

    const all = await request(app).get(route).set("Authorization", `Bearer ${sa.accessToken}`);
    expect(all.body.meta.total).toBe(3);

    const search = await request(app)
      .get(route)
      .query({ search: "lake" })
      .set("Authorization", `Bearer ${sa.accessToken}`);
    expect(search.body.data).toHaveLength(1);
    expect(search.body.data[0].code).toBe("LVH");
  });
});

describe("PATCH /projects/:id + status", () => {
  it("updates fields and records history", async () => {
    const sa = await saContext();
    const project = await makeProject({ name: "Old Name" });

    const res = await request(app)
      .patch(`${route}/${project.id}`)
      .set("Authorization", `Bearer ${sa.accessToken}`)
      .send({ name: "New Name", location: "Gulshan" });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("New Name");

    const changes = await prisma.recordHistory.findMany({
      where: { entityType: "Project", entityId: project.id, action: "UPDATED" },
    });
    expect(changes.map((c) => c.field).sort()).toEqual(["location", "name"]);
    const nameRow = changes.find((c) => c.field === "name");
    expect(nameRow?.oldValue).toBe("Old Name");
    expect(nameRow?.newValue).toBe("New Name");
  });

  it("deactivates and re-activates", async () => {
    const sa = await saContext();
    const project = await makeProject();
    const off = await request(app)
      .patch(`${route}/${project.id}/status`)
      .set("Authorization", `Bearer ${sa.accessToken}`)
      .send({ isActive: false });
    expect(off.body.isActive).toBe(false);

    const on = await request(app)
      .patch(`${route}/${project.id}/status`)
      .set("Authorization", `Bearer ${sa.accessToken}`)
      .send({ isActive: true });
    expect(on.body.isActive).toBe(true);
  });

  it("404s on unknown id and is super-admin only", async () => {
    const sa = await saContext();
    const missing = await request(app)
      .patch(`${route}/nope/status`)
      .set("Authorization", `Bearer ${sa.accessToken}`)
      .send({ isActive: false });
    expect(missing.status).toBe(404);

    const user = await userContext();
    const forbidden = await request(app)
      .patch(`${route}/whatever/status`)
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ isActive: false });
    expect(forbidden.status).toBe(403);
  });
});

describe("GET /projects/dropdown", () => {
  it("returns only active projects sorted by name", async () => {
    const sa = await saContext();
    await makeProject({ name: "Zeta", isActive: false });
    await makeProject({ name: "Alpha" });
    await makeProject({ name: "Mid" });

    const res = await request(app).get(`${route}/dropdown`).set("Authorization", `Bearer ${sa.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.map((p: { name: string }) => p.name)).toEqual(["Alpha", "Mid"]);
  });
});

describe("user-project access management", () => {
  it("assigns users to a project, lists them, and removes them", async () => {
    const sa = await saContext();
    const project = await makeProject();
    const u1 = await userContext(uniqueEmail("assignee1"));
    const u2 = await userContext(uniqueEmail("assignee2"));

    const assign = await request(app)
      .post(`${route}/${project.id}/users`)
      .set("Authorization", `Bearer ${sa.accessToken}`)
      .send({ userIds: [u1.user.id, u2.user.id] });
    expect(assign.status).toBe(200);
    expect(assign.body.data).toHaveLength(2);

    const list = await request(app)
      .get(`${route}/${project.id}/users`)
      .set("Authorization", `Bearer ${sa.accessToken}`);
    expect(list.body.data.map((u: { id: string }) => u.id).sort()).toEqual([u1.user.id, u2.user.id].sort());

    const remove = await request(app)
      .delete(`${route}/${project.id}/users/${u2.user.id}`)
      .set("Authorization", `Bearer ${sa.accessToken}`);
    expect(remove.status).toBe(200);

    const after = await request(app)
      .get(`${route}/${project.id}/users`)
      .set("Authorization", `Bearer ${sa.accessToken}`);
    expect(after.body.data.map((u: { id: string }) => u.id)).toEqual([u1.user.id]);
  });

  it("replacing assignments via PUT", async () => {
    const sa = await saContext();
    const project = await makeProject();
    const u1 = await userContext(uniqueEmail("put1"));
    const u2 = await userContext(uniqueEmail("put2"));

    await request(app)
      .post(`${route}/${project.id}/users`)
      .set("Authorization", `Bearer ${sa.accessToken}`)
      .send({ userIds: [u1.user.id] });

    const put = await request(app)
      .put(`${route}/${project.id}/users`)
      .set("Authorization", `Bearer ${sa.accessToken}`)
      .send({ userIds: [u2.user.id] });
    expect(put.status).toBe(200);

    const list = await request(app)
      .get(`${route}/${project.id}/users`)
      .set("Authorization", `Bearer ${sa.accessToken}`);
    expect(list.body.data.map((u: { id: string }) => u.id)).toEqual([u2.user.id]);
  });

  it("rejects unknown user ids on assignment", async () => {
    const sa = await saContext();
    const project = await makeProject();
    const res = await request(app)
      .post(`${route}/${project.id}/users`)
      .set("Authorization", `Bearer ${sa.accessToken}`)
      .send({ userIds: ["ghost-user"] });
    expect(res.status).toBe(400);
  });

  it("management endpoints are super-admin only", async () => {
    const project = await makeProject();
    const user = await userContext();
    const forbidden = await request(app)
      .get(`${route}/${project.id}/users`)
      .set("Authorization", `Bearer ${user.accessToken}`);
    expect(forbidden.status).toBe(403);
  });
});
