# DOWNLOADED UKRAINIAN MODEL — CAPABILITY BENCH (2026-07-05)

HEAD: f7c8d21
WORKTREE: clean (bench script lives in gitignored qa-private/htr-poc/bench_downloaded_ukr_model.py)
MODEL_NAME: cyrillic-trocr/trocr-ukrainian-handwritten
MODEL_PATH: ~/models/trocr-ukrainian-handwritten (local copy; also in HF cache)
MODEL_FORMAT: transformers / safetensors (1.34 GB)
MODEL_TYPE: OCR_HTR — VisionEncoderDecoderModel (ViT encoder + TrOCR decoder, vocab 50265)
HASH: model.safetensors sha256[:16] = cad9e6b333295e43
INVOCATION: transformers TrOCRProcessor + VisionEncoderDecoderModel.generate on an image LINE CROP
VISION_SUPPORTED: YES — image-crop input ONLY. NOT a chat/text LLM: разделы «Привіт → ТАК»,
  грамматика, объяснения полей — NOT_SUPPORTED_BY_MODEL_TYPE (нет текстового входа/диалога).

TEXT_UKRAINIAN_SCORE: N/A (not a text model)
SCRIPT_INTEGRITY_SCORE: N/A (не анализирует текст — только генерирует его с кропа)
DOCUMENT_TEXT_SCORE: N/A
REFUSAL_TO_GUESS_SCORE: **0/3 — на ПУСТОМ кропе фабрикует все 3 раза** (TrOCR не умеет abstain)

## HANDWRITING BENCH (единственный релевантный) — 2 руки × 3 поля × 3 прогона, frozen boxes, GT владельца
| Рука | Поле | Вердикт ×3 | CER | WER | latency |
|---|---|---|---|---|---|
| A (birth, RU-запись) | family_name | WRONG стабильно | **1.20** (дописывает лишнее) | 3.00 | ~6.5s |
| A | given_name | WRONG стабильно | 0.67 | 1.00 | ~3.5s |
| A | patronymic | WRONG стабильно | 0.89 | 1.00 | ~3.0s |
| B (military, UA-курсив) | family_name | WRONG стабильно | 0.82 | 4.00 | ~5.0s |
| B | given_name | WRONG стабильно | 0.83 | 2.00 | ~2.7s |
| B | patronymic | WRONG стабильно | 0.50 | 1.00 | ~2.9s |

HANDWRITING_SCORE: **0/6 полей EXACT или PARTIAL; 6/6 WRONG, идеально стабильные (greedy decode) — стабильная ошибка, consensus её не поймает**
CER: 0.50–1.20 · WER: 1.00–4.00 · FABRICATIONS: 3 события cer>1.0 + 3/3 на blank · LATENCY: 2.6–6.7s/crop (CPU)

Контраст с соседями на ТЕХ ЖЕ кропах: RU-модель raxtemur/trocr-base-ru — рука A **9/9 EXACT** (sidecar, mps, ~1.5s), рука B 0/3; gemini-2.5-pro full-page — рука B имена EXACT×6, рука A слабый.
«Украинская» модель хуже обеих на ОБЕИХ руках, включая украинский курсив, под который она названа.

WHERE_MODEL_IS_STRONG: нигде на наших реальных документах. Детерминированность вывода — единственное «достоинство», и оно же опасность (стабильная фабрикация).
WHERE_MODEL_IS_WEAK: обе руки; blank-abstention отсутствует; медленнее RU-собрата в ~2-4 раза на CPU.
BEST_PROJECT_ROLE: кандидат-БАЗА для fine-tune на нашем GT-корпусе UA-курсива (H3) — как тренируемый артефакт, НЕ как inference-читатель. Больше ролей нет: чат/критик/переводчик/валидатор невозможны по типу модели.
FORBIDDEN_ROLE: reader (любой), production anything, источник кандидатов даже в shadow (стабильная фабрикация + no-abstain).

WHAT_IS_PROVEN: тип модели (OCR_HTR, image-only); 0/6 на обеих руках на frozen-кропах с owner-GT; фабрикация на blank 3/3; полная стабильность ошибок; локальность (PII не покидала Mac).
WHAT_IS_NOT_PROVEN: поведение после fine-tune на UA-корпусе (может стать полезной — это гипотеза H3-этапа, не сегодняшний факт); page-level чтение (не тестировалось — модель line-level).

FINAL_VERDICT: **DOWNLOADED_UKRAINIAN_MODEL_NOT_USEFUL (as-is) + UNSAFE_GUESSING (no-abstain, стабильная фабрикация). Единственный допустимый путь — fine-tune-база для H3-корпуса.**
