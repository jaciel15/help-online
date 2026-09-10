(function () {
  "use strict";

  var C = window.VCDMXCatalog;
  var catalog = null;
  var pending = { dashboard: "", connection: "", ignition: "" };

  function $(id) {
    return document.getElementById(id);
  }

  function showApp(on) {
    $("loginGate").hidden = on;
    $("adminApp").hidden = !on;
  }

  function bindPreview(inputId, imgId, key) {
    $(inputId).addEventListener("change", function () {
      var file = this.files && this.files[0];
      if (!file) return;
      C.fileToDataUrl(file).then(function (url) {
        pending[key] = url;
        var img = $(imgId);
        img.src = url;
        img.classList.add("show");
      });
    });
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
            var href =
              "../ficha/?c=" +
              encodeURIComponent(cat) +
              "&b=" +
              encodeURIComponent(b.id) +
              "&m=" +
              encodeURIComponent(mid) +
              "&v=" +
              encodeURIComponent(v.id);
            html +=
              "<div class='tree-version'>• " +
              (v.name || v.id) +
              " · EEPROM " +
              (v.eeprom || "—") +
              " · <a href='" +
              href +
              "' target='_blank' rel='noopener'>Ver</a></div>";
          });
          html += "</div>";
        });
        html += "</div>";
      });
    });
    box.innerHTML = html;
  }

  function clearForm() {
    $("entryForm").reset();
    $("fProgrammer").value = "UPA USB";
    $("fType").value = "SERIAL EEPROM";
    $("fVersion").value = "Base";
    pending = { dashboard: "", connection: "", ignition: "" };
    ["prevDashboard", "prevConnection", "prevIgnition"].forEach(function (id) {
      var img = $(id);
      img.removeAttribute("src");
      img.classList.remove("show");
    });
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

    bindPreview("pDashboard", "prevDashboard", "dashboard");
    bindPreview("pConnection", "prevConnection", "connection");
    bindPreview("pIgnition", "prevIgnition", "ignition");

    $("entryForm").addEventListener("submit", function (e) {
      e.preventDefault();
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
      renderTree();
      var msg = $("formMsg");
      msg.hidden = false;
      msg.textContent =
        "Listo: " +
        brandName.toUpperCase() +
        " / " +
        modelName.toUpperCase() +
        " / " +
        versionName +
        " (usuario solo lectura).";
      clearForm();
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
