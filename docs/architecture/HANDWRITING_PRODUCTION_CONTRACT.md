# HANDWRITING PRODUCTION CONTRACT (truth-plan step 8, 2026-07-04)

Printed и handwritten — ДВА разных production-пути. Смешивать их в «одну умную модель» запрещено:
попытки читать курсив полной страницей LLM-ом доказанно фабрикуют (ADR-018/026 + live-прогоны).

## Printed path (существующий)
- Reader: primary LLM (`gemini-2.5-pro`), full-page, схема per-field.
- Fallback availability: только разрешённые модели; non-primary → force-review.
- Может достигать acceptance по критериям measurement-гейта.

## Handwritten path (этот контракт)
1. **Классификация**: `isHandwrittenFamily(docTypeId)` — единственный переключатель пути.
   Никакой LLM-full-page рид рукописного семейства не является источником acceptance.
2. **Детерминированная локализация** (по приоритету, без ручного выбора):
   (1) `HTR_FIELD_BOXES` env-override (native px) → (2) `FIELD_BOX_TEMPLATES` (normalized,
   версионируемые, child_*-алиасы) → (3) LLM-bbox только как general fallback.
   Критерий детерминизма: same input → same orientation → same box → same crop → same
   output class → same review behavior.
3. **Native-res crop рецепт (ADR-026, неизменен)**: EXIF-normalize ONCE → extract на нативном
   разрешении ОРИГИНАЛА (никогда downscaled-страницы) → contrast-stretch (`normalise`) →
   БЕЗ binarize, БЕЗ resize.
4. **Транспорты чтения кропа** (оба существуют, оба review-gated):
   - `raxtemur` HTR sidecar (`HTR_SIDECAR_URL`) — целевой ридер (доказан на кропах); DARK до хоста.
   - LLM-crop (`HANDWRITING_CROP_LLM='gemini'` strict) — работает сегодня; live-вердикт: механика
     да, качество 2.5-pro на курсиве НЕ GT-exact и нестабильно → кандидаты только под review.
   GPT на рукописном семействе исключён всегда (`isHandwrittenFamily`-гейт в провайдер-селекторе).
5. **Review-закон (безусловный)**: КАЖДЫЙ рукописный critical-рид `review_required=true`.
   Auto-finalize рукописного значения невозможен ни при каком транспорте/конфиденсе (L6).
   Fail-closed: не читается → value=null + review, никогда фабрикация.
6. **Словари** прикладываются как СИГНАЛЫ после чтения (confusion-таблица/gazetteer для мест;
   patronymic-валидация; docNumber). Словарь ИМЁН отсутствует в репо — при появлении файла
   вайрится как fuzzy-suggestion сигнал, не как переписыватель.
7. **Evidence**: crop-регион поля = EvidenceRegion 'approximate' (template) или 'exact'
   (провайдер-геометрия, когда доступна); честные метки в review-UI обязательны.
8. **Измерение**: рукописные метрики считаются ОТДЕЛЬНО от printed (per rendering rollups);
   fabricated=0 обязательный гейт; N<30 полей = EXPLORATORY, не approval.

## Статусы на дату
LLM-crop transport: FLAGGED · HTR transport: DARK (owner: хост) · full-page LLM на рукописи:
LIVE как источник кандидатов ПОД REVIEW (не acceptance). Изменения статусов — только через
ONE_BRAIN_RUNTIME_TRUTH.md.
