# Зависимости задач

**Status:** executing
**Branch:** codex/task-dependencies
**Worktree:** /Users/v/projects/Alfy/.worktrees/task-dependencies
**Base:** a323db8 (codex/release-canvas)
**Mode:** hands-off
**Goal:** Пользователь задаёт предшественников задачи в общем редакторе, видит ожидание и направленные связи на карте спринта, открывает предшественников и после их завершения видит снятие ожидания без автоматической смены статуса задачи. Useless if: цикл сохраняется, связи теряются после reload, чужие задачи доступны, стрелки путаются с иерархией, скрытые/внешние предшественники выглядят отсутствующими или прогресс спринта меняется из-за зависимостей.

## Context
- Пользователь одобрил поле «Зависит от», пунктирные стрелки, «Ждёт N задач», показ связей выбранной задачи/всех, защиту от циклов и другие спринты.
- TaskDetailContent используется страницей и preview; карта строит чистый срез project/sprint, умеет collapse/search/fullscreen.
- Истории уже имеют dependencyIds; задачи пока не имеют связей. SQLite доступ сериализуется через withSqliteAccess, схема создаётся synchronize при старте.

## Design
Зависимость A→B означает: B зависит от A. Отдельная таблица task_dependencies с FK на оба Task и каскадным удалением; команды замены предшественников валидируются и сохраняются в одной сериализованной транзакции. JSON-поле было бы короче, но потребовало бы очистки ссылок во всех путях удаления; отдельный endpoint с нормализованной таблицей сохраняет существующий Task API. Перестройка турнирного дерева в общий граф не нужна: зависимости идут отдельным слоем поверх существующей иерархии.

Общий редактор показывает выбранные зависимости, статус и ссылки, поиск по своим сохранённым задачам, явное сохранение/ошибку и удаление связи. Разрешены свои задачи из других спринтов и проектов; перенос задачи сохраняет связь. Связи относятся к конкретной сохранённой задаче; виртуальные повторения не редактируются, новые повторения не наследуют связи автоматически. Ожидание информационное: число незавершённых предшественников; выполнение/статус задачи не блокируются и не переключаются автоматически.

На карте отдельное действие выбора связей задачи; по умолчанию только выбранная задача, кнопка показывает все. Направление от предшественника к зависимой задаче обозначено наконечником и пунктиром. Свёрнутые задачи проецируют концы стрелок на видимого предка; список выбранной задачи сохраняет реальные названия, раскрывает скрытого предшественника или открывает внешний по постоянной ссылке. Внешние задачи не включаются в прогресс/дерево. Готовые связи визуально отличаются, подпись сообщает источник ожидания. Отсутствие графа из-за сетевой ошибки показывается как ошибка с повтором, не как отсутствие зависимостей.
TDD: yes — API ownership/atomicity/cycles/delete, derivation, store races, UI save/error and map visibility.

### Invariants
- IV1 — только реальные задачи одного пользователя; self, duplicate, missing/foreign IDs, прямые и транзитивные циклы отвергаются атомарно, включая конкурирующие записи.
- IV2 — GET не меняет данные; replace повторяем; удаление задачи удаляет обе стороны связей; перенос/завершение не стирают связи.
- IV3 — ожидание считается по текущему completed предшественников; зависимая задача не получает автоматический статус и её можно завершить вручную.
- IV4 — связи не влияют на иерархию и счётчики спринта; скрытые/внешние зависимости доступны и явно различимы.
- IV5 — страница и preview используют единый редактор и граф; ошибки сохранения не закрывают форму и не показывают ложный успех; старые ответы не затирают новые связи.

## Plan
Approach: additive graph REST API + shared Pinia graph store/editor + separate SVG overlay using existing layout. No new package.

### PH1 — Хранение и API
- alfy-bot/src/shared/entities/task-dependency.entity.ts (new), entities/index.ts, app.module.ts, test/helpers/test-app.ts: register FK-backed join entity with pair primary key; schema rebuild compatibility. Frozen isOverdue tasks reject dependency mutation consistently with existing TaskService.
- modules/task/domain/task-dependency.port.ts and task-dependency.ts (new), infrastructure/typeorm-task-dependency.repository.ts (new), task-dependency.service.ts, task-dependency.controller.ts, dto/set-task-dependencies.dto.ts (new), task.module.ts: IF1, owner checks, graph cycle validation and atomic replace in withSqliteAccess transaction. Separate controller avoids modifying legacy TaskService signatures.
- New domain/service/infrastructure specs and test/task-dependencies.e2e-spec.ts: RED→GREEN cycles, foreign/missing/self/duplicates, rollback, parallel A↔B, cascade, task completion unchanged, API-token/JWT access, restart schema with existing edges.
- Commit: feat(tasks): add atomic task dependency graph API.

### PH2 — Общий редактор
- Frontend new features/tasks/model/task-dependencies.ts, api/task-dependencies-api.ts, model/task-dependency-store.ts, ui/TaskDependencies.vue; TaskDetailContent.vue imports/renders it for persisted tasks. Own IF2 implementation.
- Shared graph store loads all edges, replaces one task's predecessors from canonical response, guards stale loads; editor loads candidate tasks on cold page, shows loading/errors/retry, saved predecessor links and search, explicit save, no local task-status mutation.
- Tests new API/store/editor specs, minimal existing detail tests adjustments for new mounted component; no changes to map files.
- Commit: feat(tasks): edit predecessors in shared task details.

### PH3 — Карта
- Frontend new features/projects/lib/sprint-map-dependencies.ts, ui/SprintMapDependencies.vue; modify SprintMapCanvas.vue, SprintMapNode.vue, ProjectMapView.vue. Own map-derived IF3.
- Load graph with page snapshot; derive wait counts from actual tasks and graph, overlay distinct directed dashed edges. Selected/all control, selection action on task node, external predecessor list with links and hidden predecessor reveal through existing collapse path. Do not change totals/layout or existing click preview action.
- Tests dependency derivation, canvas interactions/hidden/external/completion and page loading. Existing map fixtures may need additive optional props defaults to preserve callers.
- Commit: feat(canvas): show task dependency paths and waiting state.

### Interfaces
- IF1 — frontend TaskDependencyEdge { taskId:string, dependencyId:string }; taskId is dependent, dependencyId predecessor. GET /api/tasks/dependencies/graph -> TaskDependencyEdge[] for authenticated owner. PUT /api/tasks/:id/dependencies {dependencyIds:string[]} -> {taskId:string,dependencyIds:string[]} canonical outgoing set of dependent. GET id path cannot capture graph route. Auth same JwtOrApiTokenGuard as tasks. Existing Task API shape unchanged.
- IF2 — features/tasks/api/task-dependencies-api.ts exports fetchTaskDependencies() -> AxiosResponse<TaskDependencyEdge[]> and setTaskDependencies(taskId:string,dependencyIds:string[]) -> AxiosResponse<{taskId:string,dependencyIds:string[]}>. Store useTaskDependencyStore(): edges:TaskDependencyEdge[], revision:number, loading:boolean, loaded:boolean, error:string|null, fetchGraph():Promise<void> (throws on failure), replace(taskId,dependencyIds):Promise<void> (merges that task only), applySnapshot(edges:TaskDependencyEdge[], revision:number):boolean (ignore pre-mutation snapshot). revision increases when a mutation begins/succeeds as necessary; no last-response-wins for unrelated saves.
- IF3 — map helper consumes edges, tasks and visible layout; actual interface owned by PH3 because no other phase consumes its output. SprintMapCanvas additive props tasks:Task[], dependencies:TaskDependencyEdge[] passed explicitly from ProjectMapView; compatibility defaults [] for existing component callers/tests.

### Interface graph
- PH1 -> IF1 @ alfy-bot/src/shared/entities/task-dependency.entity.ts alfy-bot/src/shared/entities/index.ts alfy-bot/src/app.module.ts alfy-bot/src/modules/task/task.module.ts alfy-bot/src/modules/task/*dependency* alfy-bot/src/modules/task/domain/task-dependenc* alfy-bot/src/modules/task/infrastructure/typeorm-task-dependenc* alfy-bot/src/modules/task/dto/set-task-dependencies.dto.ts alfy-bot/test/task-dependencies.e2e-spec.ts alfy-bot/test/helpers/test-app.ts
- PH2 IF1 -> IF2 @ alfy-bot-frontend/src/features/tasks/model/task-dependencies.ts alfy-bot-frontend/src/features/tasks/api/task-dependencies-api.ts alfy-bot-frontend/src/features/tasks/model/task-dependency-store.ts alfy-bot-frontend/src/features/tasks/ui/TaskDependencies.vue alfy-bot-frontend/src/features/tasks/ui/TaskDetailContent.vue alfy-bot-frontend/tests/features/tasks/
- PH3 IF1, IF2 -> IF3 @ alfy-bot-frontend/src/features/projects/lib/sprint-map-dependencies.ts alfy-bot-frontend/src/features/projects/ui/SprintMapDependencies.vue alfy-bot-frontend/src/features/projects/ui/SprintMapCanvas.vue alfy-bot-frontend/src/features/projects/ui/SprintMapNode.vue alfy-bot-frontend/src/views/ProjectMapView.vue alfy-bot-frontend/tests/features/projects/ alfy-bot-frontend/tests/views/ProjectMapView.spec.ts

### Risks / rollback
- RK1 — SQLite schema synchronization and FK recreation: test restarting with persisted edges; rollback code/data table is additive, no existing row migration.
- RK2 — editor/map graph snapshots racing saves: store revision check and per-task merges; explicit network errors, no silent empty graph.
- RK3 — clutter and collapsed endpoints: selected-only default, all toggle, visible-ancestor endpoints + real predecessor panel.

## Conclusion
### Hands-off decisions
- make: new codex/task-dependencies worktree from a323db8 — retain completed map and local preview without mixing implementation branches.
- udesign: normalized FK graph, cross-sprint/project within one user, advisory waiting, concrete recurring occurrences — follows approved behavior while preserving existing task status semantics.
- uplan: plan auto-approved; three disjoint parallel implementers, controller integration/verification/docs; fresh dependencies per WT, isolated local API/frontend ports.
