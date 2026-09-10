(function () {
  "use strict";

  var C = window.VCDMXCatalog;
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
    main: { nextKey: "dashboard", nextSlot: 2, nextGallery: "pDashGallery" },
    dashboard: { nextKey: "connection", nextSlot: 3, nextGallery: "pConnGallery" },
    connection: { nextKey: "ignition", nextSlot: 4, nextGallery: "pIgnGallery" },
    ignition: { nextKey: null, nextSlot: 0, nextGallery: null }
  };

  function $(id) {
    return document.getElementById(id);
  }

  function showApp(on) {
    $("loginGate").hidden = on;
    $("adminApp").hidden = !on;
  }

  function resolvePreview(path) {
    if (!path) return "";
    if (path.indexOf("data:") === 0 || path.indexOf("http") === 0 || path.indexOf("blob:") === 0) return path;
    if (path.indexOf("../") === 0 || path.indexOf("/") === 0) return path;
    return "../" + path;
  }

  function setPhoto(key, url) {
    pending[key] = url || "";
    var meta = PHOTO_META[key];
    if (!meta) return;
    var img = $(meta.img);
    var st = $(meta.st);
    var slot = document.querySelector('.photo-slot[data-slot="' + meta.slot + '"]');
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
    var ready = PHOTO_KEYS.every(function (k) {
      return !!pending[k];
    });
    if (ready) btn.classList.add("is-pulse");
    else btn.classList.remove("is-pulse");
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
    }, 120);
  }

  function onPhotoChosen(key, file, chain) {
    if (!file) return;
    C.fileToDataUrl(file).then(function (url) {
      setPhoto(key, url);
      if (!chain) return;
      var next = CHAIN[key];
      if (next && next.nextGallery) {
        markActiveSlot(next.nextSlot);
        openPicker(next.nextGallery);
      } else {
        markActiveSlot(0);
        $("btnPublish").focus();
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
    var jobs = files.map(function (file, i) {
      return C.fileToDataUrl(file).then(function (url) {
        setPhoto(PHOTO_KEYS[i], url);
      });
    });
    return Promise.all(jobs);
  }

  function thumbHtml(photos) {
    var src =
      (photos && (photos.main || photos.dashboard || photos.connection || photos.ignition || photos.eeprom)) || "";
    if (!src) return '<div class="inv-thumb inv-thumb--empty">Sin foto</div>';
    return '<div class="inv-thumb"><img src="' + resolvePreview(src) + '" alt=""></div>';
  }

  function countItems() {
    var n = 0;
    ["autos", "motos"].forEach(function (cat) {
      C.listBrands(catalog, cat).forEach(function (b) {
        Object.keys(b.models || {}).forEach(function (mid) {
          n += ((b.models[mid].versions || []).length);
        });
      });
    });
    return n;
  }

  function renderTree() {
    var box = $("catalogTree");
    var empty = $("invEmpty");
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
            var helpHref =
              "../ayuda/?c=" +
              encodeURIComponent(cat) +
              "&b=" +
              encodeURIComponent(b.id) +
              "&m=" +
              encodeURIComponent(mid) +
              "&v=" +
              encodeURIComponent(v.id);
            var absHelp = new URL(helpHref, location.href).href;
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
              helpHref +
              "' target='_blank' rel='noopener'>Ver ayuda</a>" +
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
    if (countItems() === 0) {
      empty.hidden = false;
      empty.textContent = "Aún no hay ayudas. Usa el formulario para añadir la primera.";
    } else if (shown === 0) {
      empty.hidden = false;
      empty.textContent = "No hay ayudas en este filtro.";
    } else {
      empty.hidden = true;
    }

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
          prompt("Copia este link de ayuda:", url);
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
    $("formMsg").hidden = true;
  }

  function clearForm() {
    editing = null;
    $("formTitle").textContent = "Nueva ayuda";
    $("entryForm").reset();
    $("fProgrammer").value = "UPA USB";
    $("fType").value = "SERIAL EEPROM";
    $("fVersion").value = "Base";
    $("pMulti").value = "";
    PHOTO_KEYS.forEach(function (k) {
      setPhoto(k, "");
    });
    markActiveSlot(1);
    $("formMsg").hidden = true;
  }

  function publish() {
    if (!catalog) catalog = C.emptyCatalog();

    var category = $("fCategory").value;
    var brandName = $("fBrand").value.trim();
    var modelName = $("fModel").value.trim();
    var versionName = $("fVersion").value.trim() || "Base";
    if (!brandName || !modelName) return;

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

    C.upsertVersion(catalog, category, brandId, modelId, {
      id: versionId,
      name: versionName,
      eeprom: $("fEeprom").value.trim(),
      programmer: $("fProgrammer").value.trim(),
      type: $("fType").value.trim(),
      notes: $("fNotes")
        .value.split("\n")
        .map(function (n) {
          return n.trim();
        })
        .filter(Boolean),
      photos: photos
    });

    C.saveCatalog(catalog);
    var helpUnit = C.buildHelpUnit(catalog, category, brandId, modelId, versionId);
    C.saveHelpUnit(helpUnit);
    C.exportHelpUnit(helpUnit);
    renderTree();

    var helpUrl =
      new URL(
        "../ayuda/?c=" +
          encodeURIComponent(category) +
          "&b=" +
          encodeURIComponent(brandId) +
          "&m=" +
          encodeURIComponent(modelId) +
          "&v=" +
          encodeURIComponent(versionId),
        location.href
      ).href;

    var msg = $("formMsg");
    msg.hidden = false;
    msg.innerHTML =
      "✓ Guardado: <strong>" +
      brandName.toUpperCase() +
      " / " +
      modelName.toUpperCase() +
      " / " +
      versionName +
      "</strong><br>JSON descargado → <code>data/help/" +
      category +
      "/" +
      brandId +
      "/" +
      modelId +
      "/" +
      versionId +
      ".json</code><br>Link cliente: <code style='word-break:break-all'>" +
      helpUrl +
      "</code>";

    // Mantener datos en formulario si era edición; si era alta, limpiar para la siguiente
    if (!editing) clearForm();
    else {
      editing = { cat: category, brandId: brandId, modelId: modelId, versionId: versionId };
      $("formTitle").textContent = "Editando · " + brandName.toUpperCase() + " " + modelName.toUpperCase();
    }
  }

  function boot() {
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
      });
    });

    $("btnLogout").addEventListener("click", function () {
      C.endAdminSession();
      location.reload();
    });

    $("btnExport").addEventListener("click", function () {
      if (catalog) C.exportCatalog(catalog);
    });

    $("btnClear").addEventListener("click", clearForm);
    $("btnNew").addEventListener("click", function () {
      clearForm();
      $("formCard").scrollIntoView({ behavior: "smooth", block: "start" });
    });

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

    // Galería + cámara por cada foto (cadena solo desde galería/cámara de cada slot)
    bindPhotoInput("pMainGallery", "main", true);
    bindPhotoInput("pMainCamera", "main", true);
    bindPhotoInput("pDashGallery", "dashboard", true);
    bindPhotoInput("pDashCamera", "dashboard", true);
    bindPhotoInput("pConnGallery", "connection", true);
    bindPhotoInput("pConnCamera", "connection", true);
    bindPhotoInput("pIgnGallery", "ignition", true);
    bindPhotoInput("pIgnCamera", "ignition", true);

    $("pMulti").addEventListener("change", function () {
      applyFilesInOrder(this.files).then(function () {
        markActiveSlot(0);
        $("btnPublish").focus();
      });
    });

    markActiveSlot(1);

    $("entryForm").addEventListener("submit", function (e) {
      e.preventDefault();
      publish();
    });

    $("passForm").addEventListener("submit", function (e) {
      e.preventDefault();
      C.setPassword($("newPass").value).then(function () {
        $("newPass").value = "";
        alert("Contraseña actualizada");
      });
    });
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
