#!/usr/bin/env python3
"""Classify the production OCR availability probe response.

Exit 0 means the endpoint is available or honestly reported an expected,
non-pageable degradation. Exit 1 means an operator-actionable failure.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any


TRANSIENT_ERRORS = {"OCR_RATE_LIMITED", "OCR_PROVIDER_UNAVAILABLE"}
TERMINAL_ERRORS = {
    "OCR_BILLING_DISABLED",
    "OCR_QUOTA_EXHAUSTED",
    "OCR_BUDGET_EXCEEDED",
}
EXPECTED_REVIEW_STATUSES = {
    "needs_better_scan",
    "no_fields",
    "unknown_document_type",
}


def classify(http_code: str, payload: dict[str, Any]) -> tuple[bool, str]:
    """Return (pageable, human-readable verdict)."""

    error_code = payload.get("error_code")

    if http_code == "200" and payload.get("ok") is True:
        fields = payload.get("fields") or []
        values_set = sum(
            1
            for field in fields
            if isinstance(field, dict)
            and isinstance(field.get("value"), str)
            and field["value"].strip()
        )
        return False, f"OCR healthy: fields={len(fields)} values_set={values_set}"

    if error_code in TRANSIENT_ERRORS:
        return False, f"OCR transient ({error_code}) - honest degradation, not paging."

    if error_code in TERMINAL_ERRORS:
        return True, f"OCR TERMINAL condition: {error_code} - provider account/quota/budget needs attention."

    status = payload.get("status")
    expected_review_outcome = (
        http_code == "200"
        and not error_code
        and payload.get("ok") is False
        and (
            (
                payload.get("review_required") is True
                and (
                    status in EXPECTED_REVIEW_STATUSES
                    or (isinstance(status, str) and status.startswith("ok:"))
                )
            )
            or (status == "reshoot_required" and payload.get("reshoot") is True)
        )
    )
    if expected_review_outcome:
        return False, (
            "OCR endpoint available; synthetic document produced an expected "
            f"review outcome (status={status}, fields={len(payload.get('fields') or [])})."
        )

    return True, (
        f"OCR probe FAILED (HTTP {http_code}, error_code={error_code}, status={status}) "
        "- possible sustained outage. Investigate provider and deployed artifact."
    )


def main(argv: list[str]) -> int:
    if len(argv) != 3:
        print(f"usage: {argv[0]} HTTP_CODE RESPONSE_JSON", file=sys.stderr)
        return 1

    http_code, response_path = argv[1], Path(argv[2])
    try:
        payload = json.loads(response_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        print(f"::error::OCR probe returned malformed JSON: {exc}")
        return 1

    if not isinstance(payload, dict):
        print("::error::OCR probe returned a non-object JSON response.")
        return 1

    pageable, verdict = classify(http_code, payload)
    if payload.get("ok"):
        print(verdict)
    else:
        print(f"::{'error' if pageable else 'warning'}::{verdict}")
    return 1 if pageable else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
