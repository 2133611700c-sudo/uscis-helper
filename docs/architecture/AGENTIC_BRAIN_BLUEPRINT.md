# AGENTIC BRAIN BLUEPRINT — почему «как Claude Code» работает, а наш пайплайн нет, и как достроить (2026-07-04)

Синтез всего собранного (инвентаризации словарей/плоскостей/конституции + живые прогоны этой сессии).
Принцип: НЕ ломать построенное — дополнять. Каждый пробел ниже ложится на УЖЕ существующий узел.

---

## 1. Что у нас ЕСТЬ (полная опись)

**Конституция (L1–L10)** — enforced guard-тестами: один Gemini-ридер · один codex `packages/knowledge` ·
DeepSeek prose-only/зависимый · rawCyrillic неизменен · C3 единственный писатель finalValue · никогда не
гадать критичное · controlling-Latin выше транслита · скрипт-как-на-странице · один источник обучения
всех AI (docReadingRules) · flag-gated/byte-identical/owner-flip.

**Словари (все учтены, guard-леджер):** KMU-55 + RU-транслит · patronymic-движок (валидация live;
реконструкция за OFF-флагом) · gazetteer: 458 городов + **17 417 сёл** + **рукописная confusion-таблица
(18 пар: Т↔П, И↔Н...)** — live для мест · registry 55 (authority/civil, live через evaluateAuthoritySignal)
· docNumberFormats (live-сигнал) · MRZ (+TD1 keep-alive) · civil_registry_terms/TPS-requirements (RESERVED)
· **словаря ИМЁН НЕТ — никогда не коммитился**.

**Конструкция (мост One Brain v2, всё CI-verified, флаги OFF):** одна дверь `recognizeDocument`
(+retryOnEmpty) → ридеры (Gemini primary / GPT-печатный / **crop-route: HTR-слот + LLM-транспорт**) →
evidence до UI-кропа → KnowledgeEvaluator-СИГНАЛЫ → **Decision Engine** (извлечён, ≡C3, 3 живые
shadow-точки diffs=0) → C3 → review → адаптеры. TPS one-arbitration shadow-инструмент стоит. Мёртвые
плоскости снесены.

## 2. ПОЧЕМУ приложение (Claude Code / ChatGPT / Gemini app) работает, а наш пайплайн — нет

Дело НЕ в модели. Claude Code работает, потому что это **агентская архитектура**, а наш reader — **один выстрел**:

| Claude Code / приложения | Наш пайплайн сегодня |
|---|---|
| **ЦИКЛ**: смотрю → оцениваю → повторяю иначе → проверяю | ОДИН вызов full-page → строгий JSON → всё |
| **ИНСТРУМЕНТЫ**: я зову Read/Grep; app зумит, кропит, мультипроходит | Модель получает один жатый кадр (downscale!) без права «посмотреть ближе» |
| **ПАМЯТЬ/КОНТЕКСТ**: CLAUDE.md, memory, доки | Prompt+картинка; словари применяются ПОСЛЕ чтения, не помогают ЧИТАТЬ |
| **САМОПРОВЕРКА**: запускаю тесты, вижу diff | Ничто не перепроверяет чтение — только человек в review |
| **ОРКЕСТРАЦИЯ**: субагенты по ролям | Один reader; консенсуса нет (Vision 403, HTR без хоста) |

Живое доказательство этой сессии: full-page Gemini на рукописи = фабрикация; **тот же Gemini по
native-кропу («инструмент зума») = читает кириллицу**. Модель та же — архитектура другая.

## 3. Целевая логика: AGENTIC READING LOOP (из уже существующих узлов!)

```
recognizeDocument (УЖЕ оркестратор — доращиваем в агентский цикл)
 1 PLAN     classify/orient/quality              ← есть (CONTENT_ORIENT, quality-gate)
 2 READ     full-page primary read               ← есть
 3 ASSESS   per-field слабость: DecisionEngine + сигналы (docNumber/authority/gazetteer/
            confusion-dist) + confidence         ← ВСЁ есть, нет ЦИКЛА
 4 ZOOM     слабые поля → crop-route re-read     ← ПОСТРОЕН (LLM-транспорт сегодня, HTR при хосте)
 5 VERIFY   критик-проход: межполевая логика (дата↔возраст, пол↔отчество, чексуммы,
            скрипт-консистентность)              ← частично (dateRoleGuard, MRZ) — ДОСТРОИТЬ
 6 RECONCILE все кандидаты → ONE arbitration     ← есть
 7 ESCALATE честный review + evidence-crop       ← есть (crop в wizard построен)
```
**Недостающие 2 узла (код-solvable, дополняют, не ломают):**
- **A. ASSESS→ZOOM цикл** внутри recognizeDocument: после arbitration взять critical-поля со слабыми
  сигналами → прогнать через crop-route → кандидаты 2-го раунда → повторный арбитраж. Flag-gated.
- **B. VERIFY-критик**: детерминированный межполевой аудит (наши словари покрывают 80% проверок
  БЕЗ LLM) + опционально LLM-критик вторым взглядом. Сигналы monotonic-up.
- **C. Словари ВНУТРЬ чтения**: сейчас словари чинят ПОСЛЕ. Дать ридеру контекст ДО: в crop-prompt
  подмешивать допустимые варианты (пол→суффиксы отчеств; область→список раёнов; authority-словарь).
  L9 «teach every AI from one source» — расширение docReadingRules, механизм уже есть.

## 4. DeepSeek — «контролёр/страховка» (роль по владельцу, L3-совместимая)

DeepSeek не видит фото — значит его место в агентской системе = **текстовый критик и наблюдатель**
(как я «запускаю тесты» после правки). Четыре роли, от безопасной к гейтованной:

1. **Shadow-Watchdog (безопаснейшая, PII-free — включаемо сразу):** все наши shadow/метрики
   (`decision_shadow`, `tps_one_arbitration_shadow`, `deepseek_brain_contribution`, ADR018-маркеры)
   уже PII-free (ключи/счётчики). DeepSeek читает эти логи, агрегирует, «доносит»: аномалии,
   рост diffs, рост fabricated, деградация модели. Ровно «перепроверял/контролировал».
2. **Review-Explainer (PII-free):** коды причин (`critical_no_mrz_anchor`, `date_role_conflict`...)
   → человеческое объяснение (UK/RU/EN) для review-экрана. Кодов ~30 — генерация без полей.
3. **Consistency-Auditor (PII-gate, owner-флаг):** пост-арбитражный логический аудит ПОЛЕЙ
   (дата↔возраст, пол↔суффикс отчества, география существует, формат номера) → сигнал review,
   НИКОГДА значение (L3). Бóльшая часть — детерминирована нашими словарями; DeepSeek добавляет
   «здравый смысл» поверх. Только явный флаг: поля = PII.
4. **Rule-Miner (обучение системы):** из PII-free отчётов ошибок предлагает новые правила/записи
   словарей → человек ревьюит → в codex. Так DeepSeek «учится» нашим словарям и учит их: его
   контракты уже получают docReadingRules (L9) — расширить на registry-выдержки.

Так «разные модели» встают по способностям: **Gemini = глаза** (печать; кропы под review),
**HTR = глаза для курсива** (нужен хост), **GPT = запасные глаза печати**, **DeepSeek = внутренний
голос: логика, контроль, объяснения, обучение**, **словари = память**, **Decision Engine = воля**.

## 5. Очерёдность (дополняем, не ломаем; всё flag-gated + shadow + CI)

| # | Шаг | Использует существующее | Размер |
|---|---|---|---|
| 1 | DeepSeek Shadow-Watchdog (PII-free лог-аудит) | все shadow-маркеры уже стоят | S |
| 2 | ASSESS→ZOOM цикл в recognizeDocument | crop-route построен | M |
| 3 | Детерминированный VERIFY-критик (межполевой) | словари/dateRoleGuard/docNumber | M |
| 4 | Словари в crop-prompt (контекст ДО чтения) | docReadingRules-механизм L9 | S/M |
| 5 | Review-Explainer (DeepSeek, PII-free) | коды причин | S |
| 6 | Consistency-Auditor (owner PII-флаг) | Decision-сигналы | M |
| — | HTR-хост / staging shadow-окно / Gemini-пополнение / словарь имён | owner | — |

Правило неизменно: parity/shadow → CI → флип только по owner sign-off. Ничто из этого не трогает
уже работающие пути — только добавляет узлы в уже единый мозг.
