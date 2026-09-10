(function () {
  "use strict";

  var C = window.VCDMXCatalog;
  if (new URLSearchParams(location.search).get("portal") === "1") document.body.classList.add("is-portal");

  function params() {
    var q = new URLSearchParams(location.search);
    return {
      c: q.get("c") || "motos",
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

  C.loadCatalog().then(function (catalog) {
    var p = params();
    var brand = (((catalog.categories[p.c] || {}).brands || {})[p.b]) || null;
    var model = brand && brand.models ? brand.models[p.m] : null;
    var version = C.getVersion(catalog, p.c, p.b, p.m, p.v);

    var crumbs = document.getElementById("crumbs");
    var back = document.getElementById("backLink");
    var root = document.getElementById("fichaRoot");

    if (!brand || !model || !version) {
      document.getElementById("fichaStatus").textContent = "Ficha no encontrada.";
      return;
    }

    var catLabel = p.c === "autos" ? "Autos" : "Motos";
    var catHref = p.c === "autos" ? "../autos/" : "../motos/";
    crumbs.innerHTML =
      '<a href="../">Inicio</a><span class="sep">/</span>' +
      '<a href="' + catHref + '">' + catLabel + "</a><span class=\"sep\">/</span>" +
      "<span>" + escapeHtml(brand.name) + "</span><span class=\"sep\">/</span>" +
      "<span class=\"current\">" + escapeHtml(model.name) + (version.name ? " · " + escapeHtml(version.name) : "") + "</span>";

    back.href = catHref;
    back.textContent = "← Regresar a " + catLabel;

    var photos = version.photos || {};
    var slides = [];
    if (photos.dashboard) slides.push({ src: asset(photos.dashboard), alt: "Tablero" });
    if (photos.connection) slides.push({ src: asset(photos.connection), alt: "Conexión" });
    if (photos.ignition || photos.eeprom) slides.push({ src: asset(photos.ignition || photos.eeprom), alt: "Conexión encendido / EEPROM" });
    if (photos.main && slides.length < 3) slides.unshift({ src: asset(photos.main), alt: model.name });

    var notes = (version.notes || [])
      .map(function (n) {
        return "<li>" + escapeHtml(n) + "</li>";
      })
      .join("");

    var versions = model.versions || [];
    var versionLinks = versions
      .map(function (v) {
        var href =
          "?c=" + encodeURIComponent(p.c) +
          "&b=" + encodeURIComponent(p.b) +
          "&m=" + encodeURIComponent(p.m) +
          "&v=" + encodeURIComponent(v.id);
        var active = v.id === version.id ? " is-active" : "";
        return '<a class="version-chip' + active + '" href="' + href + '">' + escapeHtml(v.name || v.id) + "</a>";
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
      "<h1>" + escapeHtml(brand.name) + " " + escapeHtml(model.name) + "</h1>" +
      '<p class="subtitle">' + escapeHtml(version.name || "") + " · HELP ONLINE</p>" +
      '<div class="version-row">' + versionLinks + "</div>" +
      "</header>" +
      '<div class="detail-main">' +
      '<aside class="tech-stack">' +
      '<article class="tech-card"><h2>EEPROM</h2><p class="value">' + escapeHtml(version.eeprom || "—") + "</p></article>" +
      '<article class="tech-card"><h2>PROGRAMADOR</h2><p class="value">' + escapeHtml(version.programmer || "—") + "</p></article>" +
      '<article class="tech-card"><h2>TIPO</h2><p class="value">' + escapeHtml(version.type || "—") + "</p></article>" +
      '<article class="tech-card notes"><h2>NOTAS</h2><ul>' + (notes || "<li>—</li>") + "</ul></article>" +
      "</aside>" +
      (slides.length
        ? '<section class="slider-shell" data-slider aria-label="Galería">' +
          '<button type="button" class="slider-arrow prev" aria-label="Anterior">❮</button>' +
          '<div class="slider-track">' + slidesHtml + "</div>" +
          '<button type="button" class="slider-arrow next" aria-label="Siguiente">❯</button>' +
          '<div class="slider-dots" role="tablist" aria-label="Indicadores"></div>' +
          "</section>"
        : '<section class="slider-shell"><p class="lead" style="padding:24px">Sin fotos aún.</p></section>') +
      "</div>" +
      '<div class="feature-row">' +
      '<div class="feature-box"><h3>100% SEGURO</h3><p>Lectura y escritura</p></div>' +
      '<div class="feature-box"><h3>SOPORTE TÉCNICO</h3><p>Expertos en UPA</p></div>' +
      '<div class="feature-box"><h3>CONTACTO</h3><p><a href="tel:+525578914191">+52 55 7891 4191</a></p></div>' +
      '<div class="feature-box"><h3>SOLO LECTURA</h3><p>El usuario no puede editar</p></div>' +
      "</div>";

    document.title = brand.name + " " + model.name + " | HELP ONLINE";

    // Re-init slider/modal after dynamic HTML
    if (window.VCDMX && typeof window.VCDMX.initDynamic === "function") {
      window.VCDMX.initDynamic();
    } else {
      // Fallback: dispatch DOMContentLoaded-like hooks by reloading site helpers
      var evt = new Event("VCDMX_DYNAMIC");
      document.dispatchEvent(evt);
    }
  });
})();
