# HANDWRITTEN CYRILLIC — ONE BRAIN PLAN STATUS (2026-07-05)

> SUMMARY-отчёт. НЕ является truth-леджером: все цифры сведены ИЗ существующих артефактов
> (single-ledger law). Источники: `docs/reports/GT_PIPELINE_BENCH_2026-07-05.md`,
> `docs/reports/LIVE_DOOR_SCORABLE_COVERAGE.md`, `docs/reports/DOWNLOADED_UKRAINIAN_MODEL_CAPABILITY_BENCH.md`,
> `ops/agent-control/reports/2026-07-05-handwritten-contour-independent-audit.md` (+addendum),
> gt `_meta.owner_verified_fields` (gitignored qa-private/ground-truth).

STATUS: PHASE_A_BLOCKED_BY_GT · механизмы контура готовы, данных нет
HEAD: см. коммит этого файла
WORKTREE: clean на момент коммита

EXISTING_LEDGER_USED: acceptance-manifest + gt `_meta` + LIVE_DOOR_SCORABLE_COVERAGE + GT_PIPELINE_BENCH (никаких новых truth-файлов)
DEDUP_STATUS: DONE — байт-дубль помечен в `_meta` обоих GT-леджеров (`physical_doc_hash`,
  `duplicate_of: birth_cert_handwritten_01`, `scored:false`, `not_scored_reason`); строка дубля
  отключена в bench-манифесте; честная переоценка TIER-1: N=24 уникальных полей, ~75% EXPLORATORY
SCHEMA_FIRST_STATUS: DONE — поля только из контрактов/registry-спек; структурный false-MISS
  (`sex` на ua_military_id, которого нет ни в registry, ни в TPS-контракте) найден и убран;
  EAD/I-94 вне UA-двери by design (ADR-016) — скорятся своими дверями
CURRENT_UNIQUE_HANDWRITTEN_FIELDS: ≈14 кириллических (owner-verified, после дедупа)
CURRENT_HAND_COUNT: 2 (рука A birth-cert, рука B military); руки C+ = 0 полей
PHASE_A_TARGET: 36+ полей / ≥3 руки (лучше 60+)
OWNER_GT_BLOCKER: заполнение qa-private/ground-truth/OWNER_FILL_REQUIRED.md docs 4–8
  (marriage×3 + divorce + military_p2, ~15 минут с физических оригиналов; model-GT запрещён)

BLANK_GATE_STATUS: **BUILT + THIRD-SIGNATURE** (этот коммит) — `blankCropGate.judgeBlankCrop`
  (ink-density, детерминированный) вызывается ДО модели в ОБОИХ транспортах (htr_sidecar,
  llm_crop); blank → skip + `[blank_crop_gate]` маркер + review через fail-closed.
  Live-порог: реальные рукописные кропы ink 0.14–0.25 при пороге 0.004 (35–60× запас);
  синтетический blank гейтится; decode-сбой = fail-OPEN к чтению (review сохраняется).
  Цель `blank_fabrication_reachable = 0` — достигнута конструктивно для crop-транспортов.

READERS_IN_SCOPE: A=raxtemur sidecar · B=gemini-2.5-pro full-page/crop
READERS_FORBIDDEN: gemma4 · скачанная UA TrOCR (активно) · любые новые LLM · model-транслитерация
UA_TrOCR_STATUS: TESTED · NOT_USEFUL_AS_IS · UNSAFE_GUESSING · ONLY_FINE_TUNE_CANDIDATE · NOT_ACTIVE_READER

PER_HAND_METRICS_STATUS: закон принят (среднее скрывает провал руки B); текущие точки:
  рука A: raxtemur 9/9 EXACT (manual crops) / LLM слабый; рука B: LLM имена EXACT×6 / raxtemur 0/3;
  полная per-hand таблица = HANDWRITTEN_CYRILLIC_BENCH.md ПОСЛЕ снятия GT-блокера
ARBITRATION_STATUS: SHADOW_ONLY — ensemble-differ двух читателей (child_*-fold + placeholder-fix,
  live third-signature) + linguisticCritic (variant/1-char/script/date, mayRewriteValue:false типом)
  + conflict_signals в маркере; Watchdog агрегирует
TRANSLITERATION_STATUS: PASS — детерминированный KMU-55 после принятой кириллицы; RU-форма
  не украинизируется (routing существует); latin_from_model = 0 (guarded)
ORIENTATION_LOCALIZATION_STATUS: ОТДЕЛЬНЫЙ слой (не смешан с reader-качеством): VLM-детектор
  нестабилен на главном свидетельстве (180/270 на одном фото), OSD отклонён замером,
  EXIF-оракул (6/6/3) готов; Phase C матрица может стартовать до GT

WHAT_IS_PROVEN: механика всего контура (gate→readers→ensemble→critic→review→KMU-55) с live-подписями;
  комплементарность читателей по рукам; непригодность UA TrOCR as-is; дедуп и schema-first в бенче
WHAT_IS_NOT_PROVEN: качество на ≥3 руках (нет GT); Phase B стратегия (ждёт цифр Phase A);
  orientation-матрица целиком; всё production/auto-accept — ЗАПРЕЩЕНО заявлять

NEXT_ACTIONS:
  owner → заполнить ведомость docs 4–8 (единственный блокер Phase A)
  agent → Phase C orientation-матрица (не ждёт GT) → после GT: единый HANDWRITTEN_CYRILLIC_BENCH.md

FINAL_VERDICT: HANDWRITTEN_CYRILLIC_PHASE_A_BLOCKED_BY_GT
