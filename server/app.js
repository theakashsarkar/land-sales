import express from "express";
import cors from "cors";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { settings } from "./data/settings.js";
import { projects } from "./data/projects.js";
import { plots } from "./data/plots.js";
import {
  stats,
  categories,
  amenities,
  whyChooseUs,
  testimonials,
  homeLocation,
  investmentPoints,
  gallery,
} from "./data/content.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// mode:
//   "standalone" — routes mounted at /api for the local Express server
//   "serverless" — Vercel rewrites into this function with varying paths,
//                  so an /api prefix is stripped before routing
export default function createApp({ mode = "standalone", persistInquiries = true } = {}) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const api = express.Router();

  api.get("/bootstrap", (req, res) => {
    res.json({
      settings,
      stats,
      projects,
      plots,
      categories,
      amenities,
      whyChooseUs,
      testimonials,
      homeLocation,
      investmentPoints,
      gallery,
    });
  });

  api.get("/settings", (req, res) => res.json(settings));
  api.get("/stats", (req, res) => res.json(stats));
  api.get("/categories", (req, res) => res.json(categories));
  api.get("/amenities", (req, res) => res.json(amenities));
  api.get("/why-choose-us", (req, res) => res.json(whyChooseUs));
  api.get("/testimonials", (req, res) => res.json(testimonials));
  api.get("/home-location", (req, res) => res.json(homeLocation));
  api.get("/investment-points", (req, res) => res.json(investmentPoints));
  api.get("/gallery", (req, res) => res.json(gallery));

  api.get("/projects", (req, res) => res.json(projects));

  api.get("/projects/:slug", (req, res) => {
    const project = projects.find((p) => p.slug === req.params.slug);
    if (!project) return res.status(404).json({ error: "Project not found" });
    res.json(project);
  });

  api.get("/plots", (req, res) => {
    const { project, type, size, minPrice, maxPrice, status } = req.query;
    let result = [...plots];

    if (project) result = result.filter((p) => p.projectId === project);
    if (type) result = result.filter((p) => p.type === type);
    if (status) result = result.filter((p) => p.status === status);
    if (size) result = result.filter((p) => p.size >= Number(size));
    if (minPrice) result = result.filter((p) => p.price >= Number(minPrice));
    if (maxPrice) result = result.filter((p) => p.price <= Number(maxPrice));

    res.json(result);
  });

  api.get("/plots/:id", (req, res) => {
    const plot = plots.find((p) => p.id.toUpperCase() === req.params.id.toUpperCase());
    if (!plot) return res.status(404).json({ error: "Plot not found" });
    res.json(plot);
  });

  api.post("/inquiries", (req, res) => {
    const { name, phone, email, project, plot, message } = req.body || {};
    if (!name || !phone) {
      return res.status(400).json({ error: "Name and phone are required." });
    }
    const inquiry = {
      id: Date.now(),
      name,
      phone,
      email: email || null,
      project: project || null,
      plot: plot || null,
      message: message || null,
      receivedAt: new Date().toISOString(),
    };

    if (persistInquiries) {
      // Persist to a simple JSON log so inquiries are never lost.
      const logFile = path.join(__dirname, "data", "inquiries.log.json");
      let existing = [];
      try {
        existing = JSON.parse(fs.readFileSync(logFile, "utf-8"));
      } catch {
        /* first inquiry */
      }
      existing.push(inquiry);
      fs.writeFileSync(logFile, JSON.stringify(existing, null, 2));
    } else {
      // Serverless filesystems are read-only — surface inquiries in logs
      // (wire up a database/email service here for production).
      console.log("[inquiry]", JSON.stringify(inquiry));
    }

    res.status(201).json({ ok: true, message: "Thank you! Our team will contact you shortly." });
  });

  if (mode === "serverless") {
    app.use((req, _res, next) => {
      if (req.url === "/api" || req.url.startsWith("/api/")) {
        req.url = req.url.slice(4) || "/";
      }
      next();
    });
    app.use(api);
  } else {
    app.use("/api", api);
  }

  return app;
}
