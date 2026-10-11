# Agile как тип проекта, а не режим отображения

**Status:** done
**Branch:** feat/agile-board
**Worktree:** .worktrees/feat-agile-board
**Mode:** interactive

## Design

### Зачем

Agile-проект — это не «доска, показанная иначе». В нём появятся спринты, планирование и другая информация, которой нет у обычного проекта, а задачи такого проекта не должны утекать в неagile-контур. Значит признак «это agile» — свойство проекта, а не настройка того, как его рисовать.

Это закрывает вопрос, оставленный открытым предыдущей задачей ([agile-board-epics-stories.md](agile-board-epics-stories.md), раздел «Осталось открытым»): «признак agile-проект остаётся `viewMode` или заводим явный флаг проекта». Заводим флаг. Инвариант той задачи «`viewMode` управляет только отображением» при этом не отменяется, а наоборот соблюдается честно: доменные правила переезжают на `type`.

### Решение 1 — `Project.type: 'simple' | 'agile'`

Новая колонка, задаётся при создании, дальше не меняется. `viewMode` сужается обратно до `'list' | 'board'` и имеет смысл только для `simple`. У agile-проекта представление одно, выбирать нечего.

Альтернатива — оставить `viewMode: 'agile'` и просто запретить уходить из него. Дешевле на колонку и на миграцию, но «необратимая настройка отображения» — противоречие в терминах: об него споткнётся каждый следующий читатель, и на него же придётся вешать спринты. Отклонено.

Тип — это **выбор из двух при создании, а не переход из одного в другое**. Конверсия не поддерживается ни в какую сторону: ни `simple → agile`, ни обратно. Понижение невозможно в принципе — эпики, истории и будущие спринты некуда девать; повышение технически безубыточно, но сознательно не разрешаем, чтобы не заводить полупуть, у которого нет обратного хода.

### Решение 2 — переключателя видов у agile-проекта нет

`ViewModeToggle` для agile-проекта не рендерится вовсе, а не показывается заблокированным: предлагать недоступное и тут же запрещать — хуже, чем не предлагать.

### Решение 3 — тип выбирается в диалоге создания

Сейчас `viewMode` при создании на фронте не выбирается вообще: проект всегда создаётся как `list`, а в agile попадает переключателем. Как только переключатель перестанет вести в agile, agile-проекты станет невозможно создать. Поэтому `ProjectCreateDialog` получает выбор **Обычный / Agile** — это следствие решения 1, а не отдельная хотелка.

### Решение 4 — правила переноса задач

- Из agile-проекта — только в другой agile-проект.
- Во Входящие из agile-проекта — **нельзя**. Входящие это «неразобранное», а задача агile-проекта уже разобрана: у неё эпик, история, потом спринт.
- В agile-проект — можно откуда угодно: из обычного проекта и из Входящих. Задача приходит без группы и попадает в бэклог.
- Между обычными проектами и во Входящие из обычного — как было.

Осознанная цена: если agile-проект в системе один, задача из него не выйдет никуда, кроме удаления. Принято сознательно — альтернатива открывала бы обход в два шага через Входящие.

Запрет проверяется на сервере во всех путях переноса, а не только там, где UI его прячет: `ProjectTaskService.moveTask`, `TaskService.update` (смена `projectId`), `TaskService.moveToInbox`, и drop задачи на проект в сайдбаре (кастомный DnD-движок, `use-task-dnd.ts:235`).

### Решение 5 — правила читают `type`, а не `viewMode`

Скрытие блока целей в `TaskDetailDialog` переезжает с `viewMode === 'agile'` на `type === 'agile'`. Тем самым уходит оговорка из прошлого дизайна про «смена режима просмотра меняет поведение UI».

### Обратная совместимость

- **Сужение `viewMode` до `'list' | 'board'`.** Существующим строкам с `'agile'` проставляется `type = 'agile'`, а само значение `viewMode` **остаётся нетронутым** — это единственный след, по которому agile-проект опознаётся при откате кода. Значение невалидно по новому union'у, но его никто не читает. Идемпотентный `*MigrationService` в `shared/database/`, как остальные.
- **Гварды `viewMode === 'list'` ломаются молча.** `project-column.service.ts:44` и `project-task.service.ts:85,92` сегодня пропускают agile только потому, что у него `viewMode === 'agile'`. После переезда у agile-проекта окажется обычный `viewMode`, и засев колонок начнёт падать. Гвард обязан стать «запрещено только когда проект `simple` и `viewMode === 'list'`».
- **`alfy-mcp` уже объявляет `viewMode: 'list' | 'board'`** — сужение его не ломает. Но создать agile-проект через MCP будет нельзя, а в списке он покажется как `board`. Известный пробел, сознательно отложен: MCP приводим в порядок позже, вместе с работами по доступам.

TDD: yes — правила переноса, гварды и миграция детерминированы, а ошибка здесь тихо портит данные. Компонентные тесты Vue — после реализации.

### Invariants

- Тип проекта задаётся при создании и не меняется ни одним существующим эндпоинтом.
- `viewMode` принимает только `'list' | 'board'` и не влияет ни на одно доменное правило.
- Задача не может покинуть agile-проект иначе как в другой agile-проект; во Входящие — не может.
- Задача может попасть в agile-проект из обычного проекта и из Входящих.
- Колонки разрешены в agile-проекте всегда: гвард про `list` относится только к `simple`.
- Любое правило вида «это agile» читает `type`, а не `viewMode`.
- Существующие проекты с `viewMode = 'agile'` после миграции имеют `type = 'agile'`; их `viewMode` намеренно не трогается.
- Запрет переноса действует на сервере во всех четырёх путях, а не только там, где UI его прячет.

### Principles

- Тип — свойство проекта, отображение — настройка пользователя. Ни одно доменное правило не висит на настройке отображения.
- Отказ в переносе — это 400 с внятным сообщением, а не молча проигнорированный запрос.
- UI не предлагает недоступное, но запрет живёт на сервере; UI лишь избавляет от лишнего клика.

## Plan

Approach: снизу вверх — сначала колонка и миграция, затем сервисные правила, затем запреты переноса, и только потом фронт. Так каждый слой опирается на уже защищённый нижний, а фронт в конце лишь перестаёт предлагать то, что сервер уже не разрешает.

### Phase 1 — колонка `type` и миграция данных

- **1.1** `alfy-bot/src/shared/entities/project.entity.ts:32` (modify)
  - `type: 'simple' | 'agile'` с `default: 'simple'`; `viewMode` сужается до `'list' | 'board'`.
  - Invariant: `viewMode` принимает только `'list' | 'board'`.
- **1.2** `alfy-bot/src/modules/project/dto/create-project.dto.ts:19-22` (modify)
  - `type?: 'simple' | 'agile'` с `@IsIn(['simple','agile'])`; `viewMode` — `@IsIn(['list','board'])`.
- **1.3** `alfy-bot/src/modules/project/dto/update-project.dto.ts:19-22` (modify)
  - `viewMode` сужается; поля `type` в DTO **нет** — при `whitelist: true` присланный `type` молча отбрасывается.
  - Invariant: тип не меняется ни одним существующим эндпоинтом.
- **1.4** `alfy-bot/src/shared/database/project-type-migration.service.ts` (create)
  - `class ProjectTypeMigrationService implements OnApplicationBootstrap` — образец `board-group-constraints.service.ts`, инжектит `DataSource`.
  - `UPDATE projects SET type = 'agile' WHERE viewMode = 'agile' AND type <> 'agile'` — идемпотентно.
  - `viewMode` при этом **не переписываем** (см. rollback ниже).
  - Invariant: существующие проекты с `viewMode = 'agile'` получают `type = 'agile'`.
- **1.5** `alfy-bot/src/app.module.ts` (modify) — импорт и провайдер сервиса.
- Commit: `feat(project): add project type with migration for existing agile projects`

### Phase 2 — засев колонок и гварды переезжают на `type`

- **2.1** `alfy-bot/src/modules/project/project.service.ts:32-57` (modify)
  - `create` — пишет `type: dto.type ?? 'simple'`; засев колонок по `created.type === 'agile'`, не по `viewMode`.
- **2.2** `project.service.ts:60-97` (modify)
  - `update` — блок засева при переходе `viewMode → 'agile'` удаляется целиком: перехода между типами больше нет.
- **2.3** `alfy-bot/src/modules/project/project-column.service.ts:44` (modify)
  - Гвард становится `project.type === 'simple' && project.viewMode === 'list'`.
  - Invariant: колонки разрешены в agile-проекте всегда.
- **2.4** `alfy-bot/src/modules/project/project-task.service.ts:85,92` (modify) — та же переделка обоих гвардов.
- Commit: `feat(project): drive column seeding and guards from project type`

### Phase 3 — запрет переноса задач из agile-проекта

- **3.1** `alfy-bot/src/modules/task/domain/project-type.port.ts` (create)
  - `abstract class ProjectTypeQueryPort { abstract getType(projectId: string): Promise<'simple' | 'agile' | null> }`
- **3.2** `alfy-bot/src/modules/task/infrastructure/typeorm-project-type.adapter.ts` (create)
  - Читает `projects` напрямую через `@InjectRepository(Project)`. **Реализация живёт в task-модуле сознательно:** `ProjectModule` уже импортирует `TaskModule`, и реализация на стороне проекта замкнула бы цикл.
- **3.3** `alfy-bot/src/modules/task/task.module.ts` (modify) — `Project` в `forFeature`, биндинг порта.
- **3.4** `alfy-bot/src/modules/task/task.service.ts:196-240` (modify)
  - В `update`: при смене `projectId` — если исходный проект `agile`, а целевой не `agile` (включая `null`), `BadRequestException`.
- **3.5** `task.service.ts:574-600` (modify)
  - `moveToInbox` — если проект задачи `agile`, `BadRequestException`.
  - Invariant: задача не может покинуть agile-проект во Входящие.
- **3.6** `alfy-bot/src/modules/project/project-task.service.ts:23-110` (modify)
  - В `moveTask`: если проект задачи `agile`, а `targetProjectId` указывает на неagile-проект — `BadRequestException`. Обратное направление не ограничиваем.
  - Invariant: запрет действует во всех четырёх путях переноса.
- Commit: `feat(task): forbid moving tasks out of an agile project`

### Phase 4 — фронт: тип в модели, выбор при создании, переключатель

- **4.1** `alfy-bot-frontend/src/features/projects/model/types.ts:1,3-12,62` (modify)
  - `ViewMode = 'list' | 'board'`; новый `ProjectType = 'simple' | 'agile'`; `Project.type`; `CreateProjectPayload.type?`.
- **4.2** `alfy-bot-frontend/src/features/projects/ui/ProjectCreateDialog.vue` (modify)
  - Выбор **Обычный / Agile** (два сегмента), значение уходит в `store.createProject` как `type`. Значение по умолчанию — `simple`.
- **4.3** `alfy-bot-frontend/src/features/projects/ui/ViewModeToggle.vue` (modify) — обратно две кнопки, `Rows3` и ветка `agile` убираются.
- **4.4** `alfy-bot-frontend/src/views/ProjectView.vue:34,101,161-167,204` (modify)
  - `isAgileProject = project.type === 'agile'` вместо `viewMode === 'agile'`; `ViewModeToggle` не рендерится при `isAgileProject`; `handleViewModeChange` кастует в `'list' | 'board'`.
  - Invariant: переключателя видов у agile-проекта нет.
- **4.5** `alfy-bot-frontend/src/features/tasks/ui/TaskDetailDialog.vue:727` (modify) — `isAgileProject` читает `type`.
  - Invariant: правило вида «это agile» читает `type`, а не `viewMode`.
- Commit: `feat(projects): choose project type at creation, drop the agile view toggle`

### Phase 5 — фронт: не предлагать запрещённый перенос

- **5.1** `alfy-bot-frontend/src/features/tasks/lib/dnd/use-task-dnd.ts:235` (modify)
  - Перед вызовом переноса: если задача из agile-проекта, а цель — неagile-проект или Входящие, перенос не выполняется.
- **5.2** `alfy-bot-frontend/src/features/projects/ui/ProjectTreeItem.vue:87-92` и `src/components/SidebarNav.vue:26` (modify)
  - Такая цель не подсвечивается как принимающая, чтобы отказ был виден до отпускания кнопки.
  - Principle: UI не предлагает недоступное, но запрет живёт на сервере.
- Commit: `feat(projects): stop offering forbidden task drops in the sidebar`

### Test strategy

TDD (тесты первыми) — фазы 1-3:

- `project.service.spec.ts` — создание с `type: 'agile'` засевает три колонки; `simple` не засевает; без `type` проект создаётся как `simple`; `update` с присланным `type` тип не меняет.
- `project-column.service.spec.ts` — **agile-проект с `viewMode: 'list'` колонку создать позволяет**. Это тот самый молчаливый слом: сегодня гвард пропускает agile только из-за `viewMode === 'agile'`.
- `project-task.service.spec.ts` — `move` из agile в неagile → 400; из agile в agile → ок; из обычного в agile → ок.
- `task.service.spec.ts` — `update` со сменой `projectId` из agile в обычный → 400; `moveToInbox` из agile → 400; `moveToInbox` из обычного → ок.
- `project-type-migration.service.spec.ts` — на реальном in-memory SQLite: строка с `viewMode = 'agile'` получает `type = 'agile'`; повторный запуск ничего не портит; проект с `viewMode = 'board'` остаётся `simple`.
- e2e `board-groups.e2e-spec.ts` — создание проекта с `type: 'agile'` через HTTP отдаёт `type: 'agile'` и три колонки.

После реализации — фронт:

- `ProjectCreateDialog.spec.ts` — выбор Agile уходит в payload как `type`.
- `ViewModeToggle.spec.ts` — снова две кнопки.
- `TaskDetailDialog.spec.ts` — блок целей скрыт при `type: 'agile'` и виден при `simple` (сейчас тест завязан на `viewMode`).

### Order & dependencies

1 → 2 → 3 последовательны. 4 зависит от 1 (поле в API). 5 зависит от 4 (тип в модели фронта).

### Open questions / risks / rollback

- **Цикл модулей.** `ProjectModule` уже импортирует `TaskModule`. Поэтому адаптер `ProjectTypeQueryPort` реализуется внутри task-модуля и читает таблицу `projects` напрямую. Реализация на стороне project-модуля выглядела бы «правильнее» по слоям, но замкнула бы цикл — это осознанный размен.
- **Rollback.** Миграция намеренно **не переписывает** `viewMode`: у проекта остаётся `viewMode = 'agile'` рядом с `type = 'agile'`. Значение невалидно по новому union'у, но его никто не читает — зато при откате кода это единственная запись, по которой agile-проект можно опознать. Перезаписали бы на `'board'` — откат превратил бы agile-проекты в обычные доски без следов. Нормализацию значения оставляем на потом.
- **Совместимость.** Сужение `viewMode` закрывается фазой 1 (DTO) и миграцией; сломанные гварды — фазой 2. `alfy-mcp` уже объявляет `'list' | 'board'`, сужение его не задевает; создание agile-проекта через MCP останется недоступным — отложено вместе с работами по доступам.

## Verify

**Result:** passed

Positive:
- `POST /projects {type:'agile'}` → 201, `type: agile`, колонки «К выполнению / В работе / Готово»
- `POST /projects` без `type` → `simple`, колонок нет
- колонка в agile-проекте с `viewMode: 'list'` → 201
- перенос agile → agile (`PATCH /tasks/:id` и sidebar-форма `/projects/:dest/tasks/:id/move`), simple → agile, Входящие → agile → 200
- существующий «Alfy 2.0» после миграции: `type: agile`, `viewMode: agile` сохранён
- UI: диалог «Новый проект» с выбором Обычный / Agile; созданный через UI agile-проект открывает agile-доску без переключателя видов; у обычного проекта переключатель из двух кнопок

Negative:
- `PATCH /tasks/:id` agile → simple и agile → `null` → 400 «Cannot move a task out of an agile project»
- `PATCH /tasks/:id/move-to-inbox` из agile → 400
- sidebar-форма `/projects/<simple>/tasks/<agile-task>/move` → 400
- колонка в simple + list → 400
- `PATCH /projects/:id {type:'agile'}` → 200, `type` остался `simple`

Invariants:
- `viewMode === 'agile'` нигде в `src` бэка и фронта не читается
- `type` отсутствует в `UpdateProjectDto`; `viewMode` — `'list' | 'board'` в сущности и во фронтовом типе
- серверный запрет стоит во всех путях: `update`, `moveToInbox`, `moveTask` (включая sidebar-форму)

Smoke: бэк на :3102 + фронт на :5173, чеклист выше прогнан через живой API и браузер; тестовые проекты удалены. Наборы: бэк 470 unit + 47 e2e, фронт 475, `vue-tsc` и `tsc` чистые.

Notes:
- `tsc` по бэку нашёл ошибку в спеке фазы 3: `projectId: null` не влезал в тип DTO, хотя `@IsOptional()` пропускает `null` по HTTP. Тип расширен до `string | null` (`73fb457`).
- Drop в сайдбаре руками не проверен: встроенный браузер не даёт кастомному DnD-движку промежуточных `pointermove`, контрольный разрешённый перенос тоже не срабатывает. Сейчас agile-карточки отдают жест vuedraggable (`dnd-source=false`), так что до сайдбара agile-задачу в UI не дотащить; запрет фазы 5 держат `drop-rules.spec.ts`, `use-task-dnd.spec.ts`, `ProjectTreeItem.spec.ts`.

## Conclusion

Outcome: agile стал неизменяемым типом проекта (`Project.type`), и сервер не выпускает задачи из agile-проекта никуда, кроме другого agile-проекта; HEAD `216b369`.

Invariants:
- Тип задаётся при создании и не меняется — `type` нет в `UpdateProjectDto`, `PATCH {type}` в smoke вернул прежний `simple`.
- `viewMode` только `'list' | 'board'` и не участвует в правилах — сужен в сущности и фронтовом типе, grep `viewMode === 'agile'` по `src` пуст.
- Задача не покидает agile-проект иначе как в agile — unit и e2e на все три серверных пути, smoke через живой API: 400 в каждом.
- Задача попадает в agile из обычного проекта и из Входящих — smoke 200.
- Колонки в agile разрешены всегда — спек `project-column.service` и smoke (agile + list → 201).
- «Это agile» читается из `type` — grep плюс `ProjectView.spec.ts` (agile с `viewMode: 'board'` рисует agile-доску).
- Мигрированные проекты: `type = 'agile'`, `viewMode` не тронут — спек миграции на реальном SQLite, проект «Alfy 2.0» в dev-базе.
- Запрет на сервере во всех путях — включая sidebar-форму `moveTask`, где в URL проект назначения.

Review findings:
- Important: английский доккомментарий-история в `project-type-migration.service.ts` переписан по-русски как контракт (`216b369`).

Verified by: drop в сайдбаре руками не проверен — встроенный браузер не управляет кастомным DnD-движком (см. Verify → Notes). Стоит один раз проверить вручную: задача из Входящих бросается на agile-проект и переезжает.

### Deviations from plan

- Фаза 1 (`3071a95`) выполнила пункт 2.2 раньше срока и заодно удалила засев колонок из `create`: без `viewMode: 'agile'` он не компилировался. Фаза 2 вернула засев, теперь по `type` (`e1270d3`).
- Фаза 3: в `ProjectTaskService.moveTask` источник переноса берётся из `task.projectId`, а не из проекта в URL. Drop в сайдбаре шлёт `PATCH /projects/<назначение>/tasks/:id/move` без `dto.projectId`, поэтому проверка «проект из URL — agile?» пропустила бы перенос agile → обычный. Покрыто юнит- и e2e-тестом именно этой формы запроса.
- Фаза 3: e2e «перенос во Входящие обнуляет группу без 500» переписан на ожидание 400. Задача в нём лежит в agile-проекте, и после 3.5 прежний 200 противоречит Design.
- Фаза 4: в `ProjectView.vue` ветка agile проверяется раньше ветки `board`. Иначе старый agile-проект с `viewMode: 'board'` показывался бы обычной доской.
- Фаза 5: `SidebarNav.vue` не менялся. Отказ заложен в общий hit-test (`use-task-dnd.ts`, `updateHitTest`): и подсветка (`useDropTarget.isHovered`), и `commit()` читают один `state.hoveredTarget`, так что цель «Входящие» получает запрет без правок компонента. Правило вынесено в `features/tasks/lib/dnd/drop-rules.ts` (`canDropTask`).

### Known risks

- `ProjectTypeQueryPort.getType` и серверные гварды считают несуществующий исходный проект «не agile» и пропускают перенос. Достижимо только при осиротевшем `projectId`. План этот случай не определял.
- На фронте цель-проект без `data-project-type` или задача, чей проект не найден в сторе, блокируют drop с `console.error`. Сервер всё равно остаётся последней линией защиты.
