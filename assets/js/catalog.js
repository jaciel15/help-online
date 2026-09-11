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
  var MAX_PHOTO_EDGE = 1024;
  var JPEG_QUALITY = 0.65;

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
      deleted: [],
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
        var incoming = src.brands[brandId];
        var existing = out.categories[cat].brands[brandId];
        // Prefer incoming models, but keep real photo paths from file when IDB has placeholders
        out.categories[cat].brands[brandId] = mergeBrandPreferRealPhotos(existing, incoming);
      });
    });
    return out;
  }

  function isPhotoPlaceholder(val) {
    return !val || val === "[published]" || val === "[indexed]" || String(val).indexOf("data:") === 0;
  }

  function mergeBrandPreferRealPhotos(fileBrand, idbBrand) {
    if (!fileBrand) return JSON.parse(JSON.stringify(idbBrand));
    if (!idbBrand) return fileBrand;
    var out = JSON.parse(JSON.stringify(idbBrand));
    if (fileBrand.name && !out.name) out.name = fileBrand.name;
    var fileModels = fileBrand.models || {};
    var outModels = out.models || (out.models = {});
    Object.keys(fileModels).forEach(function (mid) {
      if (!outModels[mid]) {
        outModels[mid] = JSON.parse(JSON.stringify(fileModels[mid]));
        return;
      }
      var fVers = fileModels[mid].versions || [];
      var oVers = outModels[mid].versions || (outModels[mid].versions = []);
      fVers.forEach(function (fv) {
        var idx = -1;
        for (var i = 0; i < oVers.length; i++) {
          if (oVers[i].id === fv.id) {
            idx = i;
            break;
          }
        }
        if (idx < 0) {
          oVers.push(JSON.parse(JSON.stringify(fv)));
          return;
        }
        var ov = oVers[idx];
        var fp = fv.photos || {};
        var op = ov.photos || (ov.photos = {});
        Object.keys(fp).forEach(function (pk) {
          if (fp[pk] && (!op[pk] || isPhotoPlaceholder(op[pk]))) {
            op[pk] = fp[pk];
          }
        });
        if (!ov.eeprom && fv.eeprom) ov.eeprom = fv.eeprom;
        if (!ov.notes && fv.notes) ov.notes = fv.notes;
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

  function unitKey(c, b, m, v) {
    return [c, b, m, v || "base"].join("/");
  }

  function ensureDeletedList(catalog) {
    if (!catalog.deleted || !Array.isArray(catalog.deleted)) catalog.deleted = [];
    return catalog.deleted;
  }

  function markDeleted(catalog, c, b, m, v) {
    var key = unitKey(c, b, m, v);
    var list = ensureDeletedList(catalog);
    if (list.indexOf(key) === -1) list.push(key);
  }

  function unmarkDeleted(catalog, c, b, m, v) {
    var key = unitKey(c, b, m, v);
    catalog.deleted = ensureDeletedList(catalog).filter(function (k) {
      return k !== key;
    });
  }

  function isMarkedDeleted(catalog, c, b, m, v) {
    return ensureDeletedList(catalog).indexOf(unitKey(c, b, m, v)) !== -1;
  }

  /** IDB defines which helps exist; file only fills real photo paths. Never resurrect tombstones. */
  function mergeCatalogNoResurrect(fileCat, idbCat) {
    if (!idbCat) return fileCat || emptyCatalog();
    if (!fileCat) return idbCat;
    var out = JSON.parse(JSON.stringify(idbCat));
    ensureDeletedList(out);
    ["autos", "motos"].forEach(function (cat) {
      var fileBrands = (((fileCat.categories || {})[cat] || {}).brands) || {};
      if (!out.categories[cat]) out.categories[cat] = { label: cat.toUpperCase(), brands: {} };
      var outBrands = out.categories[cat].brands || (out.categories[cat].brands = {});
      Object.keys(fileBrands).forEach(function (brandId) {
        var fb = fileBrands[brandId];
        if (!outBrands[brandId]) {
          // New brand only from file if none of its versions are tombstoned entirely
          // — still copy brand shell for photo enrichment of future edits, but skip deleted versions
          outBrands[brandId] = { name: fb.name, models: {} };
        }
        var ob = outBrands[brandId];
        if (fb.name) ob.name = fb.name;
        var fModels = fb.models || {};
        var oModels = ob.models || (ob.models = {});
        Object.keys(fModels).forEach(function (mid) {
          var fm = fModels[mid];
          if (!oModels[mid]) oModels[mid] = { name: fm.name, versions: [] };
          if (fm.name) oModels[mid].name = fm.name;
          var oVers = oModels[mid].versions || (oModels[mid].versions = []);
          (fm.versions || []).forEach(function (fv) {
            var vid = fv.id || "base";
            if (isMarkedDeleted(out, cat, brandId, mid, vid)) return;
            var idx = -1;
            for (var i = 0; i < oVers.length; i++) {
              if (oVers[i].id === vid) {
                idx = i;
                break;
              }
            }
            if (idx < 0) {
              // Only add from file if this brand/model was empty in IDB (first sync),
              // OR if IDB never had local edits (no updatedAt newer). Safer: add from file
              // only when IDB doesn't know this brand at all yet — actually user wants
              // file seeds + local deletes. So: add from file if not tombstoned AND
              // (version already in IDB OR brand was not solely from a prior delete).
              // Simplest correct rule: add from file if not tombstoned.
              oVers.push(JSON.parse(JSON.stringify(fv)));
              return;
            }
            var ov = oVers[idx];
            var fp = fv.photos || {};
            var op = ov.photos || (ov.photos = {});
            Object.keys(fp).forEach(function (pk) {
              if (fp[pk] && (!op[pk] || isPhotoPlaceholder(op[pk]))) op[pk] = fp[pk];
            });
            if (!ov.eeprom && fv.eeprom) ov.eeprom = fv.eeprom;
            if (!ov.programmer && fv.programmer) ov.programmer = fv.programmer;
            if (!ov.type && fv.type) ov.type = fv.type;
            if ((!ov.notes || !ov.notes.length) && fv.notes) ov.notes = fv.notes;
          });
          if (!oModels[mid].versions.length) delete oModels[mid];
        });
        if (!Object.keys(oModels).length) delete outBrands[brandId];
      });
    });
    return out;
  }

  function isStaticHost() {
    try {
      var h = (location.hostname || "").toLowerCase();
      return (
        h.indexOf("github.io") !== -1 ||
        h.indexOf("pages.dev") !== -1 ||
        h === "jaciel15.github.io"
      );
    } catch (e) {
      return false;
    }
  }

  function fetchWithTimeout(url, options, ms) {
    options = options || {};
    ms = ms || 8000;
    var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = null;
    if (ctrl) {
      timer = setTimeout(function () {
        try {
          ctrl.abort();
        } catch (e) {}
      }, ms);
      options.signal = ctrl.signal;
    }
    return fetch(url, options).then(
      function (r) {
        if (timer) clearTimeout(timer);
        return r;
      },
      function (err) {
        if (timer) clearTimeout(timer);
        if (err && err.name === "AbortError") {
          throw new Error("Tiempo agotado. Usa el link del servidor (no GitHub Pages) para guardar.");
        }
        throw err;
      }
    );
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
        return fetchWithTimeout(path, { cache: "no-store" }, 10000)
          .then(function (r) {
            if (!r.ok) throw new Error("no catalog");
            return r.json();
          })
          .then(function (fileCat) {
            return pingApi().then(function (apiUp) {
              var result;
              if (apiUp && fileCat) {
                // Servidor = verdad. Conserva tombstones locales vacíos al sincronizar.
                result = JSON.parse(JSON.stringify(fileCat));
                ensureDeletedList(result);
                // Enrich placeholders from IDB only for versions that still exist on server
                if (idbCat) {
                  result = mergePhotosOnly(result, idbCat);
                }
              } else if (idbCat) {
                result = mergeCatalogNoResurrect(fileCat, idbCat);
              } else {
                result = fileCat || emptyCatalog();
                ensureDeletedList(result);
              }
              return idbSet(IDB_CATALOG, stripHeavyPhotos(result))
                .catch(function () {})
                .then(function () {
                  return result;
                });
            });
          })
          .catch(function () {
            var fallback = idbCat || readLocal() || emptyCatalog();
            ensureDeletedList(fallback);
            return fallback;
          });
      });
  }

  /** Copy real photo paths from idb into file-based catalog for matching versions only. */
  function mergePhotosOnly(filePrimary, idbCat) {
    var out = filePrimary;
    ["autos", "motos"].forEach(function (cat) {
      var brands = (((out.categories || {})[cat] || {}).brands) || {};
      var idbBrands = (((idbCat.categories || {})[cat] || {}).brands) || {};
      Object.keys(brands).forEach(function (bid) {
        var models = brands[bid].models || {};
        var idbModels = (idbBrands[bid] && idbBrands[bid].models) || {};
        Object.keys(models).forEach(function (mid) {
          (models[mid].versions || []).forEach(function (fv) {
            var idbModel = idbModels[mid];
            if (!idbModel) return;
            var iv = null;
            (idbModel.versions || []).forEach(function (v) {
              if (v.id === fv.id) iv = v;
            });
            if (!iv || !iv.photos) return;
            var op = fv.photos || (fv.photos = {});
            Object.keys(iv.photos).forEach(function (pk) {
              var val = iv.photos[pk];
              if (val && !isPhotoPlaceholder(val) && (!op[pk] || isPhotoPlaceholder(op[pk]))) {
                op[pk] = val;
              }
            });
          });
        });
      });
    });
    return out;
  }

  function saveCatalog(catalog) {
    catalog.updatedAt = new Date().toISOString();
    // Nunca guardar dataURLs en el índice del catálogo: escala a cientos de ayudas
    var light = stripHeavyPhotos(catalog);
    return idbSet(IDB_CATALOG, light)
      .then(function () {
        try {
          localStorage.setItem(STORAGE_KEY + "-meta", JSON.stringify(light));
        } catch (e) {}
        return catalog;
      })
      .catch(function (err) {
        var msg = (err && err.message) || String(err);
        if (/quota|QuotaExceeded/i.test(msg) || (err && err.name === "QuotaExceededError")) {
          throw new Error(
            "Almacenamiento lleno. Las fotos se comprimen y el catálogo ya no guarda fotos pesadas; recarga e intenta de nuevo. Si persiste, exporta JSON y limpia datos viejos del navegador."
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
    // Si ya son rutas de archivo (publicado), la ficha es liviana y escala bien
    var key = IDB_HELP_PREFIX + [unit.c, unit.b, unit.m, unit.v].join(":");
    return idbSet(key, unit).then(function () {
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

  /** Solo una ficha: prioriza archivo público data/help; IndexedDB como respaldo (creador). */
  function loadHelpUnit(c, b, m, v) {
    var versionId = v || "base";
    var key = IDB_HELP_PREFIX + [c, b, m, versionId].join(":");
    var path = resolveHelpUnitPath(c, b, m, versionId);

    function fromServer() {
      return fetch(path, { cache: "no-store" })
        .then(function (r) {
          if (!r.ok) return null;
          return r.json();
        })
        .catch(function () {
          return null;
        });
    }

    function fromIdbOrLegacy() {
      return idbGet(key)
        .catch(function () {
          return null;
        })
        .then(function (fromIdb) {
          if (fromIdb) return fromIdb;
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
          return null;
        });
    }

    function isRealPath(src) {
      return !!(
        src &&
        src !== "[published]" &&
        src !== "[indexed]" &&
        String(src).indexOf("data:") !== 0
      );
    }

    function mergeUnits(server, local) {
      if (!server) return local;
      if (!local) return server;
      var out;
      try {
        out = JSON.parse(JSON.stringify(server));
      } catch (e) {
        return server;
      }
      if (!out.version) out.version = {};
      var sp = server.version.photos || {};
      var lp = (local.version && local.version.photos) || {};
      var merged = {};
      ["main", "dashboard", "connection", "ignition"].forEach(function (k) {
        if (isRealPath(sp[k])) merged[k] = sp[k];
        else if (lp[k]) merged[k] = lp[k];
        else if (sp[k]) merged[k] = sp[k];
        else merged[k] = "";
      });
      if (!merged.ignition && (sp.eeprom || lp.eeprom)) {
        merged.ignition = isRealPath(sp.eeprom) ? sp.eeprom : lp.eeprom || sp.eeprom || "";
      }
      out.version.photos = merged;
      return out;
    }

    return Promise.all([fromServer(), fromIdbOrLegacy()]).then(function (pair) {
      var server = pair[0];
      var local = pair[1];
      var unit = mergeUnits(server, local);
      if (unit) return unit;
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
    unmarkDeleted(catalog, category, brandId, modelId, id);
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
      markDeleted(catalog, category, brandId, modelId, versionId);
      var brand = catalog.categories[category].brands[brandId];
      if (!brand) return true;
      var model = brand.models[modelId];
      if (!model || !model.versions) return true;
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

  var GH_PAT_KEY = "vcdmx-gh-pat";
  var GH_REPO = (global.VCDMX_GH_REPO || "jaciel15/help-online") + "";
  var GH_BRANCH = (global.VCDMX_GH_BRANCH || "main") + "";
  var CLIENT_PAGES_BASE = (
    (global.VCDMX_CLIENT_PAGES_BASE || "https://jaciel15.github.io/help-online") + ""
  ).replace(/\/$/, "");
  var PHOTO_KEYS_PUB = ["main", "dashboard", "connection", "ignition"];
  var PLACEHOLDERS_PUB = { "[published]": 1, "[indexed]": 1, "": 1 };

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

  function getGitHubToken() {
    try {
      return (localStorage.getItem(GH_PAT_KEY) || "").trim();
    } catch (e) {
      return "";
    }
  }

  function setGitHubToken(token) {
    token = String(token || "").trim();
    try {
      if (token) localStorage.setItem(GH_PAT_KEY, token);
      else localStorage.removeItem(GH_PAT_KEY);
    } catch (e) {}
    return !!token;
  }

  function clearGitHubToken() {
    return setGitHubToken("");
  }

  function hasGitHubToken() {
    return !!getGitHubToken();
  }

  function clientHelpUrl(c, b, m, v) {
    return (
      CLIENT_PAGES_BASE +
      "/ayuda/?c=" +
      encodeURIComponent(c) +
      "&b=" +
      encodeURIComponent(b) +
      "&m=" +
      encodeURIComponent(m) +
      "&v=" +
      encodeURIComponent(v || "base")
    );
  }

  function photoFilename(versionId, key, ext) {
    if (versionId && versionId !== "base") return versionId + "-" + key + "." + ext;
    return key + "." + ext;
  }

  function utf8ToBase64(text) {
    var bytes = new TextEncoder().encode(text);
    var bin = "";
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  function dataUrlToPayload(dataUrl) {
    var parts = String(dataUrl || "").split(",");
    if (parts.length < 2) throw new Error("imagen inválida");
    var header = parts[0].toLowerCase();
    if (header.indexOf("heic") >= 0 || header.indexOf("heif") >= 0) {
      throw new Error("HEIC no soportado");
    }
    var ext = "jpg";
    if (header.indexOf("image/png") >= 0) ext = "png";
    else if (header.indexOf("image/webp") >= 0) ext = "webp";
    else if (header.indexOf("image/gif") >= 0) ext = "gif";
    else if (header.indexOf("image/jpeg") >= 0 || header.indexOf("image/jpg") >= 0) ext = "jpg";
    else if (header.indexOf("image/") < 0) throw new Error("no es imagen");
    var b64 = parts.slice(1).join(",");
    var rawLen = Math.floor((b64.replace(/=+$/, "").length * 3) / 4);
    if (rawLen < 32) throw new Error("imagen vacía");
    return { ext: ext, content: b64 };
  }

  function ghHeaders() {
    var token = getGitHubToken();
    if (!token) throw new Error("Falta el token de GitHub. Pégalo al entrar al admin.");
    return {
      Accept: "application/vnd.github+json",
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28"
    };
  }

  function ghRequest(path, options) {
    options = options || {};
    var url = "https://api.github.com/repos/" + GH_REPO + "/contents/" + path.replace(/^\/+/, "");
    if ((options.method || "GET").toUpperCase() === "GET") {
      url += (url.indexOf("?") >= 0 ? "&" : "?") + "ref=" + encodeURIComponent(GH_BRANCH);
    }
    return fetchWithTimeout(
      url,
      {
        method: options.method || "GET",
        headers: ghHeaders(),
        body: options.body ? JSON.stringify(options.body) : undefined,
        cache: "no-store"
      },
      options.timeout || 45000
    ).then(function (r) {
      return r.text().then(function (raw) {
        var body = null;
        try {
          body = raw ? JSON.parse(raw) : null;
        } catch (e) {
          body = null;
        }
        return { ok: r.ok, status: r.status, body: body, raw: raw };
      });
    });
  }

  function ghGetFile(path) {
    return ghRequest(path, { method: "GET", timeout: 20000 }).then(function (res) {
      if (res.status === 404) return { exists: false, sha: "", content: "" };
      if (!res.ok) {
        throw new Error(
          (res.body && res.body.message) || "GitHub no pudo leer " + path + " (" + res.status + ")"
        );
      }
      var content = "";
      if (res.body && res.body.encoding === "base64" && res.body.content) {
        try {
          var bin = atob(String(res.body.content).replace(/\n/g, ""));
          var bytes = new Uint8Array(bin.length);
          for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          content = new TextDecoder().decode(bytes);
        } catch (e) {
          content = "";
        }
      }
      return { exists: true, sha: res.body.sha || "", content: content, raw: res.body };
    });
  }

  function ghPutFile(path, contentBase64, message, sha) {
    var body = {
      message: message,
      content: contentBase64,
      branch: GH_BRANCH
    };
    if (sha) body.sha = sha;
    return ghRequest(path, { method: "PUT", body: body, timeout: 60000 }).then(function (res) {
      if (!res.ok) {
        throw new Error(
          (res.body && res.body.message) || "No se pudo guardar " + path + " (" + res.status + ")"
        );
      }
      return res.body;
    });
  }

  function ghDeleteFile(path, message, sha) {
    if (!sha) return Promise.resolve(false);
    return ghRequest(path, {
      method: "DELETE",
      body: { message: message, sha: sha, branch: GH_BRANCH },
      timeout: 30000
    }).then(function (res) {
      if (res.status === 404) return false;
      if (!res.ok) {
        throw new Error(
          (res.body && res.body.message) || "No se pudo borrar " + path + " (" + res.status + ")"
        );
      }
      return true;
    });
  }

  function catalogPhotosLite(photos) {
    var out = {};
    PHOTO_KEYS_PUB.forEach(function (key) {
      var val = (photos || {})[key] || "";
      if (!val || PLACEHOLDERS_PUB[val] || String(val).indexOf("data:") === 0) return;
      out[key] = val;
    });
    return out;
  }

  function upsertUnitIntoCatalog(catalog, unit) {
    var c = unit.c;
    var b = unit.b;
    var m = unit.m;
    var version = Object.assign({}, unit.version || {});
    var vid = version.id || unit.v || "base";
    version.id = vid;
    version.photos = catalogPhotosLite(version.photos);
    catalog.categories = catalog.categories || {};
    var cat = catalog.categories[c] || { label: String(c).toUpperCase(), brands: {} };
    catalog.categories[c] = cat;
    cat.brands = cat.brands || {};
    var brand = cat.brands[b] || { name: unit.brandName || String(b).toUpperCase(), models: {} };
    cat.brands[b] = brand;
    if (unit.brandName) brand.name = unit.brandName;
    brand.models = brand.models || {};
    var model = brand.models[m] || { name: unit.modelName || String(m).toUpperCase(), versions: [] };
    brand.models[m] = model;
    if (unit.modelName) model.name = unit.modelName;
    model.versions = model.versions || [];
    var found = false;
    for (var i = 0; i < model.versions.length; i++) {
      if (model.versions[i].id === vid) {
        model.versions[i] = version;
        found = true;
        break;
      }
    }
    if (!found) model.versions.push(version);
    catalog.updatedAt = new Date().toISOString();
    return catalog;
  }

  function deleteUnitFromCatalog(catalog, c, b, m, v) {
    try {
      var brand = catalog.categories[c].brands[b];
      var model = brand.models[m];
      model.versions = (model.versions || []).filter(function (x) {
        return x.id !== v;
      });
      if (!model.versions.length) delete brand.models[m];
      if (!Object.keys(brand.models || {}).length) delete catalog.categories[c].brands[b];
    } catch (e) {}
    catalog.updatedAt = new Date().toISOString();
    return catalog;
  }

  function extractAndPutPhotos(unit) {
    var c = unit.c;
    var b = unit.b;
    var m = unit.m;
    var version = Object.assign({}, unit.version || {});
    var vid = version.id || unit.v || "base";
    version.id = vid;
    var photosIn = Object.assign({}, version.photos || {});
    var photosOut = {};
    var chain = Promise.resolve();

    PHOTO_KEYS_PUB.forEach(function (key) {
      chain = chain.then(function () {
        var val = photosIn[key] || "";
        if (key === "ignition" && !val) val = photosIn.eeprom || "";

        if (typeof val === "string" && val.indexOf("data:") === 0) {
          var payload = dataUrlToPayload(val);
          var fname = photoFilename(vid, key, payload.ext);
          var rel = "data/help/" + c + "/" + b + "/" + m + "/" + fname;
          return ghGetFile(rel).then(function (existing) {
            return ghPutFile(
              rel,
              payload.content,
              "Publish photo " + c + "/" + b + "/" + m + "/" + fname,
              existing.exists ? existing.sha : ""
            ).then(function () {
              photosOut[key] = rel;
            });
          });
        }

        if (typeof val === "string" && val && !PLACEHOLDERS_PUB[val]) {
          if (val.indexOf("http://") === 0 || val.indexOf("https://") === 0) {
            photosOut[key] = val;
            return;
          }
          var relPath = val.replace(/\\/g, "/").replace(/^\.\//, "");
          if (relPath.indexOf("../") === 0) relPath = relPath.slice(3);
          photosOut[key] = relPath;
          return;
        }

        photosOut[key] = "";
      });
    });

    return chain.then(function () {
      var missing = PHOTO_KEYS_PUB.filter(function (k) {
        return !photosOut[k];
      });
      if (missing.length) {
        throw new Error(
          "Faltan fotos: " + missing.join(", ") + ". Sube las 4 (principal, dashboard, conexiones, pin-out)."
        );
      }
      version.photos = photosOut;
      unit.version = version;
      unit.v = vid;
      return unit;
    });
  }

  function publishViaGitHub(unit) {
    if (!hasGitHubToken()) {
      return Promise.reject(
        new Error(
          "Para guardar en GitHub Pages pega tu token de GitHub al entrar (solo tú lo ves en este teléfono)."
        )
      );
    }
    var working = JSON.parse(JSON.stringify(unit));
    return extractAndPutPhotos(working).then(function (ready) {
      var c = ready.c;
      var b = ready.b;
      var m = ready.m;
      var v = ready.v || "base";
      var helpPath = "data/help/" + c + "/" + b + "/" + m + "/" + v + ".json";
      var helpJson = JSON.stringify(ready, null, 2);
      return ghGetFile(helpPath)
        .then(function (existing) {
          return ghPutFile(
            helpPath,
            utf8ToBase64(helpJson),
            "Publish help: " + c + "/" + b + "/" + m + "/" + v,
            existing.exists ? existing.sha : ""
          );
        })
        .then(function () {
          return ghGetFile("data/catalog.json").then(function (catFile) {
            var catalog;
            try {
              catalog = catFile.content ? JSON.parse(catFile.content) : emptyCatalog();
            } catch (e) {
              catalog = emptyCatalog();
            }
            upsertUnitIntoCatalog(catalog, ready);
            var catJson = JSON.stringify(catalog, null, 2);
            return ghPutFile(
              "data/catalog.json",
              utf8ToBase64(catJson),
              "Update catalog: " + c + "/" + b + "/" + m + "/" + v,
              catFile.exists ? catFile.sha : ""
            ).then(function () {
              return {
                ok: true,
                path: helpPath,
                helpUrl: "ayuda/?c=" + c + "&b=" + b + "&m=" + m + "&v=" + v,
                clientUrl: clientHelpUrl(c, b, m, v),
                photos: (ready.version && ready.version.photos) || {},
                unit: ready,
                via: "github-pages"
              };
            });
          });
        });
    });
  }

  function deleteViaGitHub(c, b, m, v) {
    if (!hasGitHubToken()) {
      return Promise.reject(
        new Error("Para borrar en GitHub Pages pega tu token de GitHub al entrar al admin.")
      );
    }
    v = v || "base";
    var helpPath = "data/help/" + c + "/" + b + "/" + m + "/" + v + ".json";
    var photoNames = [];
    PHOTO_KEYS_PUB.forEach(function (key) {
      ["jpg", "jpeg", "png", "webp", "gif"].forEach(function (ext) {
        photoNames.push(photoFilename(v, key, ext));
        photoNames.push(key + "." + ext);
        photoNames.push(v + "-" + key + "." + ext);
      });
    });
    // unique
    photoNames = photoNames.filter(function (n, i, a) {
      return a.indexOf(n) === i;
    });

    return ghGetFile(helpPath)
      .then(function (helpFile) {
        return ghDeleteFile(helpPath, "Delete help: " + c + "/" + b + "/" + m + "/" + v, helpFile.sha);
      })
      .then(function () {
        var chain = Promise.resolve();
        photoNames.forEach(function (name) {
          var rel = "data/help/" + c + "/" + b + "/" + m + "/" + name;
          chain = chain.then(function () {
            return ghGetFile(rel).then(function (f) {
              if (!f.exists) return false;
              return ghDeleteFile(rel, "Delete photo " + rel, f.sha).catch(function () {
                return false;
              });
            });
          });
        });
        return chain;
      })
      .then(function () {
        return ghGetFile("data/catalog.json").then(function (catFile) {
          if (!catFile.exists) return { ok: true, clientUrl: clientHelpUrl(c, b, m, v), via: "github-pages" };
          var catalog;
          try {
            catalog = JSON.parse(catFile.content);
          } catch (e) {
            catalog = emptyCatalog();
          }
          deleteUnitFromCatalog(catalog, c, b, m, v);
          return ghPutFile(
            "data/catalog.json",
            utf8ToBase64(JSON.stringify(catalog, null, 2)),
            "Update catalog after delete: " + c + "/" + b + "/" + m + "/" + v,
            catFile.sha
          ).then(function () {
            return { ok: true, clientUrl: clientHelpUrl(c, b, m, v), via: "github-pages" };
          });
        });
      });
  }

  function pingLiveApi() {
    if (isStaticHost()) return Promise.resolve(false);
    return fetchWithTimeout(apiBase() + "api/health", { cache: "no-store" }, 4000)
      .then(function (r) {
        if (!r.ok) return false;
        return r
          .json()
          .then(function (body) {
            return !!(body && body.ok);
          })
          .catch(function () {
            return false;
          });
      })
      .catch(function () {
        return false;
      });
  }

  /** ¿Se puede Guardar/Borrar? Servidor vivo O token de GitHub (Pages). */
  function canPublish() {
    if (hasGitHubToken()) return Promise.resolve({ ok: true, via: "github" });
    return pingLiveApi().then(function (up) {
      return { ok: !!up, via: up ? "server" : "none" };
    });
  }

  function pingApi() {
    return canPublish().then(function (st) {
      return !!st.ok;
    });
  }

  function publishToLiveServer(unit) {
    return fetchWithTimeout(
      apiBase() + "api/publish",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(unit)
      },
      45000
    ).then(function (r) {
      return r.text().then(function (raw) {
        var body = null;
        try {
          body = raw ? JSON.parse(raw) : null;
        } catch (e) {
          body = null;
        }
        if (!r.ok || !body || !body.ok) {
          throw new Error(
            (body && body.error) ||
              (r.status === 404
                ? "API no disponible. En GitHub Pages usa tu token de GitHub para guardar."
                : "No se pudo publicar en el servidor (" + r.status + ")")
          );
        }
        if (!body.clientUrl) {
          body.clientUrl = clientHelpUrl(unit.c, unit.b, unit.m, (unit.version && unit.version.id) || unit.v || "base");
        }
        body.via = body.via || "server";
        return body;
      });
    });
  }

  function deleteFromLiveServer(c, b, m, v) {
    return fetchWithTimeout(
      apiBase() + "api/delete",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ c: c, b: b, m: m, v: v || "base" })
      },
      15000
    ).then(function (r) {
      return r.json().then(function (body) {
        if (!r.ok || !body.ok) {
          throw new Error((body && body.error) || "No se pudo borrar en el servidor");
        }
        body.via = body.via || "server";
        return body;
      });
    });
  }

  /** Publica la ficha: GitHub Pages (token) o servidor temporal si está vivo. */
  function publishToServer(unit) {
    if (hasGitHubToken()) return publishViaGitHub(unit);
    return pingLiveApi().then(function (up) {
      if (up) return publishToLiveServer(unit);
      throw new Error(
        "Para guardar sin que se apague: entra al admin en GitHub Pages y pega tu token de GitHub (Contents: Read and write)."
      );
    });
  }

  function deleteFromServer(c, b, m, v) {
    if (hasGitHubToken()) return deleteViaGitHub(c, b, m, v);
    return pingLiveApi().then(function (up) {
      if (up) return deleteFromLiveServer(c, b, m, v);
      throw new Error(
        "Para borrar sin servidor temporal: entra en GitHub Pages y pega tu token de GitHub."
      );
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
    return new Promise(function (resolve, reject) {
      if (!dataUrl) return resolve("");
      if (dataUrl.indexOf("data:image") !== 0) {
        return reject(new Error("Archivo no es una imagen válida."));
      }
      if (/data:image\/hei[cf]/i.test(dataUrl)) {
        return reject(
          new Error(
            "Formato HEIC no soportado. En iPhone: Ajustes → Cámara → Formatos → Más compatible, o exporta JPG."
          )
        );
      }
      var img = new Image();
      img.onload = function () {
        var w = img.naturalWidth || img.width;
        var h = img.naturalHeight || img.height;
        if (!w || !h) {
          return reject(new Error("La imagen no tiene tamaño válido."));
        }
        var scale = Math.min(1, maxEdge / Math.max(w, h));
        var cw = Math.max(1, Math.round(w * scale));
        var ch = Math.max(1, Math.round(h * scale));
        var canvas = document.createElement("canvas");
        canvas.width = cw;
        canvas.height = ch;
        var ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("No se pudo procesar la imagen."));
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, cw, ch);
        ctx.drawImage(img, 0, 0, cw, ch);
        try {
          var out = canvas.toDataURL("image/jpeg", quality);
          if (!out || out.indexOf("data:image/jpeg") !== 0) {
            return reject(new Error("No se pudo convertir a JPEG."));
          }
          resolve(out);
        } catch (e) {
          reject(new Error("No se pudo comprimir la imagen."));
        }
      };
      img.onerror = function () {
        reject(
          new Error(
            "No se pudo leer la imagen. Usa JPG o PNG (no HEIC/HEIF)."
          )
        );
      };
      img.src = dataUrl;
    });
  }

  function fileToCompressedDataUrl(file) {
    if (!file) return Promise.resolve("");
    if (typeof file === "string") return compressDataUrl(file);
    var name = String(file.name || "").toLowerCase();
    var type = String(file.type || "").toLowerCase();
    if (
      type.indexOf("heic") >= 0 ||
      type.indexOf("heif") >= 0 ||
      /\.heic$|\.heif$/.test(name)
    ) {
      return Promise.reject(
        new Error(
          "El iPhone guardó HEIC. Ajustes → Cámara → Formatos → Más compatible, o elige JPG."
        )
      );
    }
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
    isStaticHost: isStaticHost,
    pingApi: pingApi,
    canPublish: canPublish,
    getGitHubToken: getGitHubToken,
    setGitHubToken: setGitHubToken,
    clearGitHubToken: clearGitHubToken,
    hasGitHubToken: hasGitHubToken,
    clientHelpUrl: clientHelpUrl,
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
