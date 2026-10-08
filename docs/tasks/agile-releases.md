# Релизы в agile-проекте

**Status:** done
**Branch:** feat/agile-board
**Worktree:** .worktrees/feat-agile-board
**Mode:** hands-off

## Design

### Зачем

Спринт отвечает на «что делаю сейчас», релиз — на «что и к какой дате выйдет». Релиз собирает задачи из разных спринтов и эпиков под одну дату выпуска и показывает, успеваем ли. Это этап 4 Jira-подобного agile, аналог Jira Versions. До него сделаны тип проекта, эпики и истории, спринты ([agile-project-type.md](agile-project-type.md), [agile-epics-stories-ui.md](agile-epics-stories-ui.md), [agile-sprints.md](agile-sprints.md)).

### Решение 1 — сущность `Release`, связь через `Task.releaseId`

Таблица `releases` в project-модуле, по образцу `Sprint`: `userId`, `projectId` (FK, `CASCADE`), `name`, `description: string | null`, `startDate`/`releaseDate: string | null` (`YYYY-MM-DD`), `status: 'planned' | 'released'`, `releasedAt: Date | null`, `order`, `createdAt`/`updatedAt`.

Связь — одно поле `Task.releaseId` (nullable, `SET NULL` при удалении релиза), решено при планировании дорожной карты. Релиз, как и спринт, не заводит своих колонок и эпиков: у задачи четыре независимых признака — эпик, колонка, спринт, релиз.

Статуса `archived` нет: без него закрытые релизы просто остаются в списке «Выпущенные», а архив можно добавить потом без миграции (см. журнал hands-off).

### Решение 2 — правила сервера

- **`releaseId` у задачи** задаётся через `POST`/`PATCH /tasks`, как `sprintId`: релиз из проекта задачи и в статусе `planned`, иначе 400. `releaseId` без проекта — 400. При смене проекта `releaseId` обнуляется, если не прислан явно. Повторная отправка текущего `releaseId` не проверяется (как у спринта). `moveToInbox` и переезд в другой проект через `moveTask` обнуляют `releaseId`.
- Колонку релиз не трогает: в отличие от спринта, релиз не показывает задачи на доске.
- **Эндпоинты** `projects/:projectId/releases`:
  - список — все релизы проекта, включая `released`, по `order`;
  - создание (имя обязательно — у релиза нет естественной нумерации вроде «Спринт N»);
  - изменение (`name`, `description`, даты; у `released` — 400);
  - удаление: задачи теряют `releaseId` (`SET NULL`), сами не удаляются;
  - `POST …/:releaseId/release { moveTo: 'none' | <releaseId> }` — только из `planned`; незавершённые задачи получают `releaseId = moveTo` (другой `planned`-релиз этого проекта) или `null`; выполненные остаются в выпущенном релизе. Статус `released`, `releasedAt = now`. Одна транзакция, как `closeAndMoveUnfinished`;
  - `POST …/:releaseId/assign-group { groupId }` — всем задачам группы (эпик вместе с его историями, либо история) ставит `releaseId`. Группа из того же проекта, релиз `planned`, иначе 400. Отвечает числом затронутых задач.
- Даты: `startDate ≤ releaseDate`, иначе 400. `order` = `max(order незавершённых) + 1` (урок ревью спринтов).

### Решение 3 — вкладка «Релизы»

Третья вкладка-маршрут `tasks-project-releases` рядом с «Доска · Бэклог». Экран:

- сверху «+ Релиз» (название через `InlineTitleInput`);
- блок «Запланированные» по `order`: строка релиза — название, даты «с 1 окт. по 15 окт.» / «до 15 окт.», прогресс «n из m готово» с полоской, метка «Просрочен», если `releaseDate` раньше сегодня; меню `⋯`: «Изменить», «Выпустить», «Удалить»;
- блок «Выпущенные» (свёрнут по умолчанию): название, дата выпуска, итоговый прогресс;
- клик по строке раскрывает её на месте (аккордеон): задачи релиза, сгруппированные «Эпик › История» и «Без эпика», каждая открывает диалог задачи.

Отдельной страницы или диалога-карточки релиза нет — раскрытие на месте покрывает «что входит в релиз» без новой модалки и без новой навигации (см. журнал).

### Решение 4 — диалоги релиза

- **Изменить:** название, описание, даты начала и выпуска (`Popover` + `Calendar` с `useLocale`, `min`/`max` друг относительно друга, очистка).
- **Выпустить:** «Выполнено N, не выполнено M. Незавершённые: [в релиз X / снять с релиза]». По умолчанию ближайший `planned`-релиз, если его нет — «снять с релиза». При M = 0 выбора нет.
- **Удалить:** `confirm` «Удалить релиз „v1.0“? N задач останутся без релиза.»
- Модалку закрывают до `confirm`; пункт меню, открывающий поле ввода, отменяет возврат фокуса (CLAUDE.md).

### Решение 5 — назначение релиза

- **Задаче:** поле «Релиз» в диалоге задачи agile-проекта рядом с «Спринт» (варианты: «Без релиза» + `planned`-релизы; задача в выпущенном показывает «v1.0 (выпущен)»), чип на мобильном.
- **Истории или эпику целиком:** пункт «В релиз…» в `GroupActionsMenu` (подменю `planned`-релизов) → `assign-group`. После ответа фронт перечитывает задачи проекта (затронуто может быть много задач; локальная подмена по `groupTaskIds` дала бы то же, но перечитывание проще и не расходится с сервером).

### Решение 6 — данные на фронте

`release-store` с кэшем по проектам, как `sprint-store`. Чистые функции в `lib/release.ts`: задачи релиза, прогресс, «просрочен», цель выпуска по умолчанию, сообщение удаления, подпись релиза для поля задачи, группировка задач релиза по эпику и истории.

### Обратная совместимость

- Колонка `tasks.releaseId` пересоберёт `tasks`; триггеры снимает `initializeWithSchemaSync`. Новая таблица `releases` без триггеров.
- API меняется только добавлением. MCP и бот не задеты.
- Ветка не на проде, данные только локальные.

### Вне скоупа

Фильтр доски и бэклога по релизу, статус «архив», release notes, таймлайн, метка релиза в строке бэклога, отчёты по релизам.

TDD: yes — бэкенд: правила `releaseId`, переходы статуса, перенос незавершённых при выпуске и массовое назначение группы детерминированы, ошибка тихо портит данные. Фронт: `release-store` и чистые функции — тестами первыми. Компонентные тесты Vue — после реализации, плюс живой браузер (фокус и слои модалок).

### Invariants

- Задача ссылается только на релиз своего проекта и не назначается в выпущенный релиз через API задач; нарушение — 400, не 500.
- У задачи во Входящих `releaseId = null`.
- Выпуск релиза не удаляет задач и не трогает выполненные; незавершённые оказываются ровно в выбранном месте.
- Удаление релиза не удаляет задач.
- `assign-group` затрагивает только задачи этой группы (эпик — вместе с историями) и только этого проекта.
- Правка релиза идёт через один `release-store`; копий списка нет.
- Любой календарь получает `:locale` и `:week-starts-on` из `useLocale`.

### Principles

- UI не предлагает недоступное: «Выпустить», «Изменить», «В релиз…» только для `planned`; поле «Релиз» только в agile-проекте.
- Последствия называются до подтверждения (выпуск с переносом, удаление).
- Отказ сервера — 400 с внятным сообщением; оптимистичное изменение на фронте откатывается.
- Переиспользуются паттерны спринтов: стор с кэшем по проектам, `SprintFormDialog`/`SprintCompleteDialog`-подобные диалоги, `SprintPicker`-подобное поле, `InlineTitleInput`, `GroupActionsMenu`.

## Plan

Approach: зеркало спринтов. Бэкенд (сущность, API, `releaseId` у задачи, `assign-group`), затем слой данных фронта, вкладка «Релизы» с диалогами, и в конце точки назначения — поле задачи и пункт меню группы. Каждая фаза опирается на уже готовые паттерны спринтов, имена файлов и методов повторяют их.

### Phase 1 — бэкенд: релиз, API и `releaseId` у задачи (TDD)

- **1.1** `alfy-bot/src/shared/entities/release.entity.ts` (create) — `Release`: поля из Design (решение 1); `@Check('CHK_release_status', "status IN ('planned','released')")`, `@Check('CHK_release_date_order', 'startDate IS NULL OR releaseDate IS NULL OR startDate <= releaseDate')`. Образец — `sprint.entity.ts`.
- **1.2** `shared/entities/task.entity.ts` (modify) — `releaseId: string | null` + `@ManyToOne(() => Release, { nullable: true, onDelete: 'SET NULL' })` рядом с `sprintId`.
- **1.3** `shared/entities/index.ts`, `app.module.ts` (список сущностей), `test/helpers/test-app.ts`, и все спеки со своими `DataSource`, где есть `Task` (как в фазе 1 спринтов: `create-data-source.spec.ts`, `project-type-migration.service.spec.ts`, `board-group-constraints.service.spec.ts`, `typeorm-report-answer.repository.spec.ts`, `typeorm-sprint.repository.spec.ts`) — `Release` в списки.
- **1.4** `modules/project/domain/release-repository.port.ts` + `infrastructure/typeorm-release.repository.ts` (create) — `findAllByProject`, `findById(id, projectId)`, `create`, `save`, `delete(id, projectId)`, `releaseAndMoveUnfinished(releaseId, moveToReleaseId: string | null)` (транзакция: `status = 'released'`, `releasedAt = now`, незавершённым задачам релиза `releaseId = moveTo`), `assignGroupTasks(releaseId, groupIds: string[]): Promise<number>` (`UPDATE tasks SET releaseId WHERE groupId IN (...)`, число строк). Образец — `typeorm-sprint.repository.ts`.
- **1.5** `modules/project/dto/create-release.dto.ts`, `update-release.dto.ts`, `release-release.dto.ts`, `assign-group-release.dto.ts` (create) — create: `name` (обязательно, непустое), `description?`, `startDate?`, `releaseDate?`; update: те же, все необязательные, `name` через `@ValidateIf(o => o.name !== undefined)` + `@IsNotEmpty` (урок ревью спринтов: `null` → 400); даты `@Matches(/^\d{4}-\d{2}-\d{2}$/)`, nullable; release: `moveTo` — `'none'` или UUID; assign: `groupId` UUID.
- **1.6** `modules/project/release.service.ts` (create) — `ReleaseService`: `list`, `create` (`order = max(order planned) + 1`, иначе 0), `update` (у `released` — 400; даты по итоговым значениям), `release(…, { moveTo })` (только `planned`; `moveTo` — `'none'` или `planned`-релиз этого проекта, не сам), `delete`, `assignGroup(…, { groupId })` (группа этого проекта через `BoardGroupRepositoryPort`; для эпика — его id и id всех историй; релиз `planned`; отдаёт `{ updated: number }`). Доступ к проекту — как `SprintService.validateProjectAccess`.
- **1.7** `modules/project/release.controller.ts` (create) — `@Controller('projects/:projectId/releases')`: `GET /`, `POST /`, `PATCH /:id`, `DELETE /:id`, `POST /:id/release`, `POST /:id/assign-group`.
- **1.8** `modules/project/project.module.ts` (modify) — `Release` в `forFeature`, порт, сервис, контроллер.
- **1.9** Задача (как фаза 2 спринтов):
  - `modules/task/domain/release-query.port.ts` + `infrastructure/typeorm-release-query.adapter.ts` (create) — `getRelease(id): Promise<{ projectId, status } | null>`; `task.module.ts` — `Release` в `forFeature`, биндинг.
  - `create-task.dto.ts` — `releaseId?: string | null`.
  - `task.service.ts` — `assertReleaseAssignable(releaseId, projectId)` (без проекта / чужой / нет → 400 «Release does not belong to the task project»; `released` → 400 «Cannot assign a task to a released release»); `create`, `update` (проверка только при реальной смене значения или проекта, как `isChangingSprint`; сброс при смене проекта без `releaseId`), `moveToInbox` → `releaseId = null`.
  - `project-task.service.ts` `moveTask` + `TaskRepositoryPort.updatePosition`/`typeorm-task.repository.ts` — параметр `releaseId` после `sprintId`, `keepsProject ? task.releaseId : null`.
  - Invariant: релиз только своего проекта и не выпущенный; во Входящих `releaseId = null`.
- Commit: `feat(project): releases with release action and group assignment`

### Phase 2 — фронт: слой данных (TDD)

- **2.1** `features/projects/model/types.ts` — `ReleaseStatus`, `Release`, `CreateReleasePayload`, `UpdateReleasePayload`, `ReleaseActionPayload { moveTo: 'none' | string }`; `features/tasks/model/types.ts` — `Task.releaseId?: string | null`.
- **2.2** `features/projects/api/releases-api.ts` (create) — `fetchReleases`, `createRelease`, `updateRelease`, `deleteRelease`, `releaseRelease`, `assignGroupToRelease`.
- **2.3** `features/projects/model/release-store.ts` (create) — как `sprint-store.ts`: `releasesOf`, `plannedReleasesOf` (по `order`), `releasedReleasesOf` (по `releasedAt` убыв.), `isLoading`, `fetchReleases`, `ensureReleases`, `createRelease`, `updateRelease`, `deleteRelease` (после успеха задачам локально `releaseId = null`), `releaseRelease(projectId, id, moveTo)` (после успеха незавершённым задачам локально `releaseId` = цель или `null`), `assignGroup(projectId, releaseId, groupId)` (после успеха `useTaskStore().fetchTasks()`).
- **2.4** `features/projects/lib/release.ts` (create) — `releaseTasks(tasks, releaseId)`, `releaseProgress(tasks, releaseId)`, `isReleaseOverdue(release, today)` (`planned` и `releaseDate` < сегодня, локальные даты через `parseLocalDate` из `lib/sprint.ts`), `defaultReleaseTarget(planned, currentId)` (первый `planned` по `order`, кроме текущего, иначе `'none'`), `releaseDeletionMessage(release, taskCount)` (`pluralRu`), `releaseLabel(releases, releaseId)` («Без релиза» / имя / «<имя> (выпущен)» / `null` если не найден), `groupReleaseTasks(tasks, groups)` → `[{ epic: BoardGroupNode | null, story: BoardGroupNode | null, tasks }]` в порядке эпиков и историй, «Без эпика» последним.
- Commit: `feat(projects): release store and helpers`

### Phase 3 — фронт: вкладка «Релизы» и диалоги

- **3.1** `router/index.ts` — маршрут `project/:projectId/releases`, `name: 'tasks-project-releases'`, `views/ProjectReleasesView.vue`; `features/projects/ui/ProjectTabs.vue` — третья вкладка «Релизы».
- **3.2** `views/ProjectReleasesView.vue` (create) — не-agile → `router.replace('tasks-project')`; `AppHeader` + `ProjectTabs`; загрузка задач, групп, релизов (как `ProjectBacklogView`); «+ Релиз» (`InlineTitleInput` → `createRelease`); блок «Запланированные» (`plannedReleasesOf`) и свёрнутый блок «Выпущенные» (`releasedReleasesOf`); `useTaskDetailHandlers` + `TaskDetailDialog`, как в бэклоге.
- **3.3** `features/projects/ui/ReleaseRow.vue` (create) — props `projectId`, `release`, `tasks`; шапка: название, даты («с 1 окт. по 15 окт.» / «до 15 окт.» / ничего), прогресс «n из m готово» + полоска, метка «Просрочен» (`isReleaseOverdue`), у выпущенного — «Выпущен 15 окт.»; `⋯` только у `planned`: «Изменить», «Выпустить», «Удалить» (emits); клик по шапке раскрывает список `groupReleaseTasks` с подписями «Эпик › История» / «Без эпика»; клик по задаче → emit `openTask`.
- **3.4** `features/projects/ui/ReleaseFormDialog.vue` (create) — по образцу `SprintFormDialog` (режим `edit`): название, описание (`Textarea`), даты начала и выпуска с `Popover` + `Calendar` (`:locale`/`:week-starts-on` из `useLocale`, `min`/`max`, очистка); `updateRelease`; ошибка сервера в диалоге (`apiErrorMessage`).
- **3.5** `features/projects/ui/ReleaseActionDialog.vue` (create) — по образцу `SprintCompleteDialog`: «Выполнено N, не выполнено M», выбор «в релиз X» (`plannedReleasesOf` без текущего) / «Снять с релиза», по умолчанию `defaultReleaseTarget`; при M = 0 выбора нет, шлётся `'none'`; `releaseRelease`.
- **3.6** Удаление — `confirm` с `releaseDeletionMessage`, затем `deleteRelease`. Диалоги монтируются по одному на экран через `v-if` на снимке релиза (как спринтовые).
- Commit: `feat(projects): releases tab with release, edit and delete`

### Phase 4 — фронт: назначение релиза

- **4.1** `features/projects/ui/ReleasePicker.vue`, `ReleasePickerContent.vue` (create) — по образцу `SprintPicker`/`SprintPickerContent`: «Без релиза» + `planned`; значение через `releaseLabel`.
- **4.2** `features/tasks/ui/TaskDetailDialog.vue` — `localReleaseId`, `onReleaseChange` → `emitUpdate({ releaseId })`; `<ReleasePicker v-if="isAgileProject && localProjectId">` после `SprintPicker`; `DrawerField` + `'release'`, `DRAWER_TITLES.release = 'Релиз'`; сброс при смене проекта; `ensureReleases`. `TaskPropertyChips.vue` — `releaseTitle?: string | null` по схеме `sprintTitle`.
- **4.3** `features/projects/ui/GroupActionsMenu.vue` — подменю «В релиз…» с `plannedReleasesOf(group.projectId)`; выбор вызывает `releaseStore.assignGroup(projectId, releaseId, group.id)` прямо из меню (без новых emits — меню используется в `AgileEpicBlock`, `AgileStoryBlock`, `BacklogEpicsPanel`, и все три получат пункт без правок); пункт скрыт, если `planned`-релизов нет; `ensureReleases` при открытии меню.
- Commit: `feat(projects): assign releases to tasks and whole stories`

### Test strategy

TDD, тесты первыми — фазы 1–2:

- `release.service.spec.ts`: имя обязательно; `order` после максимального `planned`; `update` выпущенного → 400; даты `start > release` → 400 (с учётом сохранённой второй); `release` только из `planned`; `moveTo` на себя / выпущенный / чужой → 400; `'none'` и `planned` → `releaseAndMoveUnfinished` с правильной целью; `assignGroup` для эпика передаёт id эпика и всех его историй, для истории — только её; чужая группа → 400; выпущенный релиз → 400.
- `typeorm-release.repository.spec.ts` (реальный SQLite): `releaseAndMoveUnfinished` двигает только незавершённые задачи этого релиза; `assignGroupTasks` меняет только задачи перечисленных групп и возвращает их число.
- `task.service.spec.ts`: `releaseId` своего проекта → ок; чужой, выпущенный, без проекта → 400 без записи; повторная отправка текущего (выпущенного) → ок; смена проекта без `releaseId` → обнулён; `moveToInbox` → `null`. `project-task.service.spec.ts`: переезд в другой проект обнуляет `releaseId`, внутри проекта сохраняет.
- e2e `test/releases.e2e-spec.ts`: создание → назначение задач (API задач и `assign-group` для эпика с историей) → выпуск с переносом в другой релиз → выполненные в выпущенном, незавершённые в новом → назначение в выпущенный → 400 → удаление → задачи без релиза.
- Фронт: `release.spec.ts` (все функции 2.4, включая границы «просрочен» и порядок групп); `release-store.spec.ts` (изоляция проектов, откат, локальные эффекты `deleteRelease`/`releaseRelease`, `assignGroup` перечитывает задачи).

После реализации:

- `ProjectReleasesView.spec.ts` — блоки и порядок, «+ Релиз», не-agile → редирект, раскрытие строки и группировка, «Выпустить» открывает диалог, удаление через confirm.
- `ReleaseRow.spec.ts`, `ReleaseFormDialog.spec.ts` (календарь с `locale`), `ReleaseActionDialog.spec.ts` (цель по умолчанию, M = 0).
- `TaskDetailDialog.spec.ts` — поле «Релиз» только в agile, выбор шлёт `releaseId`, выпущенный показывается «(выпущен)».
- `GroupActionsMenu.spec.ts` — «В релиз…» с `planned`-релизами, выбор вызывает `assignGroup`; без `planned` пункта нет.
- Живой браузер в `up:uverify`: фокус, слои модалок, раскрытие строк.

### Order & dependencies

1 → 2 → 3 → 4. Фаза 4.3 правит общий `GroupActionsMenu` — проверить, что доска, бэклог и панель эпиков не сломались.

### Open questions / risks / rollback

- **Совместимость:** колонка `tasks.releaseId` пересобирает `tasks`, триггеры снимает `initializeWithSchemaSync`; проверить старт на dev-базе с триггерами.
- **`assign-group` перечитывает все задачи** — при большом числе задач это лишний трафик; для одного пользователя приемлемо.

## Verify

**Result:** passed (после исправления `18acaa3`)

Positive:
- создание релиза с именем → `planned`, `order` 0, 1; назначение задачи через `PATCH /tasks` → 200
- `assign-group` для эпика → 2 задачи (эпика и его истории)
- выпуск с `moveTo` = другой релиз → незавершённые перенесены, выполненная осталась в выпущенном, `released` + `releasedAt`
- повторная отправка текущего (выпущенного) `releaseId` → 200; удаление релиза → задачи без релиза, не удалены
- UI: вкладка «Релизы»; строка «v2.0 · с 10 сент. по 25 сент. · Просрочен · 0 из 2 готово»; «Выпущенные (1)» свёрнут; раскрытие показывает «Epic › Story» и «Без эпика»; «Выпустить» — «Выполнено 0, не выполнено 2», единственный вариант «Снять с релиза» с последствиями; поле «Релиз: v2.0» после «Спринта»; «В релиз…» в меню эпика в бэклоге предлагает только `planned`; «Изменить» — одна модалка, фокус в поле названия

Negative:
- создание без имени, `startDate > releaseDate`, `name: null` → 400
- релиз чужого проекта, назначение в выпущенный, выпуск «в себя», `assign-group` чужой группы, `PATCH` выпущенного релиза → 400

Invariants:
- выпуск не трогает выполненные — API и тест репозитория
- `assign-group` — только задачи группы и проекта, и после `18acaa3` не забирает задачи из выпущенных релизов
- схема `releases` + `tasks.releaseId` синхронизировалась на dev-базе с триггерами

Smoke: бэк :3102 на dev-базе и фронт :5173, сценарий выше в браузере и через API; тестовые проекты удалены. Наборы: бэк 608 unit + 65 e2e, фронт 794; `tsc`, `vue-tsc` чистые.

Notes:
- Проверка поймала дефект дизайна: «В релиз…» для эпика переносил выполненную задачу из **выпущенного** релиза в новый — история выпуска переписывалась (живой API: «on epic 2» ушла из «v1.0» в «v2.0»). `assignGroupTasks` теперь пропускает задачи выпущенных релизов (`18acaa3`, тест на реальном SQLite), перепроверено вживую.

## Conclusion

Outcome: у agile-проекта появились релизы — вкладка «Релизы», выпуск с переносом незавершённых задач, назначение релиза задаче и целиком истории или эпику. HEAD `73b97eb`.

Invariants:
- Задача ссылается только на релиз своего проекта и не попадает в выпущенный — unit, e2e, живой API (400).
- У задачи во Входящих `releaseId = null` — `moveToInbox`, `releaseId` без проекта → 400.
- Выпуск не удаляет задач и не трогает выполненные — тест `releaseAndMoveUnfinished` на SQLite, живой API.
- Удаление релиза не удаляет задач — e2e и живой API.
- `assign-group` — только задачи группы (эпик вместе с историями) и проекта, без задач выпущенных релизов — тесты репозитория, живой API.
- Один `release-store` — вкладка, диалоги, поле задачи и меню группы работают через него.
- Календари с локалью — `ReleaseFormDialog.spec.ts`.

Review findings: Critical и Important нет. Minor — перечитывание задач после «В релиз…» на доске на мгновение снимало доску со спиннером; исправлено как в бэклоге (`73b97eb`).

Verified by: дефект «В релиз…» забирал выполненные задачи из выпущенных релизов найден только на живом API — см. Verify → Notes.

### Hands-off decisions
- make: размер Medium/Large, полный цикл — новая сущность, API, вкладка, диалоги, поле задачи.
- make: ветка `feat/agile-board` без нового worktree — пользователь сам решил вести agile-этапы в ней; это не `main`, откат — по коммитам.
- udesign: без статуса `archived` — меньше объёма; выпущенные релизы видны в свёрнутом блоке, архив добавляется позже без миграции.
- udesign: в выпущенный релиз задачу через API задач назначить нельзя (как в закрытый спринт); повторная отправка текущего значения разрешена.
- udesign: «карточка релиза» — раскрытие строки на месте, без отдельной страницы или диалога: меньше новой навигации и модалок.
- udesign: фильтр доски по релизу — вне скоупа: доска уже ограничена активным спринтом, фильтр не нужен для базового сценария.
- udesign: имя релиза обязательно при создании — у релизов нет естественной нумерации, «Релиз N» было бы выдуманным значением по умолчанию.
- udesign: «В релиз…» для эпика/истории назначает все задачи группы, включая выполненные — «история входит в релиз» целиком; после ответа фронт перечитывает задачи проекта.
- udesign: цель выпуска по умолчанию — ближайший `planned`-релиз, иначе «снять с релиза» — зеркало решения, которое пользователь принял для спринтов.
- uplan: plan auto-approved (hands-off).
- uverify: `assign-group` не трогает задачи выпущенных релизов — исправление дефекта дизайна, найденного вживую (`18acaa3`); консервативнее исходного «все задачи группы».
- ureview: исправлено мелкое замечание — доска не снимается спиннером при повторной загрузке задач (`73b97eb`).
- uplan: «В релиз…» вызывает стор прямо из `GroupActionsMenu`, без новых emits — пункт сразу появляется во всех трёх местах использования меню без правки родителей.

### Deferred (needs user input)
