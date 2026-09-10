(function () {
  "use strict";

  var C = window.VCDMXCatalog;
  var catalog = null;
  var pending = { dashboard: "", connection: "", ignition: "" };
  var editing = null;
  var chainBusy = false;

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
    var map = {
      dashboard: { img: "prevDashboard", st: "stDashboard", slot: 1 },
      connection: { img: "prevConnection", st: "stConnection", slot: 2 },
      ignition: { img: "prevIgnition", st: "stIgnition", slot: 3 }
    };
    var meta = map[key];
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
    var ready = pending.dashboard && pending.connection && pending.ignition;
    if (ready) btn.classList.add("is-pulse");
    else btn.classList.remove("is-pulse");
  }

  function markActiveSlot(n) {
    document.querySelectorAll(".photo-slot").forEach(function (el) {
      el.classList.toggle("is-active", el.getAttribute("data-slot") === String(n));
    });
  }

  function openNext(inputId) {
    var el = $(inputId);
    if (!el) return;
    chainBusy = true;
    setTimeout(function () {
      try {
        el.click();
      } catch (e) {}
      chainBusy = false;
    }, 180);
  }

  function bindSequential(inputId, key, nextInputId, nextSlot) {
    $(inputId).addEventListener("change", function () {
      var file = this.files && this.files[0];
      if (!file) return;
      C.fileToDataUrl(file).then(function (url) {
        setPhoto(key, url);
        if (nextInputId) {
          markActiveSlot(nextSlot);
          openNext(nextInputId);
        } else {
          markActiveSlot(0);
          $("btnPublish").focus();
        }
      });
    });
  }

  function applyFilesInOrder(fileList) {
    var files = Array.prototype.slice.call(fileList || [], 0, 3);
    var keys = ["dashboard", "connection", "ignition"];
    var jobs = files.map(function (file, i) {
      return C.fileToDataUrl(file).then(function (url) {
        setPhoto(keys[i], url);
      });
    });
    return Promise.all(jobs);
  }

  function renderTree() {
    var box = $("catalogTree");
    var html = "";
    ["autos", "motos"].forEach(function (cat) {
      html += "<h3>" + cat.toUpperCase() + "</h3>";
      var brands = C.listBrands(catalog, cat);
      if (!brands.length) {
        html += "<p class='muted'>Sin fichas.</p>";
        return;
      }
      brands.forEach(function (b) {
        html += "<div class='tree-brand'><strong>" + b.name + "</strong>";
        Object.keys(b.models || {}).forEach(function (mid) {
          var m = b.models[mid];
          html += "<div class='tree-model'><div>" + m.name + "</div>";
          (m.versions || []).forEach(function (v) {
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
              "<div class='tree-version'><div>• " +
              (v.name || v.id) +
              " · EEPROM " +
              (v.eeprom || "—") +
              "</div><div class='tree-actions'>" +
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
              "' target='_blank' rel='noopener'>Abrir ayuda</a>" +
              "<button type='button' class='copy-help' data-help-url='" +
              absHelp.replace(/'/g, "&#39;") +
              "'>Copiar link cliente</button></div></div>";
          });
          html += "</div>";
        });
        html += "</div>";
      });
    });
    box.innerHTML = html;

    box.querySelectorAll(".copy-help").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var url = btn.getAttribute("data-help-url");
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(function () {
            btn.textContent = "¡Copiado!";
            setTimeout(function () {
              btn.textContent = "Copiar link cliente";
            }, 1200);
          });
        } else {
          prompt("Copia este link de ayuda (solo esa ficha):", url);
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

    setPhoto("dashboard", (version.photos && version.photos.dashboard) || "");
    setPhoto("connection", (version.photos && version.photos.connection) || "");
    setPhoto("ignition", (version.photos && (version.photos.ignition || version.photos.eeprom)) || "");

    $("entryForm").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function clearForm() {
    editing = null;
    $("formTitle").textContent = "Nueva ayuda / editar";
    $("entryForm").reset();
    $("fProgrammer").value = "UPA USB";
    $("fType").value = "SERIAL EEPROM";
    $("fVersion").value = "Base";
    $("pMulti").value = "";
    setPhoto("dashboard", "");
    setPhoto("connection", "");
    setPhoto("ignition", "");
    markActiveSlot(1);
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
    var photos = {
      dashboard: pending.dashboard || (existing && existing.photos && existing.photos.dashboard) || "",
      connection: pending.connection || (existing && existing.photos && existing.photos.connection) || "",
      ignition: pending.ignition || (existing && existing.photos && (existing.photos.ignition || existing.photos.eeprom)) || ""
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
      "✓ Publicado automáticamente: <strong>" +
      brandName.toUpperCase() +
      " / " +
      modelName.toUpperCase() +
      " / " +
      versionName +
      "</strong><br>JSON de ayuda descargado → súbelo a <code>data/help/" +
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

    clearForm();
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

    bindSequential("pDashboard", "dashboard", "pConnection", 2);
    bindSequential("pConnection", "connection", "pIgnition", 3);
    bindSequential("pIgnition", "ignition", null, 0);

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
