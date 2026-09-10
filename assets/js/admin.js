(function () {
  "use strict";

  var C = window.VCDMXCatalog;
  var CFG = window.VCDMX_ADMIN || {
    root: "../",
    ayudaBase: "../ayuda/",
    assetPrefix: "../"
  };
  var FOLDERS_KEY = "vcdmx-folders-v1";
  var catalog = null;
  var pending = { main: "", dashboard: "", connection: "", ignition: "" };
  var editing = null;
  var listFilter = "all";
  var brandView = null; // { cat, brandId, brandName } when inside a brand folder
  var PHOTO_KEYS = ["main", "dashboard", "connection", "ignition"];
  var PHOTO_META = {
    main: { img: "prevMain", st: "stMain", slot: 1 },
    dashboard: { img: "prevDashboard", st: "stDashboard", slot: 2 },
    connection: { img: "prevConnection", st: "stConnection", slot: 3 },
    ignition: { img: "prevIgnition", st: "stIgnition", slot: 4 }
  };
  var CHAIN = {
    main: { nextSlot: 2, nextGallery: "pDashGallery" },
    dashboard: { nextSlot: 3, nextGallery: "pConnGallery" },
    connection: { nextSlot: 4, nextGallery: "pIgnGallery" },
    ignition: { nextSlot: 0, nextGallery: null }
  };

  function $(id) {
    return document.getElementById(id);
  }

  function showApp(on) {
    var gate = $("loginGate");
    var app = $("adminApp");
    if (gate) gate.hidden = on;
    if (app) app.hidden = !on;
  }

  function isPlaceholderPhoto(path) {
    return !path || path === "[published]" || path === "[indexed]";
  }

  function resolvePreview(path) {
    if (isPlaceholderPhoto(path)) return "";
    if (path.indexOf("data:") === 0 || path.indexOf("http") === 0 || path.indexOf("blob:") === 0) return path;
    if (path.indexOf("../") === 0 || path.indexOf("/") === 0 || path.indexOf("./") === 0) return path;
    return (CFG.assetPrefix || "") + path;
  }

  function guessPublishedPhoto(c, b, m, v, key) {
    var base =
      (CFG.root || "") +
      "data/help/" +
      encodeURIComponent(c) +
      "/" +
      encodeURIComponent(b) +
      "/" +
      encodeURIComponent(m) +
      "/";
    var vid = v || "base";
    if (vid !== "base") return base + encodeURIComponent(vid + "-" + key + ".jpg");
    return base + encodeURIComponent(key + ".jpg");
  }

  function helpHref(cat, brandId, modelId, versionId) {
    return (
      (CFG.ayudaBase || "ayuda/") +
      "?c=" +
      encodeURIComponent(cat) +
      "&b=" +
      encodeURIComponent(brandId) +
      "&m=" +
      encodeURIComponent(modelId) +
      "&v=" +
      encodeURIComponent(versionId || "base")
    );
  }

  function folderPath(cat, brandId, modelId) {
    return [cat, brandId, modelId].join("/");
  }

  function readFolders() {
    try {
      return JSON.parse(localStorage.getItem(FOLDERS_KEY) || "[]");
    } catch (e) {
      return [];
    }
  }

  function syncFoldersFromCatalog() {
    var list = [];
    if (!catalog) return list;
    ["autos", "motos"].forEach(function (cat) {
      C.listBrands(catalog, cat).forEach(function (b) {
        Object.keys(b.models || {}).forEach(function (mid) {
          var model = b.models[mid];
          (model.versions || []).forEach(function (v) {
            list.push({
              key: folderPath(cat, b.id, mid) + "/" + (v.id || "base"),
              c: cat,
              b: b.id,
              m: mid,
              v: v.id || "base",
              label: b.name + " " + model.name,
              path: folderPath(cat, b.id, mid),
              updatedAt: new Date().toISOString()
            });
          });
        });
      });
    });
    try {
      localStorage.setItem(FOLDERS_KEY, JSON.stringify(list));
    } catch (e) {}
    return list;
  }

  function updateFolderCount() {
    var el = $("folderCount");
    if (!el) return;
    var n = countItems();
    el.textContent = "Carpetas: " + n + (n === 1 ? " ayuda" : " ayudas");
    refreshStorageStatus();
  }

  function refreshStorageStatus() {
    var el = $("storageStatus");
    if (!el) return;
    fetch((CFG.root || "") + "api/storage", { cache: "no-store" })
      .then(function (r) {
        return r.json();
      })
      .then(function (body) {
        var disk = (body && body.disk) || {};
        var free = disk.freeMb != null ? disk.freeMb : "?";
        var ok = disk.ok !== false;
        el.textContent =
          (ok ? "✓ " : "⚠ ") +
          "Espacio servidor: " +
          free +
          " MB libres" +
          (ok ? " · listo para más ayudas" : " · libera espacio antes de guardar");
        el.style.color = ok ? "" : "#f5a623";
      })
      .catch(function () {
        el.textContent = "Espacio servidor: no disponible (¿servidor apagado?)";
      });
  }

  function setPhoto(key, url) {
    pending[key] = url || "";
    var meta = PHOTO_META[key];
    if (!meta) return;
    var img = $(meta.img);
    var st = $(meta.st);
    var slot = document.querySelector('.photo-slot[data-slot="' + meta.slot + '"]');
    if (!img || !st) return;
    var preview = resolvePreview(url);
    if (preview) {
      img.src = preview;
      img.classList.add("show");
      st.textContent = "Lista";
      if (slot) slot.classList.add("is-ready");
    } else {
      img.removeAttribute("src");
      img.classList.remove("show");
      st.textContent = "Pendiente";
      if (slot) slot.classList.remove("is-ready");
    }
    updatePublishPulse();
  }

  function updatePublishPulse() {
    var btn = $("btnPublish");
    if (!btn) return;
    var ready = PHOTO_KEYS.every(function (k) {
      return !!pending[k];
    });
    btn.classList.toggle("is-pulse", ready);
  }

  function markActiveSlot(n) {
    document.querySelectorAll(".photo-slot").forEach(function (el) {
      el.classList.toggle("is-active", el.getAttribute("data-slot") === String(n));
    });
  }

  function openPicker(inputId) {
    var el = $(inputId);
    if (!el) return;
    setTimeout(function () {
      try {
        el.click();
      } catch (e) {}
    }, 80);
  }

  function onPhotoChosen(key, file, chain) {
    if (!file) return;
    C.fileToCompressedDataUrl(file).then(function (url) {
      setPhoto(key, url);
      if (!chain) return;
      var next = CHAIN[key];
      if (next && next.nextGallery) {
        markActiveSlot(next.nextSlot);
        openPicker(next.nextGallery);
      } else {
        markActiveSlot(0);
        if ($("btnPublish")) $("btnPublish").focus();
      }
    });
  }

  function bindPhotoInput(inputId, key, chain) {
    var el = $(inputId);
    if (!el) return;
    el.addEventListener("change", function () {
      var file = this.files && this.files[0];
      onPhotoChosen(key, file, chain);
      this.value = "";
    });
  }

  function applyFilesInOrder(fileList) {
    var files = Array.prototype.slice.call(fileList || [], 0, 4);
    return Promise.all(
      files.map(function (file, i) {
        return C.fileToCompressedDataUrl(file).then(function (url) {
          setPhoto(PHOTO_KEYS[i], url);
        });
      })
    );
  }

  function firstRealPhoto(photos, meta) {
    var keys = ["main", "dashboard", "connection", "ignition", "eeprom"];
    for (var i = 0; i < keys.length; i++) {
      var src = photos && photos[keys[i]];
      if (!isPlaceholderPhoto(src)) return src;
    }
    if (meta && meta.c && meta.b && meta.m) {
      return guessPublishedPhoto(meta.c, meta.b, meta.m, meta.v, "main");
    }
    return "";
  }

  function thumbHtml(photos, meta) {
    var src = firstRealPhoto(photos, meta);
    var preview = resolvePreview(src);
    if (!preview) return '<div class="inv-thumb inv-thumb--empty">Sin foto</div>';
    return '<div class="inv-thumb"><img src="' + preview + '" alt="" loading="lazy"></div>';
  }

  function countItems() {
    var n = 0;
    if (!catalog) return 0;
    ["autos", "motos"].forEach(function (cat) {
      C.listBrands(catalog, cat).forEach(function (b) {
        Object.keys(b.models || {}).forEach(function (mid) {
          n += (b.models[mid].versions || []).length;
        });
      });
    });
    return n;
  }

  function countBrandHelps(cat, brandId) {
    var n = 0;
    try {
      var models = catalog.categories[cat].brands[brandId].models || {};
      Object.keys(models).forEach(function (mid) {
        n += (models[mid].versions || []).length;
      });
    } catch (e) {}
    return n;
  }

  function brandThumb(cat, brandId) {
    try {
      var models = catalog.categories[cat].brands[brandId].models || {};
      var mids = Object.keys(models);
      for (var i = 0; i < mids.length; i++) {
        var versions = models[mids[i]].versions || [];
        for (var j = 0; j < versions.length; j++) {
          var v = versions[j];
          var photos = v.photos || {};
          var meta = { c: cat, b: brandId, m: mids[i], v: v.id || "base" };
          if (firstRealPhoto(photos, meta)) return thumbHtml(photos, meta);
        }
      }
    } catch (e) {}
    return '<div class="inv-thumb inv-thumb--empty">📁</div>';
  }

  function copyTextNow(text) {
    return new Promise(function (resolve) {
      var ok = false;
      try {
        var ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.setAttribute("aria-hidden", "true");
        ta.style.cssText = "position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;border:0;padding:0;margin:0;";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        ta.setSelectionRange(0, String(text).length);
        ok = document.execCommand("copy");
        document.body.removeChild(ta);
      } catch (e) {
        ok = false;
      }
      if (ok) {
        resolve(true);
        return;
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard
          .writeText(text)
          .then(function () {
            resolve(true);
          })
          .catch(function () {
            resolve(false);
          });
        return;
      }
      resolve(false);
    });
  }

  function showLinkSharePanel(url, note) {
    var panel = $("linkSharePanel");
    var input = $("linkShareInput");
    var hint = $("linkShareHint");
    if (!panel || !input) return;
    panel.hidden = false;
    input.value = url || "";
    if (hint) {
      hint.textContent =
        note ||
        "Si el teléfono no pegó solo, toca el cuadro, selecciona todo y copia. O usa Compartir.";
    }
    try {
      input.focus();
      input.select();
      input.setSelectionRange(0, input.value.length);
    } catch (e) {}
    panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function hideLinkSharePanel() {
    var panel = $("linkSharePanel");
    if (panel) panel.hidden = true;
  }

  function bindLinkSharePanel() {
    if ($("linkShareCopy")) {
      $("linkShareCopy").addEventListener("click", function () {
        var input = $("linkShareInput");
        var text = (input && input.value) || "";
        if (!text) return;
        copyTextNow(text).then(function (ok) {
          showLinkSharePanel(
            text,
            ok
              ? "Listo: link copiado. Pégalo en WhatsApp o notas."
              : "No se pudo copiar automático. Selecciona el texto del cuadro y cópialo manualmente."
          );
        });
      });
    }
    if ($("linkShareShare")) {
      $("linkShareShare").addEventListener("click", function () {
        var input = $("linkShareInput");
        var text = (input && input.value) || "";
        if (!text) return;
        if (navigator.share) {
          navigator
            .share({ title: "HELP ONLINE", text: "Tu ayuda técnica", url: text })
            .catch(function () {
              showLinkSharePanel(text, "Usa el cuadro para copiar el link.");
            });
        } else {
          showLinkSharePanel(text, "Tu navegador no tiene Compartir. Copia el texto del cuadro.");
        }
      });
    }
    if ($("linkShareClose")) {
      $("linkShareClose").addEventListener("click", hideLinkSharePanel);
    }
  }

  function bindInventoryActions(box) {
    box.querySelectorAll(".open-brand").forEach(function (btn) {
      btn.addEventListener("click", function () {
        brandView = {
          cat: btn.getAttribute("data-c"),
          brandId: btn.getAttribute("data-b"),
          brandName: btn.getAttribute("data-name")
        };
        renderTree();
      });
    });

    var back = box.querySelector("#btnBackBrands");
    if (back) {
      back.addEventListener("click", function () {
        brandView = null;
        renderTree();
      });
    }

    box.querySelectorAll(".copy-help").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var url = btn.getAttribute("data-help-url");
        var c = btn.getAttribute("data-c");
        var b = btn.getAttribute("data-b");
        var m = btn.getAttribute("data-m");
        var v = btn.getAttribute("data-v");
        var original = btn.textContent || "Copiar link";

        function done(ok, label) {
          btn.textContent = label || (ok ? "¡Copiado!" : "Error");
          setTimeout(function () {
            btn.textContent = original;
          }, 1800);
        }

        if (!url) {
          done(false);
          alert("No hay link para esta ayuda.");
          return;
        }

        // IMPORTANTE: copiar YA (en el mismo toque). Si hacemos fetch antes,
        // iPhone/Android pierden el permiso de portapapeles y "Copiar" falla.
        copyTextNow(url).then(function (copied) {
          showLinkSharePanel(
            url,
            copied
              ? "Link copiado. Si no pega, selecciona el cuadro o toca Compartir."
              : "Copia manual: toca el cuadro, selecciona todo y copia. O toca Compartir."
          );
          done(true, copied ? "¡Copiado!" : "Ver link ↓");

          if (navigator.share && !copied) {
            // En móvil, Compartir suele ser más fiable que el portapapeles
            try {
              navigator.share({ title: "HELP ONLINE", text: "Tu ayuda técnica", url: url });
            } catch (e) {}
          }

          var checkUrl =
            (CFG.root || "") +
            "data/help/" +
            encodeURIComponent(c) +
            "/" +
            encodeURIComponent(b) +
            "/" +
            encodeURIComponent(m) +
            "/" +
            encodeURIComponent(v || "base") +
            ".json";

          fetch(checkUrl, { cache: "no-store" })
            .then(function (r) {
              if (!r.ok) throw new Error("missing");
              return true;
            })
            .catch(function () {
              return false;
            })
            .then(function (publicOk) {
              if (publicOk) return;
              showLinkSharePanel(
                url,
                "⚠ Esta ayuda aún no está publicada en el servidor. Vuelve a Guardar en catálogo y luego copia de nuevo."
              );
              done(false, "Sin publicar");
            });
        });
      });
    });

    box.querySelectorAll(".edit-help").forEach(function (btn) {
      btn.addEventListener("click", function () {
        loadIntoForm(
          btn.getAttribute("data-c"),
          btn.getAttribute("data-b"),
          btn.getAttribute("data-m"),
          btn.getAttribute("data-v")
        );
      });
    });

    box.querySelectorAll(".delete-help").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var c = btn.getAttribute("data-c");
        var b = btn.getAttribute("data-b");
        var m = btn.getAttribute("data-m");
        var v = btn.getAttribute("data-v");
        var label = btn.getAttribute("data-label") || "esta ayuda";
        if (!confirm("¿Borrar " + label + "? Esta acción no se puede deshacer.")) return;
        C.deleteVersion(catalog, c, b, m, v);
        Promise.resolve()
          .then(function () {
            return C.deleteFromServer(c, b, m, v).catch(function () {
              return null;
            });
          })
          .then(function () {
            return C.deleteHelpUnit(c, b, m, v).catch(function () {});
          })
          .then(function () {
            return C.saveCatalog(catalog);
          })
          .then(function () {
            if (brandView && countBrandHelps(brandView.cat, brandView.brandId) === 0) {
              brandView = null;
            }
            renderTree();
            if ($("formMsg")) {
              $("formMsg").hidden = false;
              $("formMsg").textContent = "Eliminado: " + label;
            }
          })
          .catch(function (err) {
            alert("No se pudo borrar: " + ((err && err.message) || err));
          });
      });
    });
  }

  function renderBrandFolders(cats) {
    var html = "";
    var shown = 0;
    cats.forEach(function (cat) {
      var brands = C.listBrands(catalog, cat).filter(function (b) {
        return countBrandHelps(cat, b.id) > 0;
      });
      if (!brands.length) return;
      html += '<div class="inv-cat"><h3>' + cat.toUpperCase() + "</h3>";
      brands.forEach(function (b) {
        var n = countBrandHelps(cat, b.id);
        shown += 1;
        html +=
          '<button type="button" class="brand-folder open-brand" data-c="' +
          cat +
          '" data-b="' +
          b.id +
          '" data-name="' +
          String(b.name).replace(/"/g, "&quot;") +
          '">' +
          brandThumb(cat, b.id) +
          '<div class="brand-folder-body">' +
          "<strong>" +
          b.name +
          "</strong>" +
          "<span>" +
          n +
          (n === 1 ? " ayuda" : " ayudas") +
          " · carpeta " +
          cat +
          "/" +
          b.id +
          "</span>" +
          "<em>Abrir carpeta →</em>" +
          "</div></button>";
      });
      html += "</div>";
    });
    return { html: html, shown: shown };
  }

  function renderBrandHelps(cat, brandId, brandName) {
    var html =
      '<div class="inv-brand-head">' +
      '<button type="button" class="btn btn-ghost" id="btnBackBrands">← Todas las marcas</button>' +
      "<div><strong>📁 " +
      brandName +
      "</strong><span class='muted tiny'> " +
      cat +
      "/" +
      brandId +
      "</span></div></div>";
    var shown = 0;
    var brand = (((catalog.categories[cat] || {}).brands || {})[brandId]) || { models: {} };
    Object.keys(brand.models || {}).forEach(function (mid) {
      var m = brand.models[mid];
      (m.versions || []).forEach(function (v) {
        shown += 1;
        var href = helpHref(cat, brandId, mid, v.id);
        var absHelp = new URL(href, location.href).href;
        var label = brandName + " " + m.name + " · " + (v.name || v.id);
        html +=
          '<article class="inv-item">' +
          thumbHtml(v.photos, { c: cat, b: brandId, m: mid, v: v.id }) +
          '<div class="inv-body">' +
          "<strong>" +
          m.name +
          "</strong>" +
          "<span>" +
          (v.name || v.id) +
          " · EEPROM " +
          (v.eeprom || "—") +
          "</span>" +
          '<span class="inv-folder">📁 ' +
          folderPath(cat, brandId, mid) +
          "</span>" +
          '<div class="tree-actions">' +
          "<button type='button' class='edit-help' data-c='" +
          cat +
          "' data-b='" +
          brandId +
          "' data-m='" +
          mid +
          "' data-v='" +
          v.id +
          "'>Editar</button>" +
          "<a href='" +
          href +
          "' target='_blank' rel='noopener'>Ver ayuda cliente</a>" +
          "<button type='button' class='copy-help' data-help-url='" +
          absHelp.replace(/'/g, "&#39;") +
          "' data-c='" +
          cat +
          "' data-b='" +
          brandId +
          "' data-m='" +
          mid +
          "' data-v='" +
          v.id +
          "'>Copiar link</button>" +
          "<button type='button' class='delete-help' data-c='" +
          cat +
          "' data-b='" +
          brandId +
          "' data-m='" +
          mid +
          "' data-v='" +
          v.id +
          "' data-label='" +
          label.replace(/'/g, "&#39;") +
          "'>Borrar</button>" +
          "</div></div></article>";
      });
    });
    return { html: html, shown: shown };
  }

  function renderTree() {
    var box = $("catalogTree");
    var empty = $("invEmpty");
    var crumb = $("invBreadcrumb");
    if (!box) return;

    var cats = listFilter === "all" ? ["autos", "motos"] : [listFilter];
    var result;

    if (brandView) {
      if (crumb) {
        crumb.hidden = false;
        crumb.innerHTML =
          "Carpetas / <strong>" +
          (brandView.cat || "").toUpperCase() +
          "</strong> / <strong>" +
          brandView.brandName +
          "</strong>";
      }
      result = renderBrandHelps(brandView.cat, brandView.brandId, brandView.brandName);
    } else {
      if (crumb) {
        crumb.hidden = true;
        crumb.innerHTML = "";
      }
      result = renderBrandFolders(cats);
    }

    box.innerHTML = result.html || "";
    if (empty) {
      if (countItems() === 0) {
        empty.hidden = false;
        empty.textContent = "Aún no hay ayudas. Guarda la primera en catálogo.";
      } else if (result.shown === 0) {
        empty.hidden = false;
        empty.textContent = brandView
          ? "Esta marca no tiene ayudas."
          : "No hay marcas en este filtro.";
      } else {
        empty.hidden = true;
      }
    }
    updateFolderCount();
    syncFoldersFromCatalog();
    bindInventoryActions(box);
  }

  function applyVersionToForm(cat, brandId, modelId, brand, model, version) {
    editing = { cat: cat, brandId: brandId, modelId: modelId, versionId: version.id };
    $("formTitle").textContent = "Editando · " + brand.name + " " + model.name;
    $("fCategory").value = cat;
    $("fBrand").value = brand.name;
    $("fModel").value = model.name;
    $("fVersion").value = version.name || version.id;
    $("fEeprom").value = version.eeprom || "";
    $("fProgrammer").value = version.programmer || "UPA USB";
    $("fType").value = version.type || "SERIAL EEPROM";
    $("fNotes").value = (version.notes || []).join("\n");

    var photos = version.photos || {};
    PHOTO_KEYS.forEach(function (key) {
      var src = photos[key] || (key === "ignition" ? photos.eeprom : "") || "";
      if (isPlaceholderPhoto(src)) {
        src = guessPublishedPhoto(cat, brandId, modelId, version.id, key);
      }
      setPhoto(key, src);
    });

    $("formCard").scrollIntoView({ behavior: "smooth", block: "start" });
    if ($("formMsg")) $("formMsg").hidden = true;
  }

  function loadIntoForm(cat, brandId, modelId, versionId) {
    if (!catalog) return;
    var brand = (((catalog.categories[cat] || {}).brands || {})[brandId]) || null;
    var model = brand && brand.models ? brand.models[modelId] : null;
    var version = C.getVersion(catalog, cat, brandId, modelId, versionId);
    if (!brand || !model || !version) return;

    // Carga la ficha completa (fotos reales) desde IndexedDB o data/help
    C.loadHelpUnit(cat, brandId, modelId, versionId || version.id)
      .then(function (unit) {
        var full = (unit && unit.version) || version;
        applyVersionToForm(cat, brandId, modelId, brand, model, full);
      })
      .catch(function () {
        applyVersionToForm(cat, brandId, modelId, brand, model, version);
      });
  }

  function resolvePhotosForSave(category, brandId, modelId, versionId, prev) {
    var photos = {
      main: pending.main || "",
      dashboard: pending.dashboard || "",
      connection: pending.connection || "",
      ignition: pending.ignition || ""
    };

    return C.loadHelpUnit(category, brandId, modelId, versionId)
      .catch(function () {
        return null;
      })
      .then(function (unit) {
        var fromUnit = (unit && unit.version && unit.version.photos) || {};
        PHOTO_KEYS.forEach(function (k) {
          var cur = photos[k];
          if (!isPlaceholderPhoto(cur)) return;
          var fallback = fromUnit[k] || (prev && prev[k]) || "";
          if (k === "ignition" && isPlaceholderPhoto(fallback)) {
            fallback = fromUnit.eeprom || (prev && prev.eeprom) || "";
          }
          if (!isPlaceholderPhoto(fallback)) photos[k] = fallback;
          else photos[k] = "";
        });
        return photos;
      });
  }

  function clearForm() {
    editing = null;
    if ($("formTitle")) $("formTitle").textContent = "Nueva ayuda";
    if ($("entryForm")) $("entryForm").reset();
    if ($("fProgrammer")) $("fProgrammer").value = "UPA USB";
    if ($("fType")) $("fType").value = "SERIAL EEPROM";
    if ($("fVersion")) $("fVersion").value = "Base";
    if ($("pMulti")) $("pMulti").value = "";
    PHOTO_KEYS.forEach(function (k) {
      setPhoto(k, "");
    });
    markActiveSlot(1);
    if ($("formMsg")) $("formMsg").hidden = true;
  }

  function downloadText(filename, text, mime) {
    try {
      var blob = new Blob([text], { type: mime || "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      setTimeout(function () {
        URL.revokeObjectURL(a.href);
      }, 1500);
    } catch (e) {}
  }

  function publish() {
    var msg = $("formMsg");
    var btn = $("btnPublish");
    try {
      if (!catalog) catalog = C.emptyCatalog();

      var category = $("fCategory").value;
      var brandName = ($("fBrand").value || "").trim();
      var modelName = ($("fModel").value || "").trim();
      var versionName = ($("fVersion").value || "").trim() || "Base";

      if (!brandName || !modelName) {
        if (msg) {
          msg.hidden = false;
          msg.textContent = "Completa marca y modelo.";
        }
        return;
      }

      if (btn) {
        btn.disabled = true;
        btn.textContent = "Guardando…";
      }

      var brandId = C.ensureBrand(catalog, category, brandName);
      var modelId = C.ensureModel(catalog, category, brandId, modelName);
      var versionId = C.slugify(versionName);
      var existing = C.getVersion(catalog, category, brandId, modelId, versionId);
      var prev = (existing && existing.photos) || {};

      resolvePhotosForSave(category, brandId, modelId, versionId, prev)
        .then(function (photos) {
          // Comprime cualquier dataURL que aún sea grande
          var compressJobs = PHOTO_KEYS.map(function (k) {
            var val = photos[k];
            if (val && String(val).indexOf("data:") === 0) {
              return C.compressDataUrl(val).then(function (out) {
                photos[k] = out;
              });
            }
            return Promise.resolve();
          });

          return Promise.all(compressJobs).then(function () {
            return photos;
          });
        })
        .then(function (photos) {
          C.upsertVersion(catalog, category, brandId, modelId, {
            id: versionId,
            name: versionName,
            eeprom: ($("fEeprom").value || "").trim(),
            programmer: ($("fProgrammer").value || "").trim(),
            type: ($("fType").value || "").trim(),
            notes: ($("fNotes").value || "")
              .split("\n")
              .map(function (n) {
                return n.trim();
              })
              .filter(Boolean),
            photos: photos
          });

          return C.saveCatalog(catalog).then(function () {
            var helpUnit = C.buildHelpUnit(catalog, category, brandId, modelId, versionId);
            return C.saveHelpUnit(helpUnit).then(function () {
              return C.pingApi().then(function (apiUp) {
                return C.publishToServer(helpUnit)
                  .then(function (pub) {
                    return { pub: pub, apiUp: apiUp };
                  })
                  .catch(function (err) {
                    console.warn("publish API", err);
                    if (apiUp) {
                      throw new Error(
                        "El servidor rechazó la publicación: " +
                          ((err && err.message) || err) +
                          ". La ayuda NO quedó pública. Vuelve a Guardar."
                      );
                    }
                    return {
                      pub: { ok: false, offline: true, error: err && err.message },
                      apiUp: false
                    };
                  })
                  .then(function (pack) {
                    var pub = pack.pub || {};
                    if (pub && pub.ok && pub.photos) {
                      var ver = C.getVersion(catalog, category, brandId, modelId, versionId);
                      if (ver) ver.photos = pub.photos;
                      if (helpUnit && helpUnit.version) helpUnit.version.photos = pub.photos;
                      return C.saveCatalog(catalog)
                        .then(function () {
                          return C.saveHelpUnit(helpUnit);
                        })
                        .then(function () {
                          return { helpUnit: helpUnit, pub: pub };
                        });
                    }
                    return C.loadHelpUnit(category, brandId, modelId, versionId).then(function (verify) {
                      if (!verify || !verify.version) {
                        throw new Error("No se pudo confirmar el guardado. Intenta de nuevo.");
                      }
                      return { helpUnit: helpUnit, pub: pub || { ok: false } };
                    });
                  });
              });
            });
          });
        })
        .then(function (result) {
          var helpUnit = result.helpUnit;
          var pub = result.pub || {};
          var folder = folderPath(category, brandId, modelId);
          brandView = {
            cat: category,
            brandId: brandId,
            brandName: brandName.toUpperCase()
          };
          renderTree();
          syncFoldersFromCatalog();

          var href = helpHref(category, brandId, modelId, versionId);
          var abs = new URL(href, location.href).href;

          if (msg) {
            msg.hidden = false;
            msg.innerHTML =
              (pub.ok ? "✓ Guardado público · " : "⚠ Guardado solo en este teléfono · ") +
              "<strong>" +
              brandName.toUpperCase() +
              " " +
              modelName.toUpperCase() +
              "</strong> · carpeta <code>" +
              folder +
              "</code><br>" +
              (pub.ok
                ? "Link listo para el cliente."
                : "El link NO funcionará en otro teléfono hasta que Guardar publique bien en el servidor. Revisa el mensaje e intenta otra vez.") +
              "<br><code style='word-break:break-all'>" +
              abs +
              "</code>";
          }

          if (pub.ok) {
            if (msg) msg.innerHTML += "<br>Abriendo ayuda…";
            setTimeout(function () {
              location.assign(href);
            }, 700);
          } else {
            showLinkSharePanel(
              abs,
              "Publicación incompleta. No envíes este link aún. Vuelve a pulsar Guardar en catálogo."
            );
            alert(
              "Se guardó en este navegador, pero NO en el servidor público. Vuelve a Guardar. Si falla otra vez, avisa (puede ser espacio o conexión)."
            );
          }
        })
        .catch(function (err) {
          console.error(err);
          var text = (err && err.message) || String(err);
          if (/quota|QuotaExceeded/i.test(text)) {
            text =
              "Espacio del navegador lleno. Ya usamos IndexedDB + fotos comprimidas. Recarga la página, vuelve a entrar y guarda de nuevo. Si sigue, en el navegador borra datos del sitio o exporta y limpia ayudas viejas.";
            try {
              C.clearBloatedLocalStorage();
            } catch (e) {}
          }
          if (msg) {
            msg.hidden = false;
            msg.textContent = "Error al guardar: " + text;
          }
          alert(text);
        })
        .then(function () {
          if (btn) {
            btn.disabled = false;
            btn.textContent = "Guardar en catálogo";
          }
        });
    } catch (err) {
      console.error(err);
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Guardar en catálogo";
      }
      if (msg) {
        msg.hidden = false;
        msg.textContent = "Error al guardar: " + (err && err.message ? err.message : String(err));
      }
      alert("No se pudo guardar. Revisa marca, modelo y vuelve a intentar.");
    }
  }

  function boot() {
    if (!$("loginForm") || !$("entryForm")) return;

    bindLinkSharePanel();

    if (C.isAdminSession()) {
      showApp(true);
      C.loadCatalog().then(function (cat) {
        catalog = cat;
        renderTree();
      });
    }

    $("loginForm").addEventListener("submit", function (e) {
      e.preventDefault();
      C.verifyPassword($("loginPass").value).then(function (ok) {
        if (!ok) {
          alert("Contraseña incorrecta");
          return;
        }
        C.startAdminSession();
        showApp(true);
        C.loadCatalog().then(function (cat) {
          catalog = cat;
          renderTree();
        });
        var hub = document.getElementById("administrador");
        if (hub) hub.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });

    if ($("btnLogout")) {
      $("btnLogout").addEventListener("click", function () {
        C.endAdminSession();
        location.reload();
      });
    }

    if ($("btnExport")) {
      $("btnExport").addEventListener("click", function () {
        if (catalog) C.exportCatalog(catalog);
      });
    }

    if ($("btnClear")) $("btnClear").addEventListener("click", clearForm);
    if ($("btnNew")) {
      $("btnNew").addEventListener("click", function () {
        clearForm();
        $("formCard").scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }

    document.querySelectorAll(".inv-filter").forEach(function (btn) {
      btn.addEventListener("click", function () {
        listFilter = btn.getAttribute("data-filter") || "all";
        brandView = null;
        document.querySelectorAll(".inv-filter").forEach(function (b) {
          b.classList.toggle("is-active", b === btn);
        });
        renderTree();
      });
    });

    document.querySelectorAll(".btn-photo").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var target = btn.getAttribute("data-target");
        var slot = btn.closest(".photo-slot");
        if (slot) markActiveSlot(slot.getAttribute("data-slot"));
        openPicker(target);
      });
    });

    bindPhotoInput("pMainGallery", "main", true);
    bindPhotoInput("pMainCamera", "main", true);
    bindPhotoInput("pDashGallery", "dashboard", true);
    bindPhotoInput("pDashCamera", "dashboard", true);
    bindPhotoInput("pConnGallery", "connection", true);
    bindPhotoInput("pConnCamera", "connection", true);
    bindPhotoInput("pIgnGallery", "ignition", true);
    bindPhotoInput("pIgnCamera", "ignition", true);

    if ($("pMulti")) {
      $("pMulti").addEventListener("change", function () {
        applyFilesInOrder(this.files).then(function () {
          markActiveSlot(0);
          if ($("btnPublish")) $("btnPublish").focus();
        });
      });
    }

    markActiveSlot(1);

    $("entryForm").addEventListener("submit", function (e) {
      e.preventDefault();
      publish();
    });

    if ($("passForm")) {
      $("passForm").addEventListener("submit", function (e) {
        e.preventDefault();
        C.setPassword($("newPass").value).then(function () {
          $("newPass").value = "";
          alert("Contraseña actualizada");
        });
      });
    }

    if (location.hash === "#administrador") {
      var hub = document.getElementById("administrador");
      if (hub) setTimeout(function () {
        hub.scrollIntoView({ behavior: "smooth" });
      }, 200);
    }
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
