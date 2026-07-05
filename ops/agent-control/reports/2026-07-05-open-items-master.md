# MASTER-СПИСОК НЕДОДЕЛАННОГО — все планы, один список (2026-07-05)

Собрано по: plan v3 (truth lock + Translation vertical), v2-лестница, H-лестница рукописи,
blueprint агентного мозга, 12-шаговый truth-план владельца, аудиты владельца, task-лист.
Классы — только словарь RUNTIME_TRUTH. «Кто» = чей рычаг блокирует.

## A. Plan v3 — Translation vertical (текущий главный)
| # | Что не доделано | Статус | Кто |
|---|---|---|---|
| A1 | Окно N≥25 на семейство доков (сейчас translation N=9/82, clean, GPT-reader) | PARTIAL | я (доки идут) + владелец (wizard-трафик на preview) |
| A2 | Primary-Gemini окно (всё сегодняшнее — через openai-override; Gemini штормило) | NOT RUN | я, когда Google стабилен |
| A3 | Флип 1: Decision Engine per-field-kind (`ONE_BRAIN_DECISION_FIELDS`) | BLOCKED на A1 + sign-off | владелец |
| A4 | Флип 2: gates-as-readers (review-state/render/generate-pdf → FieldDecision) | BLOCKED на A1 + sign-off | владелец |
| A5 | Флип 3: RECOGNIZE_RETRY_ON_EMPTY + УДАЛЕНИЕ legacy-fallback plane роута | BLOCKED на окно | владелец+я |
| A6 | Evidence-флип (`ONE_BRAIN_EVIDENCE_ENABLED`) после визуальной staging-проверки | FLAGGED, не проверен визуально | я могу локально СЕЙЧАС, staging — владелец |
| A7 | Exit T1: Translation vertical = LIVE одноплоскостной | после A1–A6 | — |

## B. T2/T3/T4 — остальные продукты
| # | Что | Статус | Кто |
|---|---|---|---|
| B1 | EAD: окно → флипы (репликация паттерна) | NOT STARTED (после T1) | — |
| B2 | ReParole: флип REPAROLE_CORE_USFORMS по чистому окну | FLAGGED, окна нет | после T1 |
| B3 | TPS-окно (arbitration+normalize маркеры) | **BLOCKED_EXTERNAL: Google Vision billing 403** (front-OCR TPS) | **владелец** |
| B4 | TPS collapse: 7 писателей по одному → READER_ADAPTER, ratchet сжать | NOT STARTED (последним, после B3-окна) | — |
| B5 | P8 шаг 2: route читает сигналы rule-pack, движок пишет | SHADOW_ONLY готов; флип за B3-окном | владелец |

## C. Рукопись (H-лестница) — главный продуктовый блокер
| # | Что | Статус | Кто |
|---|---|---|---|
| C1 | H3 = GT-корпус #36: 20–50 полей, ≥3 руки, разные кадрирования | **BLOCKED_BY_OWNER_DATA — фотосессия** | **владелец** (я готовлю разметку: Gemma-локально + GPT-подсказчик + твоё подтверждение) |
| C2 | H4 = localization hit-rate #70 (второго кадрирования НЕ существует; найден байт-дубль фикстуры) | UNMEASURED | владелец (те же фото) |
| C3 | Дедупликация фикстуры birth_cert_soviet_01 (= копия handwritten_01) | мелкая правка | я/Codex |
| C4 | H5: HTR shadow-режим в пайплайне (candidates, всегда review) | после C1/C2 | я |
| C5 | HTR prod-worker (Mac = лаборатория; прод = hosted VPS ~$10-20/мес) | решение+хост | владелец |
| C6 | UA-курсив: raxtemur читает руку A (RU) 9/9, руку B (UA) 0/3 — нужен UA-дообученный HTR или fine-tune на GT-корпусе | R&D после C1 | я |

## D. Blueprint агентного мозга
| # | Что | Статус | Кто |
|---|---|---|---|
| D1 | #6 Consistency-Auditor (DeepSeek видит агрегаты кросс-док противоречий) | требует owner PII-flag решения | владелец |
| D2 | DeepSeek key≠permission инверсия (TPS_AI_BRAIN_ENABLED строгий) | ждёт shadow-цифр (маркер есть, данных 0 из-за B3) + sign-off | владелец |

## E. Продукт/качество
| # | Что | Статус | Кто |
|---|---|---|---|
| E1 | #48: wizard error-state E2E + staging browser E2E (happy-path локально — PASSED) | PARTIAL | я |
| E2 | Review UI: рендер evidence-crop на review-экране (E2E с ONE_BRAIN_EVIDENCE_ENABLED=1) | НЕ доказан | **я — следующее действие** |
| E3 | Provider bbox → честный exact-evidence (node 9) | DARK + BLOCKED_EXTERNAL (Vision billing + wiring fieldOcrIds) | владелец → я |
| E4 | Wizard client-side сжатие >4.5MB фото (Vercel 413 на прямых аплоадах) — проверить в E1 | UNVERIFIED | я |
| E5 | Глубокий бенч новых моделей (3-flash-preview и т.п.) на printed-батарее | опционально, стоит денег | владелец решает |

## F. Security / ops
| # | Что | Статус | Кто |
|---|---|---|---|
| F1 | Ротация ДВУХ засвеченных в чате ключей (temp key3 + pay key) | **OWNER_SECURITY** | **владелец** |
| F2 | Google Vision billing (разблокирует B3, E3) | BLOCKED_EXTERNAL | **владелец** |
| F3 | Прод-решение: main деплоит эпоху запретной версии (HISTORICAL-запись) — merge ветки/redeploy | решение | владелец |
| F4 | pnpm-workspace.yaml дважды загрязнялся approve-builds-мусором — источник не найден | наблюдение | оба агента |
| F5 | Словарь украинских ИМЁН — файла никогда не существовало; имена = чистый KMU-55 | опционально | владелец даёт файл, я вайрю как сигнал |

## Сухой остаток
Код-solvable ПРЯМО СЕЙЧАС без владельца: **E2 (evidence-E2E локально), A2 (Gemini-окно при
затишье), E1-часть (error-state локально), C3 (дедуп фикстуры)**. Всё остальное упирается в
4 рычага владельца: **фотосессия GT · Vision billing · ротация ключей · sign-off'ы флипов**
(+ wizard-трафик на preview для честного N≥25).
