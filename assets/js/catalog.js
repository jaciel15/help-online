(function (global) {
  "use strict";

  var STORAGE_KEY = "vcdmx-catalog-v1";
  var HELP_UNIT_PREFIX = "vcdmx-help-unit:";
  var PASS_KEY = "vcdmx-admin-pass";
  var SESSION_KEY = "vcdmx-admin-session";
  var DB_NAME = "vcdmx-help-db";
  var DB_VER = 1;
  var IDB_CATALOG = "catalog";
  var IDB_HELP_PREFIX = "help:";
  var MAX_PHOTO_EDGE = 1280;
  var JPEG_QUALITY = 0.72;

  function openDb() {
    return new Promise(function (resolve, reject) {
      if (!global.indexedDB) {
        reject(new Error("IndexedDB no disponible"));
        return;
      }
      var req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv");
      };
      req.onsuccess = function () {
        resolve(req.result);
      };
      req.onerror = function () {
        reject(req.error || new Error("No se pudo abrir IndexedDB"));
      };
    });
  }

  function idbSet(key, value) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction("kv", "readwrite");
        tx.objectStore("kv").put(value, key);
        tx.oncomplete = function () {
          resolve(value);
        };
        tx.onerror = function () {
          reject(tx.error || new Error("Error al escribir en IndexedDB"));
        };
      });
    });
  }

  function idbGet(key) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction("kv", "readonly");
        var req = tx.objectStore("kv").get(key);
        req.onsuccess = function () {
          resolve(req.result);
        };
        req.onerror = function () {
          reject(req.error || new Error("Error al leer IndexedDB"));
        };
      });
    });
  }

  function clearBloatedLocalStorage() {
    try {
      var keys = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k === STORAGE_KEY || (k && k.indexOf(HELP_UNIT_PREFIX) === 0)) keys.push(k);
      }
      keys.forEach(function (k) {
        localStorage.removeItem(k);
      });
    } catch (e) {}
  }

  function migrateLocalToIdb() {
    var local = readLocal();
    var jobs = [];
    if (local) {
      jobs.push(idbSet(IDB_CATALOG, local));
    }
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf(HELP_UNIT_PREFIX) === 0) {
          try {
            var unit = JSON.parse(localStorage.getItem(k));
            if (unit && unit.c) {
              jobs.push(
                idbSet(IDB_HELP_PREFIX + [unit.c, unit.b, unit.m, unit.v || "base"].join(":"), unit)
              );
            }
          } catch (e) {}
        }
      }
    } catch (e) {}
    return Promise.all(jobs).then(function () {
      clearBloatedLocalStorage();
      return local;
    }).catch(function () {
      return local;
    });
  }

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
    // Solo metadata liviana en localStorage (sin fotos dataURL) como respaldo mínimo
    catalog.updatedAt = new Date().toISOString();
    return catalog;
  }

  function stripHeavyPhotos(catalog) {
    try {
      var copy = JSON.parse(JSON.stringify(catalog));
      ["autos", "motos"].forEach(function (cat) {
        var brands = (((copy.categories || {})[cat] || {}).brands) || {};
        Object.keys(brands).forEach(function (bid) {
          var models = brands[bid].models || {};
          Object.keys(models).forEach(function (mid) {
            (models[mid].versions || []).forEach(function (v) {
              if (!v.photos) return;
              Object.keys(v.photos).forEach(function (pk) {
                var val = v.photos[pk];
                if (val && String(val).indexOf("data:") === 0) {
                  v.photos[pk] = "[indexed]";
                }
              });
            });
          });
        });
      });
      return copy;
    } catch (e) {
      return catalog;
    }
  }

  function resolveCatalogPath() {
    var scripts = document.getElementsByTagName("script");
    for (var i = 0; i < scripts.length; i++) {
      var src = scripts[i].src || "";
      if (src.indexOf("catalog.js") !== -1) {
        return src.replace(/assets\/js\/catalog\.js.*/, "data/catalog.json");
      }
    }
    var parts = location.pathname.split("/").filter(Boolean);
    if (parts[parts.length - 1] && parts[parts.length - 1].indexOf(".html") !== -1) parts.pop();
    var prefix = "";
    for (var j = 0; j < parts.length; j++) prefix += "../";
    return prefix + "data/catalog.json";
  }

  function loadCatalog() {
    var path = resolveCatalogPath();
    return migrateLocalToIdb()
      .then(function () {
        return idbGet(IDB_CATALOG);
      })
      .catch(function () {
        return null;
      })
      .then(function (idbCat) {
        return fetch(path, { cache: "no-store" })
          .then(function (r) {
            if (!r.ok) throw new Error("no catalog");
            return r.json();
          })
          .then(function (fileCat) {
            return idbCat ? deepMerge(fileCat, idbCat) : fileCat;
          })
          .catch(function () {
            return idbCat || readLocal() || emptyCatalog();
          });
      });
  }

  function saveCatalog(catalog) {
    catalog.updatedAt = new Date().toISOString();
    // IndexedDB aguanta muchas ayudas con fotos comprimidas
    return idbSet(IDB_CATALOG, catalog)
      .then(function () {
        try {
          // respaldo liviano opcional (sin dataURLs) — ignora si no cabe
          localStorage.setItem(STORAGE_KEY + "-meta", JSON.stringify(stripHeavyPhotos(catalog)));
        } catch (e) {}
        return catalog;
      })
      .catch(function (err) {
        var msg = (err && err.message) || String(err);
        if (/quota|QuotaExceeded/i.test(msg) || (err && err.name === "QuotaExceededError")) {
          throw new Error(
            "Almacenamiento lleno. Las fotos se comprimen y guardan en IndexedDB; recarga e intenta de nuevo. Si persiste, exporta JSON y limpia datos viejos del navegador."
          );
        }
        throw err;
      });
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
    if (!unit || !unit.c || !unit.b || !unit.m || !unit.v) {
      return Promise.resolve(null);
    }
    var key = IDB_HELP_PREFIX + [unit.c, unit.b, unit.m, unit.v].join(":");
    return idbSet(key, unit).then(function () {
      // ya no usamos localStorage para fichas con fotos
      try {
        localStorage.removeItem(helpUnitKey(unit.c, unit.b, unit.m, unit.v));
      } catch (e) {}
      return unit;
    });
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

  /** Solo una ficha: IndexedDB (creador) o archivo data/help (hosting). */
  function loadHelpUnit(c, b, m, v) {
    var versionId = v || "base";
    var key = IDB_HELP_PREFIX + [c, b, m, versionId].join(":");

    return idbGet(key)
      .catch(function () {
        return null;
      })
      .then(function (fromIdb) {
        if (fromIdb) return fromIdb;

        // migración: localStorage viejo
        try {
          var raw = localStorage.getItem(helpUnitKey(c, b, m, versionId));
          if (raw) {
            var parsed = JSON.parse(raw);
            return idbSet(key, parsed).then(function () {
              try {
                localStorage.removeItem(helpUnitKey(c, b, m, versionId));
              } catch (e) {}
              return parsed;
            });
          }
        } catch (e) {}

        var path = resolveHelpUnitPath(c, b, m, versionId);
        return fetch(path, { cache: "no-store" })
          .then(function (r) {
            if (!r.ok) throw new Error("help unit missing");
            return r.json();
          })
          .catch(function () {
            if (!isAdminSession()) return null;
            return loadCatalog().then(function (catalog) {
              return buildHelpUnit(catalog, c, b, m, versionId);
            });
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

  function deleteVersion(catalog, category, brandId, modelId, versionId) {
    try {
      var brand = catalog.categories[category].brands[brandId];
      if (!brand) return false;
      var model = brand.models[modelId];
      if (!model || !model.versions) return false;
      model.versions = model.versions.filter(function (v) {
        return v.id !== versionId;
      });
      if (!model.versions.length) delete brand.models[modelId];
      if (!Object.keys(brand.models || {}).length) delete catalog.categories[category].brands[brandId];
      return true;
    } catch (e) {
      return false;
    }
  }

  function deleteHelpUnit(c, b, m, v) {
    var key = IDB_HELP_PREFIX + [c, b, m, v || "base"].join(":");
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction("kv", "readwrite");
        tx.objectStore("kv").delete(key);
        tx.oncomplete = function () {
          try {
            localStorage.removeItem(helpUnitKey(c, b, m, v || "base"));
          } catch (e) {}
          resolve(true);
        };
        tx.onerror = function () {
          reject(tx.error);
        };
      });
    });
  }

  function apiBase() {
    var scripts = document.getElementsByTagName("script");
    for (var i = 0; i < scripts.length; i++) {
      var src = scripts[i].src || "";
      if (src.indexOf("catalog.js") !== -1) {
        return src.replace(/assets\/js\/catalog\.js.*/, "");
      }
    }
    return "/";
  }

  /** Publica la ficha en el servidor (data/help/...) para que el link funcione a cualquiera. */
  function publishToServer(unit) {
    return fetch(apiBase() + "api/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(unit)
    }).then(function (r) {
      return r.json().then(function (body) {
        if (!r.ok || !body.ok) {
          throw new Error((body && body.error) || "No se pudo publicar en el servidor");
        }
        return body;
      });
    });
  }

  function deleteFromServer(c, b, m, v) {
    return fetch(apiBase() + "api/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ c: c, b: b, m: m, v: v || "base" })
    }).then(function (r) {
      return r.json().then(function (body) {
        if (!r.ok || !body.ok) {
          throw new Error((body && body.error) || "No se pudo borrar en el servidor");
        }
        return body;
      });
    });
  }

  function pingApi() {
    return fetch(apiBase() + "api/health", { cache: "no-store" })
      .then(function (r) {
        return r.ok;
      })
      .catch(function () {
        return false;
      });
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

  /** Comprime a JPEG para poder guardar muchas ayudas sin llenar el disco del navegador. */
  function compressDataUrl(dataUrl, maxEdge, quality) {
    maxEdge = maxEdge || MAX_PHOTO_EDGE;
    quality = quality == null ? JPEG_QUALITY : quality;
    return new Promise(function (resolve) {
      if (!dataUrl) return resolve("");
      if (dataUrl.indexOf("data:image") !== 0) return resolve(dataUrl);
      var img = new Image();
      img.onload = function () {
        var w = img.naturalWidth || img.width;
        var h = img.naturalHeight || img.height;
        if (!w || !h) return resolve(dataUrl);
        var scale = Math.min(1, maxEdge / Math.max(w, h));
        var cw = Math.max(1, Math.round(w * scale));
        var ch = Math.max(1, Math.round(h * scale));
        var canvas = document.createElement("canvas");
        canvas.width = cw;
        canvas.height = ch;
        var ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, cw, ch);
        try {
          resolve(canvas.toDataURL("image/jpeg", quality));
        } catch (e) {
          resolve(dataUrl);
        }
      };
      img.onerror = function () {
        resolve(dataUrl);
      };
      img.src = dataUrl;
    });
  }

  function fileToCompressedDataUrl(file) {
    if (!file) return Promise.resolve("");
    if (typeof file === "string") return compressDataUrl(file);
    return fileToDataUrl(file).then(function (url) {
      return compressDataUrl(url);
    });
  }

  function getStorageInfo() {
    return idbGet(IDB_CATALOG).then(function (cat) {
      var count = 0;
      try {
        ["autos", "motos"].forEach(function (c) {
          var brands = (((cat || {}).categories || {})[c] || {}).brands || {};
          Object.keys(brands).forEach(function (bid) {
            Object.keys(brands[bid].models || {}).forEach(function (mid) {
              count += (brands[bid].models[mid].versions || []).length;
            });
          });
        });
      } catch (e) {}
      return { helpCount: count, engine: "IndexedDB" };
    }).catch(function () {
      return { helpCount: 0, engine: "IndexedDB" };
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
    deleteVersion: deleteVersion,
    deleteHelpUnit: deleteHelpUnit,
    publishToServer: publishToServer,
    deleteFromServer: deleteFromServer,
    pingApi: pingApi,
    getVersion: getVersion,
    listBrands: listBrands,
    listModels: listModels,
    fileToDataUrl: fileToDataUrl,
    fileToCompressedDataUrl: fileToCompressedDataUrl,
    compressDataUrl: compressDataUrl,
    getStorageInfo: getStorageInfo,
    clearBloatedLocalStorage: clearBloatedLocalStorage,
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
