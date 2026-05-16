# T3PS Final Browser A/B Proof

Generated: 2026-05-16T22:02:30Z

## Scenario A (I-821 only)
- Source: `/Users/sergiiredacted/work/uscis-helper/docs/reports/evidence/t3ps-final-release/browser-run-clean/browser_summary.json`
- Result: `ocr_status=200`, `generate_status=200`
- ZIP captured: `tps-packet-intercept-1778968825392.zip` (bytes: `1825484`)
- Non-blocking noise: `/_vercel/insights/script.js` 404 and CSP block for Cloudflare beacon.

## Scenario B (TPS + EAD)
- Source: `/Users/sergiiredacted/work/uscis-helper/docs/reports/evidence/t3ps-functional-closeout/scenario_B/browser_summary.json`
- Result: `ocr_status=200`, `generate_status=200`, `zip_downloaded=true`
- ZIP: `/Users/sergiiredacted/work/uscis-helper/docs/reports/evidence/t3ps-functional-closeout/scenario_B/downloaded_zip/tps-packet-1778968618232.zip`
- ZIP bytes: `2590553`
- Non-blocking noise: `/_vercel/insights/script.js` 404 and CSP block for Cloudflare beacon.

## Screenshots
- A flow screenshots: `/Users/sergiiredacted/work/uscis-helper/docs/reports/evidence/t3ps-final-release/browser-run-clean/screenshots/`
- B flow screenshots: `/Users/sergiiredacted/work/uscis-helper/docs/reports/evidence/t3ps-functional-closeout/scenario_B/screenshots/`

## Important Note
- A separate forced-state debug run at `/Users/sergiiredacted/work/uscis-helper/docs/reports/evidence/t3ps-final-browser/scenario_A_fresh/browser_summary.json` returned `422`.
- That run injected synthetic state directly and is treated as non-authoritative diagnostic evidence.
- Authoritative Scenario A evidence is the clean production contour run with `generate_status=200`.
