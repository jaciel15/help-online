(function () {
  "use strict";

  var C = window.VCDMXCatalog;
  var catalog = null;
  var currentCat = "autos";

  function $(id) {
    return document.getElementById(id);
  }

  function render() {
    var q = ($("portalSearch").value || "").trim().toLowerCase();
    var box = $("portalList");
    var empty = $("portalEmpty");
    var html = "";
    var brands = C.listBrands(catalog, currentCat);
    var shown = 0;

    brands.forEach(function (b) {
      Object.keys(b.models || {}).forEach(function (mid) {
        var m = b.models[mid];
        (m.versions || []).forEach(function (v) {
          var label = (b.name + " " + m.name + " " + (v.name || "")).toLowerCase();
          if (q && label.indexOf(q) === -1) return;
          shown += 1;
          var href =
            "../ficha/?c=" +
            encodeURIComponent(currentCat) +
            "&b=" +
            encodeURIComponent(b.id) +
            "&m=" +
            encodeURIComponent(mid) +
            "&v=" +
            encodeURIComponent(v.id) +
            "&portal=1";
          html +=
            '<a class="menu-card" href="' +
            href +
            '"><span class="label">' +
            b.name +
            " " +
            m.name +
            '</span><span class="meta">' +
            (v.name || v.id) +
            " · " +
            (v.eeprom || "EEPROM") +
            "</span></a>";
        });
      });
    });

    box.innerHTML = html;
    empty.classList.toggle("visible", shown === 0);
  }

  // Soft protection: no context menu / drag on portal
  document.addEventListener("contextmenu", function (e) {
    if (e.target && e.target.tagName === "IMG") e.preventDefault();
  });
  document.addEventListener("dragstart", function (e) {
    if (e.target && e.target.tagName === "IMG") e.preventDefault();
  });

  document.addEventListener("DOMContentLoaded", function () {
    C.loadCatalog().then(function (cat) {
      catalog = cat;
      render();
    });

    document.querySelectorAll("[data-portal-cat]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        currentCat = btn.getAttribute("data-portal-cat");
        document.querySelectorAll("[data-portal-cat]").forEach(function (b) {
          b.classList.toggle("btn-primary", b === btn);
          b.classList.toggle("btn-ghost", b !== btn);
        });
        render();
      });
    });

    $("portalSearch").addEventListener("input", render);
  });
})();
