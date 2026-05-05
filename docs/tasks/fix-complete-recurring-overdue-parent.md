# Fix complete-recurring idempotency for overdue parent

**Status:** planning
**Branch:** main
**Worktree:** none
**Mode:** interactive

## Original request

> Я ее выполнил, но она не перенеслась но новый день следующий по расписанию

При завершении successor'а повторяющейся задачи (тот, что cron создал из past-due родителя) idempotency-проверка в `completeRecurringTask` ошибочно решает, что «следующий инстанс уже существует», ловит overdue-родителя как existingNext, идёт в fast-path → новый инстанс на завтра не создаётся, `recurringCompletedCount` не инкрементируется.

## Spec (Small — Design skipped)

**Root cause:** `TaskRepositoryPort.findByParentId(parentId, onlyUncompleted=true)` в [typeorm-task.repository.ts:131-146](alfy-bot/src/modules/task/infrastructure/typeorm-task.repository.ts#L131-L146) возвращает И детей серии, И **самого парента** (через ветку `{id: parentId, completed: false}`). Овердью-родитель в БД хранится как `completed=false, isOverdue=true` → попадает в выборку → коллеры в `task.service.ts` (complete- и uncomplete-recurring флоу) ошибочно считают его незавершённым инстансом.

**Семантика операции:** «найти незавершённые инстансы серии, чтобы решать idempotency / promotion» — overdue-родитель к незавершённым инстансам серии не относится: он архивный, по нему уже создан successor.

**Fix:** в SQL-условии `findByParentId` исключить `isOverdue=true` записи. Применяется к обеим веткам (`onlyUncompleted=true` и `=false`), чтобы семантика была единой и предсказуемой.

**Verification (request from user):** smoke-данные уже лежат в БД — overdue-парент `3e1c16ef-...` + псевдо-completed successor `9283725e-...`. Перед verify нужно вернуть successor в исходное состояние (recurrence/recurringParentId восстановить, completed=false), либо прогнать с нуля (создать ещё одну смок-задачу). Цель: завершить successor → backend создаёт новый инстанс на завтра, `recurringCompletedCount` инкрементируется.

## Plan

Approach: добавить фильтр `isOverdue: false` в обе ветки SQL-условия `TaskRepositoryPort.findByParentId` (typeorm-репо). Это однострочное изменение на стороне репозитория — семантика «инстансы серии, которые ещё живые» становится явной, оба коллера (complete- и uncomplete-recurring флоу в `task.service.ts`) автоматически перестают видеть архивный overdue-парент.

### Phase 1 — Exclude overdue parents from findByParentId

- **1.1** [alfy-bot/src/modules/task/infrastructure/typeorm-task.repository.ts:131-146](alfy-bot/src/modules/task/infrastructure/typeorm-task.repository.ts#L131-L146) (modify) — `findByParentId(parentId, onlyUncompleted)`
  - В `where` добавить `isOverdue: false` ко всем четырём sub-clause'ам (по два в каждой ветке `onlyUncompleted`).
  - Семантика: «вернуть детей серии и сам root, исключая архивные overdue-инстансы».
- Commit: `fix(recurring): exclude overdue parent from findByParentId result`

### Test strategy

TDD: no.

- Существующие service-тесты `task.service.spec.ts` мокают `findByParentId` напрямую и не задевают SQL-уровень — они продолжат проходить.
- Repo-уровневой интеграционной тест-инфры в проекте нет (`find ... .repository.spec.ts` — пусто); вводить её ради одностроки — over-engineering.
- Покрытие через **manual smoke** в `up:uverify`: smoke-данные уже в БД (overdue-парент `3e1c16ef-...` + successor `9283725e-...` в зомби-состоянии после прошлой попытки юзера). План в Verify:
  - Сбросить состояние successor (recurrence + recurringParentId восстановить, completed=false), либо удалить и пересоздать чистую пару через cron.
  - Дёрнуть toggle complete на successor через API → ожидаем: новый инстанс с `dueDate` ≈ сегодня создан, `recurringCompletedCount` парента инкрементирован, `pomodoroConfig` нового инстанса несёт настройки.

### Backwards-compat

Запрос возвращает **меньше** строк (исключает overdue-парента). Оба известных коллера (`completeRecurringTask`, `uncompleteRecurringTask`) хотели именно это поведение — overdue-парент в их idempotency-логике это false positive. Других коллеров `findByParentId` нет (`grep -r findByParentId src/ --exclude=*.spec.ts --exclude=*repository*` → пусто). Существующие тесты репо отсутствуют → ничего не сломается на test-suite.

### Open questions / risks

- Если в будущем появится коллер, которому overdue-парент **нужен** в результате (например для отчётов/архива) — придётся параметризовать. Сейчас спекулятивно, не делаем.

## Verify

**Result:** passed

Positive:
- E2E smoke: clean parent (overdue, count=0) + cron-сгенерированный successor → `PATCH /api/tasks/<successor> {completed:true}` → response несёт `task` (successor.completed=true, recurrence жив, recurringParentId жив) **и** `nextInstance` (новый инстанс на сегодня с pomodoro)
- В БД: parent.recurringCompletedCount **0→1** (инкремент сработал), новый инстанс с `dueDate=2026-05-05`, recurrence жив, pomodoroConfig скопирован (count=6, completed=0) — это даёт обе предыдущих фикса задачи pomodoro-carryover

Negative:
- Existing 105 task-тестов зелёные (мокают `findByParentId` напрямую, фактический SQL-фильтр их не задевает)

Invariants:
- HEAD diff = только 8 SQL-строк в `findByParentId`, ничего больше
- TypeScript clean

Smoke: `curl PATCH /api/tasks/$SUCCESSOR_ID {completed:true}` → response.nextInstance.id отличается от parent.id, parent.recurringCompletedCount=1 в БД

## Conclusion
<empty — filled by up:ureview>
