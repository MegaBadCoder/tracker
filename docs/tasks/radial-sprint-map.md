# Радиальная карта спринта

**Status:** executing
**Branch:** codex/radial-sprint-map
**Worktree:** /Users/v/projects/Alfy/.worktrees/radial-sprint-map
**Base:** 278625d (main)
**Mode:** hands-off
**Goal:** Пользователь обозревает большой спринт как радиальное дерево, раскрывает нужную ветку и видит задачи/готовность без вытянутой турнирной сетки. Useless if: подписи накладываются, обзор скрывает работу без раскрытия, зависимости проходят под карточками, поиск/collapse/fullscreen перестают работать.

## Context
- Пользователь считает растущую турнирную сетку неудобной и прямо просит радиальное отображение.
- Существующая карта уже имеет общий редактор, зависимости, сохранённые свёрнутые ветки и fullscreen; меняется визуальная проекция, не данные.

## Design
Спринт в центре, эпики на первом кольце, истории и задачи на следующих. Горизонтальные карточки сохраняют название, статус, готовность и действия. Угловые сектора пропорциональны числу видимых листьев; радиусы учитывают размеры карточек и угловые расстояния. Уровни детализации «Эпики / Истории / Задачи» дают быстрый обзор и раскрытие без потери данных. Новые scope начинают с обзора историй, сохранённые ветки сохраняются; поиск раскрывает путь и возвращает читаемый масштаб.

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
- SprintMapCanvas.vue, SprintMapNode.vue, use-sprint-map-viewport.ts, ProjectMapView.vue и связанные UI tests: потребить геометрию/bounds, уровни детализации, initial story overview, тексты, fullscreen и focus. README/CLAUDE/task: актуальное поведение и доказательства. Commit: feat(canvas): add radial sprint overview controls.

### Interfaces
- IF1 — layoutSprintMap(root,collapsed) -> {nodes:PositionedMapNode[],edges:MapEdge[],width,height}; PositionedMapNode и MapEdge сохраняют существующие поля; x/y — левый верхний угол горизонтальной карточки. Root center равен width/2,height/2; все карточки внутри padding. Сектора/радиусы — внутренние детали layout.
- IF2 — deriveSprintMapDependencies(input) сохраняет waiting, links, minX и добавляет bounds:{minX,minY,maxX,maxY}, включающие линии/порты/маркеры; при отсутствии путей bounds нулевые. Canvas объединяет layout bounds с bounds зависимостей; viewport.fit принимает optional x/y origin.

### Interface graph
- PH1 -> IF1 @ alfy-bot-frontend/src/features/projects/lib/sprint-map-layout.ts alfy-bot-frontend/tests/features/projects/lib/sprint-map-layout.spec.ts
- PH2 IF1 -> IF2 @ alfy-bot-frontend/src/features/projects/lib/sprint-map-dependencies.ts alfy-bot-frontend/src/features/projects/lib/sprint-map-dependency-routing.ts alfy-bot-frontend/tests/features/projects/lib/sprint-map-dependencies.spec.ts
- PH3 IF1, IF2 -> @ alfy-bot-frontend/src/features/projects/ui/SprintMapCanvas.vue alfy-bot-frontend/src/features/projects/ui/SprintMapNode.vue alfy-bot-frontend/src/features/projects/lib/use-sprint-map-viewport.ts alfy-bot-frontend/src/views/ProjectMapView.vue alfy-bot-frontend/tests/features/projects/ui/SprintMapCanvas.spec.ts alfy-bot-frontend/tests/views/ProjectMapView.spec.ts README.md CLAUDE.md alfy-bot-frontend/README.md docs/tasks/radial-sprint-map.md

## Conclusion
### Hands-off decisions
- udesign/uplan: радиальная раскладка и быстрые уровни детализации, новый scope по историям — прямое исправление жалобы на рост полотна, сохранённое раскрытие не теряется; план auto-approved.
- git-worktrees: отдельный codex/radial-sprint-map от main 278625d, собственный npm ci; локальный preview использует существующий изолированный dev API 3019, прод пока не изменяется.
