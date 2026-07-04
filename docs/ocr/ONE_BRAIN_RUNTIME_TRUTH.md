# ONE_BRAIN_RUNTIME_TRUTH — единственный правдивый runtime-статус (2026-07-04)

**Закон этого файла:** каждый узел имеет РОВНО ОДИН статус. Никакой узел не называется сильнее,
чем его статус. Классы: **LIVE** (работает в проде сейчас, без флага) · **FLAGGED** (построено,
strict-флаг default OFF — в проде байт-идентично отсутствию) · **SHADOW_ONLY** (наблюдает,
не влияет) · **DARK** (код есть, не подключён / внешне заблокирован) · **HISTORICAL** (запись
прошлого, не опция). Claim сильнее статуса = баг документации.

**Model policy hard lock:** primary printed = `gemini-2.5-pro`. Версия Gemini «три-точка-один»
(любые её id) — НЕ рабочая опция: не использовать, не тестировать, не упоминать активно; сам
литерал запрещён на активных поверхностях guard'ом `noGemini31.guard.test.ts` — поэтому здесь
он назван описательно.
Handwritten = НИКОГДА не LLM-acceptance, только review. GPT — printed-only availability
(`READER_PROVIDER=openai`, FLAGGED), исключён на handwritten/cert families.

## Признанные root-causes «app читает, а API нет» (по коду; без догадок о внутренностях приложений)
1. Full-page downscale (image-preprocess cap; прод-лог «downscaled from 7.1MB»). — LIVE-проблема.
2. Token/output-бюджет thinking-моделей (MAX_TOKENS → пустые риды; чинится cap≥8192). — исправлено в провайдере и crop-reader.
3. One-shot чтение вместо field-first цикла. — архитектурный пробел (см. AGENTIC_BRAIN_BLUEPRINT).
4. Отсутствие provider-geometry в live-пути (Vision billing-403 + нет fieldOcrIds). — DARK.
5. Отсутствие production-рукописного ридера (HTR-хост не поднят). — DARK.
Внутренние механики consumer-приложений — UNVERIFIED (не утверждаем).

## Таблица узлов

| Узел | Статус | Факт |
|---|---|---|
| **RECOGNITION** | | |
| readDocument full-page (Gemini 2.5-pro primary) | **LIVE** | все 4 продукта |
| Translation legacy-fallback 2-й reader (0 fields/error) | **LIVE** | route:309/614/616 — ЖИВАЯ legacy-плоскость |
| recognizeDocument оркестратор | **FLAGGED** | ONE_BRAIN_RECOGNIZE_ENABLED |
| retryOnEmpty в одной двери | **FLAGGED** | RECOGNIZE_RETRY_ON_EMPTY |
| GPT printed-override | **FLAGGED** | READER_PROVIDER=openai; cert-families исключены |
| Crop-route: LLM-транспорт | **FLAGGED** | HANDWRITING_CROP_LLM=gemini; live-проверен: механика да, качество 2.5-pro на курсиве НЕ GT/нестабильно |
| Crop-route: HTR-транспорт (raxtemur) | **DARK** | HTR_SIDECAR_URL не задан (owner-хост) |
| ReaderResult seam | **FLAGGED** | больше не dormant: candidates конвертируются ЧЕРЕЗ ReaderResult за READER_RESULT_SEAM='1'; byte-parity к прямому пути заморожена тестом; «всё идёт через ReaderResult» станет правдой только после флипа |
| Translation in-door retry (шаг 3) | **FLAGGED** | RECOGNIZE_RETRY_ON_EMPTY + retryOnEmpty(25s) в route; при флипе 0-field recovery происходит В двери; legacy-plane остаётся LIVE до shadow-окна |
| **DECISION** | | |
| Arbitration D2 + KNOWLEDGE_BRAIN | **LIVE** | default ON; accept ПЕРЕПИСЫВАЕТ normalizedValue (снятие — за флипом evaluator-пути) |
| C3 applyOcrFieldSafety (translation) | **LIVE** | безусловно в translation; флаг — для остальных |
| Decision Engine (decideField ≡ C3) | **SHADOW_ONLY** | ONE_BRAIN_DECISION_SHADOW; 3 живые точки diffs=0 (N=3 ≠ окно) |
| gates-as-readers (FieldDecision-проекции) | **FLAGGED** | адаптер+инвариант-guard готовы; gates НЕ переведены |
| TPS 7 параллельных писателей | **LIVE (болезнь)** | НЕ схлопнуты; one-arbitration = только proof-инструмент |
| TPS one-arbitration differ | **SHADOW_ONLY** | TPS_ONE_ARBITRATION_SHADOW |
| DeepSeek TPS-brain | **LIVE (наследие)** | включается наличием ключа (key≠permission не инвертирован — ждёт цифр shadow-метрики+sign-off) |
| **EVIDENCE** | | |
| FieldOut.evidence → UI-crop (wizard) | **FLAGGED** | ONE_BRAIN_EVIDENCE_ENABLED; честные статусы approximate/full_image/missing |
| Template-evidence (birth cert + child_* алиасы) | **FLAGGED** | live-проверено: fields_with_evidence=3 |
| Provider-bbox (Vision→resolveOcrIds/locator) | **DARK** | Vision 403 + live-ридер не эмитит fieldOcrIds; «provider-bbox до UI закрыт» — ЛОЖЬ |
| EvidenceProvider DI + google-провайдер | **FLAGGED/DARK** | resolver strict; google-провайдер drop-in, внешне заблокирован |
| **KNOWLEDGE (словари)** | | |
| KMU-55/RU-translit, gazetteer(458+17k+confusion), registry-55, docNumber-сигнал, authority-сигнал, patronymic-валидация | **LIVE** | через knowledgeNormalize/evaluator |
| patronymic-РЕКОНСТРУКЦИЯ | **FLAGGED** | DICTIONARY_AUTOCORRECT |
| SMART_NORMALIZE-двери, dictionaryBridge-snapCity#2 | **FLAGGED (legacy)** | схлопнуть в P8 |
| tps_requirements, civil_terms, TD1 | **RESERVED** | леджер+guard; TD1 keep-alive тест |
| Словарь украинских ИМЁН | **ОТСУТСТВУЕТ** | никогда не коммитился; имена = чистая KMU-55 без fuzzy |
| **ПРОДУКТЫ** | | |
| Translation vision-extract Core B2 | **LIVE** | + legacy-fallback LIVE (см. выше) |
| TPS Core (passport/booklet) | **LIVE** | остальные hints = legacy LIVE; расширение за TPS_CORE_HINTS (FLAGGED; i94/ead parity CLOSED) |
| EAD / ReParole Core | **LIVE** | ReParole US-форм decoupling — FLAGGED (REPAROLE_CORE_USFORMS) |
| ocr-from-storage тёмный маршрут | **УДАЛЁН** | + mapFieldsWithDeepSeek удалён |
| **ПРОД-ДЕПЛОЙ (main)** | **UNVERIFIED здесь** | эта ветка не деплоилась; прод-наблюдение запрещённой preview-версии — HISTORICAL-запись (см. OWNER_QA), требует owner-решения |

## Итоговая честная формулировка
Мост построен ЧАСТИЧНО: сильные root-causes подтверждены кодом; единый живой мозг для 4 сервисов
НЕ закрыт (legacy-fallback translation LIVE, 7 TPS-писателей LIVE, ReaderResult dormant,
provider-bbox DARK, все one-brain флаги OFF). Дальше по порядку owner-плана:
**Translation-контур до полностью честного** → **ReaderResult live-seam на translation (parity)**
→ EAD → ReParole → TPS shadow-collapse. Каждый claim — только со статусом из этого файла.
