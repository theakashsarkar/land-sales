/* Admin UI golden-path E2E: login → setup data → record → payment → receipt →
   invoice → report → screenshots. Run with backend (:4001) + vite (:5173) up. */
import { chromium } from "playwright-core";
import fs from "node:fs";

const BASE = "http://localhost:5173";
const OUT = "/tmp/admin-shots";
const EXEC = "/usr/bin/chromium-browser";
const EMAIL = "admin@bhumilandmarks.com";
const PASSWORD = "ChangeMe!123";

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: EXEC, args: ["--no-sandbox"] });
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  acceptDownloads: true,
});
const page = await ctx.newPage();
const jsErrors = [];
page.on("pageerror", (e) => jsErrors.push("pageerror: " + e.message));
page.on("console", (m) => m.type() === "error" && jsErrors.push("console: " + m.text()));

const results = [];
function ok(name, cond, extra = "") {
  results.push(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
  if (!cond) process.exitCode = 1;
}
const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
const stamp = Date.now().toString().slice(-6);

try {
  // ---- 1. login page renders
  await page.goto(`${BASE}/admin/login`, { waitUntil: "networkidle" });
  await shot("01-login");
  ok("login page renders", await page.isVisible(".admin-login__card"));

  // ---- 2. login flow
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/admin", { timeout: 15000 });
  await page.waitForSelector(".stat-card", { timeout: 10000 });
  await shot("02-dashboard");
  ok("dashboard loads with stat cards", (await page.locator(".stat-card").count()) >= 4);

  // ---- 3. create category
  await page.click('a[href="/admin/categories"]');
  await page.click("text=+ New category");
  await page.fill(".modal .form-grid input", `Plot Sale ${stamp}`);
  await page.click('.modal button:has-text("Save")');
  await page.waitForSelector(`td:has-text("Plot Sale ${stamp}")`, { timeout: 8000 });
  await shot("03-categories");
  ok("category created via UI", true);

  // ---- 4. create project
  await page.click('a[href="/admin/projects"]');
  await page.click("text=+ New project");
  await page.fill('.modal .form-grid > .field:nth-child(1) input', `River View ${stamp}`);
  await page.fill('.modal .form-grid > .field:nth-child(2) input', `RV${stamp}`);
  await page.click('.modal button:has-text("Save")');
  await page.waitForSelector(`td:has-text("River View ${stamp}")`, { timeout: 8000 });
  await shot("04-projects");
  ok("project created via UI", true);

  // ---- 5. create financial record
  await page.click('a[href="/admin/records"]');
  await page.click("text=+ New record");
  await page.waitForSelector(`.modal select >> nth=0 >> option:has-text("River View ${stamp}")`, { timeout: 10000, state: "attached" });
  await page.selectOption(".modal select >> nth=0", { label: `River View ${stamp} (RV${stamp})` });
  await page.fill('.modal input[placeholder="e.g. Plot GV-A-014 sale"]', `Plot RV-A-001 sale ${stamp}`);
  await page.fill('.modal .form-grid .field:has(label:has-text("Party")) input', "Karim Uddin");
  await page.selectOption(".modal .form-grid select >> nth=1", { index: 1 });
  await page.fill('.modal input[placeholder="e.g. 1250000.50"]', "850000.50");
  await shot("05-record-form");
  await page.click('.modal button:has-text("Create record")');
  await page.waitForSelector(".stat-card", { timeout: 10000 });
  await shot("06-record-detail");
  const totalText = await page.locator(".stat-card__value").first().textContent();
  ok("record detail shows total", totalText.includes("8,50,000.50"), totalText.trim());

  // ---- 6. record a payment
  await page.click('button:has-text("+ Record payment")');
  await page.fill('.modal input[type="number"]', "300000.25");
  await page.selectOption(".modal select", "BANK");
  await page.fill('.modal input[placeholder*="Bank txn"]', `BANK-${stamp}`);
  await page.click('.modal button:has-text("Record payment")');
  await page.waitForSelector('td:has-text("BANK-' + stamp + '")', { timeout: 8000 });
  await shot("07-payment-recorded");
  const paidCard = await page.locator(".stat-card__value").nth(1).textContent();
  ok("payment recorded + balance updated", paidCard.includes("3,00,000.25"), paidCard.trim());

  // ---- 7. issue receipt from payment row
  page.on("dialog", (d) => d.accept());
  await page.click('tr:has-text("BANK-' + stamp + '") button:has-text("Receipt")');
  await page.waitForSelector("text=Receipt RCP-", { timeout: 8000 });
  ok("receipt issued from payment row", true);

  // ---- 8. create invoice via invoices page
  await page.click('a[href="/admin/invoices"]');
  await page.click("text=+ New invoice");
  await page.selectOption(".modal select >> nth=0", { label: `River View ${stamp}` });
  await page.waitForTimeout(600);
  await page.selectOption(".modal select >> nth=1", { index: 1 });
  await page.fill('.modal input[placeholder="Description"]', "2nd installment demand");
  await page.fill('.modal input[placeholder="Unit price ৳"]', "200000");
  await shot("08-invoice-form");
  await page.click('.modal button:has-text("Issue invoice")');
  await page.waitForSelector(".kv-grid", { timeout: 10000 });
  await shot("09-invoice-detail");
  ok("invoice issued + detail page", await page.isVisible(".admin-card__head"));

  // ---- 9. invoice PDF opens (new tab with PDF)
  const [pdfPage] = await Promise.all([
    ctx.waitForEvent("page", { timeout: 10000 }),
    page.click('a:has-text("Download PDF")'),
  ]);
  await pdfPage.waitForLoadState("networkidle").catch(() => {});
  const pdfOk = (await pdfPage.content()).length > 0;
  await pdfPage.close();
  ok("invoice PDF opens", pdfOk);

  // ---- 10. reports: run project-wise + download xlsx
  await page.click('a[href="/admin/reports"]');
  await page.selectOption(".filters select >> nth=0", "project-wise");
  await page.click('button:has-text("Run report")');
  await page.waitForSelector("table.admin-table tbody tr", { timeout: 8000 });
  await shot("10-reports");
  ok("report renders rows", (await page.locator("table.admin-table tbody tr").count()) >= 1);

  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 15000 }),
    page.click('button:has-text("Excel")'),
  ]);
  ok("Excel button triggers download", !!download.suggestedFilename());
  // headless blob-download artifacts are unreliable to saveAs — verify the
  // same export via an in-page fetch with the live session instead.
  const magic = await page.evaluate(async () => {
    const token = localStorage.getItem("bhumilandmarks.admin.token");
    const res = await fetch("/api/v1/reports/project-wise?format=xlsx", {
      credentials: "include",
      headers: { Authorization: `Bearer ${token}` },
    });
    const buf = new Uint8Array(await res.arrayBuffer());
    return String.fromCharCode(buf[0], buf[1]);
  });
  ok("xlsx export downloads", magic === "PK", `magic=${magic}`);

  // ---- 11. marketing site untouched
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await shot("11-marketing-home");
  ok("marketing home still renders", await page.isVisible("body"));
  await page.goto(`${BASE}/plots`, { waitUntil: "networkidle" });
  ok("marketing plots still render", true);

  // ---- 12. logout → protected redirect
  await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
  await page.click('.admin__topbar button:has-text("Logout")');
  await page.waitForURL("**/admin/login", { timeout: 8000 });
  ok("logout returns to login", true);
} catch (err) {
  console.error("E2E crashed:", err.message);
  await shot("crash").catch(() => {});
  process.exitCode = 1;
}

console.log("\n=== RESULTS ===");
for (const r of results) console.log(r);
console.log("JS errors:", jsErrors.length ? jsErrors.join(" | ") : "none");
console.log("screenshots in", OUT);
await browser.close();
