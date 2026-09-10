(function () {
  "use strict";

  var THEME_KEY = "vcdmx-theme";

  function getPreferredTheme() {
    try {
      var saved = localStorage.getItem(THEME_KEY);
      if (saved === "dark" || saved === "warm") return saved;
    } catch (e) {}
    return "dark";
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

  // Apply early if script runs in head via sync — also on DOM ready
  applyTheme(getPreferredTheme());

  function initThemeControls() {
    document.querySelectorAll("[data-theme-set]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        applyTheme(btn.getAttribute("data-theme-set"));
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
    var timer = null;

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

    function restart() {
      if (timer) clearInterval(timer);
      timer = setInterval(function () {
        go(current + 1);
      }, 7000);
    }

    if (dotsWrap && !dotsWrap.children.length) {
      for (var i = 0; i < total; i++) {
        var b = document.createElement("button");
        b.type = "button";
        b.setAttribute("aria-label", "Ir a imagen " + (i + 1));
        if (i === 0) b.classList.add("active");
        (function (idx) {
          b.addEventListener("click", function () {
            go(idx);
            restart();
          });
        })(i);
        dotsWrap.appendChild(b);
      }
    } else if (dotsWrap) {
      dotsWrap.querySelectorAll("button").forEach(function (dot, i) {
        dot.addEventListener("click", function () {
          go(i);
          restart();
        });
      });
    }

    if (prev) {
      prev.addEventListener("click", function () {
        go(current - 1);
        restart();
      });
    }
    if (next) {
      next.addEventListener("click", function () {
        go(current + 1);
        restart();
      });
    }

    // Touch swipe
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
        restart();
      },
      { passive: true }
    );

    document.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") {
        go(current - 1);
        restart();
      } else if (e.key === "ArrowRight") {
        go(current + 1);
        restart();
      }
    });

    go(0);
    restart();
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

  document.addEventListener("DOMContentLoaded", function () {
    initThemeControls();
    applyTheme(getPreferredTheme());
    initSearch();
    initSlider();
    initModal();
    staggerCards();
  });
})();
