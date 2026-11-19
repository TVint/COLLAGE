#!/usr/bin/env python3
"""
CODEX HERMETICUS — Local Scriptorium CMS Server
Serves the Collage Esoterici portal + Admin CMS on port 8082.
Provides:
  GET  /api/manifest  -> Returns artworks-db.json
  POST /api/save      -> Persists config + artworks to artworks-db.json & artworks-data.js (with backup)
  POST /api/rescan    -> Re-runs build_manifest.py to detect new 2025/2026 collages & videos
"""
import os
import sys
import json
import shutil
from datetime import datetime
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

import build_manifest

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_JSON_PATH = os.path.join(BASE_DIR, "artworks-db.json")
DATA_JS_PATH = os.path.join(BASE_DIR, "artworks-data.js")
BACKUP_DIR = os.path.join(BASE_DIR, "backups")


def save_db(payload: dict):
    os.makedirs(BACKUP_DIR, exist_ok=True)
    if os.path.exists(DB_JSON_PATH):
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        shutil.copy2(DB_JSON_PATH, os.path.join(BACKUP_DIR, f"artworks-db_{ts}.json"))

    artworks = payload.get("artworks", [])
    payload["updatedAt"] = datetime.now().isoformat()
    payload["total"] = len(artworks)
    payload["counts"] = {
        "celestiale": sum(1 for a in artworks if a.get("era") == "celestiale"),
        "grimorio": sum(1 for a in artworks if a.get("era") == "grimorio"),
        "videos": sum(1 for a in artworks if a.get("video")),
    }

    with open(DB_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    with open(DATA_JS_PATH, "w", encoding="utf-8") as f:
        f.write("window.ARTWORKS_MANIFEST = ")
        json.dump(payload, f, ensure_ascii=False, indent=2)
        f.write(";\n")

    return payload


class ScriptoriumHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def send_json(self, obj, status=200):
        raw = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self):
        if self.path.split("?")[0] == "/api/manifest":
            if not os.path.exists(DB_JSON_PATH):
                data = build_manifest.build_manifest()
            else:
                with open(DB_JSON_PATH, "r", encoding="utf-8") as f:
                    data = json.load(f)
            return self.send_json(data)
        return super().do_GET()

    def do_POST(self):
        path = self.path.split("?")[0]
        if path == "/api/save":
            length = int(self.headers.get("Content-Length", "0"))
            body = self.rfile.read(length)
            try:
                payload = json.loads(body.decode("utf-8"))
                saved = save_db(payload)
                return self.send_json({"ok": True, "message": "Codice Ermetico salvato con successo.", "data": saved})
            except Exception as exc:
                return self.send_json({"ok": False, "error": str(exc)}, status=400)

        if path == "/api/rescan":
            try:
                data = build_manifest.build_manifest()
                return self.send_json({
                    "ok": True,
                    "message": f"Sincronizzazione completata: {data['total']} lamine ({data['counts']['videos']} video).",
                    "data": data,
                })
            except Exception as exc:
                return self.send_json({"ok": False, "error": str(exc)}, status=500)

        return self.send_json({"ok": False, "error": "Not found"}, status=404)


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8082
    server = ThreadingHTTPServer(("0.0.0.0", port), ScriptoriumHandler)
    print(f"Codex Hermeticus Scriptorium CMS running at http://localhost:{port}/")
    print(f"Admin Panel: http://localhost:{port}/admin.html")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
