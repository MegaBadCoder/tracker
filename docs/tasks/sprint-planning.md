# Планирование спринтов и жизненный цикл историй

**Status:** reviewing
**Branch:** codex/sprint-planning
**Worktree:** /Users/v/projects/Alfy/.worktrees/sprint-planning
**Base:** f9af7e8
**Goal:** Пользователь Alfy ведёт истории от проработки до принятого результата, собирает выполнимый спринт из бэклога, видит нагрузку и блокеры, работает с ежедневным фокусом и сохраняет достоверные итоги; AI через MCP предлагает объяснимый состав, который можно просмотреть и применить. Useless if: статусы только декоративны; перенос теряет статус; нагрузка игнорирует неизвестные оценки; закрытие стирает исходный план; предложения тайно меняют задачи; функции доступны только через API, но не через интерфейс.
**Mode:** hands-off

## Context
- База origin/main содержит эпики/истории open/done, атомарные переносы, спринты, релизы, оценки времени/Pomodoro и MCP.
- Спринт сейчас хранит даты и цель, закрытие переносит незавершённые задачи без истории состава; бэклог не имеет поиска и массового планирования.
- Пользователь одобрил весь предложенный объём и отдельно потребовал полноценные статусы историй.

## Design
Расширить существующую модель и API совместимо. Отдельный workflow историй не зависит от колонок задач. Сохранить status=open/done как совместимый признак принятого результата, добавить workflowStatusId. Сервер возвращает каталог пяти начальных статусов, проект может переименовать, упорядочить и дополнить его. Категории open/ready/in_progress/review/done задают смысл; блокировка, отложенная дата и архив независимы. Все задачи истории готовы — предложение проверить историю, без автоматического принятия.

Бэклог получает режимы проработки/готовых/отложенных/архива, поиск и фильтры; планирование показывает две области с выбранным спринтом, массовым переносом, ручной очередностью и отменой последнего переноса с проверкой конфликтов. Истории имеют зависимости от других историй того же проекта без циклов.

Бюджет спринта в минутах необязателен, резерв задаётся явно (изначально 0). Оценка задачи: durationMinutes при положительном значении, иначе pomodoroCount*pomodoroDuration; неизвестная оценка учитывается отдельно. Тот же расчёт используется для предложений, загрузки и отчёта. Учитывать обязательства других проектов за пересекающиеся даты отдельным показателем, не выдавая их за точный календарный прогноз. При недостатке данных прогноз не строить.

Сохранить состав/оценки на старте, изменения состава и итог на закрытии. Данные старых спринтов помечать как неполные, не восстанавливать вымышленную историю. Итог хранит оценку достижения цели, причины переноса и улучшение следующего спринта. Открытые элементы можно распределить по разным planned-спринтам или бэклогу. Переносы историй согласованы с задачами, закрытая история неизменна.

Для AI использовать существующее подключение MCP: read-only контекст и объяснимое предложение, отдельная команда применения явного списка. В UI детерминированная подсказка называется «Предложить план», не выдаётся за вызов LLM. Новые облачные ключи и платные сервисы не нужны.

Визуальная основа: существующие токены Alfy, компактная типографика и shadcn-vue. Отличительный элемент — закреплённая полоса бюджета между бэклогом и спринтом. Мобильный режим складывает области вертикально; управление доступно без drag-and-drop.

Альтернативы: расширять open/done напрямую проще, но ломает потребителей; отдельная новая система планирования дублирует задачи. Выбран совместимый workflow + существующие сущности, с отдельными сервисами планирования и отчётов.
TDD: yes для контрактов API, вычислений, атомарности и совместимости; визуальные изменения проверяются браузером.

### Invariants
- IV1 — Все чтения/записи ограничены пользователем и проектом; чужие UUID, циклы и закрытые назначения отвергаются без частичных записей.
- IV2 — Статус истории независим от выполнения задач; перенос спринта не меняет workflow, блокер, релиз и структуру.
- IV3 — Старые open/done и существующие API работают; каталог статусов имеет один серверный источник.
- IV4 — Расчёт минут не удваивает Pomodoro и duration; неизвестные оценки видны; бюджет не выдумывается.
- IV5 — История стартового и итогового состава переживает перенос, изменение и удаление задач; legacy-данные обозначены неполными.
- IV6 — Предложения не меняют данные; применение/массовый перенос атомарны, отмена не затирает более новые изменения.
- IV7 — Ошибки доступны в UI; ключевые действия доступны клавиатурой и на мобильном; архив и отложенные элементы доступны для восстановления.

## Plan

### PH1 — Workflow историй
- `alfy-bot/src/shared/entities/board-group.entity.ts:1-132`, `project.entity.ts:1-100`: workflowStatusId, blockedReason, deferredUntil, archived, dependencyIds, каталог проекта storyWorkflow.
- `alfy-bot/src/modules/project/board-group.service.ts:1-220`, `dto/update-group.dto.ts:1-20`, `dto/create-group.dto.ts`: совместимые переходы, зависимость/циклы, метаданные бэклога.
- Новые `story-workflow.controller.ts`, `story-workflow.service.ts`, `domain/story-workflow.ts`, DTO и необходимые repository-методы: IF1, каталог по проекту, проверка занятых статусов при замене.
- Unit и SQLite HTTP e2e: старые статусы, независимость, авторизация, цикл, конфигурация. Не менять project.module/app.module/index.ts — интеграция PH2.
- Commit: feat(stories): add configurable story lifecycle and backlog readiness

### PH2 — Планирование и история
- `alfy-bot/src/shared/entities/sprint.entity.ts:1-90`, `modules/project/sprint.service.ts:1-260`, `infrastructure/typeorm-sprint.repository.ts:1-240`, DTO/порты: бюджет, снимки, история, завершение с итогами и выборочным переносом, IF2.
- Новые `modules/project/planning*`, `domain/planning*`, `infrastructure/*planning*`: IF3, атомарность, отмена, оценки, контекст/предложения, межпроектные обязательства.
- Нужные изменения repository-путей задач/историй и shared/database для полного наблюдения изменений спринта; интегрировать новые сущности и контроллеры в project.module.ts/app.module.ts/shared/entities/index.ts, включая PH1.
- Unit и реальные SQLite HTTP e2e для IF2/IF3 и IV1/4/5/6.
- Commit: feat(sprints): add capacity planning and durable sprint reports

### PH3 — Интерфейс
- `alfy-bot-frontend/src/features/projects/{api,model,lib,ui}/`: типы/клиенты IF1-3, статус в строке/карточке истории, редактор каталога, доска историй, фильтры и метаданные.
- `src/views/ProjectBacklogView.vue:1-360`, `ProjectView.vue:1-400`: планирование, поиск, выделение, очередность, отмена, подсказка плана, бюджет, ежедневный фокус и архив/отчёты.
- `SprintFormDialog.vue`, `SprintCompleteDialog.vue`: бюджет и ретроспектива/направления переноса; использовать единые API, обновлять Pinia после действий.
- Компонентные проверки ключевых действий, сборка и браузер desktop/mobile. Не менять backend/MCP.
- Commit: feat(planning): build backlog workspace and story board

### PH4 — MCP и интеграция
- `alfy-mcp/src/tools/{groups,sprints}.ts`, новый `planning.ts`, `server.ts`, соответствующие tests: IF1-3, чтение каталога/контекста/отчёта, предложение и явное применение, корректные annotations.
- README приложений и этот task-файл: новые потоки и ограничения legacy-истории.
- Проверить регистрацию PH1/PH2, типы запросов PH3, реальные API и браузер. Исправлять только подтверждённые дефекты в рамках согласованного объёма.
- Commit: feat(mcp): expose guided sprint planning and reports

### Interfaces
- IF1 — GET `/projects/:projectId/story-workflow` -> `{statuses: StoryWorkflowStatus[]}`; PUT same `{statuses}`; status `{id:string,name:string,category:'open'|'ready'|'in_progress'|'review'|'done',color:string}`. IDs стабильны. Начальные IDs равны категориям. Group добавляет `workflowStatusId:string|null`, `blockedReason:string|null`, `deferredUntil:string|null` (YYYY-MM-DD), `archived:boolean`, `dependencyIds:string[]`. PATCH group принимает эти поля; existing status=open/done синхронизируется с категорией. GET groups возвращает нормализованный workflowStatusId для legacy.
- IF2 — Sprint добавляет `capacityMinutes:number|null`, `reserveMinutes:number` (0), обновляются existing create/update. Complete payload добавляет `goalOutcome?:'achieved'|'partial'|'missed'`, `retrospective?:string`, `improvement?:string`, `carryoverReason?:string`, `taskDestinations?:{taskId:string,sprintId:string|null}[]`, `storyDestinations?:{storyId:string,sprintId:string|null}[]`; исходный moveTo остаётся обязательным default для неуказанных элементов. GET `/projects/:projectId/sprints/:id/report` -> `{sprint, historyComplete:boolean, initial:PlanningSnapshot|null, final:PlanningSnapshot|null, events:SprintEvent[], summary:{planned:number,added:number,removed:number,completed:number,carried:number}, retrospective:{goalOutcome,retrospective,improvement,carryoverReason}}`. Snapshot `{capturedAt:string,tasks:{id,title,completed,estimateMinutes:number|null,groupId:string|null}[],stories:{id,title,status,workflowStatusId}[]}`; event `{id,sprintId,taskId:string|null,kind:string,occurredAt:string,title:string}`.
- IF3 — GET `/projects/:projectId/planning?sprintId=UUID` -> `{sprintId:string|null,capacityMinutes:number|null,reserveMinutes:number,plannedMinutes:number,remainingMinutes:number|null,unestimatedCount:number,otherProjectsMinutes:number,historicalCapacityMinutes:number|null,historySampleCount:number,tasks:PlanningTask[],stories:BoardGroup[],carryoverCounts:Record<string,number>}`. PlanningTask `{id,title,completed,groupId,sprintId,order,estimateMinutes:number|null,priority?:string,blocked:boolean}`. POST `/projects/:projectId/planning/proposal` `{sprintId:string,budgetMinutes:number,goal:string}` -> `{taskIds:string[],storyIds:string[],totalMinutes:number,unestimatedIds:string[],excluded:{id,reason}[],reasons:{id,reason}[]}`; selection deterministic, goal word relevance + order, completed/archived/deferred/blocked excluded; dependencies must be satisfied or included without breaking budget.
- IF3 commands — POST `/projects/:projectId/planning/move` `{taskIds:string[],storyIds:string[],sprintId:string|null}` -> `{updated:number,undoToken:string}`; POST `/projects/:projectId/planning/undo` `{undoToken:string}` -> `{updated:number}`; PATCH `/projects/:projectId/planning/order` `{taskIds:string[],sprintId:string|null}` -> `{updated:number}`. Apply proposal uses move with explicit reviewed IDs. All writes scoped and atomic; undo detects moved/deleted/changed targets instead of clobbering. UI refetches tasks/groups/sprints after writes.

### Interface graph
- PH1 -> IF1 @ alfy-bot/src/shared/entities/board-group.entity.ts alfy-bot/src/shared/entities/project.entity.ts alfy-bot/src/modules/project/board-group.service.ts alfy-bot/src/modules/project/dto/*group* alfy-bot/src/modules/project/*story-workflow* alfy-bot/src/modules/project/domain/story-workflow* alfy-bot/src/modules/project/infrastructure/typeorm-board-group.repository.ts alfy-bot/src/modules/project/domain/board-group-repository.port.ts alfy-bot/test/story-workflow.e2e-spec.ts
- PH2 IF1 -> IF2, IF3 @ alfy-bot/ (except PH1 owned paths)
- PH3 IF1, IF2, IF3 -> @ alfy-bot-frontend/
- PH4 IF1, IF2, IF3 -> @ alfy-mcp/ docs/ README.md

### Test strategy
Baseline: existing sprint/group unit tests and frontend sprint/backlog tests in isolated npm-ci environments. Test-first API edge cases; final SQLite HTTP attacks and browser full cycle create story → transition → plan → start → add/move → close → inspect preserved report, plus failure and mobile.

### Risks / rollback
- RK1 — Разный смысл статусов нарушит закрытие спринтов: сохраняется совместимый open/done, тестируются переносы всех промежуточных статусов.
- RK2 — История через разные пути обновления может быть неполной: проверить обычный PATCH task, перенос истории, массовые операции и удаление; прежние спринты явно incomplete.
- RK3 — Большой объём пересекает несколько приложений: отдельные владельцы файлов, сериализованные коммиты и интеграционная проверка контрактов. Откат фаз через revert; существующие данные не удалять.

## Progress
- PH1: committed a57ecb0 — workflow и совместимость проверены unit и SQLite HTTP.
- PH2: committed def8e27 — 732 backend unit и 162 HTTP e2e passed; гонка с обычным сохранением задачи исправлена в 29193a4.
- PH3: committed c932aa3 — 1057 frontend tests passed, build/vue-tsc, браузер desktop и 390px: статусы, перенос/undo, запуск, фокус, закрытие и сохранённые итоги.
- PH4: 216 MCP tests, build/lint и все 8 новых инструментов на реальном HTTP/SQLite passed.

## Verify

Result: passed.

- CK1 (IV1/IF1) — чужой проект, некорректные даты, цикл зависимостей и удаление занятого статуса: held, SQLite HTTP regression suites.
- CK2 (IV2/IV3) — статус истории теряется при переносе/закрытии или автоматически завершается по задачам: held, service/e2e и браузер.
- CK3 (IV4) — неизвестная оценка становится бесплатной, бюджет удваивает время, выполненные задачи освобождают первоначальный бюджет: held, регрессии + UI контекста.
- CK4 (IV5) — обычный PATCH или удаление задачи искажает отчёт: held, реальный API полный цикл и immutable snapshots.
- CK5 (IV6/IF3) — предложение меняет задачи или отмена затирает новую правку: held, HTTP negative cases; MCP client → REST → SQLite, все 8 tools.
- CK6 (IV6) — обычное устаревшее сохранение отменяет параллельный перенос: broke → held после 29193a4; gated findById регрессии для title/checklist/board/overdue и вложенного Pomodoro, исключительный scope от первого чтения до записи.
- CK7 (IV7) — мобильные элементы недоступны или undo исчезает после обновления: held после исправления unmount и мобильной строки, браузер 390px/desktop и регрессия.

Smoke: локальный сервер + Chrome — настройка «Приёмка», перенос/отмена, запуск, фокус, завершение с ретроспективой и просмотр сохранённого состава; MCP все 8 новых tools прошли на том же API.
Notes: frontend suite на Node 25 запускается с NODE_OPTIONS=--no-experimental-webstorage из-за существующей коллизии happy-dom/localStorage (8 старых timer tests). Полный backend HTTP suite прошёл 162 tests и завершился с exit 0 после app.close() в старом app.e2e. Один промежуточный запрос story-sprint дал socket hang up, отдельный и полный повторные прогоны прошли.

## Conclusion
Независимое ревью ожидается; полный API smoke повторён на финальной сборке успешно.
### Deviations from plan
- Setup: baseline backend npm ci failed at f9af7e8 because lockfile iconv-lite 0.7.2 did not satisfy dependency 0.7.3; corrected six lockfile lines and clean install passed (d0f45e1).
- PH2: reuse serialized SQLite data source helper from existing calendar fix to isolate transaction writes; no calendar functionality included. This is required for atomic planning against concurrent task updates.
### Hands-off decisions
- make: весь согласованный объём, включая статусы историй, принят; dedicated worktree от актуального origin/main, чужие незакоммиченные изменения сохранены.
- udesign: совместимое status + workflowStatusId выбрано для существующих MCP/релизов; AI через уже доступный MCP без нового платного провайдера.
- udesign: независимые части разделены на фазы одного общего результата; автоапрув разрешает выполнить все без выбора первой вручную.
- uplan: plan auto-approved; параллельные implementers по контракту uexecute, коммиты контроллером.

- PH2 compatibility: legacy setGroupSprint may reassign a story from a closed sprint while preserving its closed tasks, as required by existing story-sprint.e2e-spec.ts; frozen report snapshots remain unchanged. New bulk planning rejects closed sources.
- IF3 additive fields: today (user timezone), remainingEffortMinutes and otherProjectsUnestimatedCount make UI dates and unknown workload explicit; historical samples require equal sprint duration.

- uverify: исправлена подтверждённая гонка полного сохранения задачи с planner через repo-port exclusive; покрыты соседние мутации и повторения.
- uverify: добавлен app.close() в существующий root e2e, чтобы полный прогон освобождал приложение и завершался.
