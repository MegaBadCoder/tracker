# Completion of a recurring task skips next instance to today/future

**Status:** done
**Branch:** main
**Worktree:** none
**Mode:** interactive

## Seed (raw user description)

> не работает, при completed задача встает на место которое дальше назначено по расписанию, и в целом, надо как-то расписание тоже чтобы отображалось и в календаре сегодня или в будущем, но не трогая прошлое

Working interpretation:

- **Bug:** при пользовательском «выполнить» на просроченной recurring-задаче (например, dueDate=20 апр, сегодня 29 апр) `completeRecurringTask` создаёт next instance на 21 апр (next-by-rule), а не на 29 апр. Цепочка снова в прошлом.
- **Принцип:** recurring должны «жить» в today+future. Прошлое не модифицируем (frozen остаются красными), но новые инстансы при completion и при cron'е всегда landing на сегодня или ближайший валидный по правилу день ≥ today.

## Design

(Размер: Small. Дизайн-стадия пропущена; принципы и инварианты записаны минимально.)

### Scope

Два симметричных фикса вокруг общего принципа: **новые/проектируемые вхождения recurring-задачи всегда landing на сегодня или ближайший валидный по правилу день ≥ today**.

1. **Backend — `completeRecurringTask`** ([alfy-bot/src/modules/task/task.service.ts:128-201](alfy-bot/src/modules/task/task.service.ts#L128-L201)). При пользовательском completion просроченной recurring-задачи новая инстанция должна landing на today/future, а не на «next-by-rule» (которое для просроченной может всё ещё быть в прошлом). Заменяем `computeNextDueDate(...)` на `findNextOccurrenceOnOrAfter(zonedDue, rule, startOfTodayLocal, countAfterComplete)`.

2. **Frontend — ghost projector** ([alfy-bot-frontend/src/features/calendar/lib/calendar-events.ts](alfy-bot-frontend/src/features/calendar/lib/calendar-events.ts), функция `tasksToCalendarEvents`). Если у recurring-задачи `dueDate < startOfToday`, ghost'ы должны проектироваться **от первого валидного по правилу дня ≥ today**, а не от исторического `dueDate`. Прошлые промежуточные дни (между старым `dueDate` и сегодня) не отображаются как ghost'ы.

### Invariants

- При `complete()` recurring-задачи новый instance имеет `dueDate ≥ startOfTodayLocal` (если серия не закончилась).
- Real past instances (с `dueDate < today`) не модифицируются — отображаются на своих исторических датах как обычно (история). Frozen overdue остаются красными на своих датах. **Прошлое не трогаем.**
- Ghost-проекция для recurring-задачи в past начинается с `max(naturalNext(dueDate), startOfTodayLocal)` валидной по правилу. Между past `dueDate` и `today-1` ghost'ов нет.
- `recurringCompletedCount` инкрементится на 1 при каждом completion (независимо от того, через сколько дней «перепрыгнули»). Это сохраняет существующую семантику endCount.
- Существующая идемпотентность `completeRecurringTask` (поиск existing successor через `findByParentId`) сохраняется — fix только меняет вычисление `nextDate`, не структуру операции.

### Principles

- Принцип «recurring живёт в today/future» применяется ко всем write-path'ам генерации новых инстансов и к ghost-визуализации. Прошлое — read-only история.
- Backend и frontend получают одинаковую логику «skip to today» через одинаковую формулу (BE: helper `findNextOccurrenceOnOrAfter`; FE: эквивалентная inline-логика или новый helper в `features/tasks/model/recurrence.ts`).

### TDD

**TDD: yes** для обоих фиксов:
- BE: расширение `task.service.spec.ts` — completion стартой задачи (dueDate=прошлое) → next instance имеет dueDate сегодня.
- FE: новый тест `calendar-events.spec.ts` (если нет, создать) или подключить существующий — для recurring-задачи с past dueDate, ghost'ы только на today+future, не на промежутке.

## Plan

Approach: 2 phase'а — backend completion fix + frontend ghost-projector fix. Оба применяют тот же принцип «skip to today» через симметричный helper.

### Phase 1 — Backend: completion lands new instance ≥ today

- **1.1** [alfy-bot/src/modules/task/task.service.ts:144-167](alfy-bot/src/modules/task/task.service.ts#L144-L167) (modify)
  - В `completeRecurringTask` после получения `timezone` и `completedCount`/`countAfterComplete`:
    - Вычислить `nowLocal = shiftToUserWallClock(new Date(), timezone)`.
    - Вычислить `startOfTodayLocal = new Date(nowLocal); startOfTodayLocal.setUTCHours(0, 0, 0, 0)`.
    - Заменить `computeNextDueDate(zonedDue, rule, countAfterComplete)` на `findNextOccurrenceOnOrAfter(zonedDue, task.recurrence, startOfTodayLocal, countAfterComplete)`.
  - Добавить импорт `findNextOccurrenceOnOrAfter` рядом с существующими `computeNextDueDate, buildNextInstance`.
  - Invariant: новый instance имеет `dueDate ≥ startOfTodayLocal` (если серия не закончилась).

- **1.2** [alfy-bot/src/modules/task/task.service.spec.ts:332-428](alfy-bot/src/modules/task/task.service.spec.ts#L332-L428) (modify)
  - В `describe('update — завершение recurring задачи', ...)` добавить `beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(new Date('2026-04-05T10:00:00.000Z')); })` и `afterEach(() => { jest.useRealTimers(); })`. Это сохранит старые expectations (`dueDate=April 6` после completion of `April 5` task — потому что today=April 5, naturalNext=April 6 ≥ today).
  - Аналогично в `describe('update — идемпотентность complete', ...)` и `describe('update — uncomplete recurring задачи', ...)` если они тоже используют даты в прошлом относительно реального wall-time.
  - **Новый failing test (TDD: yes)** — добавить в тот же describe: `it('завершение задачи с dueDate в прошлом → next instance landing на сегодня', ...)`. setSystemTime=`'2026-04-29T10:00:00.000Z'`, currentDue=`'2026-04-05T10:00:00.000Z'`, expect `instanceArg.dueDate.getTime() === new Date('2026-04-29T10:00:00.000Z').getTime()`.

- Commit: `fix(task): completion of recurring task lands next instance on today/future`

### Phase 2 — Frontend: ghost projector starts from today

- **2.1** [alfy-bot-frontend/src/features/tasks/model/recurrence.ts](alfy-bot-frontend/src/features/tasks/model/recurrence.ts) (modify)
  - Добавить экспорт после `computeNextDueDate`:
    ```ts
    export function findNextOccurrenceOnOrAfter(
      currentDue: Date,
      rule: RecurrenceRule,
      refDate: Date,
      completedCount = 0,
    ): Date | null
    ```
  - Реализация — зеркало BE-версии: итеративный вызов `computeNextDueDate` пока результат `< refDate`. Bound: 500 итераций; при превышении throw Error с frequency.
  - Invariant: возвращает первый результат `≥ refDate` или `null` если серия закончилась.

- **2.2** `alfy-bot-frontend/src/features/tasks/model/recurrence.spec.ts` (create)
  - Vitest spec по образцу backend recurrence.utils.spec.ts. Кейсы:
    - daily/interval=1, currentDue=прошлая неделя, ref=сегодня → сегодня.
    - weekly Mon, currentDue=last Mon, ref=Wed (between Mon-Mon) → next Mon.
    - currentDue=будущее, ref=сегодня → naturalNext (currentDue + 1 step) — никаких лишних итераций.
    - endCount исчерпан → null.

- **2.3** [alfy-bot-frontend/src/features/calendar/lib/calendar-events.ts:46-62](alfy-bot-frontend/src/features/calendar/lib/calendar-events.ts#L46-L62) (modify)
  - Импорт: добавить `findNextOccurrenceOnOrAfter` рядом с `computeNextDueDate`.
  - Перед циклом `for (let i = 0; i < 52; i++)` вычислить `startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0)`.
  - Заменить инициализацию `let current = dueDate` на:
    ```ts
    let current = dueDate
    if (dueDate < startOfToday) {
      const skipped = findNextOccurrenceOnOrAfter(dueDate, task.recurrence, startOfToday, completedCount)
      if (!skipped) continue  // series ended, no ghosts
      current = skipped
      // emit the skipped occurrence as a ghost if it's in the visible window
      if (skipped <= weekEnd && skipped >= weekStart && !isSameDay(skipped, dueDate)) {
        events.push(taskToEvent(task, skipped, true))
      }
    }
    ```
  - Цикл далее работает как был — итерируя от нового `current` вперёд, эмитя ghost'ы в [weekStart, weekEnd]. **Не модифицировать** условие `if (next >= weekStart && !isSameDay(next, dueDate))` — оно остаётся для корректного исключения исходной даты и фильтра окна.
  - Invariant: для recurring-задачи с `dueDate < today` ghost'ы не появляются на интервале `[dueDate+1, today-1]`.

- **2.4** `alfy-bot-frontend/src/features/calendar/lib/calendar-events.spec.ts` (create)
  - Vitest spec. Кейсы:
    - Recurring daily, `dueDate=2026-04-20`, `weekStart=2026-04-26`, `weekEnd=2026-05-02`, system time `2026-04-29` → ghost'ы только на `[2026-04-29, ..., 2026-05-02]`, нет на `[2026-04-26, 2026-04-27, 2026-04-28]`.
    - Recurring weekly Mon, `dueDate=2026-04-13` (Mon), система `2026-04-29` (Wed), визибл неделя `2026-04-26..2026-05-02` → ghost только на `2026-04-27` (Mon ≥ today). Нет ghost на `2026-04-20` (он < today, но и так не в окне).
    - Recurring с `dueDate=сегодня+1` (будущее) → ghost'ы по обычной forward-проекции (не задеваем).
    - Non-recurring задача → ghost'ов нет (контроль).
  - Использовать `vi.useFakeTimers()` + `vi.setSystemTime()` для детерминизма.

- Commit: `fix(calendar): project ghosts of past-due recurring tasks from today onwards`

### Test strategy

TDD: yes. Для обоих phase'ов failing-test пишется ДО реализации.
- Phase 1.2 — failing first для past-task scenario; обновление beforeEach setSystemTime для существующих тестов одновременно.
- Phase 2.2 + 2.4 — failing first для каждого нового spec'а.

После реализации обоих phase'ов:
- `cd alfy-bot && pnpm exec jest src/modules/task/` → все tests pass.
- `cd alfy-bot-frontend && pnpm exec vitest run src/features/tasks/model/recurrence.spec.ts src/features/calendar/lib/calendar-events.spec.ts` → новые passing.
- `cd alfy-bot-frontend && pnpm exec vue-tsc --noEmit` → clean.

### Backwards-compat

- BE: поведение completion для **NOT-просроченных** задач (`dueDate ≥ today`) не меняется — `findNextOccurrenceOnOrAfter` сразу возвращает naturalNext. Меняется только для просроченных. Это и есть цель.
- FE: ghost'ы для **NOT-просроченных** задач (`dueDate ≥ today`) проектируются как раньше — наш guard `if (dueDate < startOfToday)` пропускается. Меняется только для просроченных.
- Existing tests в `task.service.spec.ts` для completion path требуют `setSystemTime` обновления (см. 1.2) — это часть phase'а, не deviation.

### Order & dependencies

Phase 1 и Phase 2 независимы — могут идти в любом порядке. Делаю последовательно (1→2) для линейной истории. Внутри Phase 2: 2.1 → 2.2 → 2.3 → 2.4 (helper создаётся первым, проектор использует его, тесты последними).

## Verify

**Result:** passed

Positive:
- BE jest `task.service.spec.ts` → 40/40 pass, включая новый кейс «завершение задачи с dueDate в прошлом → next instance landing на сегодня».
- FE vitest `recurrence.spec.ts` + `calendar-events.spec.ts` → 8/8 pass (daily/weekly/future/non-recurring + skip-to-today scenarios).

Negative:
- BE: existing «endCount достигнут / endDate пройдена → nextInstance не создаётся» tests pass — series-end semantics не сломаны.
- FE: control case «non-recurring task → ghost'ов нет» в `calendar-events.spec.ts`.

Invariants:
- Domain `recurrence.utils.ts` timezone-agnostic — `grep "shiftToUserWallClock\|shiftBackToUtc" recurrence.utils.ts` → 0 совпадений.
- `recurringCompletedCount` инкрементится только на +1 ([task.service.ts:198,202](alfy-bot/src/modules/task/task.service.ts#L198-L202)).
- Симметричный helper `findNextOccurrenceOnOrAfter` присутствует и в BE ([recurrence.utils.ts:201](alfy-bot/src/modules/task/domain/recurrence.utils.ts#L201)) и в FE ([recurrence.ts:82](alfy-bot-frontend/src/features/tasks/model/recurrence.ts#L82)) с одинаковой сигнатурой.
- FE type-check `vue-tsc --noEmit` → exit 0.
- BE build `nest build` → exit 0 (запущен ранее по итогам Phase 1).

Notes:
- **Live UI smoke deferred** — требует запущенный stack (`pnpm start:dev` + `pnpm dev`) и кликов в браузере: (1) клик на checkbox у задачи с прошлым `dueDate` → новая инстанция на сегодня; (2) визуальная проверка календаря — past-due recurring не имеет ghost'ов на интервале `[dueDate+1, today-1]`.
- **TZ-устойчивость FE-тестов** — `vi.setSystemTime` с local-time-constructed dates verified на Asia/Yekaterinburg (UTC+5). Если CI запускается в UTC и спецификации становятся flaky — нужно будет переписать на UTC-явные даты. Сейчас не риск (CI пока не настроен).

## Conclusion

Outcome: completion и ghost-проектор recurring-задач теперь landing на сегодня/будущее (commits `96fc498..ba81148`). Reviewer: merge-ready, 0 findings ≥80 confidence.

Invariants:
- Новый instance после completion имеет `dueDate ≥ startOfTodayLocal` — `findNextOccurrenceOnOrAfter` гарантирует, новый jest test покрывает кейс.
- Real past instances не модифицируются — `complete()` пишет только `task.completed=true`, `task.dueDate` сохраняется (verified diff'ом в `task.service.ts`).
- Ghost-проекция начинается с `max(naturalNext, startOfToday)` — `calendar-events.ts:53-70` skip-to-today branch + spec-кейс past-due daily.
- `recurringCompletedCount` инкрементится на +1 — код инкремента не задет ни одним коммитом (verified `task.service.ts:198,202`).
- Domain `recurrence.utils.ts` timezone-agnostic — `grep` 0 совпадений TZ-helper'ов в файле.
- BE↔FE симметрия `findNextOccurrenceOnOrAfter` — одинаковая сигнатура `(currentDue, rule, refDate, completedCount=0): Date|null`, одинаковая логика и 500-bound (reviewer verified).

Plan adherence:
- `vitest.config.ts` — additive change (`include` теперь покрывает `src/**/*.spec.ts`). Без него Phase 2.2/2.4 spec'ы не обнаруживались Vitest'ом. План этого не упоминал; решение принято исполнителем по необходимости. Существующая `tests/**` location сохранена, новых конфликтов нет.
- Defensive duplicate-guard `!isSameDay(skipped, dueDate)` на свежеэмитимом skipped occurrence — расширение существующего паттерна, плану не противоречит.

Verified by: live UI smoke deferred — требует stack + ручной клик «выполнить» на просроченной recurring задаче и визуальной проверки, что ghost'ы не появляются на интервале `[dueDate+1, today-1]`.
