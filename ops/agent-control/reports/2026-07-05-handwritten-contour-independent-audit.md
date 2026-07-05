# НЕЗАВИСИМЫЙ АУДИТ — план «контур рукописной кириллицы» vs repo-truth (2026-07-05)

HEAD на момент аудита: bf58f99 · worktree: см. коммит аудита. Метод: каждый блок плана
проверен против кода/отчётов/замеров, не пересказан.

## Вердикт одной строкой
План архитектурно ВЕРЕН и на ~60% уже реализован кодом (что сам план не знает);
две жёсткие правды: (1) его собственное правило №6 «не считать дубликаты» нарушалось
нашим же бенчем до этого аудита; (2) планка Phase A «36+ полей / 3 руки» НЕДОСТИЖИМА
без заполнения владельцем marriage-GT — это единственный настоящий блокер фазы.

## FINDINGS

### F1 [HIGH, ИСПРАВЛЕН ЭТИМ КОММИТОМ] Дубликат надувал батарею
`gt-pipeline-bench` манифест содержал ОБЕ birth-строки, а файлы байт-идентичны (sha256
совпадает). TIER-1 замер «64.7% N=34» двойным счётом включал 10 полей одного документа.
Честная переоценка того прогона БЕЗ дубля: N=24 уникальных полей, OVERALL ≈ 75%
(passport 7/8, I-94 6/6, military 3/5, birth 2/5, EAD 2/5) — «улучшение» здесь артефакт
пересчёта (дубль тянул вниз), число всё равно EXPLORATORY. Строка дубля отключена в
манифесте с причиной.

### F2 [HIGH, ВЛАДЕЛЕЦ] Планка Phase A недостижима текущими данными
Заполненный кириллический рукописный GT: рука A = 5 полей (qa-private) + ~4 (test-fixtures:
родители/место), рука B = 5, **руки C+ = 0** (marriage×4 + military_p2 — пустые шаблоны).
Итого ≈14 уникальных полей / 2 руки против требуемых 36+/3. Ведомость на 8 документов
готова (OWNER_FILL_REQUIRED.md, docs 4-8); ~15 минут владельца = Phase A разблокирована.
Все альтернативы (модельный draft-GT) запрещены no-guessing законом — GT только от человека.

### F3 [MEDIUM] Правило «blank crop produces text → cannot auto-candidate» бьёт и по raxtemur
План формулирует gate для UA TrOCR, но raxtemur ТОЖЕ не умеет abstain (ADR-026,
подтверждено). Следствие: НИ ОДИН текущий HTR не может быть auto-candidate без
blank-guard'а в обвязке (детект пустого кропа ДО модели — ink-density порог). Сегодня это
не дыра (рукопись всегда review), но при Phase B стратегия «agreement strengthens» обязана
включать blank-guard, иначе два фабрикатора могут «согласиться» на пустом поле.

### F4 [LOW] Цель «reader usefulness 60-70% exact on clean manual crops» уже превышена рукой A
raxtemur на замороженных manual-кропах руки A = 9/9 EXACT (100%). Цель должна быть
per-hand, иначе рука A маскирует провал руки B (0/3) в среднем.

## ЧТО ИЗ ПЛАНА УЖЕ ПОСТРОЕНО (план это не учитывает — не строить заново)
| Пункт плана | Уже есть в repo | Класс |
|---|---|---|
| §2 контур: два reader'а → arbitration shadow | handwritingEnsembleShadow + [handwriting_ensemble_shadow] маркер (third-signature live) | SHADOW_ONLY |
| §2 «модель не пишет final/Latin/не снимает review» | C3-единственный писатель + KMU-55 детерминирован (TRANSLITERATION_PASS) + L6 (после фикса консенсус-дубля) | LIVE/guarded |
| §4 fabrication_on_blank_crop | замерено: UA TrOCR 3/3, gemma 0/9 качели; blank-battery (task #42) существовала | measured |
| §4 latin_from_model_rate=0 | L8-гейт + transliteration suites 1988/0 | guarded |
| §7 step 7 «Decision Engine: disagreement/asymmetry signals» | linguisticCritic (пары+одиночки) + conflict_signals в маркере | SHADOW_ONLY |
| §5 Phase C harness-элементы | test-orient-detect.mjs + EXIF-оракул (6/6/3) + upright A/B замер | partial |
| §5 UA TrOCR historical baseline | DOWNLOADED_UKRAINIAN_MODEL_CAPABILITY_BENCH.md (0/6, blank 3/3) | measured |

## ЧЕГО НЕТ (честный дефицит)
1. Единого HANDWRITTEN_CYRILLIC_BENCH.md с per-reader × per-hand таблицей всех метрик §4
   (данные разбросаны по 4 отчётам) — собирается ПОСЛЕ F2.
2. Orientation-матрицы §Phase C (manual/EXIF/stripped × 0/90/180/270 × frozen/detected/full-page)
   как одного харнесса — элементы есть, матрицы нет.
3. Blank-guard'а перед HTR (F3) — не построен.
4. Метрик reader_agreement_rate/wrong_auto_accept_rate как автоматических счётчиков окна —
   ensemble-маркер их несёт, агрегатор Watchdog считает частично.

## ПОРЯДОК (подтверждаю приоритет плана с одной поправкой)
GT-ведомость (владелец, F2) → Phase A bench (я, 1 заход после GT) → Phase C orientation-матрица
(я, параллельно можно НАЧАТЬ уже сейчас — она не ждёт GT: EXIF-оракул есть) → Phase B стратегия
по цифрам → Phase D kill-test UA TrOCR только при CER-гипотезе. Vision billing остаётся
НЕЗАВИСИМОЙ веткой (TPS-окно/evidence) — план прав, что это не пререквизит рукописи.

## Hard-gates плана — статус соблюдения СЕГОДНЯ
- review 100% на рукописи: ✅ (после удаления консенсус-дубля из env)
- wrong_auto_accept: 0 наблюдений ✅ · latin_from_model: 0 ✅ (guarded)
- blank→text: ЗАФИКСИРОВАН у обоих HTR → auto-candidate запрещён обоим до blank-guard (F3)
- PII leak: 0 (guard clean 2007 файлов; 3 инцидента за сутки пойманы guard'ами ДО merge)
