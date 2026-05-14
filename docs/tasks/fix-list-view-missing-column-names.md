# Fix list view missing column names

**Status:** done
**Branch:** main
**Worktree:** none
**Mode:** interactive

## Original request

> когда я меняю отображение в Sidebar при переключении отображения @alfy-bot-frontend/src/views/ProjectView.vue меняется с колонки на список, то пропадают названия

When switching the project's view mode from board (columns) to list in `ProjectView.vue`, the names (presumably column/group titles) disappear.

## Design
<empty — filled by up:udesign>

### Invariants
<empty>

### Principles
<empty>

## Plan

Approach: устранить асимметрию между board и list. Board всегда рендерит секцию «Без раздела» (`BoardColumn` с `column=null`), а list прячется за условием `v-if="columns.length > 0"` и при 0 колонок проваливается в плоский `TaskCard`-список без заголовков. Решение — всегда рендерить `GroupedListView` в list-режиме; он сам корректно покажет «Без раздела» и колонки, если они есть.

### Phase 1 — Always render GroupedListView in list mode

- **1.1** [alfy-bot-frontend/src/views/ProjectView.vue:190-217](alfy-bot-frontend/src/views/ProjectView.vue#L190-L217) (modify) — упростить условный рендер
  - Удалить `v-if="columns.length > 0"` у `<GroupedListView>` и весь fallback `<template v-else>` (плоский список + сообщение «В этом проекте пока нет задач»).
  - Empty-state «В этом проекте пока нет задач» перенести в `GroupedListView` (см. 1.2) либо оставить отдельным блоком в `ProjectView` под `<GroupedListView>`, показываемым по `v-if="filteredTasks.length === 0 && columns.length === 0"`. Предпочитаем перенос внутрь GroupedListView, чтобы вью оставался самодостаточным.
- **1.2** [alfy-bot-frontend/src/features/projects/ui/GroupedListView.vue:1-49](alfy-bot-frontend/src/features/projects/ui/GroupedListView.vue#L1-L49) (modify) — самодостаточный empty state + всегда показывать «Без раздела»
  - В шапке uncategorized убрать `v-if="uncategorizedTasks.length > 0"` если нет колонок (`props.columns.length === 0`) — чтобы при пустом проекте всё ещё была секция «Без раздела» с пустым подразделом или сообщением «Нет задач». Логика: показывать секцию «Без раздела» если `uncategorizedTasks.length > 0` ИЛИ `props.columns.length === 0`.
  - Добавить общий empty-state блок: `v-if="props.tasks.length === 0 && props.columns.length === 0"` → текст «В этом проекте пока нет задач.» с теми же классами что и удаляемый из ProjectView.
- **1.3** [alfy-bot-frontend/src/views/ProjectView.vue:1-20](alfy-bot-frontend/src/views/ProjectView.vue#L1-L20) (modify) — почистить импорт `TaskCard`, если после правки он больше не используется в этом файле.
- Invariant: board-режим не трогаем — он уже корректен.
- Commit: `fix(project-list): always render grouped list to keep section headers in list view`

### Test strategy

Ручная проверка (smoke):
- Проект с ≥2 колонками + задачами. Board → list: колонки и «Без раздела» (если есть нераспределённые задачи) видны с заголовками. ✓
- Проект **без колонок** (`columns.length === 0`), задачи есть. Board → list: видна секция «Без раздела» + список задач. (Главный сценарий бага.)
- Совсем пустой проект (0 колонок, 0 задач). Board → list: empty state «В этом проекте пока нет задач.»
- Проект с колонками, но все задачи внутри колонок (нет uncategorized). List: «Без раздела» **не** появляется (т.к. `uncategorizedTasks.length === 0` и `columns.length > 0`).

### Open questions / risks / rollback

- Если наш диагноз неверен и реальная причина в data-flow (например, `columns` обнуляется при смене `viewMode`), фикс всё равно не ухудшит ситуацию (GroupedListView рендерится всегда), но и не вылечит до конца. Если на verify шаге окажется что и после фикса заголовки не появляются — снимаем `console.log` в `columns` computed и чиним store.
- Rollback: revert одного коммита.

### Backwards-compat

UI-only, без изменений API/схемы/контракта стора.

## Verify

**Result:** passed (логический + type-check; UI smoke — за пользователем)

Positive (по diff [GroupedListView.vue](alfy-bot-frontend/src/features/projects/ui/GroupedListView.vue) и [ProjectView.vue](alfy-bot-frontend/src/views/ProjectView.vue)):
- Проект с колонками + задачами в list-режиме → GroupedListView рендерится, секции `col.title` видны.
- Проект без колонок + задачи → все задачи в `uncategorizedTasks` → секция «Без раздела» видна.
- Совсем пустой проект → top-level блок `v-if="tasks.length === 0 && columns.length === 0"` показывает «В этом проекте пока нет задач.»

Negative:
- Колонки есть, нет нераспределённых → секция «Без раздела» не появляется (`v-if="uncategorizedTasks.length > 0"` ложно).

Type-check: `npx vue-tsc --noEmit -p tsconfig.app.json` → EXIT=0.

Tests: `npm run test:run` → 8 failed (TaskForm, TaskCard, tasks-api). Сверено с `201d205` (commit до моих коммитов) — те же 8 fail. Регрессия предсуществующая, вне scope.

Smoke (deferred to user): запустить `npm run dev`, открыть проблемный проект и сравнить board↔list для (a) проекта с колонками, (b) проекта без колонок, (c) пустого проекта. Если хоть один сценарий не отрисует заголовки/empty state — вернуться в execute.

Notes: dev-сервер запускался (порт 5174), но автоматизированный smoke через chrome-devtools требует логина (Telegram WebApp / dev-flag), что вне моих средств. Логика рендера верифицирована чтением diff.

## Conclusion

Outcome: list view всегда рендерит `GroupedListView`, board↔list симметрия восстановлена (commit `592703f`).

Invariants:
- Board view не трогается — подтверждено: ни `BoardView.vue`, ни `BoardColumn.vue`, ни `BoardColumnHeader.vue` не входят в diff (`git diff 6797a02..592703f --stat`).

Future work:
- Orphan tasks: задача с `columnId`, ссылающимся на несуществующую колонку (например, во время project-switch race), невидима (отфильтровывается и из `uncategorizedTasks`, и из per-column списков). Justification: пре-существующий риск, не вводимый этим diff; reviewer пометил как nice-to-have.
- Empty `filteredTasks` при наличии колонок: показывается каждая колонка с «Нет задач» вместо одного top-level empty state. Justification: совпадает с пре-фикс поведением ветки `columns.length > 0`; вне scope.

Verified by: type-check `npx vue-tsc --noEmit -p tsconfig.app.json` (EXIT=0); UI smoke deferred to user (требуется логин для автоматизации, см. Verify → Notes).

### Deviations from plan

- **1.2 — условие «Без раздела»:** план предлагал расширить `v-if="uncategorizedTasks.length > 0"` до `|| props.columns.length === 0`. Не реализовано — избыточно. Когда колонок нет, все задачи через `filter(t => !t.columnId)` попадают в `uncategorizedTasks`, и существующее условие уже корректно показывает секцию. Empty-case (нет ни колонок, ни задач) теперь покрывается отдельным top-level empty-state блоком.
