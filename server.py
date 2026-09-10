#!/usr/bin/env python3
"""Static site + publish API so client help links work for anyone."""
from __future__ import annotations

import json
import os
import re
import tempfile
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent
os.chdir(ROOT)

SAFE = re.compile(r"^[a-z0-9][a-z0-9_-]{0,63}$")


def slug_ok(value: str) -> bool:
    return bool(value and SAFE.match(value))


def atomic_write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=str(path.parent), prefix=".tmp-", suffix=".json")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(text)
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp):
            try:
                os.remove(tmp)
            except OSError:
                pass


def load_catalog() -> dict:
    path = ROOT / "data" / "catalog.json"
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return {
        "updatedAt": "",
        "categories": {
            "autos": {"label": "AUTOS", "brands": {}},
            "motos": {"label": "MOTOS", "brands": {}},
        },
    }


def save_catalog(catalog: dict) -> None:
    from datetime import datetime, timezone

    catalog["updatedAt"] = datetime.now(timezone.utc).isoformat()
    atomic_write(ROOT / "data" / "catalog.json", json.dumps(catalog, ensure_ascii=False, indent=2))


def lite_photos(photos: dict | None) -> dict:
    out = {}
    for key, val in (photos or {}).items():
        if isinstance(val, str) and val.startswith("data:"):
            out[key] = "[published]"
        elif val:
            out[key] = val
    return out


def upsert_unit(catalog: dict, unit: dict) -> None:
    c = unit["c"]
    b = unit["b"]
    m = unit["m"]
    version = dict(unit.get("version") or {})
    vid = version.get("id") or unit.get("v") or "base"
    version["id"] = vid
    version["photos"] = lite_photos(version.get("photos"))
    cats = catalog.setdefault("categories", {})
    cat = cats.setdefault(c, {"label": c.upper(), "brands": {}})
    brands = cat.setdefault("brands", {})
    brand = brands.setdefault(b, {"name": unit.get("brandName") or b.upper(), "models": {}})
    if unit.get("brandName"):
        brand["name"] = unit["brandName"]
    models = brand.setdefault("models", {})
    model = models.setdefault(m, {"name": unit.get("modelName") or m.upper(), "versions": []})
    if unit.get("modelName"):
        model["name"] = unit["modelName"]
    versions = model.setdefault("versions", [])
    for i, existing in enumerate(versions):
        if existing.get("id") == vid:
            versions[i] = version
            break
    else:
        versions.append(version)


def delete_unit(catalog: dict, c: str, b: str, m: str, v: str) -> None:
    try:
        brand = catalog["categories"][c]["brands"][b]
        model = brand["models"][m]
        model["versions"] = [x for x in model.get("versions", []) if x.get("id") != v]
        if not model["versions"]:
            del brand["models"][m]
        if not brand["models"]:
            del catalog["categories"][c]["brands"][b]
    except KeyError:
        pass


class Handler(SimpleHTTPRequestHandler):
    extensions_map = {
        **getattr(SimpleHTTPRequestHandler, "extensions_map", {}),
        ".json": "application/json",
        ".js": "application/javascript",
        ".css": "text/css",
        ".webp": "image/webp",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".svg": "image/svg+xml",
    }

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/api/health":
            return self._json(200, {"ok": True, "service": "help-online"})
        return super().do_GET()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def _json(self, code: int, payload: dict):
        raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def _read_json(self):
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0 or length > 25_000_000:
            raise ValueError("payload inválido")
        return json.loads(self.rfile.read(length).decode("utf-8"))

    def do_POST(self):
        path = urlparse(self.path).path
        try:
            if path == "/api/health":
                return self._json(200, {"ok": True})

            if path == "/api/publish":
                unit = self._read_json()
                c, b, m = unit.get("c"), unit.get("b"), unit.get("m")
                v = (unit.get("version") or {}).get("id") or unit.get("v") or "base"
                if not all(slug_ok(x) for x in (c, b, m, v)):
                    return self._json(400, {"ok": False, "error": "ids inválidos"})
                if c not in ("autos", "motos"):
                    return self._json(400, {"ok": False, "error": "categoría inválida"})

                help_path = ROOT / "data" / "help" / c / b / m / f"{v}.json"
                atomic_write(help_path, json.dumps(unit, ensure_ascii=False, indent=2))

                catalog = load_catalog()
                upsert_unit(catalog, unit)
                save_catalog(catalog)

                rel = f"data/help/{c}/{b}/{m}/{v}.json"
                return self._json(
                    200,
                    {
                        "ok": True,
                        "path": rel,
                        "helpUrl": f"ayuda/?c={c}&b={b}&m={m}&v={v}",
                    },
                )

            if path == "/api/delete":
                body = self._read_json()
                c, b, m, v = body.get("c"), body.get("b"), body.get("m"), body.get("v") or "base"
                if not all(slug_ok(x) for x in (c, b, m, v)):
                    return self._json(400, {"ok": False, "error": "ids inválidos"})
                help_path = ROOT / "data" / "help" / c / b / m / f"{v}.json"
                if help_path.exists():
                    help_path.unlink()
                catalog = load_catalog()
                delete_unit(catalog, c, b, m, v)
                save_catalog(catalog)
                return self._json(200, {"ok": True})

            return self._json(404, {"ok": False, "error": "not found"})
        except Exception as exc:  # noqa: BLE001
            return self._json(500, {"ok": False, "error": str(exc)})

    def log_message(self, fmt, *args):
        # quieter logs
        if args and str(args[0]).startswith("GET /api/"):
            return
        super().log_message(fmt, *args)


def main():
    port = int(os.environ.get("PORT", "8765"))
    server = ThreadingHTTPServer(("0.0.0.0", port), Handler)
    print(f"HELP ONLINE server on http://0.0.0.0:{port}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
