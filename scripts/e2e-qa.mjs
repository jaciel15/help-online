/**
 * E2E: admin login, folders, CRUD publish, client help, API.
 * Run: node scripts/e2e-qa.mjs
 */
import { chromium } from "playwright";
import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const BASE = process.env.BASE_URL || "http://127.0.0.1:8765";
const PASS = "adminupa2026";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT = "/tmp/e2e-qa-results.json";

const results = [];
function ok(name, detail) {
  results.push({ name, ok: true, detail: detail || "" });
  console.log("✓", name, detail || "");
}
function fail(name, detail) {
  results.push({ name, ok: false, detail: String(detail || "") });
  console.error("✗", name, detail || "");
}

function tinyJpegDataUrl() {
  // 1x1 jpeg
  const b64 =
    "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k=";
  return "data:image/jpeg;base64," + b64;
}

async function apiHealth() {
  const r = await fetch(BASE + "/api/health");
  const j = await r.json();
  if (!r.ok || !j.ok) throw new Error("health failed");
  ok("api/health", JSON.stringify(j));
}

async function clientHelpLoads(page, qs, expectTitlePart) {
  await page.goto(BASE + "/ayuda/?" + qs, { waitUntil: "networkidle" });
  const status = await page.locator("#fichaStatus").textContent().catch(() => "");
  const h1 = await page.locator("#fichaRoot h1").textContent().catch(() => "");
  if (/no encontrada|incompleto/i.test(status || "") || !h1) {
    throw new Error("client help failed: " + (status || h1 || "empty"));
  }
  if (expectTitlePart && !h1.toUpperCase().includes(expectTitlePart.toUpperCase())) {
    throw new Error("unexpected title: " + h1);
  }
  const imgs = await page.locator("#fichaRoot img[data-lightbox]").count();
  ok("client " + qs, h1 + " · fotos=" + imgs);
  return { h1, imgs };
}

async function main() {
  await apiHealth();

  // Public help JSON exists for seeded units
  for (const p of [
    "data/help/motos/yamaha/mt09/base.json",
    "data/help/autos/ford/focus/base.json",
    "data/help/autos/nissan/altima/base.json",
  ]) {
    const r = await fetch(BASE + "/" + p);
    if (!r.ok) throw new Error("missing " + p);
    const j = await r.json();
    if (!j.version) throw new Error("bad unit " + p);
    ok("public file " + p, j.brandName + " " + j.modelName);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(20000);

  // Home links
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  const adminJump = page.locator('a[href="#administrador"]');
  if ((await adminJump.count()) < 1) throw new Error("missing admin jump");
  ok("home admin CTA");

  const example = page.locator('a[href*="ayuda/?c=motos"]');
  if ((await example.count()) < 1) throw new Error("missing MT-09 example link");
  ok("home example client link");

  // Theme + lang buttons
  await page.locator('[data-theme-set="warm"]').click();
  const theme = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
  if (theme !== "warm") throw new Error("theme not warm");
  await page.locator('[data-theme-set="dark"]').click();
  await page.locator('[data-lang-set="en"]').click();
  const lang = await page.evaluate(() => document.documentElement.getAttribute("lang"));
  if (lang !== "en") throw new Error("lang not en");
  await page.locator('[data-lang-set="es"]').click();
  ok("theme + language toggles");

  // Login
  await page.goto(BASE + "/#administrador", { waitUntil: "networkidle" });
  await page.fill("#loginPass", PASS);
  await page.click('#loginForm button[type="submit"]');
  await page.waitForSelector("#adminApp:not([hidden])");
  ok("admin login");

  // Filters + brand folders
  const foldersBefore = await page.locator(".brand-folder").count();
  if (foldersBefore < 1) throw new Error("no brand folders");
  ok("brand folders visible", "count=" + foldersBefore);

  await page.click('.inv-filter[data-filter="autos"]');
  await page.waitForTimeout(200);
  const autosOnly = await page.locator(".brand-folder").count();
  const motosInAutos = await page.locator('.brand-folder[data-c="motos"]').count();
  if (motosInAutos !== 0) throw new Error("motos shown in autos filter");
  ok("filter Autos", "brands=" + autosOnly);

  await page.click('.inv-filter[data-filter="motos"]');
  await page.waitForTimeout(200);
  const autosInMotos = await page.locator('.brand-folder[data-c="autos"]').count();
  if (autosInMotos !== 0) throw new Error("autos shown in motos filter");
  ok("filter Motos");

  await page.click('.inv-filter[data-filter="all"]');
  await page.waitForTimeout(200);

  // Open Yamaha folder
  await page.click('.brand-folder[data-b="yamaha"]');
  await page.waitForSelector("#btnBackBrands");
  const helpItems = await page.locator(".inv-item").count();
  if (helpItems < 1) throw new Error("yamaha folder empty");
  ok("open Yamaha folder", "helps=" + helpItems);

  // Ver ayuda cliente link
  const ver = page.locator(".inv-item a[href*='ayuda/']").first();
  const href = await ver.getAttribute("href");
  ok("Ver ayuda cliente href", href);

  // Copy link verifies public file
  await context.grantPermissions(["clipboard-read", "clipboard-write"]).catch(() => {});
  await page.locator(".copy-help").first().click();
  await page.waitForTimeout(900);
  const copyText = await page.locator(".copy-help").first().textContent();
  if (/Error/i.test(copyText || "")) throw new Error("copy link failed verification");
  ok("Copiar link (public check)", copyText);

  await page.click("#btnBackBrands");
  await page.waitForSelector(".brand-folder");

  // Publish new Toyota Corolla with 4 photos via API-like fill
  await page.click("#btnNew");
  await page.selectOption("#fCategory", "autos");
  await page.fill("#fBrand", "Toyota");
  await page.fill("#fModel", "Corolla QA");
  await page.fill("#fVersion", "Base");
  await page.fill("#fEeprom", "93C66");
  await page.fill("#fNotes", "Prueba E2E automatizada");

  // Inject 4 photos into pending via evaluate + form fields
  const dataUrl = tinyJpegDataUrl();
  await page.evaluate((url) => {
    const keys = ["main", "dashboard", "connection", "ignition"];
    const imgs = ["prevMain", "prevDashboard", "prevConnection", "prevIgnition"];
    const sts = ["stMain", "stDashboard", "stConnection", "stIgnition"];
    keys.forEach((k, i) => {
      // Call setPhoto indirectly by dispatching through DOM: set img + rely on publish reading pending
      // pending is closed over — use file inputs with DataTransfer instead
    });
  }, dataUrl);

  // Use file chooser via setInputFiles with tiny buffers
  const tmpDir = "/tmp/e2e-photos";
  fs.mkdirSync(tmpDir, { recursive: true });
  const jpegBuf = Buffer.from(
    "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k=",
    "base64"
  );
  const files = ["main.jpg", "dash.jpg", "conn.jpg", "ign.jpg"].map((n) => {
    const p = path.join(tmpDir, n);
    fs.writeFileSync(p, jpegBuf);
    return p;
  });

  await page.setInputFiles("#pMainGallery", files[0]);
  await page.waitForTimeout(400);
  await page.setInputFiles("#pDashGallery", files[1]);
  await page.waitForTimeout(400);
  await page.setInputFiles("#pConnGallery", files[2]);
  await page.waitForTimeout(400);
  await page.setInputFiles("#pIgnGallery", files[3]);
  await page.waitForTimeout(600);

  const ready = await page.locator(".photo-slot.is-ready").count();
  if (ready < 4) throw new Error("photos not ready: " + ready);
  ok("4 photos loaded into form", "ready=" + ready);

  // Intercept navigation after save
  const [nav] = await Promise.all([
    page.waitForURL(/ayuda\/\?c=autos&b=toyota&m=corolla-qa/, { timeout: 25000 }),
    page.click("#btnPublish"),
  ]);
  ok("publish redirects to client help", page.url());

  await page.waitForSelector("#fichaRoot h1");
  const title = await page.locator("#fichaRoot h1").textContent();
  if (!/TOYOTA/i.test(title || "")) throw new Error("bad client title " + title);
  const slideCount = await page.locator("#fichaRoot img[data-lightbox]").count();
  if (slideCount < 1) throw new Error("no client photos");
  ok("client view after save", title + " slides=" + slideCount);

  // Public file + photo files on disk/API
  const unitRes = await fetch(BASE + "/data/help/autos/toyota/corolla-qa/base.json");
  if (!unitRes.ok) throw new Error("published json missing");
  const unit = await unitRes.json();
  const photos = unit.version.photos || {};
  for (const k of ["main", "dashboard", "connection", "ignition"]) {
    if (!photos[k] || String(photos[k]).startsWith("data:")) {
      throw new Error("photo not extracted to file: " + k + "=" + photos[k]);
    }
    const pr = await fetch(BASE + "/" + photos[k]);
    if (!pr.ok) throw new Error("photo file 404 " + photos[k]);
  }
  ok("server extracted photo files", JSON.stringify(photos));

  // Catalog has toyota with path thumbs
  const cat = await (await fetch(BASE + "/data/catalog.json")).json();
  const toyota = cat.categories.autos.brands.toyota;
  if (!toyota || !toyota.models["corolla-qa"]) throw new Error("toyota missing in catalog");
  const catPhotos = toyota.models["corolla-qa"].versions[0].photos;
  if (!catPhotos.main || catPhotos.main === "[published]") throw new Error("catalog still placeholder");
  ok("catalog paths updated", catPhotos.main);

  // Admin escape visible (session)
  const escapeVisible = await page.locator("#adminEscape").isVisible();
  if (!escapeVisible) throw new Error("admin escape hidden");
  ok("creator escape link visible");

  // Back to admin, open Toyota folder, edit
  await page.click('#adminEscape a');
  await page.waitForSelector("#adminApp:not([hidden])");
  await page.waitForTimeout(500);
  // may need re-show inventory
  const toyotaFolder = page.locator('.brand-folder[data-b="toyota"]');
  await toyotaFolder.waitFor({ state: "visible", timeout: 10000 });
  await toyotaFolder.click();
  await page.waitForSelector(".edit-help");
  ok("Toyota folder after publish");

  await page.click(".edit-help");
  await page.waitForTimeout(800);
  const formTitle = await page.locator("#formTitle").textContent();
  if (!/Editando/i.test(formTitle || "")) throw new Error("edit form not loaded");
  const eeprom = await page.inputValue("#fEeprom");
  if (eeprom !== "93C66") throw new Error("eeprom not loaded: " + eeprom);
  const mainSrc = await page.getAttribute("#prevMain", "src");
  if (!mainSrc || mainSrc.includes("[published]")) throw new Error("edit photo broken: " + mainSrc);
  ok("Editar loads real photos", mainSrc.slice(0, 80));

  // Delete toyota
  page.once("dialog", async (d) => {
    await d.accept();
  });
  await page.locator(".delete-help").first().click();
  await page.waitForTimeout(1200);
  const gone = await fetch(BASE + "/data/help/autos/toyota/corolla-qa/base.json");
  if (gone.status !== 404) throw new Error("delete did not remove public json: " + gone.status);
  ok("Borrar removes public help");

  // Fresh context client links (no admin session)
  const client = await browser.newContext();
  const cpage = await client.newPage();
  await clientHelpLoads(cpage, "c=motos&b=yamaha&m=mt09&v=base", "YAMAHA");
  await clientHelpLoads(cpage, "c=autos&b=ford&m=focus&v=base", "FORD");
  await clientHelpLoads(cpage, "c=autos&b=nissan&m=altima&v=base", "NISSAN");

  // Lightbox open/close
  await cpage.goto(BASE + "/ayuda/?c=motos&b=yamaha&m=mt09&v=base", { waitUntil: "networkidle" });
  await cpage.locator("#fichaRoot img[data-lightbox]").first().click();
  await cpage.waitForTimeout(400);
  const modalOpen = await cpage.evaluate(() => {
    const m = document.getElementById("imageModal");
    return !!(m && m.classList.contains("open") && document.getElementById("modalImg").getAttribute("src"));
  });
  if (!modalOpen) throw new Error("lightbox did not open");
  ok("lightbox opens");
  await cpage.locator(".modal-close").click();
  const modalClosed = await cpage.evaluate(() => !document.getElementById("imageModal").classList.contains("open"));
  if (!modalClosed) throw new Error("lightbox did not close");
  ok("lightbox close button");

  // Slider arrows + dots + lightbox close by image click
  await cpage.locator("#fichaRoot img[data-lightbox]").first().click();
  await cpage.waitForTimeout(300);
  await cpage.locator("#modalImg").click();
  await cpage.waitForTimeout(300);
  const closedByImg = await cpage.evaluate(() => !document.getElementById("imageModal").classList.contains("open"));
  if (!closedByImg) throw new Error("lightbox image click did not close");
  ok("lightbox closes on image click");

  const beforeDot = await cpage.locator(".slider-dots .active, .slider-dots button.active").count();
  await cpage.locator(".slider-arrow.next").click();
  await cpage.waitForTimeout(400);
  ok("slider next arrow");
  await cpage.locator(".slider-arrow.prev").click();
  await cpage.waitForTimeout(300);
  ok("slider prev arrow", "dotsBefore=" + beforeDot);

  // Vespa + missing help
  await clientHelpLoads(cpage, "c=motos&b=vespa&m=zardt&v=v1", "VESPA");
  await cpage.goto(BASE + "/ayuda/?c=autos&b=noexiste&m=x&v=base", { waitUntil: "domcontentloaded" });
  await cpage.waitForSelector("#fichaStatus", { timeout: 10000 });
  await cpage.waitForTimeout(500);
  const missing = await cpage.locator("#fichaStatus").textContent();
  if (!/no encontrada/i.test(missing || "")) throw new Error("missing help should show error: " + missing);
  ok("missing help message", (missing || "").slice(0, 60));

  // Portal redirect with query
  await cpage.goto(BASE + "/portal/?c=motos&b=yamaha&m=mt09&v=base", { waitUntil: "networkidle" });
  if (!cpage.url().includes("/ayuda/")) throw new Error("portal did not redirect to ayuda: " + cpage.url());
  ok("portal → ayuda redirect", cpage.url());

  // Ficha redirects guest to ayuda
  await cpage.goto(BASE + "/ficha/?c=motos&b=yamaha&m=mt09&v=base", { waitUntil: "networkidle" });
  if (!cpage.url().includes("/ayuda/")) throw new Error("ficha guest redirect failed: " + cpage.url());
  ok("ficha guest → ayuda", cpage.url());

  // Home example link navigates
  await cpage.goto(BASE + "/", { waitUntil: "networkidle" });
  await cpage.click('a[href*="ayuda/?c=motos"]');
  await cpage.waitForURL(/ayuda\/\?c=motos/);
  await cpage.waitForSelector("#fichaRoot h1");
  ok("home Ver ejemplo MT-09");

  // Admin redirect
  await cpage.goto(BASE + "/admin/", { waitUntil: "domcontentloaded" });
  await cpage.waitForTimeout(500);
  const hasLogin = await cpage.locator("#loginGate, #loginPass, #administrador").count();
  if (hasLogin < 1) throw new Error("admin redirect broken url=" + cpage.url());
  ok("admin/ route reaches hub", cpage.url());

  // Extra admin buttons: clear, new, export, edit yamaha, logout, wrong pass
  const adminCtx = await browser.newContext();
  await adminCtx.grantPermissions(["clipboard-read", "clipboard-write"]).catch(() => {});
  const ap = await adminCtx.newPage();
  await ap.goto(BASE + "/#administrador", { waitUntil: "networkidle" });
  await ap.fill("#loginPass", "wrong-password");
  ap.once("dialog", async (d) => d.accept());
  await ap.click('#loginForm button[type="submit"]');
  await ap.waitForTimeout(500);
  const stillGate = await ap.locator("#loginGate").isVisible();
  if (!stillGate) throw new Error("wrong password should keep gate");
  ok("wrong password rejected");

  await ap.fill("#loginPass", PASS);
  await ap.click('#loginForm button[type="submit"]');
  await ap.waitForSelector("#adminApp:not([hidden])");

  // Open every brand folder
  const brands = await ap.locator(".brand-folder").evaluateAll((els) =>
    els.map((e) => e.getAttribute("data-b"))
  );
  for (const bid of brands) {
    await ap.click('.brand-folder[data-b="' + bid + '"]');
    await ap.waitForSelector("#btnBackBrands");
    const n = await ap.locator(".inv-item").count();
    if (n < 1) throw new Error("empty brand folder " + bid);
    const actions = await ap.locator(".edit-help, .copy-help, .delete-help").count();
    if (actions < 3) throw new Error("missing actions in " + bid);
    ok("folder " + bid, "helps=" + n + " actions=" + actions);
    await ap.click("#btnBackBrands");
    await ap.waitForSelector(".brand-folder");
  }

  // Edit Yamaha MT-09
  await ap.click('.brand-folder[data-b="yamaha"]');
  await ap.waitForSelector(".edit-help");
  await ap.click(".edit-help");
  await ap.waitForTimeout(700);
  if (!(await ap.locator("#formTitle").textContent()).match(/Editando/i)) throw new Error("edit yamaha failed");
  const yMain = await ap.getAttribute("#prevMain", "src");
  if (!yMain) throw new Error("yamaha edit photo missing");
  ok("Editar Yamaha MT-09", yMain.slice(0, 70));

  // Clear + New
  await ap.click("#btnClear");
  await ap.waitForTimeout(300);
  const cleared = await ap.inputValue("#fBrand");
  if (cleared) throw new Error("clear did not reset brand");
  ok("Limpiar form");
  await ap.click("#btnNew");
  await ap.waitForTimeout(200);
  const newTitle = await ap.locator("#formTitle").textContent();
  if (!/Nueva ayuda/i.test(newTitle || "")) throw new Error("btnNew title");
  ok("Nueva ayuda");

  // Export catalog download
  const [download] = await Promise.all([
    ap.waitForEvent("download", { timeout: 10000 }),
    ap.click("#btnExport"),
  ]);
  const dlName = download.suggestedFilename();
  if (!/catalog\.json/i.test(dlName || "")) throw new Error("export name " + dlName);
  ok("Exportar JSON", dlName);

  // Photo gallery buttons exist and target inputs
  const photoBtns = await ap.locator(".btn-photo").count();
  if (photoBtns < 8) throw new Error("expected 8 galeria/camara buttons, got " + photoBtns);
  for (const id of [
    "pMainGallery",
    "pMainCamera",
    "pDashGallery",
    "pDashCamera",
    "pConnGallery",
    "pConnCamera",
    "pIgnGallery",
    "pIgnCamera",
    "pMulti",
  ]) {
    if ((await ap.locator("#" + id).count()) !== 1) throw new Error("missing input " + id);
  }
  ok("photo inputs + Galería/Cámara buttons", "btns=" + photoBtns);

  // Logout
  await ap.click("#btnLogout");
  await ap.waitForTimeout(800);
  const gateAgain = await ap.locator("#loginGate, #loginPass").count();
  if (gateAgain < 1) throw new Error("logout did not return to login");
  ok("Salir / logout");

  // Tunnel public smoke (if available)
  const tunnel = process.env.TUNNEL_URL || "https://dude-monitors-tooth-nasa.trycloudflare.com";
  try {
    const th = await fetch(tunnel + "/api/health", { signal: AbortSignal.timeout(8000) });
    const tj = await th.json();
    if (!th.ok || !tj.ok) throw new Error("tunnel health");
    const ta = await fetch(tunnel + "/ayuda/?c=motos&b=yamaha&m=mt09&v=base", {
      signal: AbortSignal.timeout(10000),
    });
    if (!ta.ok) throw new Error("tunnel ayuda " + ta.status);
    ok("tunnel público", tunnel);
  } catch (e) {
    fail("tunnel público", e.message || e);
  }

  await browser.close();

  const failed = results.filter((r) => !r.ok);
  fs.writeFileSync(OUT, JSON.stringify({ base: BASE, results, failed: failed.length }, null, 2));
  console.log("\n== SUMMARY ==", results.length - failed.length, "/", results.length, "passed");
  if (failed.length) {
    console.error(failed);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("FATAL", err);
  results.push({ name: "fatal", ok: false, detail: String(err && err.stack || err) });
  fs.writeFileSync(OUT, JSON.stringify({ base: BASE, results }, null, 2));
  process.exit(1);
});
