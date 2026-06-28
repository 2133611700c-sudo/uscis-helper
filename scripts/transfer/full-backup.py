#!/usr/bin/env python3
"""
full-backup.py — Read-only full snapshot of a Supabase project via REST + Storage API.

Why not pg_dump: requires Postgres password which is not stored locally.
This script uses the service_role JWT key (already in .env.local) to read every
table via PostgREST and every Storage object via the Storage API. Output is a
restorable snapshot directory with SHA-256 manifest. No writes.

Usage:
  python3 scripts/transfer/full-backup.py
  python3 scripts/transfer/full-backup.py --out ~/Backups/uscis-helper-prod-2026-06-28
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ENV_FILE = Path(__file__).resolve().parents[2] / ".env.local"
DEFAULT_OUT = Path.home() / "Backups" / f"uscis-helper-prod-{datetime.now(timezone.utc).strftime('%Y-%m-%dT%H%M%SZ')}"

# Tables to dump — full list from baseline. 47 public tables.
TABLES = [
    "assistant_threads","audit_log","audit_logs","canonical_answers","canonical_documents",
    "canonical_overrides","certification_records","certifier_override_audit","dead_links_log",
    "delivery_outbox","document_artifacts","email_events","extracted_fields","extraction_runs",
    "final_renders","form_answers","form_editions","form_sessions","generated_packets",
    "guard_block_events","manual_answers","manual_review_events","manual_review_queue",
    "monitoring_alerts","monitoring_sources","numeric_evidence","ocr_cache","ocr_request_leases",
    "official_sources","profiles","session_documents","session_members","stripe_processed_events",
    "tps_ocr_audit","translation_certification_audit","translation_documents","translation_events",
    "translation_order_events","translation_orders","translation_orders_v2","translation_payments",
    "translation_quality_log","translation_sessions","translations_orders","user_corrections",
    "wizard_drafts","wizard_sessions",
]


def parse_env(path: Path) -> dict:
    env = {}
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def http_get(url: str, headers: dict, timeout: int = 60) -> tuple[int, bytes, dict]:
    req = urllib.request.Request(url, headers=headers, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read(), dict(r.headers)
    except urllib.error.HTTPError as e:
        return e.code, e.read(), dict(e.headers or {})


def sha256_bytes(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def sha256_file(p: Path) -> str:
    h = hashlib.sha256()
    with p.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def dump_table(base: str, headers: dict, name: str, out_dir: Path) -> dict:
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / f"{name}.json"
    rows, page, page_size = [], 0, 1000
    while True:
        url = f"{base}/rest/v1/{name}?select=*&limit={page_size}&offset={page*page_size}"
        h = dict(headers); h["Accept"] = "application/json"
        code, body, _ = http_get(url, h)
        if code != 200:
            return {"table": name, "ok": False, "http": code, "error": body[:200].decode("utf-8","replace")}
        chunk = json.loads(body)
        rows.extend(chunk)
        if len(chunk) < page_size:
            break
        page += 1
    out_file.write_text(json.dumps(rows, ensure_ascii=False, indent=2))
    return {"table": name, "ok": True, "rows": len(rows), "sha256": sha256_file(out_file), "bytes": out_file.stat().st_size}


def dump_storage(base: str, headers: dict, out_root: Path) -> dict:
    code, body, _ = http_get(f"{base}/storage/v1/bucket", headers)
    if code != 200:
        return {"ok": False, "http": code, "error": body[:200].decode("utf-8","replace")}
    buckets = json.loads(body)
    bucket_summary, total_files, total_bytes = [], 0, 0
    for b in buckets:
        bname = b["name"]
        bdir = out_root / bname
        bdir.mkdir(parents=True, exist_ok=True)
        objs = []
        prefix_stack = [""]
        while prefix_stack:
            prefix = prefix_stack.pop()
            offset = 0
            while True:
                payload = json.dumps({"prefix": prefix, "limit": 1000, "offset": offset}).encode()
                req = urllib.request.Request(
                    f"{base}/storage/v1/object/list/{bname}",
                    data=payload,
                    headers={**headers, "Content-Type": "application/json"},
                    method="POST",
                )
                try:
                    with urllib.request.urlopen(req, timeout=60) as r:
                        page = json.loads(r.read())
                except urllib.error.HTTPError as e:
                    return {"ok": False, "bucket": bname, "http": e.code, "error": e.read()[:200].decode("utf-8","replace")}
                if not page:
                    break
                for item in page:
                    name = item.get("name","")
                    if item.get("id") is None:
                        prefix_stack.append((prefix + name + "/").lstrip("/"))
                    else:
                        full_key = (prefix + name).lstrip("/")
                        dl_url = f"{base}/storage/v1/object/{bname}/{urllib.parse.quote(full_key)}"
                        code2, body2, _ = http_get(dl_url, headers)
                        if code2 != 200:
                            objs.append({"key": full_key, "ok": False, "http": code2})
                            continue
                        dest = bdir / full_key
                        dest.parent.mkdir(parents=True, exist_ok=True)
                        dest.write_bytes(body2)
                        sha = sha256_bytes(body2)
                        objs.append({"key": full_key, "ok": True, "size": len(body2), "sha256": sha})
                        total_files += 1; total_bytes += len(body2)
                if len(page) < 1000:
                    break
                offset += 1000
        bucket_summary.append({"name": bname, "public": b.get("public", False), "objects": objs})
    return {"ok": True, "buckets": bucket_summary, "total_files": total_files, "total_bytes": total_bytes}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(DEFAULT_OUT))
    args = ap.parse_args()

    env = parse_env(ENV_FILE)
    url = env.get("SUPABASE_URL") or env.get("NEXT_PUBLIC_SUPABASE_URL")
    key = env.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("FATAL: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing from .env.local", file=sys.stderr)
        return 2

    out = Path(args.out).expanduser()
    out.mkdir(parents=True, exist_ok=True)
    started = datetime.now(timezone.utc)
    print(f"[{started.isoformat()}] Output: {out}")
    print(f"  Source: {url}")

    headers = {"apikey": key, "Authorization": f"Bearer {key}"}

    print("[1/2] Dumping tables via PostgREST...")
    table_results = []
    t0 = time.time()
    for t in TABLES:
        r = dump_table(url, headers, t, out / "tables")
        marker = "ok" if r.get("ok") else "FAIL"
        rows = r.get("rows", "?")
        print(f"  [{marker}] {t}: rows={rows}")
        table_results.append(r)
    t_tables = time.time() - t0

    print("[2/2] Dumping Storage objects...")
    t0 = time.time()
    storage = dump_storage(url, headers, out / "storage")
    t_storage = time.time() - t0

    manifest = {
        "started_utc": started.isoformat(),
        "finished_utc": datetime.now(timezone.utc).isoformat(),
        "source_url": url,
        "tables": table_results,
        "storage": storage,
        "duration_seconds": {"tables": round(t_tables,1), "storage": round(t_storage,1)},
        "tables_total_rows": sum(r.get("rows",0) for r in table_results if r.get("ok")),
        "tables_failed": [r["table"] for r in table_results if not r.get("ok")],
    }
    (out / "manifest.json").write_text(json.dumps(manifest, indent=2))

    print()
    print(f"  rows total          : {manifest['tables_total_rows']}")
    print(f"  storage files       : {storage.get('total_files', 'n/a')}")
    print(f"  storage bytes       : {storage.get('total_bytes', 'n/a')}")
    print(f"  failures (tables)   : {len(manifest['tables_failed'])}")
    print(f"  output              : {out}")
    if manifest['tables_failed'] or not storage.get("ok"):
        print("  ⚠ INCOMPLETE — see manifest.json")
        return 1
    print("  ✅ FULL BACKUP COMPLETE")
    return 0


if __name__ == "__main__":
    sys.exit(main())
