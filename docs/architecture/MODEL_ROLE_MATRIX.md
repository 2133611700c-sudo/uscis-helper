# MODEL_ROLE_MATRIX — кто за что отвечает (закон ролей, 2026-07-04)

Owner-утверждённая карта ролей. Правило чтения: роль сильнее хотелки — если провайдера нет
в строке задачи, он эту задачу НЕ делает. Классы готовности — только из
`docs/ocr/ONE_BRAIN_RUNTIME_TRUTH.md`. Измерения, на которых стоит эта таблица:
printed-батарея 12/12 byte-identical (Gemini, GPT), рукописный контролируемый прогон
3 поля × 3 прогона × 3 провайдера 2026-07-04 (Gemini 0/9 нестабилен; GPT 3/9 стабильная
фабрикация на 2 из 3 полей; gemma4 0/9, до CER 3.89, 1.5–4 мин/кроп), ADR-026 (raxtemur
читает нативные кропы, LLM фабрикуют на курсиве).

## Матрица провайдеров

| Провайдер | Runtime | Printed | Handwriting | PII | Пишет final | Роль в продукте |
|---|---|---|---|---|---|---|
| Gemini 2.5 Pro | cloud API (paid key) | ✅ PRIMARY_READER | ❌ 0/9, DISQUALIFIED на cert-family | да (paid tier) | никогда (кандидаты) | Глаза printed-пути |
| gemini-3.5/2.5-flash | cloud API | availability-fallback, force-review | ❌ | да | никогда | Только доступность, никогда acceptance |
| GPT-4.1 | cloud API | ✅ временный override (`READER_PROVIDER=openai`) | ❌ 3/9; стабильная фабрикация — consensus не ловит | да | никогда | PRINTED_FALLBACK + GT_ASSISTANT_ONLY (офлайн-подсказчик кандидатов с человеком) |
| gpt-5.x | cloud API | ❌ само-транслитерирует в cyr-слот (L8) | ❌ | — | никогда | ОТКЛОНЁН как reader |
| Gemma4 (ollama, Mac) | local worker, НЕ Vercel | не нужен (printed решён) | ❌ 0/9, confident fabrication, 1.5–4 мин/кроп | локально — да (PII не покидает Mac) | никогда | LOCAL_HELPER / NOT_READER: bench-judge, GT-лаборатория, prose |
| Qwen2.5 / -coder | local worker | — | — | локально — да | никогда | LOCAL_HELPER (text) / CODE_HELPER (repo, CI, diff) |
| DeepSeek API | cloud API, text-only | ФИЗИЧЕСКИ НЕ МОЖЕТ (нет vision) | физически не может | ❗ПО УМОЛЧАНИЮ НЕТ: вход = keys/counts/codes/summaries (L3, двойной барьер) | никогда | TEXT_CRITIC: watchdog-вердикты, explainer-полировка, rule-mining, root-cause |
| Google Vision | cloud API (billing 403 сейчас) | OCR-геометрия | геометрия | да | никогда | EVIDENCE_PROVIDER: bbox/words/layout, НЕ семантика |
| raxtemur HTR (sidecar) | отдельный worker (Mac=lab, prod=hosted) | ❌ на печати слаб | ✅ единственный доказанный на нативных кропах (ADR-026); не умеет abstain → всегда review | да (self-hosted) | никогда | HANDWRITING_READER_CANDIDATE — главный рычаг рукописи |

## Матрица блоков конвейера

| Блок | Отвечает за | Использует | НЕ имеет права |
|---|---|---|---|
| Preprocess | ориентация, native-res crop, контраст | image-preprocess, ADR-026 recipe | решать значение поля |
| Reader (printed) | кандидаты с печати | Gemini primary, flash/GPT availability | принимать рукопись авто |
| Reader (handwriting) | кандидаты с курсива | HTR sidecar; LLM-crop = comparison/hint only | быть замещённым LLM без бенча |
| Evidence | ГДЕ поле на странице | Vision (DARK) / template approximate | менять значение; врать лейблом (approximate ≠ exact) |
| Knowledge | сигналы: формат/орган/страна/translit/скрипт | packages/knowledge (единственный словарный SoT) | молча подменять значение |
| Decision Engine | вердикт по кандидатам+сигналам | decideField (≡ C3-логика) | читать картинку; писать final |
| C3 | ЕДИНСТВЕННЫЙ писатель finalValue | FieldDecision | иметь конкурентов (TPS 7 писателей = болезнь, T4) |
| Review UI | показать сомнение человеку: значение+источник+причина+crop+кандидат Б | Review Explainer (глоссарий) | скрывать uncertainty |
| Shadow Watchdog | можно ли флипать флаг | shadow-маркеры; verdict-полировка Gemma/DeepSeek | менять production-поведение |

## Алиасы «*-latest» — ЗАПРЕЩЕНЫ для pro-класса (измерено 2026-07-04)
Probe на pay-ключе показал: `gemini-flash-latest` → подаёт 3.5-flash (ок), но
`gemini-pro-latest` → **подаёт запретную preview-версию «три-точка-один»**. Это и был
корень «прод подаёт запретную версию» из ранних сессий. Закон: модель указывается ТОЛЬКО
пином точного id (`modelMatrix.ts`); любой `*-latest`/дефолт для pro-класса запрещён.

## Законы (не обсуждаются)
1. Модель — свидетель, не нотариус. Decision Engine — судья. Словарь — справочник-закон. C3 — единственный писатель. Review — защита. Evidence — доказательство.
2. Не доказано → не final. Слабый источник → review. Evidence missing → честная метка. Conflict → не схлопывать. Unknown → не выдумывать (no-guessing law).
3. Latin имён пишет только детерминированный KMU-55 — никакая модель.
4. Тяжёлые модели НЕ живут в Vercel Functions: только external API или отдельный worker (Ollama/HTR = worker с /health и /read-crop; Mac = лаборатория, прод = hosted worker).
5. GitHub Actions = CI/bench, не runtime продукта.
6. Порядок продуктов: Translation vertical → EAD → ReParole → TPS ПОСЛЕДНИМ (7 писателей).

## Честные уточнения против «идеальной» карты (код-правда)
- «GPT-4.1 fallback» — в коде это НЕ авто-fallback: авто-fallback'и только gemini-flash
  (`FALLBACK_MODELS`); GPT — ручной override-флаг с исключением cert-families.
- «Decision Engine выдаёт exact/weak/conflict/unknown» — сегодня FieldDecision =
  accept/reject + reviewRequired + reasons. Четырёхзначная таксономия — целевое расширение
  ПОСЛЕ флипа движка, не текущее состояние.
- Локальный LLM-worker в проде v1 НЕ нужен: prod-текстовые роли закрывает DeepSeek,
  локальные — Gemma на Mac. Hosted-Gemma строить только при доказанной потребности.
