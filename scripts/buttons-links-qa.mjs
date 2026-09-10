/**
 * Smoke-test every primary button/link on hub + admin + client help.
 * Run: node scripts/buttons-links-qa.mjs
 */
import { chromium } from "playwright";
import fs from "fs";

const BASE = process.env.BASE_URL || "http://127.0.0.1:8765";
const PASS = "adminupa2026";
const OUT = "/tmp/buttons-links-qa.json";
const results = [];

function ok(name, detail) {
  results.push({ name, ok: true, detail: detail || "" });
  console.log("✓", name, detail || "");
}
function fail(name, detail) {
  results.push({ name, ok: false, detail: String(detail || "") });
  console.error("✗", name, detail || "");
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(20000);

  // --- Home hub links ---
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  const brand = page.locator('a.brand-lockup[href="./"]');
  if ((await brand.count()) < 1) throw new Error("brand home link missing");
  ok("hub brand → ./");

  for (const sel of ['a.btn-admin-jump[href="#administrador"]', 'a.btn-primary[href="#administrador"]']) {
    if ((await page.locator(sel).count()) < 1) throw new Error("missing " + sel);
  }
  ok("hub admin CTAs");

  const exampleHref = await page.locator('a[href*="ayuda/?c=motos"]').first().getAttribute("href");
  if (!exampleHref || !/c=motos/.test(exampleHref)) throw new Error("bad example href");
  ok("hub example client link", exampleHref);

  await page.locator('[data-theme-set="warm"]').first().click();
  if ((await page.evaluate(() => document.documentElement.getAttribute("data-theme"))) !== "warm") {
    throw new Error("theme warm failed");
  }
  await page.locator('[data-theme-set="dark"]').first().click();
  await page.locator('[data-lang-set="en"]').first().click();
  const leadEn = await page.locator("[data-i18n='hub.lead']").textContent();
  if (!/client link appears/i.test(leadEn || "")) throw new Error("EN lead not updated: " + leadEn);
  await page.locator('[data-lang-set="es"]').first().click();
  ok("theme + lang buttons update copy");

  // --- Admin redirect ---
  await page.goto(BASE + "/admin/", { waitUntil: "networkidle" });
  if (!page.url().includes("#administrador")) throw new Error("admin redirect failed: " + page.url());
  ok("admin/ → #administrador");

  // --- Login + inventory actions ---
  await page.goto(BASE + "/#administrador", { waitUntil: "networkidle" });
  await page.fill("#loginPass", PASS);
  await page.click('#loginForm button[type="submit"]');
  await page.waitForSelector("#adminApp:not([hidden])");
  ok("login button");

  await page.click("#btnNew");
  const title = await page.locator("#formTitle").textContent();
  if (!/Nueva ayuda|New help/i.test(title || "")) throw new Error("btnNew form title: " + title);
  ok("btn Nueva ayuda");

  // Filters
  await page.click('.inv-filter[data-filter="motos"]');
  await page.click('.inv-filter[data-filter="autos"]');
  await page.click('.inv-filter[data-filter="all"]');
  ok("inventory filters");

  // Open Yamaha folder if present
  const yamaha = page.locator(".open-brand[data-b='yamaha']");
  if ((await yamaha.count()) > 0) {
    await yamaha.first().click();
    await page.waitForSelector("#btnBackBrands");
    ok("open brand folder");

    const edit = page.locator(".edit-help").first();
    const view = page.locator(".tree-actions a[href*='ayuda/']").first();
    const copy = page.locator(".copy-help").first();
    const del = page.locator(".delete-help").first();
    if ((await edit.count()) < 1 || (await view.count()) < 1 || (await copy.count()) < 1 || (await del.count()) < 1) {
      throw new Error("inventory action buttons incomplete");
    }

    const viewHref = await view.getAttribute("href");
    if (!viewHref || !viewHref.includes("ayuda/")) throw new Error("bad view href " + viewHref);
    ok("Ver ayuda cliente href", viewHref);

    await copy.click();
    await page.waitForSelector("#linkSharePanel:not([hidden])");
    const shareVal = await page.inputValue("#linkShareInput");
    if (!shareVal.includes("ayuda/")) throw new Error("share panel empty");
    const openHref = await page.locator("#linkShareOpen").getAttribute("href");
    if (!openHref || openHref === "#") throw new Error("Abrir ayuda href missing");
    ok("Copiar link → panel + Abrir ayuda", openHref);

    await page.click("#linkShareClose");
    if (!(await page.locator("#linkSharePanel").isHidden())) throw new Error("close share failed");
    ok("Cerrar panel link");

    await edit.click();
    await page.waitForFunction(() => /Editando|Editing/i.test(document.getElementById("formTitle")?.textContent || ""));
    ok("Editar carga formulario");

    await page.click("#btnBackBrands");
    await page.waitForSelector(".open-brand");
    ok("← Todas las marcas");
  } else {
    fail("yamaha folder", "not found in catalog");
  }

  // Photo labels point at real inputs
  for (const [label, input] of [
    ["pMainGallery", "pMainGallery"],
    ["pMainCamera", "pMainCamera"],
    ["pDashGallery", "pDashGallery"],
    ["pConnGallery", "pConnGallery"],
    ["pIgnGallery", "pIgnGallery"],
  ]) {
    const forAttr = await page.locator(`label.btn-photo[for="${label}"]`).count();
    const inputEl = await page.locator("#" + input).count();
    if (!forAttr || !inputEl) throw new Error("photo control missing " + label);
  }
  ok("Galería/Cámara labels → file inputs");

  // Clear + export + logout wired
  await page.click("#btnClear");
  ok("Limpiar");
  if ((await page.locator("#btnExport").count()) < 1) throw new Error("export missing");
  ok("Exportar JSON present");

  // Password form
  if ((await page.locator("#passForm button[type='submit']").count()) < 1) throw new Error("pass update missing");
  ok("Actualizar clave present");

  // --- Client help controls ---
  await page.goto(BASE + "/ayuda/?c=motos&b=yamaha&m=mt09&v=base", { waitUntil: "networkidle" });
  await page.waitForSelector("#fichaRoot h1");
  await page.click(".slider-arrow.next");
  await page.click(".slider-arrow.prev");
  ok("ayuda slider arrows");

  const dots = page.locator(".slider-dots button");
  if ((await dots.count()) > 1) {
    await dots.nth(1).click();
    ok("ayuda slider dots");
  }

  await page.locator("[data-lightbox]").first().click();
  await page.waitForSelector("#imageModal.open");
  await page.click(".modal-close");
  await page.waitForFunction(() => !document.getElementById("imageModal")?.classList.contains("open"));
  ok("ayuda lightbox open/close");

  const escape = page.locator("#adminEscape a[href='../#administrador']");
  if ((await escape.count()) < 1) throw new Error("admin escape link missing from DOM");
  ok("ayuda admin escape link exists");

  // Legacy redirects
  await page.goto(BASE + "/motos/yamaha/mt09/", { waitUntil: "networkidle" });
  if (!page.url().includes("/ayuda/") || !page.url().includes("mt09")) {
    throw new Error("mt09 legacy redirect failed: " + page.url());
  }
  ok("legacy mt09 → ayuda");

  await page.goto(BASE + "/portal/?c=motos&b=yamaha&m=mt09&v=base", { waitUntil: "networkidle" });
  if (!page.url().includes("/ayuda/")) throw new Error("portal redirect failed: " + page.url());
  ok("portal/?… → ayuda");

  await browser.close();

  const failed = results.filter((r) => !r.ok);
  fs.writeFileSync(OUT, JSON.stringify({ base: BASE, results, failed: failed.length }, null, 2));
  console.log("\n" + (results.length - failed.length) + "/" + results.length + " ok → " + OUT);
  if (failed.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  fs.writeFileSync(OUT, JSON.stringify({ error: String(err), results }, null, 2));
  process.exit(1);
});
