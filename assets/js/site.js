(function () {
  "use strict";

  var THEME_KEY = "vcdmx-theme";
  var LANG_KEY = "vcdmx-lang";

  var I18N = {
    es: {
      "theme.label": "Tema visual",
      "theme.dark": "Oscuro",
      "theme.warm": "Cálido",
      "lang.label": "Idioma",
      "brand.tag": "Sistema Velocímetros Digitales CDMX",
      "nav.home": "Inicio",
      "nav.cars": "Autos",
      "nav.bikes": "Motos",
      "nav.crumbs": "Migas de pan",
      "nav.nav": "Navegación",
      "back.home": "← Regresar al inicio",
      "back.cars": "← Regresar a Autos",
      "back.bikes": "← Regresar a Motos",
      "back.yamaha": "← Regresar a Yamaha",
      "home.seal": "Creado por Velocímetros Digitales CDMX",
      "home.lead": "Referencia técnica para EEPROM, programadores UPA, conexiones y dashboards automotrices.",
      "home.catalogTitle": "CATÁLOGO RÁPIDO",
      "home.catalogLead": "Elige la categoría y entra a marcas, modelos y fichas técnicas con fotos de tablero, EEPROM y conexión.",
      "home.carsMeta": "Chevrolet y más",
      "home.bikesMeta": "Yamaha MT-09 listo",
      "home.mt09Meta": "Ficha completa",
      "home.helpTitle": "HELP ONLINE SYSTEM",
      "home.helpLead": "Plataforma para talleres y técnicos: datos de chip, programador, tipo de memoria y notas de seguridad.",
      "home.eepromDesc": "Identificación de chips y organización",
      "home.upaDesc": "Programadores y flujos de lectura",
      "home.dashDesc": "Fotos de tablero y conexiones",
      "home.whoTitle": "¿QUIÉN HACE ESTE SISTEMA?",
      "home.whoLead": "HELP ONLINE es un desarrollo de Velocímetros Digitales CDMX: soporte técnico automotriz con identidad propia.",
      "home.whoLeadHtml": "HELP ONLINE es un desarrollo de <strong>Velocímetros Digitales CDMX</strong>: soporte técnico automotriz con identidad propia.",
      "home.officialBrand": "Marca oficial",
      "home.makerServices": "EEPROM · UPA · Dashboards · Conexiones · Soporte técnico CDMX",
      "footer.developedBy": "Sistema desarrollado por",
      "footer.note": "HELP ONLINE © VELOCÍMETROS CDMX — Uso técnico responsable",
      "cars.eyebrow": "Categoría",
      "cars.lead": "Selecciona la marca para ver modelos y fichas técnicas de velocímetros.",
      "cars.search": "Buscar marca…",
      "cars.empty": "No hay marcas con ese nombre.",
      "cars.ready": "Modelos listos",
      "soon": "Próximamente",
      "bikes.eyebrow": "Categoría",
      "bikes.lead": "Marcas de motocicletas con fichas de EEPROM, tablero y conexión.",
      "bikes.search": "Buscar marca…",
      "bikes.empty": "No hay marcas con ese nombre.",
      "bikes.available": "MT-09 disponible",
      "chevy.eyebrow": "Marca",
      "chevy.lead": "Modelos disponibles. Las fichas técnicas se irán publicando por unidad.",
      "chevy.search": "Buscar modelo…",
      "chevy.empty": "No hay modelos con ese nombre.",
      "yamaha.eyebrow": "Marca",
      "yamaha.lead": "Modelos con ficha técnica completa: EEPROM, programador, fotos y notas.",
      "yamaha.search": "Buscar modelo…",
      "yamaha.empty": "No hay modelos con ese nombre.",
      "fullSheet": "Ficha completa",
      "mt09.programmer": "PROGRAMADOR",
      "mt09.type": "TIPO",
      "mt09.notes": "NOTAS",
      "mt09.note1": "Velocímetros digitales CDMX",
      "mt09.note2": "No se hace responsable del mal uso",
      "mt09.note3": "El usuario es responsable de cada edición",
      "mt09.note4": "y modificación del sistema",
      "mt09.gallery": "Galería MT-09",
      "mt09.prev": "Anterior",
      "mt09.next": "Siguiente",
      "mt09.dots": "Indicadores",
      "mt09.close": "Cerrar",
      "mt09.zoom": "Vista ampliada",
      "mt09.safe": "100% SEGURO",
      "mt09.safeDesc": "Lectura y escritura",
      "mt09.support": "SOPORTE TÉCNICO",
      "mt09.supportDesc": "Expertos en UPA",
      "mt09.contact": "CONTACTO",
      "mt09.project": "PROYECTO YAMAHA",
      "mt09.mileage": "Kilometraje",
      "mt09.slideTo": "Ir a imagen"
    },
    en: {
      "theme.label": "Visual theme",
      "theme.dark": "Dark",
      "theme.warm": "Warm",
      "lang.label": "Language",
      "brand.tag": "Velocímetros Digitales CDMX System",
      "nav.home": "Home",
      "nav.cars": "Cars",
      "nav.bikes": "Bikes",
      "nav.crumbs": "Breadcrumbs",
      "nav.nav": "Navigation",
      "back.home": "← Back to home",
      "back.cars": "← Back to Cars",
      "back.bikes": "← Back to Bikes",
      "back.yamaha": "← Back to Yamaha",
      "home.seal": "Created by Velocímetros Digitales CDMX",
      "home.lead": "Technical reference for EEPROM, UPA programmers, wiring and automotive dashboards.",
      "home.catalogTitle": "QUICK CATALOG",
      "home.catalogLead": "Pick a category and browse brands, models and technical sheets with dashboard, EEPROM and connection photos.",
      "home.carsMeta": "Chevrolet and more",
      "home.bikesMeta": "Yamaha MT-09 ready",
      "home.mt09Meta": "Full sheet",
      "home.helpTitle": "HELP ONLINE SYSTEM",
      "home.helpLead": "Platform for shops and technicians: chip data, programmer, memory type and safety notes.",
      "home.eepromDesc": "Chip identification and layout",
      "home.upaDesc": "Programmers and read/write flows",
      "home.dashDesc": "Dashboard and connection photos",
      "home.whoTitle": "WHO BUILT THIS SYSTEM?",
      "home.whoLead": "HELP ONLINE is built by Velocímetros Digitales CDMX: automotive technical support with its own identity.",
      "home.whoLeadHtml": "HELP ONLINE is built by <strong>Velocímetros Digitales CDMX</strong>: automotive technical support with its own identity.",
      "home.officialBrand": "Official brand",
      "home.makerServices": "EEPROM · UPA · Dashboards · Wiring · Technical support CDMX",
      "footer.developedBy": "System developed by",
      "footer.note": "HELP ONLINE © VELOCÍMETROS CDMX — Responsible technical use",
      "cars.eyebrow": "Category",
      "cars.lead": "Select a brand to see models and speedometer technical sheets.",
      "cars.search": "Search brand…",
      "cars.empty": "No brands match that name.",
      "cars.ready": "Models ready",
      "soon": "Coming soon",
      "bikes.eyebrow": "Category",
      "bikes.lead": "Motorcycle brands with EEPROM, cluster and connection sheets.",
      "bikes.search": "Search brand…",
      "bikes.empty": "No brands match that name.",
      "bikes.available": "MT-09 available",
      "chevy.eyebrow": "Brand",
      "chevy.lead": "Available models. Technical sheets will be published per unit.",
      "chevy.search": "Search model…",
      "chevy.empty": "No models match that name.",
      "yamaha.eyebrow": "Brand",
      "yamaha.lead": "Models with a full technical sheet: EEPROM, programmer, photos and notes.",
      "yamaha.search": "Search model…",
      "yamaha.empty": "No models match that name.",
      "fullSheet": "Full sheet",
      "mt09.programmer": "PROGRAMMER",
      "mt09.type": "TYPE",
      "mt09.notes": "NOTES",
      "mt09.note1": "Digital speedometers CDMX",
      "mt09.note2": "Not responsible for misuse",
      "mt09.note3": "The user is responsible for every edit",
      "mt09.note4": "and system modification",
      "mt09.gallery": "MT-09 gallery",
      "mt09.prev": "Previous",
      "mt09.next": "Next",
      "mt09.dots": "Indicators",
      "mt09.close": "Close",
      "mt09.zoom": "Enlarged view",
      "mt09.safe": "100% SAFE",
      "mt09.safeDesc": "Read and write",
      "mt09.support": "TECH SUPPORT",
      "mt09.supportDesc": "UPA experts",
      "mt09.contact": "CONTACT",
      "mt09.project": "YAMAHA PROJECT",
      "mt09.mileage": "Mileage",
      "mt09.slideTo": "Go to image"
    }
  };

  function getPreferredTheme() {
    try {
      var saved = localStorage.getItem(THEME_KEY);
      if (saved === "dark" || saved === "warm") return saved;
    } catch (e) {}
    return "dark";
  }

  function getPreferredLang() {
    try {
      var saved = localStorage.getItem(LANG_KEY);
      if (saved === "es" || saved === "en") return saved;
    } catch (e) {}
    var nav = (navigator.language || "es").toLowerCase();
    return nav.indexOf("en") === 0 ? "en" : "es";
  }

  function t(key, lang) {
    var pack = I18N[lang] || I18N.es;
    return pack[key] || I18N.es[key] || key;
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (e) {}

    document.querySelectorAll("[data-theme-set]").forEach(function (btn) {
      var active = btn.getAttribute("data-theme-set") === theme;
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  function applyLang(lang) {
    if (lang !== "es" && lang !== "en") lang = "es";
    document.documentElement.setAttribute("lang", lang);
    document.documentElement.setAttribute("data-lang", lang);
    try {
      localStorage.setItem(LANG_KEY, lang);
    } catch (e) {}

    document.querySelectorAll("[data-lang-set]").forEach(function (btn) {
      var active = btn.getAttribute("data-lang-set") === lang;
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    });

    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var key = el.getAttribute("data-i18n");
      if (!key) return;
      if (el.getAttribute("data-i18n-html") === "true") {
        el.innerHTML = t(key, lang);
      } else {
        el.textContent = t(key, lang);
      }
    });

    document.querySelectorAll("[data-i18n-placeholder]").forEach(function (el) {
      var key = el.getAttribute("data-i18n-placeholder");
      if (key) el.setAttribute("placeholder", t(key, lang));
    });

    document.querySelectorAll("[data-i18n-aria]").forEach(function (el) {
      var key = el.getAttribute("data-i18n-aria");
      if (key) el.setAttribute("aria-label", t(key, lang));
    });

    // Refresh dynamically created slider dots labels
    document.querySelectorAll(".slider-dots button").forEach(function (dot, i) {
      dot.setAttribute("aria-label", t("mt09.slideTo", lang) + " " + (i + 1));
    });
  }

  applyTheme(getPreferredTheme());
  applyLang(getPreferredLang());

  function initThemeControls() {
    document.querySelectorAll("[data-theme-set]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        applyTheme(btn.getAttribute("data-theme-set"));
      });
    });
  }

  function initLangControls() {
    document.querySelectorAll("[data-lang-set]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        applyLang(btn.getAttribute("data-lang-set"));
      });
    });
  }

  function initSearch() {
    var input = document.querySelector("[data-filter-input]");
    var grid = document.querySelector("[data-filter-grid]");
    var empty = document.querySelector("[data-filter-empty]");
    var count = document.querySelector("[data-filter-count]");
    if (!input || !grid) return;

    var items = Array.prototype.slice.call(grid.querySelectorAll("[data-filter-item]"));

    function update() {
      var q = (input.value || "").trim().toLowerCase();
      var shown = 0;
      items.forEach(function (el) {
        var label = (el.getAttribute("data-filter-item") || el.textContent || "").toLowerCase();
        var match = !q || label.indexOf(q) !== -1;
        el.classList.toggle("is-hidden", !match);
        if (match) shown += 1;
      });
      if (empty) empty.classList.toggle("visible", shown === 0);
      if (count) count.textContent = shown + " / " + items.length;
    }

    input.addEventListener("input", update);
    update();
  }

  function initSlider() {
    var shell = document.querySelector("[data-slider]");
    if (!shell) return;

    var track = shell.querySelector(".slider-track");
    var slides = shell.querySelectorAll(".slide");
    var dotsWrap = shell.querySelector(".slider-dots");
    var prev = shell.querySelector(".slider-arrow.prev");
    var next = shell.querySelector(".slider-arrow.next");
    if (!track || !slides.length) return;

    var current = 0;
    var total = slides.length;
    var lang = getPreferredLang();

    function go(index) {
      current = (index + total) % total;
      track.style.transform = "translateX(-" + current * 100 + "%)";
      if (dotsWrap) {
        dotsWrap.querySelectorAll("button").forEach(function (dot, i) {
          dot.classList.toggle("active", i === current);
          dot.setAttribute("aria-current", i === current ? "true" : "false");
        });
      }
    }

    // Solo cambia con click/flecha — sin autoplay
    if (dotsWrap && !dotsWrap.children.length) {
      for (var i = 0; i < total; i++) {
        var b = document.createElement("button");
        b.type = "button";
        b.setAttribute("aria-label", t("mt09.slideTo", lang) + " " + (i + 1));
        if (i === 0) b.classList.add("active");
        (function (idx) {
          b.addEventListener("click", function () {
            go(idx);
          });
        })(i);
        dotsWrap.appendChild(b);
      }
    } else if (dotsWrap) {
      dotsWrap.querySelectorAll("button").forEach(function (dot, i) {
        dot.addEventListener("click", function () {
          go(i);
        });
      });
    }

    if (prev) {
      prev.addEventListener("click", function () {
        go(current - 1);
      });
    }
    if (next) {
      next.addEventListener("click", function () {
        go(current + 1);
      });
    }

    var startX = 0;
    track.addEventListener(
      "touchstart",
      function (e) {
        startX = e.changedTouches[0].screenX;
      },
      { passive: true }
    );
    track.addEventListener(
      "touchend",
      function (e) {
        var dx = e.changedTouches[0].screenX - startX;
        if (Math.abs(dx) < 40) return;
        go(current + (dx < 0 ? 1 : -1));
      },
      { passive: true }
    );

    document.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") {
        go(current - 1);
      } else if (e.key === "ArrowRight") {
        go(current + 1);
      }
    });

    go(0);
  }

  function initModal() {
    var modal = document.getElementById("imageModal");
    var modalImg = document.getElementById("modalImg");
    var closeBtn = document.querySelector(".modal-close");
    if (!modal || !modalImg) return;

    function open(src, alt) {
      modalImg.src = src;
      modalImg.alt = alt || "";
      modal.classList.add("open");
      document.body.style.overflow = "hidden";
    }

    function close() {
      modal.classList.remove("open");
      modalImg.removeAttribute("src");
      document.body.style.overflow = "";
    }

    document.querySelectorAll("[data-lightbox]").forEach(function (img) {
      img.addEventListener("click", function () {
        open(img.src, img.alt);
      });
    });

    if (closeBtn) closeBtn.addEventListener("click", close);
    modal.addEventListener("click", function (e) {
      if (e.target === modal) close();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") close();
    });
  }

  function staggerCards() {
    document.querySelectorAll(".menu-card").forEach(function (card, i) {
      card.style.animationDelay = Math.min(i * 0.04, 0.5) + "s";
    });
  }

  function initDynamic() {
    initSlider();
    initModal();
  }

  document.addEventListener("DOMContentLoaded", function () {
    initThemeControls();
    initLangControls();
    applyTheme(getPreferredTheme());
    applyLang(getPreferredLang());
    initSearch();
    initDynamic();
    staggerCards();
  });

  document.addEventListener("VCDMX_DYNAMIC", initDynamic);

  window.VCDMX = {
    initDynamic: initDynamic,
    applyLang: applyLang,
    applyTheme: applyTheme
  };
})();
