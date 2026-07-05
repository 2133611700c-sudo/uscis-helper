# RUNNER GUARD — AUDIT CLOSURE (2026-07-05)

STATUS: v2 — RUNNER_GUARD_HARDENED_AND_ADVERSARIALLY_REVERIFIED (эта ветка; main — после merge)
> v1 этого отчёта ПЕРЕОЦЕНИВАЛ закрытие (вердикт ALL_..._CLOSED вынесен до независимого
> adversarial-аудита). Аудит нашёл: (H1) allowlist в package.json НЕ доказан действующим
> (pnpm 11 игнорирует поле; `config get` = undefined) и (H2) обход `.pnpmfile` через
> `--workspace-root` (парсер ел подкоманду). Оба закрыты в v2, см. ниже.
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

## v2 — закрытие находок независимого adversarial-аудита (2026-07-05, же день)

| Находка | Фикс | Живое доказательство |
|---|---|---|
| H1 allowlist недоказан (pnpm 11 игнорирует package.json.pnpm; config get = undefined) | Список перенесён в `pnpm-workspace.yaml` — единственное место, читаемое и pnpm 10, и 11; поле из package.json УДАЛЕНО (одна правда); pin `packageManager: pnpm@10.33.2` уже стоял | `pnpm config get onlyBuiltDependencies` теперь возвращает все 7; чистый install без ignored-builds warning; sharp loads |
| H2 `--workspace-root` обходил pnpmfile (флаг ошибочно value-taking → sub='') | Флаг булевый; + fail-closed: непарсабельная pnpm-команда ⇒ enforce; + enforcement только когда процесс = pnpm (иначе require() из vitest сам триггерил guard — поймано и исправлено) | Батарея: все 4 `--workspace-root`-варианта REFUSED |
| Контракт без тестов | `pnpmfileGuard.guard.test.ts` (7 тестов: обходы, value-флаги, recursive, fail-closed, exec-паралич-регрессия) — в CI | 7/7 |
| Нет воспроизводимой adversarial-проверки | `scripts/runner-guard-battery.sh` — таблица 13 mutate-путей + 4 benign + leak-check (локальный, требует живой dev) | **18/18: все mutate REFUSED, все benign WORK, утечек 0** |

Heuristic-природа ps/lsof-детекта и лимиты symlink-скана (head-окна) — признаны и
ОСТАЮТСЯ: это детект-слой поверх двух enforcement-точек, не замена им; fail-open там
намеренный (guard не должен сам ломать установку).

FINAL VERDICT: RUNNER_GUARD_HARDENED_AND_ADVERSARIALLY_REVERIFIED — 18/18 батарея,
7/7 контракт-тестов в CI, allowlist доказан действующим; остаточное = социальный слой
(SAFE_INSTALL=1 / --ignore-pnpmfile), эвристика ps/lsof, merge-gap main — все записаны.
