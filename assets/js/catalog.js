(function (global) {
  "use strict";

  var STORAGE_KEY = "vcdmx-catalog-v1";
  var HELP_UNIT_PREFIX = "vcdmx-help-unit:";
  var PASS_KEY = "vcdmx-admin-pass";
  var SESSION_KEY = "vcdmx-admin-session";

  // Real SHA-256 of "adminupa2026" computed at runtime on first load if needed
  async function sha256(text) {
    var data = new TextEncoder().encode(text);
    var hash = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hash))
      .map(function (b) {
        return b.toString(16).padStart(2, "0");
      })
      .join("");
  }

  function slugify(str) {
    return String(str || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 64) || "item";
  }

  function emptyCatalog() {
    return {
      updatedAt: new Date().toISOString(),
      categories: {
        autos: { label: "AUTOS", brands: {} },
        motos: { label: "MOTOS", brands: {} }
      }
    };
  }

  function deepMerge(base, over) {
    if (!over) return base;
    var out = JSON.parse(JSON.stringify(base || emptyCatalog()));
    if (over.updatedAt) out.updatedAt = over.updatedAt;
    if (!over.categories) return out;
    Object.keys(over.categories).forEach(function (cat) {
      if (!out.categories[cat]) out.categories[cat] = { label: cat.toUpperCase(), brands: {} };
      var src = over.categories[cat];
      if (src.label) out.categories[cat].label = src.label;
      if (!src.brands) return;
      Object.keys(src.brands).forEach(function (brandId) {
        out.categories[cat].brands[brandId] = src.brands[brandId];
      });
    });
    return out;
  }

  function readLocal() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function writeLocal(catalog) {
    catalog.updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(catalog));
    return catalog;
  }

  function resolveCatalogPath() {
    var scripts = document.getElementsByTagName("script");
    for (var i = 0; i < scripts.length; i++) {
      var src = scripts[i].src || "";
      if (src.indexOf("catalog.js") !== -1) {
        return src.replace(/assets\/js\/catalog\.js.*/, "data/catalog.json");
      }
    }
    var depth = (location.pathname.match(/\//g) || []).length - 1;
    var prefix = "";
    // rough fallback from path segments after root
    var parts = location.pathname.split("/").filter(Boolean);
    if (parts[parts.length - 1] && parts[parts.length - 1].indexOf(".html") !== -1) parts.pop();
    for (var j = 0; j < parts.length; j++) prefix += "../";
    return prefix + "data/catalog.json";
  }

  function loadCatalog() {
    var local = readLocal();
    var path = resolveCatalogPath();
    return fetch(path, { cache: "no-store" })
      .then(function (r) {
        if (!r.ok) throw new Error("no catalog");
        return r.json();
      })
      .then(function (fileCat) {
        // Local admin overrides win for brands/models they added
        return local ? deepMerge(fileCat, local) : fileCat;
      })
      .catch(function () {
        return local || emptyCatalog();
      });
  }

  function saveCatalog(catalog) {
    return writeLocal(catalog);
  }

  function exportCatalog(catalog) {
    var blob = new Blob([JSON.stringify(catalog, null, 2)], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "catalog.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function helpUnitKey(c, b, m, v) {
    return HELP_UNIT_PREFIX + [c, b, m, v || "base"].join(":");
  }

  function buildHelpUnit(catalog, c, b, m, v) {
    try {
      var brand = catalog.categories[c].brands[b];
      var model = brand.models[m];
      var version = getVersion(catalog, c, b, m, v);
      if (!brand || !model || !version) return null;
      return {
        c: c,
        b: b,
        m: m,
        v: version.id,
        brandName: brand.name,
        modelName: model.name,
        version: version
      };
    } catch (e) {
      return null;
    }
  }

  function saveHelpUnit(unit) {
    if (!unit || !unit.c || !unit.b || !unit.m || !unit.v) return null;
    try {
      localStorage.setItem(helpUnitKey(unit.c, unit.b, unit.m, unit.v), JSON.stringify(unit));
    } catch (e) {}
    return unit;
  }

  function exportHelpUnit(unit) {
    if (!unit) return;
    var blob = new Blob([JSON.stringify(unit, null, 2)], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = [unit.c, unit.b, unit.m, unit.v].join("-") + ".json";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function resolveHelpUnitPath(c, b, m, v) {
    var scripts = document.getElementsByTagName("script");
    for (var i = 0; i < scripts.length; i++) {
      var src = scripts[i].src || "";
      if (src.indexOf("catalog.js") !== -1) {
        return (
          src.replace(/assets\/js\/catalog\.js.*/, "data/help/") +
          encodeURIComponent(c) +
          "/" +
          encodeURIComponent(b) +
          "/" +
          encodeURIComponent(m) +
          "/" +
          encodeURIComponent(v || "base") +
          ".json"
        );
      }
    }
    return (
      "../data/help/" +
      encodeURIComponent(c) +
      "/" +
      encodeURIComponent(b) +
      "/" +
      encodeURIComponent(m) +
      "/" +
      encodeURIComponent(v || "base") +
      ".json"
    );
  }

  /** Solo una ficha: no descarga el catálogo completo (vista cliente). */
  function loadHelpUnit(c, b, m, v) {
    var versionId = v || "base";
    try {
      var raw = localStorage.getItem(helpUnitKey(c, b, m, versionId));
      if (raw) {
        return Promise.resolve(JSON.parse(raw));
      }
    } catch (e) {}

    var path = resolveHelpUnitPath(c, b, m, versionId);
    return fetch(path, { cache: "no-store" })
      .then(function (r) {
        if (!r.ok) throw new Error("help unit missing");
        return r.json();
      })
      .catch(function () {
        // Fallback solo si el admin tiene sesión (mismo navegador) y hay catálogo local
        if (!isAdminSession()) return null;
        return loadCatalog().then(function (catalog) {
          return buildHelpUnit(catalog, c, b, m, versionId);
        });
      });
  }

  function ensureBrand(catalog, category, brandName) {
    var cat = catalog.categories[category] || (catalog.categories[category] = { label: category.toUpperCase(), brands: {} });
    var id = slugify(brandName);
    if (!cat.brands[id]) cat.brands[id] = { name: brandName.toUpperCase(), models: {} };
    else cat.brands[id].name = brandName.toUpperCase();
    return id;
  }

  function ensureModel(catalog, category, brandId, modelName) {
    var brand = catalog.categories[category].brands[brandId];
    var id = slugify(modelName);
    if (!brand.models[id]) brand.models[id] = { name: modelName.toUpperCase(), versions: [] };
    else brand.models[id].name = modelName.toUpperCase();
    return id;
  }

  function upsertVersion(catalog, category, brandId, modelId, version) {
    var model = catalog.categories[category].brands[brandId].models[modelId];
    if (!model.versions) model.versions = [];
    var id = version.id || slugify(version.name || "version");
    version.id = id;
    var idx = -1;
    for (var i = 0; i < model.versions.length; i++) {
      if (model.versions[i].id === id) {
        idx = i;
        break;
      }
    }
    if (idx >= 0) model.versions[idx] = version;
    else model.versions.push(version);
    return version;
  }

  function getVersion(catalog, category, brandId, modelId, versionId) {
    try {
      var versions = catalog.categories[category].brands[brandId].models[modelId].versions || [];
      if (!versionId) return versions[0] || null;
      for (var i = 0; i < versions.length; i++) {
        if (versions[i].id === versionId) return versions[i];
      }
      return versions[0] || null;
    } catch (e) {
      return null;
    }
  }

  function listBrands(catalog, category) {
    var brands = (catalog.categories[category] && catalog.categories[category].brands) || {};
    return Object.keys(brands).map(function (id) {
      return { id: id, name: brands[id].name, models: brands[id].models || {} };
    });
  }

  function listModels(catalog, category, brandId) {
    try {
      var models = catalog.categories[category].brands[brandId].models || {};
      return Object.keys(models).map(function (id) {
        return { id: id, name: models[id].name, versions: models[id].versions || [] };
      });
    } catch (e) {
      return [];
    }
  }

  function fileToDataUrl(file) {
    return new Promise(function (resolve, reject) {
      if (!file) return resolve("");
      var reader = new FileReader();
      reader.onload = function () {
        resolve(reader.result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function ensureDefaultPass() {
    var existing = localStorage.getItem(PASS_KEY);
    if (existing) return existing;
    var hash = await sha256("adminupa2026");
    localStorage.setItem(PASS_KEY, hash);
    return hash;
  }

  async function verifyPassword(password) {
    var hash = await ensureDefaultPass();
    var attempt = await sha256(password);
    return attempt === hash;
  }

  async function setPassword(newPassword) {
    var hash = await sha256(newPassword);
    localStorage.setItem(PASS_KEY, hash);
  }

  function isAdminSession() {
    try {
      return sessionStorage.getItem(SESSION_KEY) === "1";
    } catch (e) {
      return false;
    }
  }

  function startAdminSession() {
    sessionStorage.setItem(SESSION_KEY, "1");
  }

  function endAdminSession() {
    sessionStorage.removeItem(SESSION_KEY);
  }

  function resolveAsset(path, base) {
    if (!path) return "";
    if (path.indexOf("data:") === 0 || path.indexOf("http") === 0) return path;
    return (base || "") + path;
  }

  global.VCDMXCatalog = {
    STORAGE_KEY: STORAGE_KEY,
    slugify: slugify,
    emptyCatalog: emptyCatalog,
    loadCatalog: loadCatalog,
    saveCatalog: saveCatalog,
    exportCatalog: exportCatalog,
    buildHelpUnit: buildHelpUnit,
    saveHelpUnit: saveHelpUnit,
    exportHelpUnit: exportHelpUnit,
    loadHelpUnit: loadHelpUnit,
    ensureBrand: ensureBrand,
    ensureModel: ensureModel,
    upsertVersion: upsertVersion,
    getVersion: getVersion,
    listBrands: listBrands,
    listModels: listModels,
    fileToDataUrl: fileToDataUrl,
    verifyPassword: verifyPassword,
    setPassword: setPassword,
    isAdminSession: isAdminSession,
    startAdminSession: startAdminSession,
    endAdminSession: endAdminSession,
    resolveAsset: resolveAsset,
    sha256: sha256,
    ensureDefaultPass: ensureDefaultPass
  };
})(window);
