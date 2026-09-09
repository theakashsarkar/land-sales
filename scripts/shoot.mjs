/* Visual QA: captures desktop + mobile screenshots of the built site. */
import { chromium } from "playwright-core";

const BASE = "http://localhost:4000";
const OUT = "/tmp/shots";
const EXEC = "/usr/bin/chromium-browser";

const pages = [
  { name: "home", url: "/", full: true },
  { name: "projects", url: "/projects", full: true },
  { name: "project-greenvalley", url: "/projects/green-valley-township", full: true },
  { name: "plots", url: "/plots?type=residential", full: true },
  { name: "plot-gv-a-014", url: "/plots/GV-A-014", full: true },
  { name: "contact", url: "/contact?plot=GV-A-014&project=green-valley-township&interest=visit", full: true },
];

const browser = await chromium.launch({ executablePath: EXEC, args: ["--no-sandbox"] });

async function shoot(shot, viewport, fullPage) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  await page.goto(`${BASE}${shot.url}`, { waitUntil: "networkidle", timeout: 45000 }).catch((e) => console.log("nav warn:", shot.name, e.message));
  // Force reveal animations visible so the full page is captured.
  await page.addStyleTag({ content: ".reveal{opacity:1!important;transform:none!important} .hero__bg{animation:none!important}" });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/${shot.name}${viewport.width < 800 ? "-m" : ""}.png`, fullPage });
  const errors = await page.evaluate(() => window.__errors || []);
  console.log("done:", shot.name, viewport.width + "w", errors.length ? "JS ERRORS: " + errors.join(" | ") : "");
  await ctx.close();
}

// Capture console errors on one pass
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  console.log("console check:", errors.length ? errors.join(" | ") : "clean");
  await ctx.close();
}

for (const shot of pages) {
  await shoot(shot, { width: 1440, height: 900 }, shot.full);
}
await shoot({ name: "home", url: "/" }, { width: 390, height: 844 }, true);
await shoot({ name: "plot-gv-a-014", url: "/plots/GV-A-014" }, { width: 390, height: 844 }, true);

await browser.close();
console.log("all screenshots saved to", OUT);
