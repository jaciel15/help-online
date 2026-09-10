(function () {
  "use strict";

  var C = window.VCDMXCatalog;

  function qs(sel) {
    return document.querySelector(sel);
  }

  function renderCategory(category, mount, emptyEl, fichaBase) {
    C.loadCatalog().then(function (catalog) {
      var brands = C.listBrands(catalog, category);
      var html = "";
      brands.forEach(function (b) {
        var models = Object.keys(b.models || {});
        var count = 0;
        models.forEach(function (mid) {
          count += (b.models[mid].versions || []).length;
        });
        if (!count) {
          // still show brand if present but empty
          html +=
            '<a class="menu-card is-disabled" href="#" aria-disabled="true" data-filter-item="' +
            b.name.toLowerCase() +
            '"><span class="label">' +
            b.name +
            '</span><span class="meta" data-i18n="soon">Próximamente</span></a>';
          return;
        }
        // If only one model+version, link direct to ficha; else to brand models list via hash page
        var firstModelId = models[0];
        var firstVersion = (b.models[firstModelId].versions || [])[0];
        var href =
          fichaBase +
          "?c=" +
          encodeURIComponent(category) +
          "&b=" +
          encodeURIComponent(b.id) +
          "&m=" +
          encodeURIComponent(firstModelId) +
          "&v=" +
          encodeURIComponent(firstVersion.id);
        // If multiple models, go to models page
        if (models.length > 1 || (b.models[firstModelId].versions || []).length > 1) {
          href =
            "marca.html?c=" +
            encodeURIComponent(category) +
            "&b=" +
            encodeURIComponent(b.id);
        }
        html +=
          '<a class="menu-card" href="' +
          href +
          '" data-filter-item="' +
          b.name.toLowerCase() +
          '"><span class="label">' +
          b.name +
          '</span><span class="meta">' +
          count +
          " ficha(s)</span></a>";
      });
      mount.innerHTML = html || "";
      if (emptyEl) emptyEl.classList.toggle("visible", !html);
      document.dispatchEvent(new Event("VCDMX_DYNAMIC"));
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    var mount = qs("[data-catalog-category]");
    if (!mount) return;
    var category = mount.getAttribute("data-catalog-category");
    var emptyEl = qs("[data-filter-empty]");
    var fichaBase = mount.getAttribute("data-ficha-base") || "../ficha/";
    renderCategory(category, mount, emptyEl, fichaBase);
  });
})();
