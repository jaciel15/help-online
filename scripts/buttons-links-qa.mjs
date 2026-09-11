/**
 * Smoke-test every primary button/link on hub + admin + client help.
 * Run: node scripts/buttons-links-qa.mjs
 * Pages: BASE_URL=https://jaciel15.github.io/help-online node scripts/buttons-links-qa.mjs
 */
import { chromium } from "playwright";
import fs from "fs";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:8765").replace(/\/$/, "");
const PASS = "adminupa2026";
const OUT = process.env.QA_OUT || "/tmp/buttons-links-qa.json";
const IS_PAGES = /github\.io/i.test(BASE);
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
  page.setDefaultTimeout(25000);
  page.on("dialog", async (dialog) => {
    try {
      await dialog.accept();
    } catch (e) {}
  });

  // --- Home hub links ---
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  const brand = page.locator('a.brand-lockup[href="./"]');
  if ((await brand.count()) < 1) throw new Error("brand home link missing");
  ok("hub brand → ./");

  for (const sel of ['a.btn-admin-jump[href="#administrador"]', 'a.btn-primary[href="#administrador"]']) {
    if ((await page.locator(sel).count()) < 1) throw new Error("missing " + sel);
  }
  ok("hub admin CTAs → #administrador");

  const exampleHref = await page.locator('a[href*="ayuda/?c=motos"]').first().getAttribute("href");
  if (!exampleHref || !/c=motos/.test(exampleHref)) throw new Error("bad example href");
  ok("hub example client link", exampleHref);

  if (IS_PAGES) {
    if ((await page.locator("#staticHostBanner").count()) < 1) {
      throw new Error("staticHostBanner missing on Pages");
    }
    ok("Pages static banner present");
    if ((await page.locator("#loginGhToken").count()) < 1) {
      throw new Error("GitHub token field missing on Pages login");
    }
    ok("Pages login has Token GitHub field");
  }

  await page.locator('[data-theme-set="warm"]').first().click();
  if ((await page.evaluate(() => document.documentElement.getAttribute("data-theme"))) !== "warm") {
    throw new Error("theme warm failed");
  }
  await page.locator('[data-theme-set="dark"]').first().click();
  await page.locator('[data-lang-set="en"]').first().click();
  const leadEn = await page.locator("[data-i18n='hub.lead']").textContent();
  if (!/GitHub Pages|client link|permanent/i.test(leadEn || "")) {
    throw new Error("EN lead not updated: " + leadEn);
  }
  await page.locator('[data-lang-set="es"]').first().click();
  ok("theme + lang buttons update copy");

  // --- Admin redirect ---
  await page.goto(BASE + "/admin/", { waitUntil: "networkidle" });
  if (!page.url().includes("#administrador")) throw new Error("admin redirect failed: " + page.url());
  ok("admin/ → #administrador");

  // --- entrar.html → admin ---
  await page.goto(BASE + "/entrar.html", { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  if (!page.url().includes("#administrador")) {
    throw new Error("entrar.html did not land on #administrador: " + page.url());
  }
  ok("entrar.html → #administrador");

  // --- Login + inventory actions ---
  await page.goto(BASE + "/#administrador", { waitUntil: "networkidle" });
  if ((await page.locator("#loginGhToken").count()) < 1) throw new Error("loginGhToken missing");
  ok("login shows GitHub token field");
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
    if (!/jaciel15\.github\.io\/help-online\/ayuda\//.test(shareVal)) {
      throw new Error("client copy link is not permanent Pages URL: " + shareVal);
    }
    const openHref = await page.locator("#linkShareOpen").getAttribute("href");
    if (!openHref || openHref === "#") throw new Error("Abrir ayuda href missing");
    ok("Copiar link → Pages permanente + Abrir ayuda", openHref);

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

  await page.click("#btnClear");
  ok("Limpiar");
  if ((await page.locator("#btnExport").count()) < 1) throw new Error("export missing");
  ok("Exportar JSON present");

  if ((await page.locator("#passForm button[type='submit']").count()) < 1) throw new Error("pass update missing");
  ok("Actualizar clave present");

  if ((await page.locator("#btnLogout").count()) < 1) throw new Error("logout missing");
  ok("Salir present");

  // --- Client help controls ---
  await page.goto(BASE + "/ayuda/?c=motos&b=yamaha&m=mt09&v=base", { waitUntil: "networkidle" });
  await page.waitForSelector("#fichaRoot");
  const bodyHelp = await page.locator("#fichaRoot").textContent();
  if (!/MT-09/i.test(bodyHelp || "")) throw new Error("MT-09 help did not load: " + (bodyHelp || "").slice(0, 120));
  ok("ayuda MT-09 carga", page.url());

  await page.click(".slider-arrow.next");
  await page.waitForTimeout(700);
  await page.click(".slider-arrow.prev");
  await page.waitForTimeout(700);
  ok("ayuda slider arrows");

  const dots = page.locator(".slider-dots button");
  if ((await dots.count()) > 1) {
    await dots.nth(1).click();
    await page.waitForTimeout(700);
    ok("ayuda slider dots");
  }

  await page.locator(".slider-shell").evaluate((shell) => {
    shell.scrollIntoView({ block: "center", inline: "nearest" });
  });
  await page.waitForTimeout(300);
  const opened = await page.evaluate(() => {
    const shell = document.querySelector(".slider-shell");
    if (!shell) return false;
    const sr = shell.getBoundingClientRect();
    const imgs = Array.prototype.slice.call(shell.querySelectorAll("img[data-lightbox]"));
    const visible = imgs.find(function (img) {
      const r = img.getBoundingClientRect();
      return r.width > 40 && r.height > 40 && r.left >= sr.left - 4 && r.right <= sr.right + 4;
    });
    if (!visible) return false;
    visible.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
    return document.getElementById("imageModal")?.classList.contains("open") || false;
  });
  if (!opened) throw new Error("lightbox did not open from visible slide");
  await page.waitForSelector("#imageModal.open", { state: "attached" });
  await page.click(".modal-close");
  await page.waitForFunction(() => !document.getElementById("imageModal")?.classList.contains("open"));
  ok("ayuda lightbox open/close");

  const escape = page.locator("#adminEscape a[href='../#administrador']");
  if ((await escape.count()) < 1) throw new Error("admin escape link missing from DOM");
  ok("ayuda admin escape link exists");

  for (const path of [
    "/ayuda/?c=autos&b=ford&m=focus&v=base",
    "/ayuda/?c=autos&b=nissan&m=altima&v=base",
  ]) {
    await page.goto(BASE + path, { waitUntil: "networkidle" });
    await page.waitForSelector("#fichaRoot");
    const txt = await page.locator("#fichaRoot").textContent();
    if (/no encontrada|not found|incompleto/i.test(txt || "")) {
      throw new Error("help missing at " + path + ": " + (txt || "").slice(0, 100));
    }
    ok("ayuda published ok", path);
  }

  // Legacy redirects
  await page.goto(BASE + "/motos/yamaha/mt09/", { waitUntil: "networkidle" });
  if (!page.url().includes("/ayuda/") || !page.url().includes("mt09")) {
    throw new Error("mt09 legacy redirect failed: " + page.url());
  }
  ok("legacy mt09 → ayuda");

  await page.goto(BASE + "/portal/?c=motos&b=yamaha&m=mt09&v=base", { waitUntil: "networkidle" });
  if (!page.url().includes("/ayuda/")) throw new Error("portal redirect failed: " + page.url());
  ok("portal/?… → ayuda");

  await page.goto(BASE + "/ficha/?c=motos&b=yamaha&m=mt09&v=base", { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  if (!page.url().includes("/ayuda/")) throw new Error("ficha guest redirect failed: " + page.url());
  ok("ficha/?… → ayuda");

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
