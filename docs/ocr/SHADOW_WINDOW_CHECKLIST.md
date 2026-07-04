# SHADOW WINDOW — чеклист владельца (T1.1, один экран)

Цель: превратить shadow-инструменты в flip-доказательства. Ни один флип не происходит
автоматически — только твой sign-off по чистому отчёту.

## Шаг 1 — включить наблюдение на preview (5 мин)
Vercel → проект → Settings → Environment Variables → окружение **Preview** (ветка
`feat/one-brain-reader-result`):
```
ONE_BRAIN_DECISION_SHADOW=1
TPS_ONE_ARBITRATION_SHADOW=1
NORMALIZE_COLLAPSE_SHADOW=1
```
Всё остальное НЕ трогать. Эти три флага ничего не меняют в поведении — только пишут
keys/counts-маркеры в логи. Redeploy preview после установки.

## Шаг 2 — прогнать реальные документы (окно)
Через обычный wizard на preview-URL: минимум **10–20 документов** разных типов
(паспорт, booklet, свидетельство, i94/ead для TPS-пути). Твои реальные доки из qa-private —
идеально. Один-два дока = НЕ окно.

## Шаг 3 — снять логи
```
vercel logs <preview-deployment-url> > window.log
```
(или Dashboard → Deployment → Functions → Logs → скопировать в файл)

## Шаг 4 — отчёт вердиктов (локально, 10 сек)
```
cd apps/web && node scripts/shadow-window-report.mjs window.log
```
Скрипт печатает 4 вердикта: decision / gates / arbitration / normalize —
✅ clean или ⛔ BLOCKED с цифрами. Логика — тот же Watchdog-агрегатор, что в CI.

## Шаг 5 — решение
- Все ✅ на окне ≥10 доков → твой sign-off → флипаем ПО ОДНОМУ флагу в порядке
  `docs/ocr/FLIP_CRITERIA.md`, маркеры оставляем включёнными ещё на окно ПОСЛЕ флипа.
- Любой ⛔ → флип запрещён; diff-ключи из отчёта = мой следующий баг для разбора.

Ничего из этого не касается production (main) — только preview этой ветки.
