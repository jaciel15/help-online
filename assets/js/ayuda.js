(function () {
  "use strict";

  var C = window.VCDMXCatalog;

  function params() {
    var q = new URLSearchParams(location.search);
    return {
      c: q.get("c") || "",
      b: q.get("b") || "",
      m: q.get("m") || "",
      v: q.get("v") || ""
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

  // Bloqueo suave de menú contextual en fotos
  document.addEventListener("contextmenu", function (e) {
    if (e.target && e.target.tagName === "IMG") e.preventDefault();
  });
  document.addEventListener("dragstart", function (e) {
    if (e.target && e.target.tagName === "IMG") e.preventDefault();
  });

  C.loadCatalog().then(function (catalog) {
    var p = params();
    var root = document.getElementById("fichaRoot");
    var status = document.getElementById("fichaStatus");

    if (!p.c || !p.b || !p.m) {
      status.textContent = "Enlace de ayuda incompleto. Pide al soporte el link específico de tu unidad.";
      return;
    }

    var brand = (((catalog.categories[p.c] || {}).brands || {})[p.b]) || null;
    var model = brand && brand.models ? brand.models[p.m] : null;
    var version = C.getVersion(catalog, p.c, p.b, p.m, p.v);

    if (!brand || !model || !version) {
      status.textContent = "Ayuda no encontrada para este enlace.";
      return;
    }

    var photos = version.photos || {};
    var slides = [];
    if (photos.dashboard) slides.push({ src: asset(photos.dashboard), alt: "Tablero" });
    if (photos.connection) slides.push({ src: asset(photos.connection), alt: "Conexión" });
    if (photos.ignition || photos.eeprom) {
      slides.push({ src: asset(photos.ignition || photos.eeprom), alt: "Conexión encendido" });
    }
    if (photos.main && slides.length < 1) {
      slides.push({ src: asset(photos.main), alt: model.name });
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
      escapeHtml(brand.name) +
      " " +
      escapeHtml(model.name) +
      "</h1>" +
      '<p class="subtitle">' +
      escapeHtml(version.name || "") +
      " · HELP</p>" +
      "</header>" +
      '<div class="detail-main">' +
      '<aside class="tech-stack">' +
      '<article class="tech-card"><h2>EEPROM</h2><p class="value">' +
      escapeHtml(version.eeprom || "—") +
      "</p></article>" +
      '<article class="tech-card"><h2>PROGRAMADOR</h2><p class="value">' +
      escapeHtml(version.programmer || "—") +
      "</p></article>" +
      '<article class="tech-card"><h2>TIPO</h2><p class="value">' +
      escapeHtml(version.type || "—") +
      "</p></article>" +
      '<article class="tech-card notes"><h2>NOTAS</h2><ul>' +
      (notes || "<li>—</li>") +
      "</ul></article>" +
      "</aside>" +
      (slides.length
        ? '<section class="slider-shell" data-slider aria-label="Galería de ayuda">' +
          '<button type="button" class="slider-arrow prev" aria-label="Anterior">❮</button>' +
          '<div class="slider-track">' +
          slidesHtml +
          "</div>" +
          '<button type="button" class="slider-arrow next" aria-label="Siguiente">❯</button>' +
          '<div class="slider-dots" role="tablist" aria-label="Indicadores"></div>' +
          "</section>"
        : '<section class="slider-shell"><p class="lead" style="padding:24px">Sin fotos en esta ayuda.</p></section>') +
      "</div>" +
      '<div class="feature-row">' +
      '<div class="feature-box"><h3>SOLO ESTA UNIDAD</h3><p>Enlace específico</p></div>' +
      '<div class="feature-box"><h3>SOLO LECTURA</h3><p>No se puede editar</p></div>' +
      '<div class="feature-box"><h3>FOTOS</h3><p>Usa las flechas</p></div>' +
      '<div class="feature-box"><h3>SOPORTE</h3><p>UPA USB</p></div>' +
      "</div>";

    document.title = "HELP · " + brand.name + " " + model.name;

    if (window.VCDMX && typeof window.VCDMX.initDynamic === "function") {
      window.VCDMX.initDynamic();
    } else {
      document.dispatchEvent(new Event("VCDMX_DYNAMIC"));
    }
  });
})();
