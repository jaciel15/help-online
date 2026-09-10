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

  function resolvePreview(path) {
    if (!path) return "";
    if (path.indexOf("data:") === 0 || path.indexOf("http") === 0 || path.indexOf("blob:") === 0) return path;
    if (path.indexOf("../") === 0 || path.indexOf("/") === 0 || path.indexOf("./") === 0) return path;
    return (CFG.assetPrefix || "") + path;
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

  function registerFolder(entry) {
    var list = readFolders();
    var key = folderPath(entry.c, entry.b, entry.m) + "/" + (entry.v || "base");
    var found = -1;
    for (var i = 0; i < list.length; i++) {
      if (list[i].key === key) {
        found = i;
        break;
      }
    }
    var row = {
      key: key,
      c: entry.c,
      b: entry.b,
      m: entry.m,
      v: entry.v || "base",
      label: entry.label,
      path: folderPath(entry.c, entry.b, entry.m),
      updatedAt: new Date().toISOString()
    };
    if (found >= 0) list[found] = row;
    else list.push(row);
    list.sort(function (a, b) {
      return (b.updatedAt || "").localeCompare(a.updatedAt || "");
    });
    localStorage.setItem(FOLDERS_KEY, JSON.stringify(list));
    return list;
  }

  function updateFolderCount() {
    var el = $("folderCount");
    if (!el) return;
    el.textContent = "Carpetas: " + readFolders().length;
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

  function thumbHtml(photos) {
    var src =
      (photos && (photos.main || photos.dashboard || photos.connection || photos.ignition || photos.eeprom)) || "";
    if (!src) return '<div class="inv-thumb inv-thumb--empty">Sin foto</div>';
    return '<div class="inv-thumb"><img src="' + resolvePreview(src) + '" alt=""></div>';
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

  function renderTree() {
    var box = $("catalogTree");
    var empty = $("invEmpty");
    if (!box) return;
    var html = "";
    var shown = 0;
    var cats = listFilter === "all" ? ["autos", "motos"] : [listFilter];

    cats.forEach(function (cat) {
      var brands = C.listBrands(catalog, cat).filter(function (b) {
        return Object.keys(b.models || {}).some(function (mid) {
          return (b.models[mid].versions || []).length > 0;
        });
      });
      if (!brands.length) return;
      html += '<div class="inv-cat"><h3>' + cat.toUpperCase() + "</h3>";
      brands.forEach(function (b) {
        Object.keys(b.models || {}).forEach(function (mid) {
          var m = b.models[mid];
          (m.versions || []).forEach(function (v) {
            shown += 1;
            var href = helpHref(cat, b.id, mid, v.id);
            var absHelp = new URL(href, location.href).href;
            var folder = folderPath(cat, b.id, mid);
            html +=
              '<article class="inv-item">' +
              thumbHtml(v.photos) +
              '<div class="inv-body">' +
              "<strong>" +
              b.name +
              " " +
              m.name +
              "</strong>" +
              "<span>" +
              (v.name || v.id) +
              " · EEPROM " +
              (v.eeprom || "—") +
              "</span>" +
              '<span class="inv-folder">📁 ' +
              folder +
              "</span>" +
              '<div class="tree-actions">' +
              "<button type='button' class='edit-help' data-c='" +
              cat +
              "' data-b='" +
              b.id +
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
              "'>Copiar link</button>" +
              "</div></div></article>";
          });
        });
      });
      html += "</div>";
    });

    box.innerHTML = html || "";
    if (empty) {
      if (countItems() === 0) {
        empty.hidden = false;
        empty.textContent = "Aún no hay ayudas. Guarda la primera en catálogo.";
      } else if (shown === 0) {
        empty.hidden = false;
        empty.textContent = "No hay ayudas en este filtro.";
      } else {
        empty.hidden = true;
      }
    }
    updateFolderCount();

    box.querySelectorAll(".copy-help").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var url = btn.getAttribute("data-help-url");
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(function () {
            btn.textContent = "¡Copiado!";
            setTimeout(function () {
              btn.textContent = "Copiar link";
            }, 1200);
          });
        } else {
          prompt("Link cliente:", url);
        }
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
  }

  function loadIntoForm(cat, brandId, modelId, versionId) {
    if (!catalog) return;
    var brand = (((catalog.categories[cat] || {}).brands || {})[brandId]) || null;
    var model = brand && brand.models ? brand.models[modelId] : null;
    var version = C.getVersion(catalog, cat, brandId, modelId, versionId);
    if (!brand || !model || !version) return;

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
    setPhoto("main", photos.main || "");
    setPhoto("dashboard", photos.dashboard || "");
    setPhoto("connection", photos.connection || "");
    setPhoto("ignition", photos.ignition || photos.eeprom || "");

    $("formCard").scrollIntoView({ behavior: "smooth", block: "start" });
    if ($("formMsg")) $("formMsg").hidden = true;
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
      var photos = {
        main: pending.main || prev.main || "",
        dashboard: pending.dashboard || prev.dashboard || "",
        connection: pending.connection || prev.connection || "",
        ignition: pending.ignition || prev.ignition || prev.eeprom || ""
      };

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

      Promise.all(compressJobs)
        .then(function () {
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
              return helpUnit;
            });
          });
        })
        .then(function (helpUnit) {
          var folder = folderPath(category, brandId, modelId);
          registerFolder({
            c: category,
            b: brandId,
            m: modelId,
            v: versionId,
            label: brandName.toUpperCase() + " " + modelName.toUpperCase()
          });

          try {
            C.exportHelpUnit(helpUnit);
          } catch (e) {}

          var href = helpHref(category, brandId, modelId, versionId);
          var abs = new URL(href, location.href).href;

          if (msg) {
            msg.hidden = false;
            msg.innerHTML =
              "✓ Guardado (IndexedDB) · carpeta <code>" +
              folder +
              "</code><br>Abriendo ayuda cliente…<br><code style='word-break:break-all'>" +
              abs +
              "</code>";
          }

          setTimeout(function () {
            location.assign(href);
          }, 400);
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

    if (C.isAdminSession()) {
      showApp(true);
      if (C.clearBloatedLocalStorage) C.clearBloatedLocalStorage();
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
