# Зависимости задач

**Status:** reviewing
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

Outcome: зависимости задач реализованы в 64da258 / 1478057 / 109edf1; независимое ревью a323db8..109edf1 не обнаружило critical/important findings с confidence ≥80. Reviewer независимо выполнил 15 backend unit, 12 backend e2e, 47 frontend tests — всё прошло.

Invariants: IV1–IV5 подтверждены CK1–CK8; API сохраняет владельца и атомарность, ожидание не меняет статус, дерево/прогресс не зависят от графа, общий редактор сохраняет черновик и защищает свежие ответы.

### Hands-off decisions
- make: new codex/task-dependencies worktree from a323db8 — retain completed map and local preview without mixing implementation branches.
- udesign: normalized FK graph, cross-sprint/project within one user, advisory waiting, concrete recurring occurrences — follows approved behavior while preserving existing task status semantics.
- uverify: browser/API checks passed; independent review completed without fixes; local preview retained, delivery remains on feature branch.
- udocument: README and CLAUDE updated with usage, edge direction and transaction/store constraints.
- uplan: plan auto-approved; three disjoint parallel implementers, controller integration/verification/docs; fresh dependencies per WT, isolated local API/frontend ports.

## Verify

Baseline a323db8: task.service 143 tests and Canvas/TaskView 19 tests passed; Node 25 frontend requires NODE_OPTIONS=--no-experimental-webstorage as in the base branch. Backend/frontend installed independently with npm ci.

Local smoke uses new API 3019 / frontend 5190, isolated data/database.sqlite and dev account 900106. Existing previews 3018/5188/5189 retained. Fixture: project f2b9dcb7-8c62-463e-9b96-893e5e3390f5, chain recording→mixing→publication, cover approval in another sprint.


Result: passed

- CK1 (IV1, IF1) — self/duplicate/missing/foreign IDs, direct/transitive cycles and concurrent opposite writes — held: domain/service RED→GREEN; real HTTP/SQLite tests reject invalid replacement without changing prior graph.
- CK2 (IV2) — failed insert leaves partial replacement, cascade misses either endpoint, schema rebuild loses graph — held: transaction rollback, both delete endpoints, restart/rebuild tests pass. Completion/move preserve edges; recurring successor does not inherit them.
- CK3 (IV3) — finishing a predecessor completes dependent or leaves stale waiting — held: browser A→B→C plus external D→B, finishing A and D removes B waiting while B remains unfinished and C waits for B; sprint remains 1/3.
- CK4 (IV4) — collapsed/external endpoints disappear or alter totals — held: collapse marks real tasks hidden, reveal expands path; external task has direct link and other-sprint label, never enters tree totals. Dashed arrowheads distinguish dependency direction.
- CK5 (IV5, IF2) — stale GET or unrelated save replaces newer graph — held: store race tests, serialized same-task saves, canonical per-task merge, failed save preserves draft. Page load rejects stale revision; editor snapshot preserves concurrent task changes.
- CK6 (IF3) — failed graph load appears empty — held: page/editor failure-and-retry tests. Shared editor integration covered for preview/page, persisted UUID and readonly/frozen restrictions.
- CK7 — cold task page loses candidates or links after reload — held in browser: B direct page reload shows both completed predecessors; remove/save/search/re-add/save works.
- CK8 — fullscreen/mobile makes dependency controls inaccessible — held in browser at 1280×720 and 390×844: fullscreen preview, shared editor, all-links panel and reveal usable; no horizontal page overflow observed.

Commands: backend `npm test -- --runInBand` (44 suites / 745 tests) and `npm run test:e2e -- --runInBand` (15 / 175) passed before supplemental tests; final focused domain/service/repository 15 tests and e2e 12 tests pass. Backend build and new-file ESLint pass. Frontend `NODE_OPTIONS=--no-experimental-webstorage npm run test:run` passes 152 suites / 1168 tests; `npm run build`, vue-tsc, scoped ESLint and diff-check pass.

Smoke: real API 3019 + UI 5190, isolated SQLite. Browser saved external predecessor, rejected A→C cycle with draft retained, completed predecessors, removed/re-added link, reloaded canonical task page, collapsed/revealed story, inspected mobile and desktop fullscreen. Goal reached locally on representative persisted tasks; production rollout is outside this task.

## Code smells
- Existing backend broad `tsc --noEmit` errors in project-move.integration.spec.ts (obsolete telegramId), board-groups.e2e-spec.ts (getHttpServer generic), planning.e2e-spec.ts (DataSourceOptions union). Nest build, unit and e2e commands pass; these unrelated test typing issues were not changed.


## Goal validation

Direct browser evidence: persisted A→B→C and external D→B chain; cycle rejected, reload preserved links, A/D completion removed B waiting while B stayed unfinished, C still waited for B, sprint stayed 1/3. Hidden tasks were revealed from dependency panel; desktop fullscreen and 390px editor/map worked. Final local map: http://localhost:5190/tasks/project/f2b9dcb7-8c62-463e-9b96-893e5e3390f5/map. Screenshot: /Users/v/.codex/visualizations/2026/11/04/01a1a794-bc60-7b13-a320-224d1cf0c89f/task-dependencies.png.

Finish: local commits on codex/task-dependencies, isolated preview kept running; no remote publication. Temporary fixture/probe scripts removed; demo data retained in ignored local SQLite.


## Follow-up: читаемость стрелок

Пользователь показал наложение наконечника на границу карточки. Причина: endpoint совпадает с x карточки; SVG лежит под HTML, а общая cubic-кривая не разделяет пересекающиеся связи. Цель: направление читается при обычном масштабе, наконечники целиком снаружи карточек, пересекающиеся вертикальные участки разделены. Useless if: увеличили стрелку, сохранив перекрытие или обрезав дорожки по краю карты.

Design: скруглённые ортогональные дорожки слева, отдельные вход/выход с зазором, начало отмечено кружком, конец открытым шевроном; пунктир и готовность сохраняются. Стабильное распределение пересекающихся интервалов по дорожкам; fit учитывает левую границу связей. Прямая кривая с увеличенным наконечником не устраняет перекрытие. TDD: yes для маршрутизации и fit; визуальная проверка на настоящей карте. API/данные/иерархия не меняются.

Plan: helper маршрутизации → SVG ports/markers и bounds → focused tests/build → browser desktop/mobile/collapse → независимое ревью. Auto-approved in existing hands-off worktree.


Follow-up Verify: passed. RED: 2 новых geometry tests падали на старой кривой; GREEN: 162 tests (17 suites), build, scoped ESLint, diff-check. CK9 — точки начала/конца вынесены за карточку, конечный отрезок горизонтальный, перекрывающиеся интервалы получают разные дорожки независимо от порядка API — held. CK10 — 7 пересекающихся связей уходят в отрицательные X, команда «Вся карта» оставляет крайний путь внутри viewport — held. CK11 — browser desktop 1496×1112, mobile 390×844, collapse/reveal — held: шевроны не перекрываются карточкой; петля внутри свёрнутой истории компактна, цвет готовности совпадает с панелью. Screenshot: task-dependencies-polished.png.
