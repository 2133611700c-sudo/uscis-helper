# STATUS — Messenginfo TPS Robot
**Updated:** 2026-05-24 Session 15
**SHA:** PENDING (this commit)
**Live:** messenginfo.com

## VERIFIED (live proof exists)
- MRZ passport extraction: stable, 8 identity fields from MRZ
- I-94 extraction: Brain runs (post-contract threshold fix), 10 fields
- EAD given_name duplicate detection: "Kuropiatnyk"→ dropped, Brain fills "Sergii"
- Date normalization: US format MM/DD/YYYY → ISO YYYY-MM-DD
- Booklet city/province: "Trostianets" / "Vinnytsia Oblast" (1 of 2 runs stable)

## FAILED / BROKEN
- EAD standalone: given_name = "Saghi" (no MRZ backup = garbage accepted)
- Booklet: garbage-rejection guard added (BiRHEROI→rejected) ("BiRHEROI odwaemi" on second run)
- Passport city_of_birth: Brain outputs "ВІННИЦЬКА ОБЛ." — JS \b regex didn't catch Cyrillic
- Controlling spelling: NOT IMPLEMENTED (packetIdentityAnchor exists in translation, not used by TPS)

## UNVERIFIED (code written, not live-proven)
- A2: MRZ identity lock (this commit)
- A3: city/province Cyrillic regex fix (this commit)
- A4: booklet weak-source marking (this commit)
- Central Brain: ADR written, NOT built

## OPEN
- place_of_last_entry: not extracted from I-94
- middle_name: unreachable from any automated source
- Translation engine ↔ TPS bridge: not built
- Central Brain v0: not started (Phase A must complete first)

## NEXT EXACT STEP
Deploy this commit → test same passport image → verify:
1. city_of_birth = "ВІННИЦЬКА ОБЛ." is REJECTED (not "Vinnytsia Oblast")
2. MRZ identity fields are LOCKED (EAD "Saghi" rejected when passport uploaded)
3. Booklet fields marked review_required



