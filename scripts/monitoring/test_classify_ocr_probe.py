#!/usr/bin/env python3

import unittest

from classify_ocr_probe import classify


class ClassifyOcrProbeTest(unittest.TestCase):
    def test_successful_read_is_healthy(self) -> None:
        pageable, message = classify("200", {"ok": True, "fields": [{"value": "X"}]})
        self.assertFalse(pageable)
        self.assertIn("values_set=1", message)

    def test_expected_zero_field_review_does_not_page(self) -> None:
        pageable, message = classify(
            "200",
            {
                "ok": False,
                "fields": [],
                "review_required": True,
                "status": "ok:gemini-3.1-pro-preview:1000ms:0f",
            },
        )
        self.assertFalse(pageable)
        self.assertIn("expected review outcome", message)

    def test_known_quality_outcomes_do_not_page(self) -> None:
        for payload in (
            {"ok": False, "status": "needs_better_scan", "review_required": True},
            {"ok": False, "status": "reshoot_required", "reshoot": True},
            {"ok": False, "status": "no_fields", "review_required": True, "fields": []},
        ):
            with self.subTest(status=payload["status"]):
                self.assertFalse(classify("200", payload)[0])

    def test_untyped_provider_failure_still_pages(self) -> None:
        pageable, _ = classify(
            "200",
            {"ok": False, "review_required": True, "status": "vision_failed:invalid JSON from model"},
        )
        self.assertTrue(pageable)

    def test_transient_typed_failure_does_not_page(self) -> None:
        self.assertFalse(classify("503", {"ok": False, "error_code": "OCR_PROVIDER_UNAVAILABLE"})[0])

    def test_terminal_typed_failure_pages(self) -> None:
        self.assertTrue(classify("402", {"ok": False, "error_code": "OCR_BILLING_DISABLED"})[0])

    def test_malformed_transport_failure_pages(self) -> None:
        self.assertTrue(classify("500", {})[0])


if __name__ == "__main__":
    unittest.main()
