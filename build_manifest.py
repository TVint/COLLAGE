#!/usr/bin/env python3
"""
CODEX HERMETICUS — Complete Web Media Optimizer & Manifest Builder
Reads raw masters from 2025/ and 2026/<Title>/ without modifying them.
Generates web-optimized assets in MEDIA/:
  - MEDIA/thumbs/ (900px square thumbnails for instant Star Map & Grimoire)
  - MEDIA/zoom/   (1800px Macrocosmos / Mesocosmos / Microcosmos zoom plates)
  - MEDIA/video/  (H.264 720p fast-start MP4 animations via macOS avconvert)
Preserves existing curatorial edits and gate config from artworks-db.json.
"""
import os
import re
import json
import time
import subprocess
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DIR_2025 = os.path.join(BASE_DIR, "2025")
DIR_2026 = os.path.join(BASE_DIR, "2026")
MEDIA_DIR = os.path.join(BASE_DIR, "MEDIA")
THUMBS_DIR = os.path.join(MEDIA_DIR, "thumbs")
ZOOM_DIR = os.path.join(MEDIA_DIR, "zoom")
VIDEO_DIR = os.path.join(MEDIA_DIR, "video")
AUDIO_DIR = os.path.join(MEDIA_DIR, "audio")
DB_JSON_PATH = os.path.join(BASE_DIR, "artworks-db.json")
DATA_JS_PATH = os.path.join(BASE_DIR, "artworks-data.js")

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp"}
VIDEO_EXTS = {".mp4", ".webm", ".mov"}
AUDIO_EXTS = {".mp3", ".m4a", ".wav", ".ogg"}
ALCHEMICAL_STAGES = ["NIGREDO", "ALBEDO", "CITRINITAS", "RUBEDO"]

ZOOM_META = [
    ("I · MACROCOSMOS", "Visione Integrale"),
    ("II · MESOCOSMOS", "Soglia Intermedia"),
    ("III · MICROCOSMOS", "Cuore Materico"),
]

DEFAULT_CONFIG = {
    "activeGate": "sound",
    "soundSequence": [0, 2, 1, 3],
    "showCuratorBypass": True,
}

HERMETIC_FRAGMENTS = [
    "Ciò che è in basso è come ciò che è in alto, per compiere i miracoli della Cosa Una.",
    "Nella materia oscura dorme la scintilla d'oro; l'occhio che osserva separa il sottile dallo spesso.",
    "Ogni frammento strappato al tempo ricompone una mappa invisibile dello spirito.",
    "Il silenzio è la chiave della prima porta; la geometria è il linguaggio della seconda.",
    "Dissolvi la forma conosciuta e coagula il simbolo: così nasce la nuova lamina.",
    "Tra l'ombra della laguna e il firmamento, il collage è un ponte tra due mondi.",
    "L'arco teso nel cosmo non cerca un bersaglio, ma un centro immobile.",
    "Sotto la carta antica scorre un circuito di luce: ogni taglio è un'incisione rituale.",
    "Osserva il dettaglio finché non diventa universo: il microcosmo contiene l'intera sfera.",
    "Quando la carta respira, l'immagine spezza il margine e cammina nello spazio.",
]


def to_roman(num: int) -> str:
    val = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1]
    syb = ["M", "CM", "D", "CD", "C", "XC", "L", "XL", "X", "IX", "V", "IV", "I"]
    roman = ""
    i = 0
    while num > 0:
        for _ in range(num // val[i]):
            roman += syb[i]
            num -= val[i]
        i += 1
    return roman


def natural_key(s: str):
    return [int(t) if t.isdigit() else t.lower() for t in re.split(r"(\d+)", s)]


def slugify(text: str) -> str:
    return re.sub(r"[^a-zA-Z0-9]+", "_", text).strip("_")


def optimize_image(job):
    src_abs, dst_rel, max_dim, quality = job
    dst_abs = os.path.join(BASE_DIR, dst_rel)
    os.makedirs(os.path.dirname(dst_abs), exist_ok=True)
    if not os.path.exists(dst_abs) or os.path.getmtime(src_abs) > os.path.getmtime(dst_abs):
        subprocess.run(
            [
                "sips",
                "-s", "format", "jpeg",
                "-s", "formatOptions", str(quality),
                "-Z", str(max_dim),
                src_abs,
                "--out", dst_abs,
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=False,
        )
    return dst_rel


def optimize_video(job):
    src_abs, dst_rel = job
    dst_abs = os.path.join(BASE_DIR, dst_rel)
    os.makedirs(os.path.dirname(dst_abs), exist_ok=True)
    if not os.path.exists(dst_abs) or os.path.getmtime(src_abs) > os.path.getmtime(dst_abs):
        print(f"  Transcoding video -> {dst_rel} ...")
        res = subprocess.run(
            [
                "/usr/bin/avconvert",
                "--preset", "Preset1280x720",
                "--source", src_abs,
                "--output", dst_abs,
                "--replace",
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=False,
        )
        if res.returncode != 0 or not os.path.exists(dst_abs):
            # Fallback direct copy if avconvert fails
            import shutil
            shutil.copy2(src_abs, dst_abs)
    return dst_rel


def load_existing_db():
    if os.path.exists(DB_JSON_PATH):
        try:
            with open(DB_JSON_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {}


def build_manifest():
    os.makedirs(THUMBS_DIR, exist_ok=True)
    os.makedirs(ZOOM_DIR, exist_ok=True)
    os.makedirs(VIDEO_DIR, exist_ok=True)
    os.makedirs(AUDIO_DIR, exist_ok=True)

    # Discover all available audio tracks in MEDIA/audio/
    audio_library = sorted(
        f"MEDIA/audio/{f}"
        for f in os.listdir(AUDIO_DIR)
        if os.path.splitext(f)[1].lower() in AUDIO_EXTS and not f.startswith(".")
    )
    video_audio_idx = 0

    existing = load_existing_db()
    existing_by_id = {a["id"]: a for a in existing.get("artworks", []) if "id" in a}
    config = {**DEFAULT_CONFIG, **existing.get("config", {})}

    artworks = []
    image_jobs = []
    video_jobs = []
    idx = 0

    # ------------------------------------------------------------------
    # 1. 2026 -> MAPPA CELESTIALE (3 zoom layers + living .mp4 videos)
    # ------------------------------------------------------------------
    celestiale_count = 0
    if os.path.isdir(DIR_2026):
        folders = sorted(
            d for d in os.listdir(DIR_2026)
            if os.path.isdir(os.path.join(DIR_2026, d)) and not d.startswith(".")
        )
        for folder in folders:
            fpath = os.path.join(DIR_2026, folder)
            entries = sorted(os.listdir(fpath), key=natural_key)
            images = [f for f in entries if os.path.splitext(f)[1].lower() in IMAGE_EXTS and not f.startswith(".")]
            videos = [f for f in entries if os.path.splitext(f)[1].lower() in VIDEO_EXTS and not f.startswith(".")]
            if not images:
                continue

            # Identify zoom sequence: prefer *_1, *_2, *_3 ordered by zoom depth
            z1 = next((im for im in images if re.search(r"_1\.[^.]+$", im)), None)
            z2 = next((im for im in images if re.search(r"_2\.[^.]+$", im)), None)
            z3 = next((im for im in images if re.search(r"_3\.[^.]+$", im)), None)

            ordered_zoom_files = [f for f in [z1, z2, z3] if f]
            if not ordered_zoom_files:
                ordered_zoom_files = images[:3]

            cover = ordered_zoom_files[0]
            idx += 1
            celestiale_count += 1
            art_id = f"cel-{celestiale_count:03d}"
            roman = to_roman(celestiale_count)
            slug = slugify(folder)

            thumb_rel = f"MEDIA/thumbs/2026_{slug}.jpg"
            image_jobs.append((os.path.join(fpath, cover), thumb_rel, 900, 82))

            zoom_layers = []
            for z_idx, zf in enumerate(ordered_zoom_files[:3]):
                z_rel = f"MEDIA/zoom/2026_{slug}_z{z_idx + 1}.jpg"
                image_jobs.append((os.path.join(fpath, zf), z_rel, 1800, 84))
                label, sub = ZOOM_META[z_idx]
                zoom_layers.append({
                    "level": z_idx + 1,
                    "label": label,
                    "subtitle": sub,
                    "src": z_rel,
                })

            video_rel = None
            default_audio = None
            if videos:
                video_rel = f"MEDIA/video/2026_{slug}.mp4"
                video_jobs.append((os.path.join(fpath, videos[0]), video_rel))
                if audio_library:
                    default_audio = audio_library[video_audio_idx % len(audio_library)]
                    video_audio_idx += 1

            prev = existing_by_id.get(art_id, {})
            default_formula = (
                "COLLAGE ESOTERICO · III STRATI OTTICI & ANIMAZIONE"
                if (video_rel and len(zoom_layers) >= 3)
                else ("COLLAGE ESOTERICO & ANIMAZIONE · 1:1" if video_rel else "COLLAGE ESOTERICO · III STRATI OTTICI · 1:1")
            )

            artworks.append({
                "id": art_id,
                "index": idx,
                "roman": prev.get("roman", roman),
                "filename": cover,
                "folder": folder,
                "title": prev.get("title", folder.upper()),
                "era": prev.get("era", "celestiale"),
                "year": prev.get("year", 2026),
                "stage": prev.get("stage", ALCHEMICAL_STAGES[(celestiale_count - 1) % len(ALCHEMICAL_STAGES)]),
                "thumb": thumb_rel,
                "src": zoom_layers[0]["src"],
                "zoomLayers": zoom_layers,
                "video": video_rel,
                "audio": prev.get("audio") or default_audio,
                "formula": prev.get("formula", default_formula),
                "oracle": prev.get("oracle", HERMETIC_FRAGMENTS[(celestiale_count - 1) % len(HERMETIC_FRAGMENTS)]),
                "notes": prev.get("notes", f"Lamina {roman} — Serie Celestiale 2026 di Nicola Vianello."),
            })

    # ------------------------------------------------------------------
    # 2. 2025 -> GRIMORIO VENEZIANO (50 square plates)
    # ------------------------------------------------------------------
    grimorio_count = 0
    if os.path.isdir(DIR_2025):
        files_2025 = sorted(
            (f for f in os.listdir(DIR_2025) if os.path.splitext(f)[1].lower() in IMAGE_EXTS and not f.startswith(".")),
            key=natural_key,
        )
        for fn in files_2025:
            idx += 1
            grimorio_count += 1
            art_id = f"gri-{grimorio_count:03d}"
            roman = to_roman(grimorio_count)
            stem = slugify(os.path.splitext(fn)[0])

            thumb_rel = f"MEDIA/thumbs/2025_{stem}.jpg"
            high_rel = f"MEDIA/zoom/2025_{stem}.jpg"
            image_jobs.append((os.path.join(DIR_2025, fn), thumb_rel, 900, 82))
            image_jobs.append((os.path.join(DIR_2025, fn), high_rel, 1600, 84))

            prev = existing_by_id.get(art_id, {})
            artworks.append({
                "id": art_id,
                "index": idx,
                "roman": prev.get("roman", roman),
                "filename": fn,
                "folder": "2025",
                "title": prev.get("title", f"LAMINA {roman}"),
                "era": prev.get("era", "grimorio"),
                "year": prev.get("year", 2025),
                "stage": prev.get("stage", ALCHEMICAL_STAGES[(grimorio_count - 1) % len(ALCHEMICAL_STAGES)]),
                "thumb": thumb_rel,
                "src": high_rel,
                "zoomLayers": [{"level": 1, "label": "I · MACROCOSMOS", "subtitle": "Tavola Integrale", "src": high_rel}],
                "video": None,
                "formula": prev.get("formula", "GRIMORIO VENEZIANO · COLLAGE QUADRATO 1:1"),
                "oracle": prev.get("oracle", HERMETIC_FRAGMENTS[(grimorio_count - 1) % len(HERMETIC_FRAGMENTS)]),
                "notes": prev.get("notes", f"Lamina {roman} — Archivio 2025 di Nicola Vianello."),
            })

    t0 = time.time()
    print(f"Optimizing {len(image_jobs)} images into MEDIA/...")
    with ThreadPoolExecutor(max_workers=8) as ex:
        list(ex.map(optimize_image, image_jobs))
    print(f"Images ready in {time.time() - t0:.1f}s.")

    if video_jobs:
        tv = time.time()
        print(f"Optimizing {len(video_jobs)} MP4 animations into MEDIA/video/...")
        with ThreadPoolExecutor(max_workers=4) as ex:
            list(ex.map(optimize_video, video_jobs))
        print(f"Videos ready in {time.time() - tv:.1f}s.")

    payload = {
        "generatedAt": datetime.now().isoformat(),
        "config": config,
        "audioLibrary": audio_library,
        "total": len(artworks),
        "counts": {
            "celestiale": sum(1 for a in artworks if a["era"] == "celestiale"),
            "grimorio": sum(1 for a in artworks if a["era"] == "grimorio"),
            "videos": sum(1 for a in artworks if a.get("video")),
        },
        "artworks": artworks,
    }

    with open(DB_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    with open(DATA_JS_PATH, "w", encoding="utf-8") as f:
        f.write("window.ARTWORKS_MANIFEST = ")
        json.dump(payload, f, ensure_ascii=False, indent=2)
        f.write(";\n")

    print(
        f"Manifest saved: {len(artworks)} artworks "
        f"({payload['counts']['celestiale']} Celestiale 2026, "
        f"{payload['counts']['grimorio']} Grimorio 2025, "
        f"{payload['counts']['videos']} Living Videos)."
    )
    return payload


if __name__ == "__main__":
    build_manifest()
