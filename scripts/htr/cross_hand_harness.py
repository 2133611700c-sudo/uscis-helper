#!/usr/bin/env python3
"""Committed, reproducible cross-hand handwritten-OCR harness.

Reproduces the cross-hand result end-to-end: read the owner's two INDEPENDENT
handwritten hands at FROZEN field boxes through a chosen HTR model and score the
RAW output against owner ground truth.

  hand A — birth_cert_handwritten_01  (Russian cursive)
  hand B — military_id_p1_01          (Ukrainian cursive)

PII DISCIPLINE: this file (committed) holds only PII-safe config — fixture file
names, source SHA-256, canonical rotation, frozen pixel boxes, GT key names, and
the recorded EXPECTED verdicts. The real images + ground-truth VALUES + raw model
outputs live ONLY under gitignored qa-private/ and are read at runtime; the full
evidence (with raw text) is written to gitignored qa-private/htr-poc/.

CI-safe: if the model weights / fixtures / GT are absent (as in CI), the harness
prints SKIP and exits 0 — it never needs real PII or multi-GB weights to import.

Run (locally, with qa-private present + raxtemur in the HF cache):
  python scripts/htr/cross_hand_harness.py
  HTR_MODEL=cyrillic-trocr/trocr-ukrainian-handwritten python scripts/htr/cross_hand_harness.py
"""
from __future__ import annotations
import os, re, json, hashlib
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
REAL = ROOT / "test-fixtures" / "real-docs"
GTD = ROOT / "qa-private" / "ground-truth"
EVID = ROOT / "qa-private" / "htr-poc" / "cross_hand_evidence.json"
HTR_MODEL = os.environ.get("HTR_MODEL", "raxtemur/trocr-base-ru")

# ── FROZEN config (PII-safe; never select boxes after seeing the output) ──────
FIXTURES = {
    "hand_A_birth_ru": {
        "file": "birth_cert_handwritten_01.jpg",
        "sha256": "3188741189ef589cc32a56c7ba11df709b46643b10120a28fa0014ff058aa2f7",
        "rotate_cw": 0,
        "gt": "birth_cert_handwritten_01.json",
        "boxes": {  # native-pixel [left, top, right, bottom] on the (rotated) image
            "family_name_cyrillic": [960, 705, 2250, 905],
            "given_name_cyrillic": [540, 905, 1010, 1120],
            "patronymic_cyrillic": [1090, 905, 1850, 1120],
        },
    },
    "hand_B_military_ua": {
        "file": "military_id_p1_01.jpg",
        "sha256": "f5dbc268836bbbf41d941a7816d1ce70bc4005485db23a79e46458b0be938556",
        "rotate_cw": 90,  # booklet photographed sideways; grid-verified upright at 90° CW
        "gt": "military_id_p1_01.json",
        "boxes": {
            "family_name_cyrillic": [355, 1810, 1085, 1898],
            "given_name_cyrillic": [345, 1933, 655, 1994],
            "patronymic_cyrillic": [400, 2003, 915, 2074],
        },
    },
}

# Recorded result with raxtemur (regression anchor; update only with evidence).
EXPECTED = {
    "raxtemur/trocr-base-ru": {
        "hand_A_birth_ru": {"strict_exact": 3},   # of 3
        "hand_B_military_ua": {"strict_exact": 0},  # of 3 — does NOT generalize to UA hand
    }
}

_CYR = re.compile(r"[^а-яёіїєґ']")
def fold(s: str | None) -> str:
    return _CYR.sub("", (s or "").lower())

def cer(a: str, b: str) -> float:
    a, b = fold(a), fold(b)
    if not b:
        return 1.0 if a else 0.0
    dp = list(range(len(b) + 1))
    for i in range(1, len(a) + 1):
        p = dp[0]; dp[0] = i
        for j in range(1, len(b) + 1):
            c = dp[j]; dp[j] = min(dp[j] + 1, dp[j - 1] + 1, p + (a[i - 1] != b[j - 1])); p = c
    return round(dp[-1] / len(b), 3)

def verdict(raw: str, gt: str) -> str:
    if not fold(raw):
        return "EMPTY"
    if fold(raw) == fold(gt):
        return "STRICT_EXACT"
    g = fold(gt)
    if g and (g in fold(raw) or cer(raw, gt) < 0.4):
        return "FOLDED_SOFT"
    return "WRONG"

def sha256_file(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()

def main() -> int:
    try:
        import numpy as np
        from PIL import Image
        import torch
        from transformers import TrOCRProcessor, VisionEncoderDecoderModel
    except Exception as e:  # CI / no ML deps
        print(f"SKIP cross_hand_harness: ML deps unavailable ({type(e).__name__})")
        return 0

    def contrast(im):
        a = np.asarray(im.convert("L")).astype(np.float32)
        lo, hi = np.percentile(a, 2), np.percentile(a, 98)
        return Image.fromarray(np.clip((a - lo) * 255 / (hi - lo), 0, 255).astype(np.uint8)) if hi > lo else im.convert("L")

    try:
        proc = TrOCRProcessor.from_pretrained(HTR_MODEL, local_files_only=True)
        model = VisionEncoderDecoderModel.from_pretrained(HTR_MODEL, local_files_only=True).eval()
    except Exception as e:
        print(f"SKIP cross_hand_harness: model '{HTR_MODEL}' not in local cache ({type(e).__name__})")
        return 0

    def read(im) -> str:
        with torch.no_grad():
            ids = model.generate(proc(im.convert("RGB"), return_tensors="pt").pixel_values, max_new_tokens=40)
        return proc.batch_decode(ids, skip_special_tokens=True)[0].strip()

    record = {"model": HTR_MODEL, "timestamp_utc": datetime.now(timezone.utc).isoformat(), "hands": {}}
    summary = {}
    for hand, cfg in FIXTURES.items():
        img_p, gt_p = REAL / cfg["file"], GTD / cfg["gt"]
        if not img_p.exists() or not gt_p.exists():
            print(f"SKIP {hand}: fixture or GT missing (real PII stays gitignored)")
            continue
        actual_sha = sha256_file(img_p)
        sha_ok = actual_sha == cfg["sha256"]
        gt = json.loads(gt_p.read_text())
        img = Image.open(img_p)
        if cfg["rotate_cw"]:
            img = img.rotate(-cfg["rotate_cw"], expand=True)  # PIL CCW positive → -cw = clockwise
        fields = {}
        n_exact = 0
        for key, box in cfg["boxes"].items():
            try:
                raw = read(contrast(img.crop(tuple(box))))
                v = verdict(raw, gt.get(key, ""))
                err = None
            except Exception as e:
                raw, v, err = "", "MODEL_ERROR", str(e)[:120]
            if v == "STRICT_EXACT":
                n_exact += 1
            fields[key] = {"raw": raw, "verdict": v, "cer": cer(raw, gt.get(key, "")), "error": err}  # raw → gitignored only
        record["hands"][hand] = {"sha256_match": sha_ok, "fields": fields}
        summary[hand] = {"strict_exact": n_exact, "of": len(cfg["boxes"]), "sha_ok": sha_ok}

    EVID.parent.mkdir(parents=True, exist_ok=True)
    EVID.write_text(json.dumps(record, ensure_ascii=False, indent=1))

    # PII-free console summary + EXPECTED regression check
    print(f"=== cross-hand HTR — model={HTR_MODEL} (PII-free; raw → {EVID.relative_to(ROOT)}) ===")
    exp = EXPECTED.get(HTR_MODEL, {})
    for hand, s in summary.items():
        e = exp.get(hand, {}).get("strict_exact")
        flag = "" if e is None else (" OK" if e == s["strict_exact"] else f" !! expected {e}")
        print(f"  {hand:20s} strict_exact={s['strict_exact']}/{s['of']} sha_ok={s['sha_ok']}{flag}")
    print("conclusion: cross-hand generalization holds only if BOTH hands strict_exact>0.")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
