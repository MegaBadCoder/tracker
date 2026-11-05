# Турнирная карта спринта

**Status:** reviewing
**Branch:** codex/release-canvas
**Worktree:** /Users/v/projects/Alfy/.worktrees/release-canvas
**Base:** 7b43e36 (codex/issue-pages; зависимость от общих редакторов и страниц)
**Mode:** hands-off
**Goal:** Пользователь видит на масштабируемом полотне задачи выбранного спринта в их историях и эпиках, разбивает работу на дочерние элементы и понимает завершённость веток в этом спринте. Useless if: подписи перекрываются, узлы теряются при сворачивании, прогресс смешивает работу разных спринтов или завершённость задач подменяет статус истории/выпуск релиза.

## Context
- Пользователь выбрал турнирную сетку на Canvas, сворачивание каждого составного узла и обзор готовности «как на чемпионате»; пользователь согласовал начало реализации.
- Пользователь уточнил: сетка формируется из спринта. `sprintTasks` уже отбирает задачи по проекту и спринту; доска дополнительно учитывает назначенные пустые истории.
- `BoardGroup` содержит epic→story; задачи могут принадлежать истории, непосредственно эпику или не иметь группы.
- `releaseId` назначается историям и задачам независимо; у эпика собственного релиза нет. Один эпик и даже история могут содержать задачи разных релизов.
- Истории имеют собственные workflow-статусы, блокировку и зависимости; состояние released у релиза отдельно от готовности задач.
- В ветке есть общие редакторы страницы/preview и постоянные ссылки на task/group.

## Design
Отдельная вкладка карты в agile-проекте. Выбор спринта, по умолчанию активного; масштабирование и перемещение по полотну, раскрытие веток до нужного уровня. Узел содержит название, тип, фактический статус и счётчик готовности в выбранном спринте. Свёрнутая ветка сохраняет сводку и число скрытых потомков. Поиск раскрывает путь к найденному узлу. Кнопка добавления создаёт дочерний элемент, быстрый просмотр использует существующий редактор; ссылка открывает полноценную страницу. Предложение: новая задача явно получает выбранный спринт; пустая новая история также назначается в него.

Выбрана турнирная раскладка: задачи слева сходятся в истории, далее эпики. Финальный узел справа — выбранный спринт; релизы отображаются метками задач и историй. Карточки расположены по уровням, связи показывают группировку, не порядок выполнения. У родителя может быть любое число дочерних элементов; фиктивные пары участников не создаются. Родитель выравнивается относительно видимых дочерних веток. Сворачивание уплотняет ветку, сохраняя выбранный узел в поле зрения.

Состав карты: задачи выбранного спринта и их родительские истории/эпики, плюс истории, явно назначенные в спринт, даже если они пусты. Прогресс ветки считается только по задачам этого спринта; пометка «есть задачи вне спринта» отличает частичное участие истории. Задачи непосредственно в эпике, без группы и без релиза остаются доступными. Смена раскладки и сворачивание не изменяют данные.

### Invariants
- IV1 — задача считается один раз в прогрессе выбранного спринта; фильтры, масштаб и collapse не меняют итог.
- IV2 — готовность потомков, workflow-статус истории и факт выпуска релиза различимы.
- IV3 — сворачивание/навигация не перемещают и не удаляют элементы; скрытые ветви доступны для раскрытия и поиска.
- IV4 — пустые назначенные истории, задачи без истории/эпика и работа без релиза не исчезают.
- IV5 — редактирование использует реальные сущности и общие редакторы, без копий задач ради визуальных узлов.

### Principles
- PC1 — устойчивое расположение и читаемость названий важнее декоративной симметрии.
- PC2 — кнопка сворачивания, выбор узла и редактирование имеют разные понятные действия.

### Scope
Добавление из карты доступно для активных/плановых спринтов; закрытые открываются без кнопок создания. Быстрый просмотр использует ограничения существующих редакторов. Перенос родителей выполняется существующим редактором, drag-reparent на полотне не входит в эту задачу. Для нового эпика форма также запрашивает первую историю, чтобы ветка имела назначение спринта. Частично успешное создание сохраняет идентификаторы для повтора без дублей и явно сообщает оставшийся шаг.
TDD: yes для проекции/раскладки и сценариев сохранения/загрузки; визуальное качество проверяется браузером.

## Plan
Approach: собственная детерминированная раскладка дерева, SVG-связи и доступные HTML-карточки в масштабируемом полотне; существующие Vue/store/API, без новой зависимости и изменений backend.

### PH1 — Проекция и раскладка
- Новые src/features/projects/lib/sprint-map.ts и sprint-map-layout.ts: типы, buildSprintMap, flattenSprintMap, layoutSprintMap. Срез одного project/sprint, empty assigned stories, прямые задачи эпика/без группы, own statuses, progress, outside count. Layout tasks→stories→epics→sprint, collapse без изменения totals. IV1–IV4.
- Tests features/projects/lib/sprint-map.spec.ts и sprint-map-layout.spec.ts: RED→GREEN scope, mixed tasks, empty groups, no overlap, stable order, collapse.
- Commit: feat(canvas): project sprint work into a tournament tree.

### PH2 — Полотно
- Новые ui/SprintMapCanvas.vue, ui/SprintMapNode.vue, lib/use-sprint-map-viewport.ts; props root:SprintMapNode, projectId:string, readonly:boolean; emits openNode(node), addChild(node). Панорама, zoom anchor, fit, focus, поиск с раскрытием пути, localStorage collapse per project/sprint, keyboard; отчётливые статусы/число скрытых элементов. IV2–IV5.
- Tests ui/SprintMapCanvas.spec.ts: search раскрывает, collapse persistence, scoped keys, actions, readonly. SVG orthogonal paths behind horizontal cards, theme tokens, mobile toolbar, reduced motion.
- Commit: feat(canvas): add interactive tournament sprint map.

### PH3 — Страница и создание
- Новый views/ProjectMapView.vue: атомарно применять project/groups/tasks snapshot/sprints/releases/columns/workflow только после актуальности request; errors/retry/missing, sprint query selection, scope reset. Existing quick-preview opener и TaskDetailDialog, real page links. IV1–IV5.
- Новые lib/use-sprint-map-create.ts и ui/SprintMapCreateDialog.vue: task/story/epic+firststory, explicit selected sprint, released release handling, resumable partial failures, no duplicated creations.
- router/index.ts + ui/ProjectTabs.vue: /tasks/project/:projectId/map name tasks-project-map; tests views/ProjectMapView.spec.ts, lib/use-sprint-map-create.spec.ts, tabs/router coverage.
- README/CLAUDE/task: контракт карты, browser smoke, full frontend checks, independent review.
- Commit: feat(projects): connect sprint map navigation and creation.

### Interfaces
- IF1 — sprint-map.ts exports SprintMapNode { key:string, kind:'sprint'|'epic'|'story'|'task'|'ungrouped', sourceId:string|null, title:string, statusLabel:string, statusCategory:string, statusColor:string|null, done:number, total:number, outsideCount:number, blockedReason:string|null, releases:Pick<Release,'id'|'name'|'status'>[], children:SprintMapNode[] }. Keys kind:id; sourceId persisted entity ID, ungrouped null. buildSprintMap(input:{projectId:string,sprint:Sprint,groups:BoardGroupNode[],tasks:Task[],columns:ProjectColumn[],workflow:StoryWorkflowStatus[],releases:Release[]}):SprintMapNode; flattenSprintMap(root):SprintMapNode[].
- IF2 — sprint-map-layout.ts exports layoutSprintMap(root:SprintMapNode,collapsed:ReadonlySet<string>):{nodes:PositionedMapNode[],edges:MapEdge[],width:number,height:number}; PositionedMapNode {node:SprintMapNode,x:number,y:number,width:number,height:number}; MapEdge {from:string,to:string,path:string}. Shared MAP_NODE_WIDTH=264, MAP_NODE_HEIGHT=156, MAP_COLUMN_GAP=96, MAP_ROW_GAP=32, MAP_PADDING=48. Columns task0/story1/epic|ungrouped2/sprint3. Edges child-right→parent-left.
- IF3 — SprintMapCanvas.vue props {root:SprintMapNode,projectId:string,readonly:boolean}, emits {openNode:[node:SprintMapNode],addChild:[node:SprintMapNode]}. Canvas owns collapse/search/viewport, page owns mutation/loading. Node add allowed story→task, epic→story, sprint→epic+firststory; ungrouped no add.

### Interface graph
- PH1 -> IF1, IF2 @ alfy-bot-frontend/src/features/projects/lib/sprint-map.ts alfy-bot-frontend/src/features/projects/lib/sprint-map-layout.ts alfy-bot-frontend/tests/features/projects/lib/sprint-map.spec.ts alfy-bot-frontend/tests/features/projects/lib/sprint-map-layout.spec.ts
- PH2 IF1, IF2 -> IF3 @ alfy-bot-frontend/src/features/projects/ui/SprintMapCanvas.vue alfy-bot-frontend/src/features/projects/ui/SprintMapNode.vue alfy-bot-frontend/src/features/projects/lib/use-sprint-map-viewport.ts alfy-bot-frontend/tests/features/projects/ui/SprintMapCanvas.spec.ts
- PH3 IF1, IF3 -> @ alfy-bot-frontend/src/views/ProjectMapView.vue alfy-bot-frontend/src/features/projects/lib/use-sprint-map-create.ts alfy-bot-frontend/src/features/projects/ui/SprintMapCreateDialog.vue alfy-bot-frontend/src/router/index.ts alfy-bot-frontend/src/features/projects/ui/ProjectTabs.vue alfy-bot-frontend/tests/views/ProjectMapView.spec.ts alfy-bot-frontend/tests/features/projects/lib/use-sprint-map-create.spec.ts alfy-bot-frontend/tests/router/ alfy-bot-frontend/tests/features/projects/ui/ProjectTabs.spec.ts README.md CLAUDE.md docs/tasks/release-canvas.md

### Risks / rollback
- RK1 — shared stores swallow some errors: page loads raw responses and clean task snapshot; tests stale replies and retry.
- RK2 — story creation and sprint assignment are separate requests: retry reuses created IDs; cancellation informs where partially created objects remain.
- RK3 — large tree becomes tiny in fit view: initial useful zoom, focus/search, collapsible levels; no lossy filtering of completed tasks.

## Conclusion
### Hands-off decisions
- udesign: «приступай» approves sprint as final node; existing autoapproval continues after design.
- uplan: plan auto-approved; PH1/PH2 parallel implementers, PH3 controller; no changes to production.
- frontend-design: use Alfy theme/body typography, distinctive feature is rightward tournament convergence, understated progress rails and status badges. No decorative new brand styles.
- ureview: fixed IV2 release-state loss — IF1 now preserves release id/name/status; cards distinguish planned and released independently of task progress.
- ureview: fixed large-map clipping — fit derives its minimum zoom from actual bounds; later zoom steps remain continuous.

## Verify

Result: passed

- CK1 (IV1, IV4) — смешанные спринты, пустые истории, прямые задачи эпика и потерянная группа — held: projection/layout suites; в браузере активный спринт 1/4, плановый 0/1, пустые истории видны.
- CK2 (IV2) — прогресс подменяет статус истории — held: «В работе» остаётся отдельным статусом при 1/3 задач; релиз отображается меткой.
- CK3 (IV3) — collapse теряет задачи или влияет на счётчик — held: поиск раскрыл свёрнутую историю до выполненной задачи; после reload эпик сохранил collapse и «Скрыто: 2».
- CK4 — частичный отказ создаёт дубликаты — held: use-sprint-map-create tests с отказом создания истории и назначения спринта; повтор использует сохранённые ID. Неполная форма и повторный submit не отправляются.
- CK5 — старый ответ/ошибка загрузки подменяет новый проект — held: ProjectMapView tests stale response, unmount, atomic failure/retry, missing sprint, closed sprint.
- CK6 (IF1–IF3) — UI и модель расходятся — held: vue-tsc, targeted ESLint, 147 suites / 1128 tests, production build.
- CK7 (IV5) — создание не доходит до API или меняет другой спринт — held: браузер создал задачу, эпик с первой историей и вторую историю; reload сохранил плановый спринт и структуру. Preview задачи и переход на отдельную страницу работают.
- CK8 (PC1, PC2) — узкий экран перекрывает управление — held: 390×844, body.scrollWidth=390, панель в две строки; screenshot sprint-map-mobile.png. Пустой поиск показывает «Ничего не найдено», zoom и стрелка изменяют transform.

Smoke: IAB + local frontend 5189 + real local API 3018; project e1e89400-cd7f-4725-a42e-e6aca914858f. User preview 5188 preserved. No production changes.
Notes: baseline 34 tests passed. PH1 12 tests and creation 5 tests observed RED→GREEN; page tests observed RED→GREEN. First navigation test fixture returned a sprint of the wrong project; fixed fixture, no product workaround. Canvas border currentColor found in browser and replaced with border-border.

Review re-verification: CK2 broke for released vs planned labels; regression reproduced identical trees, then passed after preserving release state. CK9 — «Вся карта» on 100 tasks broke (1509 px in a 600 px viewport); regression now fits all bounds and preserves a 1.2× zoom step. UI regression distinguishes «Запланирован: Демо» and «Выпущен: Демо» with unchanged task progress.
