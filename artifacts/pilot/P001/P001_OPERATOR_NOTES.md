# P001 — Operator Notes

**Pilot user ID:** P001  
**Date:** 2026-05-09

---

## Pre-send Checklist

- [x] Production deployment READY: `dpl_3ciMbuxavU6WVb4KjdRhTw4qVLRS`
- [x] Deployed commit matches main: `22641ef`
- [x] TypeScript: 0 errors
- [x] Tests: 325/325 pass
- [x] Build: exit 0
- [x] Content guard: 0 violations
- [x] User message EN prepared: `P001_USER_MESSAGE_EN.txt`
- [x] User message RU prepared: `P001_USER_MESSAGE_RU.txt`
- [ ] User message sent to P001
- [ ] P001 acknowledged instructions

---

## Payment Mode Decision

**⚠️ IMPORTANT — DECIDE BEFORE SENDING LINK TO P001:**

Stripe is in LIVE mode (`cs_live_` prefix confirmed in prior smoke test).  
Real payment will be charged unless one of the following is configured:
- A Stripe coupon code set to 100% discount
- A manual `payment_confirmed = true` override in DB (for test only)
- A mock payment path

**Operator action required:** Decide whether P001 pays real money or gets a manual override.  
Record decision here before sending user the link.

Decision: _______________  
Date decided: _______________

---

## Issue Log

| Date | Issue | Action | Resolved |
|---|---|---|---|
| 2026-05-09 | awaiting_upload | Prepared messages, waiting for P001 | no |

---

## Rules

- Do not enter real names, passport numbers, or dates in this file.
- Do not share this file with P001.
- Update this file after each significant event.
