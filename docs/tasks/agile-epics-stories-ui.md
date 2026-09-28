# Эпики и истории: управление в интерфейсе

**Status:** design
**Branch:** feat/agile-board
**Worktree:** .worktrees/feat-agile-board
**Mode:** interactive

## Design

### Зачем

Первый этап Jira-подобного agile. У эпиков и историй есть бэкенд-CRUD ([agile-board-epics-stories.md](agile-board-epics-stories.md)), и `group-store` умеет создавать, менять и удалять группы, но в интерфейсе ни одной кнопки для этого нет. Эпики на доске сейчас появляются только через API. Задача закрывает этот пробел: эпиками и историями можно управлять прямо на доске, у них есть своя карточка, а задача в диалоге показывает и меняет своё место в иерархии.

Дальше по дорожной карте идут релизы (`Task.releaseId`), спринты (`Task.sprintId`, вкладка «Бэклог») и вкладки проекта «Доска · Бэклог · Релизы». Категорий колонок не будет, прогресс считается по `task.completed`. Эта задача им не мешает и ничего из них не делает.

### Решение 1 — `groupId` в создании и обновлении задачи

`CreateTaskDto` и `UpdateTaskDto` получают поле `groupId?: string | null`. Быстрое создание в строке истории — один атомарный запрос. Поле «Эпик / История» в диалоге — обычный `PATCH /tasks/:id`.

- Группа обязана существовать и принадлежать проекту задачи; для обновления — целевому проекту, если он меняется. Иначе 400. Сейчас такой случай ловит только триггер `trg_task_group_same_project`, и клиент получает 500.
- `groupId` без проекта (задача во Входящих) — 400.
- Явный `null` убирает задачу из группы. Отсутствие поля группу не трогает. При смене проекта группа по-прежнему обнуляется: правило уже есть в `TaskService.update`.

Отклонено: создавать задачу, а потом переносить её через `move`. Два запроса не атомарны, а `move` обнуляет `columnId`, если его не передать. Диалогу пришлось бы всегда слать текущую колонку, и об эту ловушку легко споткнуться.

### Решение 2 — даты эпика

В `board_groups` добавляются nullable-колонки `startDate` и `dueDate`: дата без времени, строка `YYYY-MM-DD`. Таймзона здесь не участвует, это календарные даты. Даты есть только у эпика: попытка задать их истории даёт 400. `startDate > dueDate` — тоже 400. На этом этапе даты только хранятся и редактируются. Потребитель у них появится позже — таймлайн и релизы.

### Решение 3 — управление на доске

- **Шапка эпика.** Клик по названию открывает карточку. Кнопка «+» — быстрое создание задачи прямо в эпике. Меню «⋯»: Открыть · Переименовать · Цвет · Добавить историю · Закрыть/Открыть · Удалить. Отдельная кнопка «Закрыть эпик» переезжает в меню. Вид закрытого эпика или истории не меняется: они не сворачиваются и не прячутся.
- **Подпись истории.** Клик открывает карточку, «+» создаёт задачу в истории. Меню «⋯»: Открыть · Переименовать · Закрыть/Открыть · Удалить.
- **Строка «+ Эпик»** идёт после последнего эпика, перед блоком «Без эпика».
- **Переименование и быстрое создание** — поле ввода на месте: Enter сохраняет, Esc отменяет, пустое значение не сохраняется. Задача создаётся в первой колонке доски, в выбранной группе.
- **Удаление** идёт через существующий `ConfirmDialog`, и текст называет последствия: сколько историй удалится и сколько задач переедет в «Без эпика». Бэкенд уже так устроен: истории удаляются каскадом, у задач `groupId` становится `SET NULL`.
- **Цвет** — существующий `ColorPicker` из `features/projects/ui`. Только у эпика: цвет истории доска не рисует.
- **Мобильная версия:** «⋯» и «+» видны всегда, без hover.

### Решение 4 — карточка эпика или истории

`GroupDetailDialog` сделан по образцу `TaskDetailDialog`: диалог в центре, на мобильном — на весь экран.

- **Шапка:** крошки «📁 Проект › Эпик» (у истории), меню «⋯» → «Удалить».
- **Основная часть:** редактируемое название, описание (сохраняется при потере фокуса), список дочерних элементов. У эпика — истории со счётчиком «n из m» и пометкой «закрыта», затем задачи самого эпика. У истории — её задачи.
- **Боковая колонка:** статус, прогресс «n из m готово» с полоской. У эпика — ещё цвет и даты. Календарь получает `:locale` и `:week-starts-on` из `useLocale`.
- **Прогресс** считается так же, как в шапке эпика на доске: выполненные задачи эпика и всех его историй из общего числа.

### Решение 5 — одна модалка за раз, навигация крошками

Из карточки эпика клик по истории или задаче **заменяет** карточку, а не открывает вторую поверх. Назад ведут крошки.

- Какая группа открыта, хранит глобальное состояние `useGroupDetail()` (модульный синглтон): `open(projectId, groupId)` и `close()`.
- `GroupDetailDialog` монтируется рядом с каждым `TaskDetailDialog`: `TasksView`, `CalendarView`, `ProjectView`, `GoalView`. Одновременно активен один экран, поэтому экземпляр тоже один.
- Клик по задаче в карточке закрывает карточку и открывает задачу через `handleOpenTask` экрана. Клик по эпику или истории в крошках задачи закрывает задачу и вызывает `useGroupDetail().open`.

Отклонено: второй слой модалки поверх первой. Появляются вопросы фокуса, Esc и мобильной версии, а крошки начинают спорить со стеком.

### Решение 6 — диалог задачи в agile-проекте

- В шапке вместо «📁 Проект» — крошки «📁 Проект › Эпик › История», каждый уровень кликабелен (решение 5).
- В боковой колонке на месте скрытого блока целей — поле «Эпик / История»: выпадающий список эпиков с вложенными историями и пунктом «Без эпика». На мобильном вместо списка drawer, как у остальных полей.

### Решение 7 — кэш групп по проектам

`group-store` хранит дерево отдельно для каждого проекта, а не одно на всё приложение. Иначе карточка, открытая из Календаря для задачи другого проекта, подменила бы дерево открытой доски. Стор остаётся единственным источником данных: правка в карточке сразу видна на доске.

### Обратная совместимость

- Все изменения API только добавляют новое: новые необязательные поля в DTO задачи и группы, новые поля в ответе группы. MCP, бот и старые клиенты не задеты.
- Колонки в `board_groups` добавит `synchronize`. SQLite при этом пересоздаёт таблицу и **молча роняет триггеры** на ней. Их на каждом старте восстанавливает `board-group-constraints.service.ts`. Нужен тест, что триггеры переживают изменение схемы (см. CLAUDE.md).
- Кнопка «Закрыть эпик» переезжает из шапки в меню «⋯». Поведение то же, меняется только место.

### Вне скоупа

- Перетаскивание эпиков и историй для смены порядка (`reorderGroups` в сторе есть, UI нет).
- Перенос истории в другой эпик из интерфейса.
- Скрытие или сворачивание закрытых эпиков — осознанно оставлено как есть.
- Таймлайн по датам эпика, релизы, спринты.

TDD: yes — бэкенд: правила `groupId` у задачи и дат у эпика детерминированы, а ошибка тихо портит иерархию или отдаёт 500. Фронт: стор (кэш по проектам, `useGroupDetail`) и чистые функции (счётчики удаления, прогресс) — тестами первыми. Компонентные тесты Vue — после реализации.

### Invariants

- Задача может ссылаться только на группу своего проекта; нарушение даёт 400 на сервере, а не 500 от триггера.
- У задачи во Входящих `groupId` всегда `null`.
- Даты `startDate` и `dueDate` бывают только у эпика, и `startDate ≤ dueDate`.
- Удаление эпика или истории не удаляет ни одной задачи: задачи остаются в проекте с `groupId = null`.
- Триггеры `board_groups` и `tasks` существуют после изменения схемы `board_groups`.
- Одновременно открыта не больше одной модалки из пары «задача / группа».
- Правка группы в карточке и на доске идёт через один `group-store`; копий дерева нет.
- Открытие карточки группы чужого проекта не меняет дерево, которое показывает открытая доска.
- Любой календарь в новых компонентах получает `:locale` и `:week-starts-on` из `useLocale`.

### Principles

- UI не предлагает недоступное: поля «Эпик / История» и крошек нет у задачи обычного проекта и Входящих, пунктов «Цвет» и «Добавить историю» нет у истории.
- Удаление называет последствия до подтверждения, а не после.
- Отказ сервера — 400 с внятным сообщением. На фронте оптимистичное изменение откатывается, а не остаётся висеть.
- Существующие примитивы (`ConfirmDialog`, `ColorPicker`, `DropdownMenu`, `Dialog`, `Drawer`, `Calendar`) переиспользуются, новые не заводятся.

## Plan

Approach: снизу вверх. Сначала бэкенд (`groupId` у задачи, даты эпика), затем слой данных фронта (кэш групп по проектам, состояние карточки, навигация), потом три UI-части в порядке зависимостей: доска, карточка группы, диалог задачи. Каждая UI-фаза опирается на уже готовый стор.

Упрощение относительно Design (решение 5): `GroupDetailDialog` монтируется **один раз в `App.vue`**, рядом с `ConfirmDialog`, а не в четырёх экранах. Задачу из карточки открывает `openTaskDetail(task)`: активный экран регистрирует его через `useTaskDetailHandlers`, а этим composable пользуются все четыре экрана с `TaskDetailDialog`. Шаблоны экранов не меняются, инвариант «одна модалка» сохраняется.

### Phase 1 — бэкенд: `groupId` при создании и обновлении задачи (TDD)

- **1.1** `alfy-bot/src/modules/task/domain/board-group-query.port.ts` (create)
  - `abstract class BoardGroupQueryPort { abstract getProjectId(groupId: string): Promise<string | null> }` — `null` означает, что группы нет. Русский TSDoc.
- **1.2** `alfy-bot/src/modules/task/infrastructure/typeorm-board-group-query.adapter.ts` (create)
  - Читает `board_groups` через `@InjectRepository(BoardGroup)`. Адаптер лежит в task-модуле по той же причине, что и `TypeOrmProjectTypeAdapter`: `ProjectModule` импортирует `TaskModule`.
- **1.3** `alfy-bot/src/modules/task/task.module.ts` (modify) — `BoardGroup` в `forFeature`, биндинг `BoardGroupQueryPort → TypeOrmBoardGroupQueryAdapter`.
- **1.4** `alfy-bot/src/modules/task/dto/create-task.dto.ts:107-110` (modify) — рядом с `columnId` поле `groupId?: string | null`: `@IsOptional() @IsUUID()`, `nullable: true` в `ApiPropertyOptional`. `UpdateTaskDto` наследует поле через `PartialType`.
- **1.5** `alfy-bot/src/modules/task/task.service.ts` (modify)
  - `private assertGroupInProject(groupId: string, projectId: string | null): Promise<void>`: `projectId === null` → 400 «Cannot assign a group to a task without a project»; `getProjectId(groupId) !== projectId` → 400 «Group does not belong to the task project».
  - `create` (`:67-110`): при `groupId` → `assertGroupInProject(groupId, projectId ?? null)` до `taskRepo.create`.
  - `update` (`:193-250`): целевой проект = `isChangingProject ? dto.projectId : task.projectId`. При `dto.groupId` — не `undefined` и не `null` — проверка против целевого проекта, до любых записей. Обнуление `task.groupId` при смене проекта (`:247-249`) срабатывает, **только если `dto.groupId === undefined`**. Иначе остаётся присланное и уже проверенное значение.
  - Invariant: задача ссылается только на группу своего проекта (400, не 500); у задачи во Входящих `groupId = null`.
- Commit: `feat(task): accept groupId on task create and update`

### Phase 2 — бэкенд: даты эпика (TDD)

- **2.1** `alfy-bot/src/shared/entities/board-group.entity.ts` (modify)
  - `@Column({ type: 'text', nullable: true }) startDate: string | null` и такой же `dueDate`.
  - `@Check('CHK_board_group_dates_epic_only', "type = 'epic' OR (startDate IS NULL AND dueDate IS NULL)")`, `@Check('CHK_board_group_date_order', 'startDate IS NULL OR dueDate IS NULL OR startDate <= dueDate')`.
- **2.2** `alfy-bot/src/modules/project/dto/create-group.dto.ts` (modify) — `startDate?: string | null` и `dueDate?: string | null`: `@IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/)`. `UpdateGroupDto` наследует поля.
- **2.3** `alfy-bot/src/modules/project/board-group.service.ts` (modify)
  - `private assertDates(type: 'epic' | 'story', startDate: string | null, dueDate: string | null): void`: у `story` любая непустая дата → 400 «Only epics have dates»; `startDate > dueDate` → 400 «startDate must not be after dueDate».
  - `create`: передаёт даты в `groupRepo.create` после `assertDates(type, …)`.
  - `update`: считает итоговые даты (присланное или текущее значение) и итоговый `type`, вызывает `assertDates`, присваивает.
  - Invariant: даты только у эпика, `startDate ≤ dueDate`.
- **2.4** `alfy-bot/src/shared/database/board-group-constraints.service.spec.ts` (modify) — тест 6 («re-protects after the table is recreated») дополнить проверкой на схеме с новыми колонками: после пересоздания таблицы задача с группой чужого проекта отклоняется.
  - Invariant: триггеры переживают изменение схемы `board_groups`.
- Commit: `feat(project): start and due dates on epics`

### Phase 3 — фронт: слой данных (TDD)

- **3.1** `alfy-bot-frontend/src/features/projects/model/types.ts:29-55` (modify) — `BoardGroup.startDate: string | null`, `BoardGroup.dueDate: string | null`; `CreateGroupPayload.startDate?`, `dueDate?`.
- **3.2** `alfy-bot-frontend/src/features/projects/lib/group-tree.ts` (create) — чистые функции:
  - `findGroup(tree: BoardGroupNode[], id: string): BoardGroupNode | undefined` (переезжает из `findNode` в сторе);
  - `groupPath(tree, groupId): { epic: BoardGroupNode, story: BoardGroupNode | null } | null`;
  - `groupTaskIds(group: BoardGroupNode): string[]` — id самой группы и её историй;
  - `groupProgress(group, tasks: Task[]): { done: number, total: number }` — по `task.completed`, та же формула, что в `AgileEpicBlock`;
  - `deletionImpact(group, tasks): { stories: number, tasks: number }`.
- **3.3** `alfy-bot-frontend/src/lib/plural.ts` (create) — `pluralRu(n: number, forms: [string, string, string]): string` для текста подтверждения.
- **3.4** `alfy-bot-frontend/src/features/projects/model/group-store.ts` (modify)
  - `groups` и `currentProjectId` заменяются на `trees = ref<Record<string, BoardGroupNode[]>>({})` и `loadingProjects = ref<Set<string>>`.
  - `groupsOf(projectId): BoardGroupNode[]` (не загружено → `[]`), `isLoading(projectId): boolean`, `fetchGroups(projectId)` пишет только свой ключ, `ensureGroups(projectId)` грузит, если ключа нет.
  - `createGroup`, `updateGroup`, `deleteGroup`, `reorderGroups`, `toggleGroupDone(projectId, group)` (переименован из `toggleEpicDone`, работает и для истории) меняют только `trees[projectId]`. Оптимистичное обновление и откат — как сейчас.
  - Invariant: одна копия дерева; группа чужого проекта не меняет дерево открытой доски.
- **3.5** `AgileBoardView.vue:31,52,61,71,77`, `AgileBacklogPanel.vue:33,57,75` (modify) — `groupStore.groups` → `groupStore.groupsOf(projectId)`, `loading` → `isLoading(projectId)`, `toggleEpicDone` → `toggleGroupDone`.
- **3.6** `alfy-bot-frontend/src/features/projects/model/use-group-detail.ts` (create) — модульный синглтон: `useGroupDetail(): { current: Readonly<Ref<{ projectId: string, groupId: string } | null>>, open(projectId, groupId): void, close(): void }`.
- **3.7** `alfy-bot-frontend/src/features/tasks/lib/task-detail-navigation.ts` (create) — `registerTaskOpener(fn: (task: Task) => void): () => void` (возвращает unregister, который снимает только свою регистрацию), `openTaskDetail(task: Task): void`. Без зарегистрированного обработчика — `console.error`, без тихого no-op.
- **3.8** `alfy-bot-frontend/src/features/tasks/lib/use-task-detail-handlers.ts:21-37` (modify) — в `onMounted` регистрирует `handleOpenTask`, в `onBeforeUnmount` снимает регистрацию.
- Commit: `feat(projects): per-project group cache and detail navigation state`

### Phase 4 — фронт: управление на доске

- **4.1** `alfy-bot-frontend/src/features/projects/ui/InlineTitleInput.vue` (create) — props `placeholder: string`, `initial?: string`; emits `submit: [title: string]`, `cancel: []`. Enter сдаёт обрезанное непустое значение, пустое → `cancel`; Esc и blur → `cancel`. Автофокус при монтировании.
- **4.2** `alfy-bot-frontend/src/features/projects/ui/GroupActionsMenu.vue` (create) — `DropdownMenu`; props `group: BoardGroup`; emits `open`, `rename`, `setColor: [color: string | null]`, `addStory`, `toggleDone`, `delete`. «Цвет» (подменю `DropdownMenuSub` с `PROJECT_COLOR_PALETTE` и «Без цвета») и «Добавить историю» рендерятся только при `group.type === 'epic'`. Триггер `⋯` виден всегда.
- **4.3** `AgileEpicBlock.vue` (modify)
  - Название становится кнопкой → emit `openGroup`. В режиме переименования вместо него `InlineTitleInput`.
  - Кнопка «Закрыть эпик» (`:67-73`) удаляется, её место занимают `+` и `GroupActionsMenu`.
  - `+` показывает строку «Задачи эпика» с `InlineTitleInput`, даже если задач эпика ещё нет. «Добавить историю» → `InlineTitleInput` после последней истории.
  - Новые emits: `openGroup: [id]`, `renameGroup: [id, title]`, `setGroupColor: [id, color]`, `createStory: [epicId, title]`, `toggleGroupDone: [group]`, `deleteGroup: [group]`, `createTask: [groupId, title]`; события историй пробрасываются наверх.
- **4.4** `AgileStoryBlock.vue` (modify) — то же для подписи истории: название-кнопка, `+`, `GroupActionsMenu`, переименование на месте.
- **4.5** `AgileBoardView.vue` (modify)
  - Строка «+ Эпик» с `InlineTitleInput` перед блоком «Без эпика» → `groupStore.createGroup(projectId, { title })`.
  - `createTask` → `taskStore.createTask({ title, projectId, columnId: lanes[0]?.id ?? null, groupId })`.
  - `deleteGroup` → `confirm` с текстом из `deletionImpact` и `pluralRu` («Удалить эпик „X“? Вместе с ним удалятся 2 истории. 5 задач останутся и переедут в „Без эпика“.») → `groupStore.deleteGroup`, затем задачи группы локально получают `groupId = null` (сервер это уже сделал через `SET NULL`).
  - `openGroup` → `useGroupDetail().open(projectId, id)`.
  - Invariant: удаление не удаляет задач; последствия названы до подтверждения.
- Commit: `feat(projects): manage epics and stories on the agile board`

### Phase 5 — фронт: карточка эпика или истории

- **5.1** `alfy-bot-frontend/src/features/projects/ui/GroupDetailDialog.vue` (create) — без props, читает `useGroupDetail().current`.
  - При открытии вызывает `groupStore.ensureGroups(projectId)`. Группа через `findGroup(groupsOf(projectId), groupId)`. Если после загрузки группы нет (удалена) → `close()`.
  - Оболочка и мобильный режим — как в `TaskDetailDialog` (`Dialog`/`DialogContent`, тот же `isDesktop`-брейкпоинт).
  - Шапка: `FolderOpen` + название проекта, у истории ещё «› Эпик» — кнопка → `open(projectId, epic.id)`. Меню `⋯` → «Удалить» с тем же подтверждением, что в 4.5, затем `close()`.
  - Основная часть: название (`ContentEditableInput`, сохраняется при потере фокуса через `updateGroup`), описание (`Textarea`, сохраняется при потере фокуса), список дочерних элементов. У эпика — истории со счётчиком `groupProgress` и пометкой «закрыта», затем задачи эпика. У истории — её задачи. Клик по истории → `open(projectId, story.id)`, клик по задаче → `close()` + `openTaskDetail(task)`.
  - Боковая колонка: статус (переключатель через `toggleGroupDone`), прогресс «n из m готово» с полоской. У эпика — `ColorPicker` и две даты (`Popover` + `Calendar` с `:locale="intlLocale"` и `:week-starts-on="weekStartsOn"` из `useLocale`, с очисткой даты). Формат даты — `YYYY-MM-DD` в локальном времени.
  - Invariant: одна модалка за раз; календари получают локаль.
- **5.2** `alfy-bot-frontend/src/App.vue` (modify) — `<GroupDetailDialog />` рядом с `<ConfirmDialog />`.
- Commit: `feat(projects): epic and story detail dialog`

### Phase 6 — фронт: диалог задачи

- **6.1** `alfy-bot-frontend/src/features/projects/ui/GroupPickerContent.vue` (create) — props `projectId: string`, `modelValue: string | null`; список: «Без эпика», затем эпики с вложенными историями (отступ), текущий отмечен; emits `update:modelValue`. Образец — `ProjectPickerContent.vue`.
- **6.2** `alfy-bot-frontend/src/features/projects/ui/GroupPicker.vue` (create) — секция боковой колонки по образцу `ProjectPicker.vue` (подпись «Эпик / История», значение «Эпик › История» или «Без эпика»), внутри `DropdownMenu` с `GroupPickerContent`.
- **6.3** `TaskDetailDialog.vue` (modify)
  - `localGroupId = ref<string | null>`, синхронизируется с `task.groupId` там же, где `localProjectId` (`:823`); в `onProjectChange` (`:733`) обнуляется.
  - `onGroupChange(value)` → `emitUpdate({ groupId: value })`, `activeDrawer = null`.
  - При `isAgileProject` → `groupStore.ensureGroups(localProjectId)`.
  - Шапка (`:17-20`): при `isAgileProject` вместо одного названия проекта — крошки по `groupPath`: «📁 Проект › Эпик › История». Эпик и история — кнопки: `emit('update:open', false)` + `useGroupDetail().open(projectId, id)`.
  - Боковая колонка: `<GroupPicker v-if="isAgileProject">` сразу после `ProjectPicker` (`:255`).
  - Мобильный режим: `DrawerField` + `'group'`, `DRAWER_TITLES.group = 'Эпик / История'`, в drawer `<GroupPickerContent v-if="activeDrawer === 'group'">`.
- **6.4** `TaskPropertyChips.vue` (modify) — prop `groupTitle?: string | null`. Чип `key: 'group'` (подпись — `groupTitle` или «Без эпика») рендерится, только когда проп передан. `TaskDetailDialog` передаёт его только при `isAgileProject`.
  - Principle: UI не предлагает недоступное — у задачи обычного проекта и Входящих нет ни крошек, ни поля.
- Commit: `feat(tasks): epic and story field and breadcrumbs in the task dialog`

### Test strategy

TDD, тесты первыми — фазы 1-3:

- `task.service.spec.ts`:
  - `create` с группой своего проекта → ок;
  - `create` с группой чужого проекта → 400;
  - `create` с `groupId` без проекта → 400;
  - `update` с `groupId` своей группы → ок;
  - `update` с группой чужого проекта → 400;
  - `update` с `groupId: null` → группа снята;
  - `update` со сменой проекта без `groupId` → группа обнулена (как сейчас);
  - `update` со сменой проекта и `groupId` группы целевого проекта → сохранён.
- `board-group.service.spec.ts`:
  - эпик с датами → ок;
  - история с датой при создании → 400; при обновлении → 400;
  - `startDate > dueDate` → 400;
  - обновление одной даты проверяется против текущей второй.
- `board-group-constraints.service.spec.ts` — тест 6 на схеме с новыми колонками.
- e2e `alfy-bot/test/board-groups.e2e-spec.ts`:
  - `POST /tasks` с `groupId` → 201 и группа на задаче;
  - `PATCH /tasks/:id` с группой другого проекта → 400, не 500;
  - `PATCH` эпика с датами → 200 и значения в ответе;
  - `PATCH` истории с датой → 400.
- Фронт:
  - `group-tree.spec.ts` — `groupPath`, `groupProgress`, `deletionImpact` (эпик с историями и задачами эпика, история);
  - `plural.spec.ts` — 1 / 2 / 5 / 11 / 21;
  - `group-store.spec.ts`: загрузка проекта B не меняет `groupsOf(A)`; `createGroup`/`updateGroup`/`deleteGroup` меняют только свой проект; откат при ошибке API;
  - `task-detail-navigation.spec.ts`: `openTaskDetail` вызывает зарегистрированный обработчик; unregister старого не снимает новый; без обработчика — `console.error`.

Компонентные тесты — после реализации, фазы 4-6:

- `AgileEpicBlock.spec.ts` / `AgileBoardView.spec.ts`:
  - `+` → ввод → Enter → `createTask` с `groupId` и первой колонкой;
  - Esc не создаёт;
  - «+ Эпик» создаёт эпик;
  - удаление показывает confirm с числами и не удаляет задачи из стора;
  - у истории в меню нет «Цвета» и «Добавить историю».
- `GroupDetailDialog.spec.ts`:
  - прогресс эпика;
  - клик по истории переключает карточку, клик по задаче закрывает её и вызывает `openTaskDetail`;
  - дат и цвета у истории нет;
  - календарь получает `locale`.
- `TaskDetailDialog.spec.ts`:
  - agile-задача → крошки «Проект › Эпик › История» и поле «Эпик / История»;
  - задача обычного проекта → ни того, ни другого;
  - выбор истории шлёт `groupId`;
  - клик по эпику в крошках закрывает диалог и открывает карточку.
- Существующие `AgileBoardView.spec.ts` и `AgileBacklogPanel.spec.ts` переводятся на `groupsOf`.

### Order & dependencies

1 и 2 независимы. 3 зависит от 2 (типы дат). 4, 5 и 6 зависят от 3. 5 нужен для кнопок «Открыть» из 4, но 4 можно закоммитить раньше: вызов `useGroupDetail().open` уже есть после фазы 3. 6 зависит от 1 (`groupId` в `PATCH`) и 5 (крошки открывают карточку).

### Open questions / risks / rollback

- **Совместимость.** Все изменения API только добавляют новое: `groupId` в DTO задачи, даты в DTO и ответе группы. `synchronize` добавит две колонки в `board_groups`, пересоздав таблицу. Триггеры восстанавливает `board-group-constraints.service.ts` на старте, фаза 2.4 это проверяет. Откат кода оставит в таблице лишние nullable-колонки, их никто не читает.
- **Кнопка «Закрыть эпик»** переезжает в меню `⋯` (фаза 4.3): поведение то же, меняется место.
- **`openTaskDetail` без зарегистрированного экрана** (например, карточка открыта на `/settings`) не откроет задачу и напишет `console.error`. Карточку открывают только доска и диалог задачи, а они живут на экранах с `useTaskDetailHandlers`, так что это достижимо лишь при будущей ошибке навигации.

## Verify
<empty — filled by up:uverify>

## Conclusion
<empty — filled by up:ureview>
