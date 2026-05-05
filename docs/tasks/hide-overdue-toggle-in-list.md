# Hide overdue toggle in list view

**Status:** done
**Branch:** main
**Worktree:** none
**Mode:** interactive

## Original request

> у меня задачи которые в напоминаниях подсвечиваются красным и в календаре и в списке, когда создаются новые, у меня должен срабатывать фильтр в списке входящих и исходящий во Frontend что они должны скрываться вместе с выполненными
>
> Блин я тебя запутал, давай просто добавим еще один toggle скрывать просроченные и только в списке. Скрываются всегда по умолчанию.

Когда повторяющаяся задача просрочивается, бэкенд создаёт новый instance, а старый «красный» остаётся в списке и захламляет вью. Юзер хочет тоггл «Скрывать просроченные» рядом с существующим «Выполненные задачи» — только в List-вью, по умолчанию ON (просроченные скрыты).

## Spec (Small — Design skipped)

- Новый тоггл «Скрывать просроченные» в той же шапке/панели, где сейчас «Выполненные задачи».
- **Scope:** только List-вью. Не Calendar, не Inbox, не другие.
- **Default:** ON (просроченные скрыты при первом открытии).
- **Persistence:** сохраняется так же, как существующий `Выполненные задачи` (тот же механизм — localStorage / Pinia / user settings — что используется сейчас).
- **Семантика overdue:** задача с `dueDate < сейчас` и `completed = false`. Конкретное определение — то же, что подсвечивает красным (см. existing logic).

## Plan

Approach: зеркалим существующий механизм `useShowCompleted` (composable + localStorage + scope `'inbox'`/`projectId`) — добавляем `useHideOverdue` с дефолтом `true` и плагуем его в фильтры там же, где сейчас живёт `showCompleted`. Тоггл попадает в существующий `TaskListOptionsMenu` рядом с «Выполненные задачи». Поскольку этот меню рендерится в [TasksView](alfy-bot-frontend/src/views/TasksView.vue) и [ProjectView](alfy-bot-frontend/src/views/ProjectView.vue) (как в list-, так и в board-режиме), фильтр применяется к ним всем; календарь не трогаем.

**Scope-интерпретация:** «только в списке» = там, где сейчас рендерится `TaskListOptionsMenu`. Это включает board-режим проекта (меню там видно). Calendar — исключён, у него отдельный набор контролов и нет `TaskListOptionsMenu`.

### Phase 1 — Composable + UI

- **1.1** [alfy-bot-frontend/src/features/tasks/lib/use-hide-overdue.ts](alfy-bot-frontend/src/features/tasks/lib/use-hide-overdue.ts) (create)
  - `useHideOverdue(scope: Ref<string> | string): Ref<boolean>` — копия [use-show-completed.ts](alfy-bot-frontend/src/features/tasks/lib/use-show-completed.ts) с двумя отличиями: `STORAGE_KEY = 'hide_overdue_tasks'`, дефолт `true` (`loadAll()[s] ?? true` остаётся, но поведение «не задано → ON» — то есть скрыто).
  - Persistence: `localStorage`, `Record<scope, boolean>`, тот же scope-watcher на смену `projectId`.

- **1.2** [alfy-bot-frontend/src/features/tasks/ui/TaskListOptionsMenu.vue:12-13](alfy-bot-frontend/src/features/tasks/ui/TaskListOptionsMenu.vue#L12-L13) (modify)
  - `defineProps<{ showCompleted: boolean; hideOverdue: boolean }>()` — добавить второе поле.
  - `defineEmits<{ 'update:showCompleted': [value: boolean]; 'update:hideOverdue': [value: boolean] }>()` — добавить второй emit.
  - Шаблон ([:23-35](alfy-bot-frontend/src/features/tasks/ui/TaskListOptionsMenu.vue#L23-L35)): добавить вторым `<DropdownMenuItem>` с лейблом «Скрывать просроченные» и `<Switch>`, биндинг к `hideOverdue` / `update:hideOverdue`. Тот же паттерн `@select.prevent` + `@click.stop`, чтобы не закрывать меню.

- Commit: `feat(tasks): add hide-overdue toggle to list options menu`

### Phase 2 — Wire into TasksView (Inbox)

- **2.1** [alfy-bot-frontend/src/views/TasksView.vue:10](alfy-bot-frontend/src/views/TasksView.vue#L10) (modify)
  - Импортировать `useHideOverdue` рядом с `useShowCompleted`.
- **2.2** [alfy-bot-frontend/src/views/TasksView.vue:38](alfy-bot-frontend/src/views/TasksView.vue#L38) (modify)
  - `const hideOverdue = useHideOverdue('inbox')`.
- **2.3** [alfy-bot-frontend/src/views/TasksView.vue:56-65](alfy-bot-frontend/src/views/TasksView.vue#L56-L65) (modify) — `sortedTasks`
  - Добавить шаг фильтра: `.filter(t => !hideOverdue.value || !t.isOverdue)` после `showCompleted`-фильтра.
- **2.4** [alfy-bot-frontend/src/views/TasksView.vue:130](alfy-bot-frontend/src/views/TasksView.vue#L130) (modify)
  - `<TaskListOptionsMenu v-model:show-completed="showCompleted" v-model:hide-overdue="hideOverdue" />`.

- Commit: `feat(inbox): respect hide-overdue toggle in tasks list`

### Phase 3 — Wire into ProjectView (list + board)

- **3.1** [alfy-bot-frontend/src/views/ProjectView.vue:14](alfy-bot-frontend/src/views/ProjectView.vue#L14), [:29](alfy-bot-frontend/src/views/ProjectView.vue#L29) (modify)
  - Импорт + `const hideOverdue = useHideOverdue(projectId)` (Ref-scope, чтобы переключение между проектами читало нужное значение — как у `showCompleted`).
- **3.2** [alfy-bot-frontend/src/views/ProjectView.vue:58-67](alfy-bot-frontend/src/views/ProjectView.vue#L58-L67) (modify) — `filteredTasks`
  - Добавить `.filter(t => !hideOverdue.value || !t.isOverdue)`.
- **3.3** [alfy-bot-frontend/src/views/ProjectView.vue:137](alfy-bot-frontend/src/views/ProjectView.vue#L137) (modify)
  - `<TaskListOptionsMenu v-model:show-completed="showCompleted" v-model:hide-overdue="hideOverdue" />`.
- **3.4** [alfy-bot-frontend/src/views/ProjectView.vue:161-167](alfy-bot-frontend/src/views/ProjectView.vue#L161-L167) (modify) — `<BoardView>`
  - Передать `:hide-overdue="hideOverdue"`.
- **3.5** [alfy-bot-frontend/src/features/projects/ui/BoardView.vue:12-17](alfy-bot-frontend/src/features/projects/ui/BoardView.vue#L12-L17) (modify) — `defineProps`
  - Добавить `hideOverdue?: boolean` с дефолтом `true` (соответствует «по умолчанию скрыто»).
- **3.6** [alfy-bot-frontend/src/features/projects/ui/BoardView.vue:29-31](alfy-bot-frontend/src/features/projects/ui/BoardView.vue#L29-L31) (modify) — `projectTasks` computed
  - Расширить фильтр: `(props.showCompleted || !t.completed) && (!props.hideOverdue || !t.isOverdue)`.

- Commit: `feat(project): respect hide-overdue toggle in board and list views`

### Test strategy

TDD: no — мелкое UI-изменение, copy-paste композэбла + добавление клаузы фильтра. Существующий `useShowCompleted` тоже без unit-тестов; вводить новый паттерн для одного из них непропорционально. Покрытие проверяется ручным smoke-тестом в `up:uverify`:
- Дефолт: открыть Inbox с просроченной задачей → не видна.
- Toggle OFF (показать) → появляется, красная подсветка работает.
- Перезагрузка страницы → состояние сохраняется per-scope (Inbox vs project).
- Calendar и `TaskCard.isOverdue`-стилизация не задеты.

### Order & dependencies

Phase 1 блокирует 2 и 3 (composable и тоггл нужны им обоим). Phase 2 и 3 независимы — можно мёрджить отдельными коммитами.

### Backwards-compat

Никаких миграций. Новый ключ `hide_overdue_tasks` в localStorage добавляется чисто, у существующих юзеров просто включится дефолт (`true` → скрыто). Старый ключ `show_completed_tasks` не трогаем.

### Open questions / risks

- Если у юзера на момент релиза в списке только просроченные (всё, что висит как hangover от рекуррентов), при первом открытии лист будет пустым — это ожидаемое поведение, тоггл легко вернуть. Empty-state в `TasksView`/`GroupedListView` уже есть.

## Verify

**Result:** passed

Positive:
- Default `hideOverdue=true` (toggle checked by reload в Inbox и в незатронутом проекте — per-scope ?? true)
- Toggle OFF → injected fake overdue появляется в `[role="list"]` (count 5→6)
- Toggle ON → fake overdue прячется (count 6→5)
- `localStorage["hide_overdue_tasks"]` пишется и переживает reload (`{"inbox":true}` после toggle ON в Inbox)
- ProjectView: оба тоггла рендерятся в том же меню, новый чекнут по дефолту
- Per-scope persistence: после toggle в Inbox в `localStorage` только ключ `inbox`, project-scope не задет

Negative:
- Calendar (`/tasks/calendar`) не имеет «Параметры списка» (`aria-label` отсутствует), консоль чистая

Invariants:
- vue-tsc: единственная ошибка — `task.isOverdueфы` в [TaskCard.vue:29](alfy-bot-frontend/src/features/tasks/ui/TaskCard.vue#L29), pre-existing (введена коммитом `20ad6b8 fix` сегодня), не связана со scope
- Тесты: baseline 8 fails / 133 pass → с изменениями 8 fails / 134 pass (новых регрессий нет; разница в +1 — pre-existing modified test в `project-store.spec.ts` в воркдире)

Smoke: chrome-devtools на запущенном vite (5173) + nest (3002) → инжектил fake overdue в Pinia, гонял оба toggle-state, ходил между Inbox/Project/Calendar — поведение совпадает со спекой.

Notes: pre-existing TS-typo (`isOverdueфы`) и 8 пре-существующих fail-тестов — флагую, но не чиню (вне scope задачи).

## Conclusion

Outcome: добавлен тоггл «Скрывать просроченные» (default ON) в `TaskListOptionsMenu`, фильтр пробросан в Inbox + ProjectView (list & board); HEAD `c7a365a`.

Invariants:
- Calendar не задет — `TaskListOptionsMenu` там не рендерится, фильтрация задач не менялась (verify: `/tasks/calendar` без `aria-label="Параметры списка"`, консоль чистая)
- Persistence per-scope — отдельный localStorage-ключ `hide_overdue_tasks` с записями `{ inbox: bool, [projectId]: bool }`, не пересекается с `show_completed_tasks` (verify: `localStorage["hide_overdue_tasks"] === '{"inbox":true}'` после toggle в Inbox; project-scope не задет)
- Default ON — composable возвращает `true` для незаписанного scope (verify: ProjectView впервые открыт, switch checked)
