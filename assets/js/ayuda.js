(function () {
  "use strict";

  var C = window.VCDMXCatalog;

  function tt(key, fallback) {
    try {
      if (window.VCDMX && typeof window.VCDMX.t === "function") {
        return window.VCDMX.t(key, window.VCDMX.getPreferredLang());
      }
    } catch (e) {}
    return fallback || key;
  }

  function params() {
    var q = new URLSearchParams(location.search);
    return {
      c: q.get("c") || "",
      b: q.get("b") || "",
      m: q.get("m") || "",
      v: q.get("v") || "base"
    };
  }

  function asset(path) {
    if (!path) return "";
    if (path.indexOf("data:") === 0 || path.indexOf("http") === 0) return path;
    return "../" + path.replace(/^\.\.\//, "");
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  document.addEventListener("contextmenu", function (e) {
    if (e.target && e.target.tagName === "IMG") e.preventDefault();
  });
  document.addEventListener("dragstart", function (e) {
    if (e.target && e.target.tagName === "IMG") e.preventDefault();
  });

  var p = params();
  var root = document.getElementById("fichaRoot");
  var status = document.getElementById("fichaStatus");

  if (!p.c || !p.b || !p.m) {
    status.textContent = tt("ayuda.incomplete", "Enlace de ayuda incompleto. Pide al soporte el link específico de tu unidad.");
    return;
  }

  C.loadHelpUnit(p.c, p.b, p.m, p.v)
    .then(function (unit) {
    if (!unit || !unit.version) {
      status.innerHTML =
        tt("ayuda.missing", "Ayuda no encontrada para este enlace.") +
        "<br><small>Pide a soporte que vuelva a <strong>Guardar en catálogo</strong> y te reenvíe el link.</small>";
      return;
    }

    var brandName = unit.brandName || "";
    var modelName = unit.modelName || "";
    var version = unit.version;
    var photos = version.photos || {};
    var slides = [];
    function pushPhoto(src, alt) {
      if (!src || src === "[published]" || src === "[indexed]") return;
      slides.push({ src: asset(src), alt: alt });
    }
    pushPhoto(photos.main, modelName || "Principal");
    pushPhoto(photos.dashboard, "Dashboard");
    pushPhoto(photos.connection, "Conexiones");
    pushPhoto(photos.ignition || photos.eeprom, "Pin-out");

    if (!slides.length) {
      status.innerHTML =
        tt("ayuda.missing", "Ayuda sin fotos.") +
        "<br><small>Pide a soporte que vuelva a subir las 4 fotos y <strong>Guardar en catálogo</strong>.</small>";
    }

    var notes = (version.notes || [])
      .map(function (n) {
        return "<li>" + escapeHtml(n) + "</li>";
      })
      .join("");

    var slidesHtml = slides
      .map(function (s) {
        return (
          '<div class="slide"><img src="' +
          s.src +
          '" alt="' +
          escapeHtml(s.alt) +
          '" data-lightbox></div>'
        );
      })
      .join("");

    root.innerHTML =
      '<header class="detail-header">' +
      "<h1>" +
      escapeHtml(brandName) +
      " " +
      escapeHtml(modelName) +
      "</h1>" +
      '<p class="subtitle">' +
      escapeHtml(version.name || "") +
      " · HELP</p>" +
      "</header>" +
      '<div class="detail-main">' +
      '<aside class="tech-stack">' +
      '<article class="tech-card"><h2 data-i18n="ayuda.eeprom">' +
      tt("ayuda.eeprom", "EEPROM") +
      '</h2><p class="value">' +
      escapeHtml(version.eeprom || "—") +
      "</p></article>" +
      '<article class="tech-card"><h2 data-i18n="ayuda.programmer">' +
      tt("ayuda.programmer", "PROGRAMADOR") +
      '</h2><p class="value">' +
      escapeHtml(version.programmer || "—") +
      "</p></article>" +
      '<article class="tech-card"><h2 data-i18n="ayuda.type">' +
      tt("ayuda.type", "TIPO") +
      '</h2><p class="value">' +
      escapeHtml(version.type || "—") +
      "</p></article>" +
      '<article class="tech-card notes"><h2 data-i18n="ayuda.notes">' +
      tt("ayuda.notes", "NOTAS") +
      "</h2><ul>" +
      (notes || "<li>—</li>") +
      "</ul></article>" +
      "</aside>" +
      (slides.length
        ? '<section class="slider-shell" data-slider data-i18n-aria="ayuda.gallery" aria-label="' +
          tt("ayuda.gallery", "Galería de ayuda") +
          '">' +
          '<button type="button" class="slider-arrow prev" data-i18n-aria="ayuda.prev" aria-label="' +
          tt("ayuda.prev", "Anterior") +
          '">❮</button>' +
          '<div class="slider-track">' +
          slidesHtml +
          "</div>" +
          '<button type="button" class="slider-arrow next" data-i18n-aria="ayuda.next" aria-label="' +
          tt("ayuda.next", "Siguiente") +
          '">❯</button>' +
          '<div class="slider-dots" role="tablist" data-i18n-aria="mt09.dots" aria-label="' +
          tt("mt09.dots", "Indicadores") +
          '"></div>' +
          "</section>"
        : '<section class="slider-shell"><p class="lead" style="padding:24px">—</p></section>') +
      "</div>" +
      '<div class="feature-row">' +
      '<div class="feature-box"><h3 data-i18n="ayuda.onlyUnit">' +
      tt("ayuda.onlyUnit", "SOLO ESTA UNIDAD") +
      '</h3><p data-i18n="ayuda.onlyUnitDesc">' +
      tt("ayuda.onlyUnitDesc", "Enlace específico") +
      "</p></div>" +
      '<div class="feature-box"><h3 data-i18n="ayuda.readOnly">' +
      tt("ayuda.readOnly", "SOLO LECTURA") +
      '</h3><p data-i18n="ayuda.readOnlyDesc">' +
      tt("ayuda.readOnlyDesc", "No se puede editar") +
      "</p></div>" +
      '<div class="feature-box"><h3 data-i18n="ayuda.photos">' +
      tt("ayuda.photos", "FOTOS") +
      '</h3><p data-i18n="ayuda.photosDesc">' +
      tt("ayuda.photosDesc", "Usa las flechas") +
      "</p></div>" +
      '<div class="feature-box"><h3 data-i18n="ayuda.support">' +
      tt("ayuda.support", "SOPORTE") +
      '</h3><p data-i18n="ayuda.supportDesc">' +
      tt("ayuda.supportDesc", "UPA USB") +
      "</p></div>" +
      "</div>";

    document.title = "HELP · " + brandName + " " + modelName;

    if (window.VCDMX && typeof window.VCDMX.initDynamic === "function") {
      window.VCDMX.initDynamic();
      if (typeof window.VCDMX.applyLang === "function") {
        window.VCDMX.applyLang(window.VCDMX.getPreferredLang());
      }
    } else {
      document.dispatchEvent(new Event("VCDMX_DYNAMIC"));
    }
  })
  .catch(function () {
    status.innerHTML =
      tt("ayuda.missing", "Ayuda no encontrada para este enlace.") +
      "<br><small>Pide a soporte que vuelva a <strong>Guardar en catálogo</strong> y te reenvíe el link.</small>";
  });
})();
