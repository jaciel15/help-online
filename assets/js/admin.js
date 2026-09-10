(function () {
  "use strict";

  var C = window.VCDMXCatalog;
  var CFG = window.VCDMX_ADMIN || {
    root: "../",
    ayudaBase: "../ayuda/",
    assetPrefix: "../"
  };
  var FOLDERS_KEY = "vcdmx-folders-v1";
  var catalog = null;
  var pending = { main: "", dashboard: "", connection: "", ignition: "" };
  var editing = null;
  var listFilter = "all";
  var brandView = null; // { cat, brandId, brandName } when inside a brand folder
  var PHOTO_KEYS = ["main", "dashboard", "connection", "ignition"];
  var PHOTO_META = {
    main: { img: "prevMain", st: "stMain", slot: 1 },
    dashboard: { img: "prevDashboard", st: "stDashboard", slot: 2 },
    connection: { img: "prevConnection", st: "stConnection", slot: 3 },
    ignition: { img: "prevIgnition", st: "stIgnition", slot: 4 }
  };
  var CHAIN = {
    main: { nextSlot: 2, nextGallery: "pDashGallery" },
    dashboard: { nextSlot: 3, nextGallery: "pConnGallery" },
    connection: { nextSlot: 4, nextGallery: "pIgnGallery" },
    ignition: { nextSlot: 0, nextGallery: null }
  };

  function $(id) {
    return document.getElementById(id);
  }

  function showApp(on) {
    var gate = $("loginGate");
    var app = $("adminApp");
    if (gate) gate.hidden = on;
    if (app) app.hidden = !on;
    try {
      document.body.classList.toggle("admin-unlocked", !!on);
    } catch (e) {}
  }

  function isPlaceholderPhoto(path) {
    return !path || path === "[published]" || path === "[indexed]";
  }

  function resolvePreview(path) {
    if (isPlaceholderPhoto(path)) return "";
    if (path.indexOf("data:") === 0 || path.indexOf("http") === 0 || path.indexOf("blob:") === 0) return path;
    if (path.indexOf("../") === 0 || path.indexOf("/") === 0 || path.indexOf("./") === 0) return path;
    return (CFG.assetPrefix || "") + path;
  }

  function guessPublishedPhoto(c, b, m, v, key) {
    var base =
      (CFG.root || "") +
      "data/help/" +
      encodeURIComponent(c) +
      "/" +
      encodeURIComponent(b) +
      "/" +
      encodeURIComponent(m) +
      "/";
    var vid = v || "base";
    if (vid !== "base") return base + encodeURIComponent(vid + "-" + key + ".jpg");
    return base + encodeURIComponent(key + ".jpg");
  }

  /** Busca un archivo de foto real en el servidor (jpg/png/webp/gif). */
  function probePublishedPhoto(c, b, m, v, key) {
    var vid = v || "base";
    var exts = ["jpg", "jpeg", "png", "webp", "gif"];
    var names = [];
    exts.forEach(function (ext) {
      if (vid !== "base") {
        names.push(vid + "-" + key + "." + ext);
      } else {
        names.push(key + "." + ext);
        names.push("base-" + key + "." + ext);
      }
    });
    var dir =
      (CFG.root || "") +
      "data/help/" +
      encodeURIComponent(c) +
      "/" +
      encodeURIComponent(b) +
      "/" +
      encodeURIComponent(m) +
      "/";

    function tryAt(i) {
      if (i >= names.length) return Promise.resolve("");
      var rel = "data/help/" + c + "/" + b + "/" + m + "/" + names[i];
      var url = dir + encodeURIComponent(names[i]);
      return fetch(url, { method: "HEAD", cache: "no-store" })
        .then(function (r) {
          if (r.ok) {
            var len = parseInt(r.headers.get("content-length") || "0", 10);
            if (len && len < 32) return tryAt(i + 1);
            return rel;
          }
          // Algunos hosts no permiten HEAD → intenta GET corto
          return fetch(url, { method: "GET", cache: "no-store", headers: { Range: "bytes=0-64" } }).then(
            function (r2) {
              if (!r2.ok) return tryAt(i + 1);
              return r2.blob().then(function (blob) {
                if (!blob || blob.size < 16) return tryAt(i + 1);
                return rel;
              });
            }
          );
        })
        .catch(function () {
          return tryAt(i + 1);
        });
    }
    return tryAt(0);
  }

  function helpHref(cat, brandId, modelId, versionId) {
    return (
      (CFG.ayudaBase || "ayuda/") +
      "?c=" +
      encodeURIComponent(cat) +
      "&b=" +
      encodeURIComponent(brandId) +
      "&m=" +
      encodeURIComponent(modelId) +
      "&v=" +
      encodeURIComponent(versionId || "base")
    );
  }

  function folderPath(cat, brandId, modelId) {
    return [cat, brandId, modelId].join("/");
  }

  function readFolders() {
    try {
      return JSON.parse(localStorage.getItem(FOLDERS_KEY) || "[]");
    } catch (e) {
      return [];
    }
  }

  function syncFoldersFromCatalog() {
    var list = [];
    if (!catalog) return list;
    ["autos", "motos"].forEach(function (cat) {
      C.listBrands(catalog, cat).forEach(function (b) {
        Object.keys(b.models || {}).forEach(function (mid) {
          var model = b.models[mid];
          (model.versions || []).forEach(function (v) {
            list.push({
              key: folderPath(cat, b.id, mid) + "/" + (v.id || "base"),
              c: cat,
              b: b.id,
              m: mid,
              v: v.id || "base",
              label: b.name + " " + model.name,
              path: folderPath(cat, b.id, mid),
              updatedAt: new Date().toISOString()
            });
          });
        });
      });
    });
    try {
      localStorage.setItem(FOLDERS_KEY, JSON.stringify(list));
    } catch (e) {}
    return list;
  }

  function updateFolderCount() {
    var el = $("folderCount");
    if (!el) return;
    var n = countItems();
    el.textContent = "Carpetas: " + n + (n === 1 ? " ayuda" : " ayudas");
    refreshStorageStatus();
  }

  function refreshStorageStatus() {
    var el = $("storageStatus");
    if (!el) return;
    fetch((CFG.root || "") + "api/storage", { cache: "no-store" })
      .then(function (r) {
        return r.json();
      })
      .then(function (body) {
        var disk = (body && body.disk) || {};
        var free = disk.freeMb != null ? disk.freeMb : "?";
        var ok = disk.ok !== false;
        el.textContent =
          (ok ? "✓ " : "⚠ ") +
          "Espacio servidor: " +
          free +
          " MB libres" +
          (ok ? " · listo para más ayudas" : " · libera espacio antes de guardar");
        el.style.color = ok ? "" : "#f5a623";
      })
      .catch(function () {
        el.textContent = "Espacio servidor: no disponible (¿servidor apagado?)";
      });
  }

  function setPhoto(key, url) {
    pending[key] = url || "";
    var meta = PHOTO_META[key];
    if (!meta) return;
    var img = $(meta.img);
    var st = $(meta.st);
    var slot = document.querySelector('.photo-slot[data-slot="' + meta.slot + '"]');
    if (!img || !st) return;
    img.onload = null;
    img.onerror = null;
    var preview = resolvePreview(url);
    if (preview) {
      st.textContent = "Cargando…";
      if (slot) slot.classList.remove("is-ready");
      img.onload = function () {
        img.classList.add("show");
        st.textContent = "Lista";
        if (slot) slot.classList.add("is-ready");
        updatePublishPulse();
      };
      img.onerror = function () {
        pending[key] = "";
        img.removeAttribute("src");
        img.classList.remove("show");
        st.textContent = "Error · vuelve a subir";
        if (slot) slot.classList.remove("is-ready");
        updatePublishPulse();
      };
      img.src = preview;
    } else {
      img.removeAttribute("src");
      img.classList.remove("show");
      st.textContent = "Pendiente";
      if (slot) slot.classList.remove("is-ready");
    }
    updatePublishPulse();
  }

  function setPhotoStatus(key, text) {
    var meta = PHOTO_META[key];
    if (!meta) return;
    var st = $(meta.st);
    if (st) st.textContent = text;
  }

  function updatePublishPulse() {
    var btn = $("btnPublish");
    if (!btn) return;
    var ready = PHOTO_KEYS.every(function (k) {
      return !!pending[k];
    });
    btn.classList.toggle("is-pulse", ready);
  }

  function markActiveSlot(n) {
    document.querySelectorAll(".photo-slot").forEach(function (el) {
      el.classList.toggle("is-active", el.getAttribute("data-slot") === String(n));
    });
  }

  function openPicker(inputId) {
    var el = $(inputId);
    if (!el) return;
    try {
      el.click();
    } catch (e) {}
  }

  function onPhotoChosen(key, file, chain) {
    if (!file) return;
    setPhotoStatus(key, "Comprimiendo…");
    C.fileToCompressedDataUrl(file)
      .then(function (url) {
        setPhoto(key, url);
        if (!chain) return;
        var next = CHAIN[key];
        if (next && next.nextSlot) {
          markActiveSlot(next.nextSlot);
        } else {
          markActiveSlot(0);
          if ($("btnPublish")) $("btnPublish").focus();
        }
      })
      .catch(function (err) {
        pending[key] = "";
        setPhoto(key, "");
        setPhotoStatus(key, "Error");
        alert((err && err.message) || "No se pudo procesar la foto.");
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
    PHOTO_KEYS.forEach(function (k) {
      setPhotoStatus(k, files.length ? "Comprimiendo…" : "Pendiente");
    });
    return Promise.all(
      files.map(function (file, i) {
        return C.fileToCompressedDataUrl(file)
          .then(function (url) {
            setPhoto(PHOTO_KEYS[i], url);
          })
          .catch(function (err) {
            setPhoto(PHOTO_KEYS[i], "");
            setPhotoStatus(PHOTO_KEYS[i], "Error");
            throw err;
          });
      })
    );
  }

  function firstRealPhoto(photos) {
    var keys = ["main", "dashboard", "connection", "ignition", "eeprom"];
    for (var i = 0; i < keys.length; i++) {
      var src = photos && photos[keys[i]];
      if (!isPlaceholderPhoto(src) && String(src).indexOf("data:") !== 0) return src;
      if (!isPlaceholderPhoto(src)) return src;
    }
    return "";
  }

  function thumbHtml(photos) {
    var src = firstRealPhoto(photos);
    var preview = resolvePreview(src);
    if (!preview) return '<div class="inv-thumb inv-thumb--empty">Sin foto</div>';
    return (
      '<div class="inv-thumb"><img src="' +
      preview +
      '" alt="" loading="lazy" onerror="this.parentNode.classList.add(\'inv-thumb--empty\');this.remove();"></div>'
    );
  }

  function countItems() {
    var n = 0;
    if (!catalog) return 0;
    ["autos", "motos"].forEach(function (cat) {
      C.listBrands(catalog, cat).forEach(function (b) {
        Object.keys(b.models || {}).forEach(function (mid) {
          n += (b.models[mid].versions || []).length;
        });
      });
    });
    return n;
  }

  function countBrandHelps(cat, brandId) {
    var n = 0;
    try {
      var models = catalog.categories[cat].brands[brandId].models || {};
      Object.keys(models).forEach(function (mid) {
        n += (models[mid].versions || []).length;
      });
    } catch (e) {}
    return n;
  }

  function brandThumb(cat, brandId) {
    try {
      var models = catalog.categories[cat].brands[brandId].models || {};
      var mids = Object.keys(models);
      for (var i = 0; i < mids.length; i++) {
        var versions = models[mids[i]].versions || [];
        for (var j = 0; j < versions.length; j++) {
          var v = versions[j];
          var photos = v.photos || {};
          if (firstRealPhoto(photos)) return thumbHtml(photos);
        }
      }
    } catch (e) {}
    return '<div class="inv-thumb inv-thumb--empty">📁</div>';
  }

  function copyTextNow(text) {
    return new Promise(function (resolve) {
      var ok = false;
      try {
        var ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.setAttribute("aria-hidden", "true");
        ta.style.cssText = "position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;border:0;padding:0;margin:0;";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        ta.setSelectionRange(0, String(text).length);
        ok = document.execCommand("copy");
        document.body.removeChild(ta);
      } catch (e) {
        ok = false;
      }
      if (ok) {
        resolve(true);
        return;
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard
          .writeText(text)
          .then(function () {
            resolve(true);
          })
          .catch(function () {
            resolve(false);
          });
        return;
      }
      resolve(false);
    });
  }

  function showLinkSharePanel(url, note) {
    var panel = $("linkSharePanel");
    var input = $("linkShareInput");
    var hint = $("linkShareHint");
    var openBtn = $("linkShareOpen");
    if (!panel || !input) return;
    panel.hidden = false;
    input.value = url || "";
    if (openBtn) {
      openBtn.href = url || "#";
      openBtn.style.display = url ? "" : "none";
    }
    if (hint) {
      hint.textContent =
        note ||
        "Toca Copiar link o selecciona el texto del cuadro. Luego pégalo en WhatsApp.";
    }
    try {
      input.focus();
      input.select();
      input.setSelectionRange(0, input.value.length);
    } catch (e) {}
    panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function hideLinkSharePanel() {
    var panel = $("linkSharePanel");
    if (panel) panel.hidden = true;
  }

  function bindLinkSharePanel() {
    if ($("linkShareCopy")) {
      $("linkShareCopy").addEventListener("click", function () {
        var input = $("linkShareInput");
        var text = (input && input.value) || "";
        if (!text) return;
        copyTextNow(text).then(function (ok) {
          showLinkSharePanel(
            text,
            ok
              ? "Listo: link copiado. Pégalo en WhatsApp o notas."
              : "No se pudo copiar automático. Selecciona el texto del cuadro y cópialo manualmente."
          );
        });
      });
    }
    if ($("linkShareShare")) {
      $("linkShareShare").addEventListener("click", function () {
        var input = $("linkShareInput");
        var text = (input && input.value) || "";
        if (!text) return;
        if (navigator.share) {
          navigator
            .share({ title: "HELP ONLINE", text: "Tu ayuda técnica", url: text })
            .catch(function () {
              showLinkSharePanel(text, "Usa el cuadro para copiar el link.");
            });
        } else {
          showLinkSharePanel(text, "Tu navegador no tiene Compartir. Copia el texto del cuadro.");
        }
      });
    }
    if ($("linkShareClose")) {
      $("linkShareClose").addEventListener("click", hideLinkSharePanel);
    }
  }

  function bindInventoryActions(box) {
    box.querySelectorAll(".open-brand").forEach(function (btn) {
      btn.addEventListener("click", function () {
        brandView = {
          cat: btn.getAttribute("data-c"),
          brandId: btn.getAttribute("data-b"),
          brandName: btn.getAttribute("data-name")
        };
        renderTree();
      });
    });

    var back = box.querySelector("#btnBackBrands");
    if (back) {
      back.addEventListener("click", function () {
        brandView = null;
        renderTree();
      });
    }

    box.querySelectorAll(".copy-help").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var url = btn.getAttribute("data-help-url");
        var c = btn.getAttribute("data-c");
        var b = btn.getAttribute("data-b");
        var m = btn.getAttribute("data-m");
        var v = btn.getAttribute("data-v");
        var original = btn.textContent || "Copiar link";

        function done(ok, label) {
          btn.textContent = label || (ok ? "¡Copiado!" : "Error");
          setTimeout(function () {
            btn.textContent = original;
          }, 1800);
        }

        if (!url) {
          done(false);
          alert("No hay link para esta ayuda.");
          return;
        }

        // IMPORTANTE: copiar YA (en el mismo toque). Si hacemos fetch antes,
        // iPhone/Android pierden el permiso de portapapeles y "Copiar" falla.
        copyTextNow(url).then(function (copied) {
          showLinkSharePanel(
            url,
            copied
              ? "Link copiado. Si no pega, selecciona el cuadro o toca Compartir."
              : "Copia manual: toca el cuadro, selecciona todo y copia. O toca Compartir."
          );
          done(true, copied ? "¡Copiado!" : "Ver link ↓");

          if (navigator.share && !copied) {
            // En móvil, Compartir suele ser más fiable que el portapapeles
            try {
              navigator.share({ title: "HELP ONLINE", text: "Tu ayuda técnica", url: url });
            } catch (e) {}
          }

          var checkUrl =
            (CFG.root || "") +
            "data/help/" +
            encodeURIComponent(c) +
            "/" +
            encodeURIComponent(b) +
            "/" +
            encodeURIComponent(m) +
            "/" +
            encodeURIComponent(v || "base") +
            ".json";

          fetch(checkUrl, { cache: "no-store" })
            .then(function (r) {
              if (!r.ok) throw new Error("missing");
              return true;
            })
            .catch(function () {
              return false;
            })
            .then(function (publicOk) {
              if (publicOk) return;
              showLinkSharePanel(
                url,
                "⚠ Esta ayuda aún no está publicada en el servidor. Vuelve a Guardar en catálogo y luego copia de nuevo."
              );
              done(false, "Sin publicar");
            });
        });
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

    box.querySelectorAll(".delete-help").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var c = btn.getAttribute("data-c");
        var b = btn.getAttribute("data-b");
        var m = btn.getAttribute("data-m");
        var v = btn.getAttribute("data-v");
        var label = btn.getAttribute("data-label") || "esta ayuda";
        if (!confirm("¿Borrar " + label + "? Esta acción no se puede deshacer.")) return;
        C.deleteVersion(catalog, c, b, m, v);
        Promise.resolve()
          .then(function () {
            return C.deleteFromServer(c, b, m, v).catch(function () {
              return null;
            });
          })
          .then(function () {
            return C.deleteHelpUnit(c, b, m, v).catch(function () {});
          })
          .then(function () {
            return C.saveCatalog(catalog);
          })
          .then(function () {
            if (brandView && countBrandHelps(brandView.cat, brandView.brandId) === 0) {
              brandView = null;
            }
            renderTree();
            if ($("formMsg")) {
              $("formMsg").hidden = false;
              $("formMsg").textContent = "Eliminado: " + label;
            }
          })
          .catch(function (err) {
            alert("No se pudo borrar: " + ((err && err.message) || err));
          });
      });
    });
  }

  function renderBrandFolders(cats) {
    var html = "";
    var shown = 0;
    cats.forEach(function (cat) {
      var brands = C.listBrands(catalog, cat).filter(function (b) {
        return countBrandHelps(cat, b.id) > 0;
      });
      if (!brands.length) return;
      html += '<div class="inv-cat"><h3>' + cat.toUpperCase() + "</h3>";
      brands.forEach(function (b) {
        var n = countBrandHelps(cat, b.id);
        shown += 1;
        html +=
          '<button type="button" class="brand-folder open-brand" data-c="' +
          cat +
          '" data-b="' +
          b.id +
          '" data-name="' +
          String(b.name).replace(/"/g, "&quot;") +
          '">' +
          brandThumb(cat, b.id) +
          '<div class="brand-folder-body">' +
          "<strong>" +
          b.name +
          "</strong>" +
          "<span>" +
          n +
          (n === 1 ? " ayuda" : " ayudas") +
          " · carpeta " +
          cat +
          "/" +
          b.id +
          "</span>" +
          "<em>Abrir carpeta →</em>" +
          "</div></button>";
      });
      html += "</div>";
    });
    return { html: html, shown: shown };
  }

  function renderBrandHelps(cat, brandId, brandName) {
    var html =
      '<div class="inv-brand-head">' +
      '<button type="button" class="btn btn-ghost" id="btnBackBrands">← Todas las marcas</button>' +
      "<div><strong>📁 " +
      brandName +
      "</strong><span class='muted tiny'> " +
      cat +
      "/" +
      brandId +
      "</span></div></div>";
    var shown = 0;
    var brand = (((catalog.categories[cat] || {}).brands || {})[brandId]) || { models: {} };
    Object.keys(brand.models || {}).forEach(function (mid) {
      var m = brand.models[mid];
      (m.versions || []).forEach(function (v) {
        shown += 1;
        var href = helpHref(cat, brandId, mid, v.id);
        var absHelp = new URL(href, location.href).href;
        var label = brandName + " " + m.name + " · " + (v.name || v.id);
        html +=
          '<article class="inv-item">' +
          thumbHtml(v.photos) +
          '<div class="inv-body">' +
          "<strong>" +
          m.name +
          "</strong>" +
          "<span>" +
          (v.name || v.id) +
          " · EEPROM " +
          (v.eeprom || "—") +
          "</span>" +
          '<span class="inv-folder">📁 ' +
          folderPath(cat, brandId, mid) +
          "</span>" +
          '<div class="tree-actions">' +
          "<button type='button' class='edit-help' data-c='" +
          cat +
          "' data-b='" +
          brandId +
          "' data-m='" +
          mid +
          "' data-v='" +
          v.id +
          "'>Editar</button>" +
          "<a href='" +
          href +
          "' target='_blank' rel='noopener'>Ver ayuda cliente</a>" +
          "<button type='button' class='copy-help' data-help-url='" +
          absHelp.replace(/'/g, "&#39;") +
          "' data-c='" +
          cat +
          "' data-b='" +
          brandId +
          "' data-m='" +
          mid +
          "' data-v='" +
          v.id +
          "'>Copiar link</button>" +
          "<button type='button' class='delete-help' data-c='" +
          cat +
          "' data-b='" +
          brandId +
          "' data-m='" +
          mid +
          "' data-v='" +
          v.id +
          "' data-label='" +
          label.replace(/'/g, "&#39;") +
          "'>Borrar</button>" +
          "</div></div></article>";
      });
    });
    return { html: html, shown: shown };
  }

  function renderTree() {
    var box = $("catalogTree");
    var empty = $("invEmpty");
    var crumb = $("invBreadcrumb");
    if (!box) return;

    var cats = listFilter === "all" ? ["autos", "motos"] : [listFilter];
    var result;

    if (brandView) {
      if (crumb) {
        crumb.hidden = false;
        crumb.innerHTML =
          "Carpetas / <strong>" +
          (brandView.cat || "").toUpperCase() +
          "</strong> / <strong>" +
          brandView.brandName +
          "</strong>";
      }
      result = renderBrandHelps(brandView.cat, brandView.brandId, brandView.brandName);
    } else {
      if (crumb) {
        crumb.hidden = true;
        crumb.innerHTML = "";
      }
      result = renderBrandFolders(cats);
    }

    box.innerHTML = result.html || "";
    if (empty) {
      if (countItems() === 0) {
        empty.hidden = false;
        empty.textContent = "Aún no hay ayudas. Guarda la primera en catálogo.";
      } else if (result.shown === 0) {
        empty.hidden = false;
        empty.textContent = brandView
          ? "Esta marca no tiene ayudas."
          : "No hay marcas en este filtro.";
      } else {
        empty.hidden = true;
      }
    }
    updateFolderCount();
    syncFoldersFromCatalog();
    bindInventoryActions(box);
  }

  function applyVersionToForm(cat, brandId, modelId, brand, model, version) {
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
    PHOTO_KEYS.forEach(function (key) {
      var src = photos[key] || (key === "ignition" ? photos.eeprom : "") || "";
      if (!isPlaceholderPhoto(src)) {
        setPhoto(key, src);
        return;
      }
      setPhoto(key, "");
      probePublishedPhoto(cat, brandId, modelId, version.id, key).then(function (found) {
        if (found && !pending[key]) setPhoto(key, found);
      });
    });

    $("formCard").scrollIntoView({ behavior: "smooth", block: "start" });
    if ($("formMsg")) $("formMsg").hidden = true;
  }

  function loadIntoForm(cat, brandId, modelId, versionId) {
    if (!catalog) return;
    var brand = (((catalog.categories[cat] || {}).brands || {})[brandId]) || null;
    var model = brand && brand.models ? brand.models[modelId] : null;
    var version = C.getVersion(catalog, cat, brandId, modelId, versionId);
    if (!brand || !model || !version) return;

    // Carga la ficha completa (fotos reales) desde IndexedDB o data/help
    C.loadHelpUnit(cat, brandId, modelId, versionId || version.id)
      .then(function (unit) {
        var full = (unit && unit.version) || version;
        applyVersionToForm(cat, brandId, modelId, brand, model, full);
      })
      .catch(function () {
        applyVersionToForm(cat, brandId, modelId, brand, model, version);
      });
  }

  function resolvePhotosForSave(category, brandId, modelId, versionId, prev) {
    var photos = {
      main: pending.main || "",
      dashboard: pending.dashboard || "",
      connection: pending.connection || "",
      ignition: pending.ignition || ""
    };

    return C.loadHelpUnit(category, brandId, modelId, versionId)
      .catch(function () {
        return null;
      })
      .then(function (unit) {
        var fromUnit = (unit && unit.version && unit.version.photos) || {};
        PHOTO_KEYS.forEach(function (k) {
          var cur = photos[k];
          if (!isPlaceholderPhoto(cur)) return;
          var fallback = fromUnit[k] || (prev && prev[k]) || "";
          if (k === "ignition" && isPlaceholderPhoto(fallback)) {
            fallback = fromUnit.eeprom || (prev && prev.eeprom) || "";
          }
          if (!isPlaceholderPhoto(fallback)) photos[k] = fallback;
          else photos[k] = "";
        });
        return photos;
      });
  }

  function clearForm() {
    editing = null;
    if ($("formTitle")) $("formTitle").textContent = "Nueva ayuda";
    if ($("entryForm")) $("entryForm").reset();
    if ($("fProgrammer")) $("fProgrammer").value = "UPA USB";
    if ($("fType")) $("fType").value = "SERIAL EEPROM";
    if ($("fVersion")) $("fVersion").value = "Base";
    if ($("pMulti")) $("pMulti").value = "";
    PHOTO_KEYS.forEach(function (k) {
      setPhoto(k, "");
    });
    markActiveSlot(1);
    if ($("formMsg")) $("formMsg").hidden = true;
  }

  function downloadText(filename, text, mime) {
    try {
      var blob = new Blob([text], { type: mime || "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      setTimeout(function () {
        URL.revokeObjectURL(a.href);
      }, 1500);
    } catch (e) {}
  }

  function publish() {
    var msg = $("formMsg");
    var btn = $("btnPublish");
    try {
      if (!catalog) catalog = C.emptyCatalog();

      var category = $("fCategory").value;
      var brandName = ($("fBrand").value || "").trim();
      var modelName = ($("fModel").value || "").trim();
      var versionName = ($("fVersion").value || "").trim() || "Base";

      if (!brandName || !modelName) {
        if (msg) {
          msg.hidden = false;
          msg.textContent = "Completa marca y modelo.";
        }
        return;
      }

      var missingBefore = PHOTO_KEYS.filter(function (k) {
        return !pending[k];
      });
      if (missingBefore.length === 4) {
        if (msg) {
          msg.hidden = false;
          msg.textContent = "Sube las 4 fotos (principal, dashboard, conexiones, pin-out) antes de guardar.";
        }
        alert("Faltan las 4 fotos. Usa Galería, Cámara o elige 4 juntas.");
        return;
      }

      if (btn) {
        btn.disabled = true;
        btn.textContent = "Guardando…";
      }
      hideLinkSharePanel();

      var brandId = C.ensureBrand(catalog, category, brandName);
      var modelId = C.ensureModel(catalog, category, brandId, modelName);
      // Al editar, conservar el id de versión (si no, al renombrar se crea otra y “faltan fotos”)
      var versionId =
        editing && editing.versionId ? editing.versionId : C.slugify(versionName);
      var existing = C.getVersion(catalog, category, brandId, modelId, versionId);
      var prev = (existing && existing.photos) || {};

      resolvePhotosForSave(category, brandId, modelId, versionId, prev)
        .then(function (photos) {
          var missing = PHOTO_KEYS.filter(function (k) {
            return !photos[k] || isPlaceholderPhoto(photos[k]);
          });
          if (missing.length) {
            var labels = {
              main: "1 principal",
              dashboard: "2 dashboard",
              connection: "3 conexiones",
              ignition: "4 pin-out"
            };
            throw new Error(
              "Faltan fotos: " +
                missing
                  .map(function (k) {
                    return labels[k] || k;
                  })
                  .join(", ") +
                ". Sube las 4 y vuelve a Guardar."
            );
          }
          // Comprime cualquier dataURL que aún sea grande
          var compressJobs = PHOTO_KEYS.map(function (k) {
            var val = photos[k];
            if (val && String(val).indexOf("data:") === 0) {
              return C.compressDataUrl(val)
                .then(function (out) {
                  photos[k] = out;
                })
                .catch(function (err) {
                  throw new Error(
                    "Foto " +
                      k +
                      ": " +
                      ((err && err.message) || "no se pudo comprimir")
                  );
                });
            }
            return Promise.resolve();
          });

          return Promise.all(compressJobs).then(function () {
            return photos;
          });
        })
        .then(function (photos) {
          C.upsertVersion(catalog, category, brandId, modelId, {
            id: versionId,
            name: versionName,
            eeprom: ($("fEeprom").value || "").trim(),
            programmer: ($("fProgrammer").value || "").trim(),
            type: ($("fType").value || "").trim(),
            notes: ($("fNotes").value || "")
              .split("\n")
              .map(function (n) {
                return n.trim();
              })
              .filter(Boolean),
            photos: photos
          });

          return C.saveCatalog(catalog).then(function () {
            var helpUnit = C.buildHelpUnit(catalog, category, brandId, modelId, versionId);
            return C.saveHelpUnit(helpUnit).then(function () {
              return C.pingApi().then(function (apiUp) {
                return C.publishToServer(helpUnit)
                  .then(function (pub) {
                    return { pub: pub, apiUp: apiUp };
                  })
                  .catch(function (err) {
                    console.warn("publish API", err);
                    if (apiUp) {
                      throw new Error(
                        "El servidor rechazó la publicación: " +
                          ((err && err.message) || err) +
                          ". La ayuda NO quedó pública. Vuelve a Guardar."
                      );
                    }
                    return {
                      pub: { ok: false, offline: true, error: err && err.message },
                      apiUp: false
                    };
                  })
                  .then(function (pack) {
                    var pub = pack.pub || {};
                    if (pub && pub.ok && pub.photos) {
                      var ver = C.getVersion(catalog, category, brandId, modelId, versionId);
                      if (ver) ver.photos = pub.photos;
                      if (helpUnit && helpUnit.version) helpUnit.version.photos = pub.photos;
                      PHOTO_KEYS.forEach(function (k) {
                        if (pub.photos[k]) setPhoto(k, pub.photos[k]);
                      });
                      return C.saveCatalog(catalog)
                        .then(function () {
                          return C.saveHelpUnit(helpUnit);
                        })
                        .then(function () {
                          return { helpUnit: helpUnit, pub: pub };
                        });
                    }
                    return C.loadHelpUnit(category, brandId, modelId, versionId).then(function (verify) {
                      if (!verify || !verify.version) {
                        throw new Error("No se pudo confirmar el guardado. Intenta de nuevo.");
                      }
                      return { helpUnit: helpUnit, pub: pub || { ok: false } };
                    });
                  });
              });
            });
          });
        })
        .then(function (result) {
          var helpUnit = result.helpUnit;
          var pub = result.pub || {};
          var folder = folderPath(category, brandId, modelId);
          brandView = {
            cat: category,
            brandId: brandId,
            brandName: brandName.toUpperCase()
          };
          renderTree();
          syncFoldersFromCatalog();

          var href = helpHref(category, brandId, modelId, versionId);
          var abs = new URL(href, location.href).href;

          if (msg) {
            msg.hidden = false;
            msg.innerHTML =
              (pub.ok ? "✓ Guardado público · " : "⚠ Guardado solo en este teléfono · ") +
              "<strong>" +
              brandName.toUpperCase() +
              " " +
              modelName.toUpperCase() +
              "</strong> · carpeta <code>" +
              folder +
              "</code><br>" +
              (pub.ok
                ? "Link listo abajo: cópialo y envíaselo al cliente."
                : "El link NO funcionará en otro teléfono hasta que Guardar publique bien en el servidor.") +
              "<br><code style='word-break:break-all'>" +
              abs +
              "</code>";
          }

          // Siempre mostrar el panel del link (antes se redirigía y el link “desaparecía”)
          showLinkSharePanel(
            abs,
            pub.ok
              ? "✓ Guardado. Copia este link o ábrelo para ver la ayuda del cliente."
              : "Publicación incompleta. No envíes este link aún. Vuelve a Guardar con el servidor encendido."
          );
          copyTextNow(abs).then(function (ok) {
            if (ok) {
              showLinkSharePanel(abs, "✓ Guardado y link copiado. Pégalo en WhatsApp o ábrelo abajo.");
            }
          });

          if (!pub.ok) {
            alert(
              "Se guardó en este navegador, pero NO en el servidor público. Vuelve a Guardar con el link del servidor (no solo GitHub Pages)."
            );
          }
        })
        .catch(function (err) {
          console.error(err);
          var text = (err && err.message) || String(err);
          if (/quota|QuotaExceeded/i.test(text)) {
            text =
              "Espacio del navegador lleno. Recarga, vuelve a entrar y guarda de nuevo.";
            try {
              C.clearBloatedLocalStorage();
            } catch (e) {}
          }
          if (msg) {
            msg.hidden = false;
            msg.textContent = "Error al guardar: " + text;
          }
          try {
            alert(text);
          } catch (e) {}
        })
        .then(function () {
          if (btn) {
            btn.disabled = false;
            btn.textContent = "Guardar en catálogo";
            try {
              if (window.VCDMX && typeof window.VCDMX.applyLang === "function") {
                window.VCDMX.applyLang(window.VCDMX.getPreferredLang());
              }
            } catch (e) {}
          }
        });
    } catch (err) {
      console.error(err);
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Guardar en catálogo";
      }
      if (msg) {
        msg.hidden = false;
        msg.textContent = "Error al guardar: " + (err && err.message ? err.message : String(err));
      }
      alert("No se pudo guardar. Revisa marca, modelo y fotos, y vuelve a intentar.");
    }
  }

  function boot() {
    if (!$("loginForm") || !$("entryForm")) return;

    bindLinkSharePanel();

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
        var hub = document.getElementById("administrador");
        if (hub) hub.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });

    if ($("btnLogout")) {
      $("btnLogout").addEventListener("click", function () {
        C.endAdminSession();
        location.reload();
      });
    }

    if ($("btnExport")) {
      $("btnExport").addEventListener("click", function () {
        if (catalog) C.exportCatalog(catalog);
      });
    }

    if ($("btnClear")) $("btnClear").addEventListener("click", clearForm);
    if ($("btnNew")) {
      $("btnNew").addEventListener("click", function () {
        clearForm();
        $("formCard").scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }

    document.querySelectorAll(".inv-filter").forEach(function (btn) {
      btn.addEventListener("click", function () {
        listFilter = btn.getAttribute("data-filter") || "all";
        brandView = null;
        document.querySelectorAll(".inv-filter").forEach(function (b) {
          b.classList.toggle("is-active", b === btn);
        });
        renderTree();
      });
    });

    document.querySelectorAll(".photo-slot").forEach(function (slot) {
      slot.querySelectorAll(".btn-photo").forEach(function (btn) {
        btn.addEventListener("click", function () {
          markActiveSlot(slot.getAttribute("data-slot"));
        });
      });
    });

    bindPhotoInput("pMainGallery", "main", true);
    bindPhotoInput("pMainCamera", "main", true);
    bindPhotoInput("pDashGallery", "dashboard", true);
    bindPhotoInput("pDashCamera", "dashboard", true);
    bindPhotoInput("pConnGallery", "connection", true);
    bindPhotoInput("pConnCamera", "connection", true);
    bindPhotoInput("pIgnGallery", "ignition", true);
    bindPhotoInput("pIgnCamera", "ignition", true);

    if ($("pMulti")) {
      $("pMulti").addEventListener("change", function () {
        var input = this;
        applyFilesInOrder(this.files)
          .then(function () {
            markActiveSlot(0);
            if ($("btnPublish")) $("btnPublish").focus();
          })
          .catch(function (err) {
            alert((err && err.message) || "No se pudieron cargar las fotos. Usa JPG o PNG.");
          })
          .then(function () {
            input.value = "";
          });
      });
    }

    markActiveSlot(1);

    $("entryForm").addEventListener("submit", function (e) {
      e.preventDefault();
      publish();
    });

    if ($("passForm")) {
      $("passForm").addEventListener("submit", function (e) {
        e.preventDefault();
        C.setPassword($("newPass").value).then(function () {
          $("newPass").value = "";
          alert("Contraseña actualizada");
        });
      });
    }

    if (location.hash === "#administrador") {
      var hub = document.getElementById("administrador");
      if (hub) setTimeout(function () {
        hub.scrollIntoView({ behavior: "smooth" });
      }, 200);
    }
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
