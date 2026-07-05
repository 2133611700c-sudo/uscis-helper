# RUNNER GUARD — AUDIT CLOSURE (2026-07-05)

STATUS: ALL_AUDITED_HOLES_CLOSED_AND_LIVE_PROVEN (эта ветка; main worktree — после merge)
HEAD: см. коммит этого файла

Закрытие дыр из аудита «что защищено / не защищено» (тот же день). Каждый пункт имеет
живое срабатывание, не только код.

## Дыры аудита → статус

| # | Дыра | Фикс | Живое доказательство |
|---|---|---|---|
| 1 | mutex per-worktree → конкурентные safe-install из sibling worktrees | Machine-global lock `$HOME/.uscis-safe-install.lock` | 2-й конкурентный safe-install отказал; 1-й завершился чисто |
| 2 | `dev-doctor --heal` ставил под живым dev | heal останавливает dev целевого worktree → install → recheck → рестарт | стоп pid 5491+5518 → healthy → dev вернулся (pid 10717) |
| 3 | `pnpm install --ignore-scripts` обходил preinstall | `.pnpmfile.cjs` — 2-я точка enforcement (`--ignore-scripts` НЕ отключает pnpmfile) | refusals=1 при живом dev |
| 4 | `pnpm rebuild`/`prune` без lifecycle | тот же `.pnpmfile.cjs` (MUTATING-set) | `rebuild sharp` refusals=1 (до фикса — исполнялся) |
| 5 | `pnpm add/update/remove`, `--dir`, `-r` — UNVERIFIED | эмпирика: preinstall НА них бежит + pnpmfile дублирует | все 6 путей refusals=1, утечек нет (left-pad: 0 записей) |

## Найдено и исправлено ВО ВРЕМЯ закрытия (честные собственные ошибки)

- **False positive конкурент-детекта:** guard флагал zsh-обёртку агента (её cmdline цитирует
  «pnpm add …»). Фикс: shell-wrapper'ы (`zsh|bash|sh -c`) исключены — реальный установщик
  всегда виден как node/pnpm-процесс.
- **False positive deep-скана:** workspace-линки `@uscis-helper/* → packages/*` легитимно
  поднимаются на 4 уровня. Фикс: кандидаты ≥4 up-levels резолвятся; флаг только вне worktree.
- **Незаскоупленный pnpmfile-guard душил `pnpm exec/run`** (парализовал бы vitest при живом
  dev). Фикс: enforcement только на MUTATING-подкомандах, с argv-парсером (value-флаги
  `--dir/--filter/...`, префиксы `recursive/-r`). Доказано: exec vitest/tsc работают при
  живом dev, все мутирующие — отказывают.
- Регекс dev-процессов расширен: vitest watch (не `run`), tsx watch, playwright.

## Инвариант после закрытия

При живом dev-сервере или чужой установке НИ ОДИН путь мутации node_modules
(`install`, `add`, `update`, `remove`, `rebuild`, `prune`, `--dir`, `-r`,
`--ignore-scripts`) не исполняется; `exec`/`run`/`test`/`dev` работают всегда;
CI (`CI` env) и санкционированный `safe-install` проходят.
`.pnpmfile.cjs` меняет `pnpmfileChecksum` в lockfile — правка этого файла требует
локального `safe-install` (иначе frozen-CI честно упадёт с config mismatch).

## Остаточные риски (не закрываемы механикой этого слоя, задокументированы)

- `SAFE_INSTALL=1` — сознательный обход (социальный слой; задокументирован как запрет).
- `--ignore-pnpmfile` + `--ignore-scripts` одновременно — обход обеих точек (нет легитимной
  причины; тот же социальный слой).
- npm/yarn/bun напрямую ломают pnpm-layout самим фактом установки (guard бежит под npm,
  но layout-разрушение не предотвратимо изнутри pnpm).
- main worktree до merge ветки — без interlock (лечится из one-brain по пути).
- Не-install разрушители (rm -rf, полный диск) — ловятся постфактум dev-doctor'ом.

FINAL VERDICT: RUNNER_GUARD_HARDENED_ALL_AUDIT_HOLES_CLOSED · остаточное = социальный
слой + merge-gap, оба записаны.
