# ONE_BRAIN_RUNTIME_TRUTH — единственный правдивый runtime-статус (truth lock 2026-07-04)

**Закон этого файла:** каждый узел имеет РОВНО ОДИН класс из словаря ниже. Никакой узел не
называется сильнее своего класса; слова «done/готово/закрыто» без класса запрещены во всех
отчётах. Claim сильнее класса = баг документации. Инвентарь ниже парсится guard-тестом
(`runtimeTruthVocabulary.guard.test.ts`) — строка без ровно одного класса валит CI.

**No-guessing law:** система может читать, предлагать, проверять и объяснять сомнение; она не
имеет права выдумывать значение. Лучше `unknown`, чем fabricated. См.
`docs/ocr/NO_GUESSING_CONSTITUTION.md`.

**Словарь классов (единственные допустимые):**
`LIVE` (работает в проде сейчас, без флага) · `FLAGGED` (построено, strict-флаг default OFF —
в проде байт-идентично отсутствию) · `SHADOW_ONLY` (наблюдает, не влияет) · `DARK` (код есть,
не подключён) · `HISTORICAL` (запись прошлого, не опция) · `BLOCKED_EXTERNAL` (ждёт внешнего
ресурса: billing/host/квота — код готов ровно настолько, насколько сказано в факте).

**Иерархия правды:** «код написан» < «FLAGGED» < «SHADOW_ONLY с чистым окном» < «LIVE».
Флип между классами — только по `docs/ocr/FLIP_CRITERIA.md` + owner sign-off.

**Model policy hard lock:** primary printed = `gemini-2.5-pro` (`modelMatrix.ts`: PRIMARY_READER;
FALLBACK_MODELS = 3.5-flash, 2.5-flash — availability-only, force-review, никогда acceptance).
Версия Gemini «три-точка-один» (любые её id) — НЕ рабочая опция: guard `noGemini31.guard.test.ts`
валит CI на любое активное упоминание; исторические поверхности — HISTORICAL. Handwritten =
НИКОГДА не LLM-acceptance, только review. GPT — printed-only availability, исключён на
handwritten/cert families (`isHandwrittenFamily`).

## Инвентарь 15 узлов (guard-parsed; один класс на узел + predicate перехода)

| # | Узел | Класс | Факт + что переводит в следующий класс |
|---|---|---|---|
| 1 | Translation recognition contour (upload→read→assess→zoom→candidates) | LIVE | Болезнь внутри: ДВЕ плоскости чтения — дверь + legacy-fallback 2-й reader (route:309/614/616). Одноплоскостным станет после чистого окна RECOGNIZE_RETRY_ON_EMPTY → удаление fallback-plane (флип T1.2-4) |
| 2 | Translation decision contour (signals→critic→arbitration→C3→review) | LIVE | Legacy-форма: D2+KNOWLEDGE_BRAIN переписывает normalizedValue, C3 — единственный писатель finalValue. Engine-форма — узел 2a ниже; переход = per-field-kind флип по чистому окну |
| 2a | Decision Engine (decideField ≡ C3) + gates-as-readers differ | SHADOW_ONLY | ONE_BRAIN_DECISION_SHADOW: [decision_shadow] (3 живые точки diffs=0, N=3 ≠ окно) + [gates_as_readers_shadow] (differ через реальную гейт-деривацию). Переход: FLIP_CRITERIA блок 1-2 на окне + sign-off |
| 3 | Translation evidence contour (geometry→EvidenceRegion→carriage→UI) | FLAGGED | ONE_BRAIN_EVIDENCE_ENABLED: template-evidence с ЧЕСТНЫМИ лейблами approximate/full_image/missing (live-проверено fields_with_evidence=3). Переход в LIVE: визуальная проверка на staging + флип. Provider-bbox НЕ входит (узел 9) |
| 4 | TPS writers (семь параллельных плоскостей) | LIVE | Болезнь. Поимённо: (1) rule-модули `tps/modules/*` (passport/booklet/i94/ead/dl/i797/militaryId/birthCertificate); (2) dualOcrCrossref; (3) geminiVisionArbiter (readBookletViaVision); (4) DeepSeek runBrain-merge; (5) contract firewall (applyContract/documentContracts); (6) postExtractNormalize in-place; (7) policy-guards (applyHardCaseReviewOverride + role-date). Переход: T4 collapse-план, по одному, после ReParole |
| 5 | TPS one-arbitration | SHADOW_ONLY | TPS_ONE_ARBITRATION_SHADOW differ (missing_in_shadow/review_loosened = flip-blockers). Переход: чистое окно per doc-type hint + sign-off |
| 6 | EAD route | LIVE | Через Core (us_ead spec). Наследует все флаги двери при их флипах |
| 7 | ReParole route | LIVE | i94/ead делегация в TPS-роут = live-связка; собственный Core-путь за REPAROLE_CORE_USFORMS (FLAGGED-механизм внутри LIVE-узла); dl = честный 422. Переход: окно + флип флага |
| 8 | ReaderResult seam | FLAGGED | Внутри `recognizeDocument` candidates уже конвертируются ЧЕРЕЗ ReaderResult; byte-parity к историческому direct-path заморожена CI-тестом. Узел остаётся FLAGGED, потому что сам `recognizeDocument` ещё не является единственным live route-path во всех продуктах (T1.2-3) |
| 9 | Provider bbox (Vision→locator→UI) | DARK | Код-цепочка есть (resolveOcrIds/visionBboxLocator/EvidenceProvider DI), но live-ридер не эмитит fieldOcrIds И Vision billing 403 (внешний блок). Переход: billing + wiring + honest-label проверка |
| 10 | Review Explainer | FLAGGED | REVIEW_EXPLAINER_ENABLED: детерминированный глоссарий в vision-extract response; DeepSeek-полировка уже route-wired как helper-only слой, никогда не writer final value/review release; отдельно за DEEPSEEK_REVIEW_EXPLAINER (prose-only, keys+codes, L3). Переход: staging-просмотр + флип |
| 11 | Normalize collapse (P8) | SHADOW_ONLY | NORMALIZE_COLLAPSE_SHADOW: rule-pack = сигнальная обёртка САМОГО postExtractNormalize (drift=0 by construction), differ vs live-писатель. Переход: чистое окно → route читает сигналы, движок пишет (шаг 2) |
| 12 | ASSESS→ZOOM verification re-read | FLAGGED | ASSESS_ZOOM_LOOP: критик называет HARD-противоречия → ≤4 платных перечиток; значения не меняет, review только вверх (zoom_mismatch). Переход: staging-наблюдение маркера + флип |
| 13 | DeepSeek | LIVE | Наследие: TPS-brain включается НАЛИЧИЕМ ключа (key≠permission не инвертирован — ждёт [deepseek_brain_contribution] цифр + sign-off). Допустимая target-роль: дешёвый helper/analyst/explainer для системы и других агентов; НЕ silent final writer. Prose-инструменты (Watchdog-вердикт, Explainer-полировка) — strict-flag механизмы внутри узла, default OFF; локальный helper `scripts/shadow-watchdog.ts` читает aggregate-only logs |
| 14 | HTR (raxtemur crop-транспорт) | BLOCKED_EXTERNAL | HTR_SIDECAR_URL не задан (owner-хост). Маршрут готов (crop-контракт + LLM-транспорт live-проверен механически); КАЧЕСТВО рукописи без HTR не решено — LLM на курсиве фабрикует (ADR-026) |
| 15 | Model policy | LIVE | matrix (PRIMARY/FALLBACK/DEPRECATED/DISQUALIFIED) + acceptanceModelVerdict + noGemini31-guard в CI. Historical-упоминания запретной версии остаются на HISTORICAL-поверхностях by design |

## Детализация (вспомогательная; классы те же)

| Узел | Класс | Факт |
|---|---|---|
| readDocument full-page (2.5-pro primary) | LIVE | все 4 продукта |
| recognizeDocument оркестратор | FLAGGED | ONE_BRAIN_RECOGNIZE_ENABLED |
| retryOnEmpty в одной двери | FLAGGED | RECOGNIZE_RETRY_ON_EMPTY; route передаёт retryOnEmpty(25s) |
| GPT printed-override | FLAGGED | READER_PROVIDER=openai; cert-families исключены |
| Crop-route: LLM-транспорт | FLAGGED | HANDWRITING_CROP_LLM=gemini; механика live-да; качество 2.5-pro на курсиве НЕ GT/нестабильно |
| Crop-prompt knowledge-hints | FLAGGED | структурные подсказки; словарные ЗНАЧЕНИЯ в prompt запрещены тестом |
| VERIFY-критик (C1-C5) | SHADOW_ONLY | наблюдается в [decision_shadow]; ASSESS-источник zoom-целей |
| KMU-55/translit, gazetteer, registry-55, docNumber/authority-сигналы, patronymic-валидация | LIVE | через knowledgeNormalize/evaluator |
| patronymic-РЕКОНСТРУКЦИЯ | FLAGGED | DICTIONARY_AUTOCORRECT |
| SMART_NORMALIZE-двери, dictionaryBridge-snapCity#2 | FLAGGED | legacy; схлопнуть в P8 шаг 2 |
| tps_requirements, civil_terms, TD1 | DARK | в KNOWLEDGE_EXPORT_LEDGER (RESERVED-записи) + guard; TD1 keep-alive тест |
| Словарь украинских ИМЁН | DARK | никогда не коммитился — файла нет; имена = чистая KMU-55 без fuzzy |
| ocr-from-storage тёмный маршрут | HISTORICAL | удалён вместе с mapFieldsWithDeepSeek |
| Прод-деплой этой ветки (main) | DARK | ветка не деплоилась; прод-наблюдение запрещённой preview-версии — HISTORICAL-запись (OWNER_QA), требует owner-решения |

## Признанные root-causes «app читает, а API нет» (по коду; без догадок о внутренностях приложений)
1. Full-page downscale (image-preprocess cap; прод-лог «downscaled from 7.1MB») — LIVE-проблема.
2. Token-бюджет thinking-моделей (MAX_TOKENS → пустые риды) — исправлено (cap≥8192, провайдер + crop-reader).
3. One-shot чтение вместо field-first цикла — узлы цикла построены (2a/11/12), классы выше.
4. Отсутствие provider-geometry в live-пути — узел 9 (DARK).
5. Отсутствие production-рукописного ридера — узел 14 (BLOCKED_EXTERNAL).
Внутренние механики consumer-приложений — не утверждаем (нет доступа).

## Итоговая честная формулировка (эталон для любых отчётов)
One Brain convergence materially advanced: shadow/flagged-механизмы реализованы и наблюдаемы,
flip-критерии машиночитаемы. Runtime остаётся PARTIAL: legacy-fallback translation LIVE,
TPS 7 писателей LIVE, ReaderResult FLAGGED (не live-spine), provider-bbox DARK, HTR
BLOCKED_EXTERNAL. Дальше по v3-плану: T0 truth lock → T1 Translation vertical (окно → флипы
по одному) → EAD → ReParole → TPS последним. Каждый claim — только со классом из этого файла.
