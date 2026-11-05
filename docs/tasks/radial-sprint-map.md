# Радиальная карта спринта

**Status:** reviewing
**Branch:** codex/radial-sprint-map
**Worktree:** /Users/v/projects/Alfy/.worktrees/radial-sprint-map
**Base:** 278625d (main)
**Mode:** hands-off
**Goal:** Пользователь обозревает большой спринт как радиальное дерево, раскрывает нужную ветку и видит задачи/готовность без вытянутой турнирной сетки. Useless if: подписи накладываются, обзор скрывает работу без раскрытия, зависимости проходят под карточками, поиск/collapse/fullscreen перестают работать.

## Context
- Пользователь считает растущую турнирную сетку неудобной и прямо просит радиальное отображение.
- Существующая карта уже имеет общий редактор, зависимости, сохранённые свёрнутые ветки и fullscreen; меняется визуальная проекция, не данные.

## Design
Спринт в центре, эпики на первом кольце, истории и задачи на следующих. Горизонтальные карточки сохраняют название, статус, готовность и действия. Угловые сектора пропорциональны числу видимых листьев; радиусы учитывают размеры карточек и угловые расстояния. Уровни детализации «Эпики / Истории / Задачи» дают быстрый обзор и раскрытие без потери данных. Новые scope начинают с обзора эпиков, сохранённые ветки сохраняются; поиск раскрывает путь и возвращает читаемый масштаб.

Выбрана полноценная радиальная раскладка с адаптивными кольцами; простое вращение старой сетки сохраняет вытянутый размер. Свободное force-расположение потребовало бы нестабильных позиций и нового движка. Связи иерархии идут между краями карточек, зависимости сохраняют пунктир/наконечники и обходят видимые карточки. API, состав спринта и прогресс неизменны.
TDD: yes — детерминированная геометрия, отсутствие наложений, обход препятствий, детализация и поиск; качество проверяется в браузере на малом и большом спринте.

### Invariants
- IV1 — спринт в центре, глубина дерева растёт по радиусу, подписи горизонтальны, видимые карточки не перекрываются.
- IV2 — сворачивание/детализация/поиск не меняют состав или прогресс; скрытая работа раскрывается и доступна по ссылкам.
- IV3 — зависимости направлены, не проходят сквозь карточки, скрытые/внешние концы остаются доступны в панели.
- IV4 — fullscreen, preview, постоянные ссылки, создание, клавиатура и narrow viewport сохраняют работу.

## Plan
### PH1 — Радиальная геометрия
- features/projects/lib/sprint-map-layout.ts и tests/features/projects/lib/sprint-map-layout.spec.ts: заменить колонки кольцами, сектора по видимому дереву, адаптивный радиус, bounds, связи с краёв карточек. Проверить 0/1/100+ задач, несбалансированные ветви, collapse и детерминизм. Commit: feat(canvas): arrange sprint work in radial rings.
### PH2 — Маршруты зависимостей
- features/projects/lib/sprint-map-dependencies.ts, дополнительные routing helpers при необходимости, tests/features/projects/lib/sprint-map-dependencies.spec.ts: обработка произвольных x/y, обход всех видимых карточек и bounds всех направлений, включая loop collapsed endpoints и пересекающиеся связи. Commit: fix(canvas): route dependencies around radial nodes.
### PH3 — Обзор и интеграция
- SprintMapCanvas.vue, SprintMapNode.vue, use-sprint-map-viewport.ts, ProjectMapView.vue и связанные UI tests: потребить геометрию/bounds, уровни детализации, initial epic overview, тексты, fullscreen и focus. README/CLAUDE/task: актуальное поведение и доказательства. Commit: feat(canvas): add radial sprint overview controls.

### Interfaces
- IF1 — layoutSprintMap(root,collapsed) -> {nodes:PositionedMapNode[],edges:MapEdge[],width,height}; PositionedMapNode и MapEdge сохраняют существующие поля; x/y — левый верхний угол горизонтальной карточки. Root center равен width/2,height/2; все карточки внутри padding. Сектора/радиусы — внутренние детали layout.
- IF2 — deriveSprintMapDependencies(input) сохраняет waiting, links, minX и добавляет bounds:{minX,minY,maxX,maxY}, включающие линии/порты/маркеры; при отсутствии путей bounds нулевые. Canvas объединяет layout bounds с bounds зависимостей; viewport.fit принимает optional x/y origin.

### Interface graph
- PH1 -> IF1 @ alfy-bot-frontend/src/features/projects/lib/sprint-map-layout.ts alfy-bot-frontend/tests/features/projects/lib/sprint-map-layout.spec.ts
- PH2 IF1 -> IF2 @ alfy-bot-frontend/src/features/projects/lib/sprint-map-dependencies.ts alfy-bot-frontend/src/features/projects/lib/sprint-map-dependency-routing.ts alfy-bot-frontend/tests/features/projects/lib/sprint-map-dependencies.spec.ts
- PH3 IF1, IF2 -> @ alfy-bot-frontend/src/features/projects/ui/SprintMapCanvas.vue alfy-bot-frontend/src/features/projects/ui/SprintMapNode.vue alfy-bot-frontend/src/features/projects/lib/use-sprint-map-viewport.ts alfy-bot-frontend/src/views/ProjectMapView.vue alfy-bot-frontend/tests/features/projects/ui/SprintMapCanvas.spec.ts alfy-bot-frontend/tests/views/ProjectMapView.spec.ts README.md CLAUDE.md alfy-bot-frontend/README.md docs/tasks/radial-sprint-map.md

## Conclusion
### Hands-off decisions
- udesign/uplan: радиальная раскладка и быстрые уровни детализации, новый scope по эпикам — прямое исправление жалобы на рост полотна, сохранённое раскрытие не теряется; план auto-approved.
- git-worktrees: отдельный codex/radial-sprint-map от main 278625d, собственный npm ci; локальный preview использует существующий изолированный dev API 3019, прод пока не изменяется.


Design refinement from browser: 60 tasks / 12 stories at 1280×720 require 39% fit even with tasks hidden. Initial overview changed to epics; per-story/full-task controls and search retain detail. This fixes observed readability rather than selecting a numeric layout score. Baseline Canvas/Page 25 tests passed; new UI control tests observed RED before implementation.


## Verify
Result: passed
- CK1 (IV1) — all-pair card overlap on 120 tasks /151nodes, unbalanced110tasks, all32collapse combinations — held. Layout tests RED→GREEN; deterministic rings, rootcenter and padding preserved.
- CK2 (IV1/IF1) — wide single-branch hierarchy crosses center — broke on initial chord, reproduced task→story through sprint; fixed radial ports plus arcs in free inter-ring corridor. All sampled cubic segments clear other cards.
- CK3 (IF1) — sparse2tasks arc leaves canvas — broke, fixed bounds from cubic control-point hull per axis with symmetric shift; sparse2/3/5/24 paths and node bounds held.
- CK4 (IV3/IF2) — horizontal dependency leg or leftport crosses arbitrary card — broke with old tournament routing, fixed orthogonal obstacle routing and safe port selection; full-path samples, collapsed loops, input-order stability, 100tasks/5links pass. Bounds cover all directions with marker margin.
- CK5 (IV2/IV4) — initial overview hides inaccessible work or toggles change data — held: initial epics, sequential disclosure, detail levels, saved scope, hidden search/reveal/focus, unchanged root snapshot tests. Browser 60tasks/4epics/12stories retains20/60 progress.
- CK6 (IV4) — fullscreen/preview/mobile regress — held: browser search hidden Registration API task→preview, fullscreen all-task/all-links, collapsed real-name links and390×844 toolbar, fit/zoom; existing regression tests pass.

Commands: baseline25Canvas/Page passed. Full frontend152 suites/1190tests +build +scopedlint passed before final sparse-bounds regression; final52targeted tests and productionbuild pass after fix, vue-tsc clean. Final scoped lint and diff-check pass.
Smoke: local frontend5191 + existing isolated API3019/dev900106. Seed demo d156adb3-c3a0-4625-a477-321080b574bc contains60tasks/4epics/12stories/9dependencies. No production changes.

### Hands-off review repairs
- Confirmed center-crossing hierarchy and clipped sparse arcs; fixed at geometry source with RED regressions rather than masking behind cards.


Goal evidence: final desktop1280×720 epic overview at81% displays20/60 progress, mobile390×844 has pageWidth390 and search reveals hidden API task at readable scale. Screenshot /Users/v/.codex/visualizations/2026/11/04/01a1a794-bc60-7b13-a320-224d1cf0c89f/radial-sprint-map.png. Preview http://localhost:5191/tasks/project/d156adb3-c3a0-4625-a477-321080b574bc/map. Full-task fit is a structural overview; readable inspection uses branch disclosure, focus or search.


## Final conclusion
Outcome: radial overview achieved locally in 550f0f6/3649603/cb8cfbc. Independent review 278625d..cb8cfbc found no important/critical findings ≥80 confidence; probes covered300 irregular tree/collapse layouts and500dependency routes across50layouts without missing routes or card intersections. Browser review remains controller evidence rather than independent repetition.

IV1–IV4 held by geometry/regression tests and real60task browser smoke. Scope refinement: initial epics replace planned initial stories based39% unreadable story overview; sequential expansion preserves nested collapsed keys. All stages auto-approved; controller repaired center-crossing chords and sparse-arc bounds with RED regressions. Local preview5191 retained, no remote push/merge/deploy in this task. Temporary fixture/probe scripts removed; demo data remains only in ignored local API SQLite.

## Уточнение: ветви mind map

Пользователь явно выбрал «Влево и вправо, как mind map: эпик → истории → задачи, с разветвлениями как на скриншоте». Это заменяет кольцевую геометрию: спринт остаётся в центре, эпики распределяются между сторонами с балансом по полному размеру веток; потомки растут наружу своей стороны. У каждого родителя общий ортогональный ствол и отдельные ответвления. Сторона эпика стабильна при collapse. Уровни детализации, зависимости, поиск и сохранённые ветки остаются.

Plan (auto-approved): один этап — заменить layoutSprintMap и его geometry tests, выровнять актуальные UI тексты/документацию, проверить отсутствие наложений и пересечений линий/карточек, stability sides, bounds, общие стволы, затем browser smoke и независимое ревью. API/IF1/IF2 shapes сохраняются. База уточнения 5d80e02, та же изолированная WT.


Mind-map Verify: passed. New geometry tests RED (3failed/3passed) on radial implementation, GREEN after replacing it:47 layout/dependency/canvas/page tests; final17Canvas after label change, productionbuild/vue-tsc/scopedlint/diff-check pass. CK7 — left/right branches, common stems, outward descendants, fixed sides throughcollapse and unchangeddata — held. CK8 — 120tasks/151nodes, unbalanced110tasks and32collapse combinations: no card overlap or hierarchy segment crossing cards, centeredbounds and determinism — held. Browser60task demo confirms forked trunks both sides, dependencies on collapsednodes remainlisted, hidden search→RAD-3 preview works. Shared hierarchy stems render under group opacity to avoid darker repeated segments.
