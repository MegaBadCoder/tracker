# Равномерное распределение веток

**Status:** reviewing
**Branch:** codex/balanced-mind-map
**Worktree:** /Users/v/projects/Alfy/.worktrees/balanced-mind-map
**Base:** 4cc35d0
**Mode:** hands-off
**Goal:** Большая mind map равномерно использует обе стороны без наложений и перестановки сторон при collapse. Useless if: баланс зависит от порядка эпиков, короткая сторона сжата в центре, прогресс или состав меняются.

## Design / Plan
Текущий greedy даёт17/13 для весов8,7,6,5,4 при возможных15/15. Найти ближайшее к половине распределение полных веток по числу листьев с детерминированным выбором, сохранив порядок внутри стороны и первую ветку справа. Использовать полное дерево для устойчивости collapse. Для видимых веток обеих сторон использовать общую высоту и равные интервалы между соседними ветками; одиночную ветку центрировать. Ветки не дробить между сторонами. API и формы не меняются.
Один этап: sprint-map-layout.ts, geometry specs, README/CLAUDE. TDD yes: точный баланс на неодинаковых ветках, равные верх/низ видимых сторон, прежние коллизии/детерминизм/collapse. Затем targeted tests/build/lint, реальный local preview и независимое ревью. План auto-approved по существующему hands-off.


## Verify
Result: passed. RED:2newtestsfailed/6passed on old greedy. GREEN:50targeted geometry/dependency/canvas/page tests; build/vue-tsc, ESLint, diff-check pass. CK1:8/7/6/5/4 now15/15; exact closest split compared against exhaustive partitions for uneven/indivisible examples. CK2: collapsed2vs3epics share top/bottom edges, isolatedbranch centered. Existing120task/unbalanced110task/collision/collapse/determinism tests pass.
Browser: real isolated API3019, new project540c43eb-d019-41fe-a377-534e23ac1221 with30tasks. DOM confirms15tasks on each side in expanded view; overview uses same top/bottom extents, progress12/30. Preview http://localhost:5192/tasks/project/540c43eb-d019-41fe-a377-534e23ac1221/map. Screenshot balanced-mind-map.png in session visualization directory. LocalAPI had stopped overnight; restarted its existing isolated WT/SQLite, no production access.
