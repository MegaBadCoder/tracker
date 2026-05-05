# Carry pomodoro config to recurring task instances

**Status:** done
**Branch:** main
**Worktree:** none
**Mode:** interactive

## Original request

> Это не переносятся настройки помодоро на вновь созданные задачи из тех что просрочились
>
> pastDue вообще не чиним, только чтобы настройки pomodoro переносились у задач которые по крону в Overdue подсвечиваются

Кронжоб, который шифтует past-due рекуррент-задачу на сегодня (создаёт новый инстанс, старый помечает overdue и подсвечивает красным), не копирует pomodoro-конфигурацию со старого инстанса. У нового инстанса pomodoro-поля приходят с дефолтами/нулями вместо унаследованных от шаблона.

## Spec (Small — Design skipped)

**Скоуп:** только cron-задача, которая обрабатывает past-due рекурренты. Сценарий «complete recurring → создать следующий инстанс» — out of scope (там тикет уже закрыт, см. `docs/tasks/complete-recurring-skip-to-today.md`).

**Что переносить со старого инстанса на новый:**
- `isPomodoroTask`
- `pomodoroDuration`
- `shortBreak`
- `longBreak`
- `longBreakInterval`
- `pomodoroCount`

**Что сбрасывать:**
- `pomodoroCompleted` → `0` (новый инстанс — нулевой счётчик)

**Verification (request from user):** на этапе `up:uverify` создать в SQLite повторяющуюся (every day) задачу с pomodoro-настройками, выставить `dueDate` в прошлое, дёрнуть cron вручную → старый инстанс становится overdue, новый инстанс на сегодня несёт те же pomodoro-поля.

## Plan

Approach: в freeze-ветке `OverdueRecurringService.processForUser` склонировать `task.pomodoroConfig` в новый `PomodoroConfig` (5 настроек скопировать, `pomodoroCompleted=0`), приклеить к `successorData.pomodoroConfig`. TypeORM каскадно создаст pomodoro_configs row для нового инстанса (cascade=true на `Task.pomodoroConfig` OneToOne). Domain-слой (`buildNextInstance`) не трогаем: pomodoro — это infrastructure entity, а сервис уже работает на уровне сущностей.

**Shift-ветка вне scope:** там обновляется тот же task-row, отдельный `pomodoroConfig`-row уже привязан к нему — переносить нечего.

### Phase 1 — Carry pomodoro on freeze + tests

- **1.1** [alfy-bot/src/modules/task/overdue-recurring.service.ts:1-10](alfy-bot/src/modules/task/overdue-recurring.service.ts#L1-L10) (modify)
  - Импорт: `import { PomodoroConfig } from '../../shared/entities'`.
- **1.2** [alfy-bot/src/modules/task/overdue-recurring.service.ts](alfy-bot/src/modules/task/overdue-recurring.service.ts) (modify) — добавить top-level helper:
  - `function clonePomodoroConfigFresh(src: PomodoroConfig): PomodoroConfig` — `new PomodoroConfig()`, копирует `pomodoroCount`, `pomodoroDuration`, `shortBreak`, `longBreak`, `longBreakInterval`; `pomodoroCompleted = 0`. Без `id`/`taskId` (TypeORM выставит при cascade-save).
- **1.3** [alfy-bot/src/modules/task/overdue-recurring.service.ts:54-60](alfy-bot/src/modules/task/overdue-recurring.service.ts#L54-L60) (modify) — freeze-ветка
  - После строчки `const successorData = nextDate ? buildNextInstance(task, nextDate, parentId) : null;` — если `successorData && task.pomodoroConfig`, заменить: `successorData = { ...successorData, pomodoroConfig: clonePomodoroConfigFresh(task.pomodoroConfig) } as Partial<Task>`. (Cast нужен: `NextInstanceData` не знает про pomodoroConfig; репо ожидает `Partial<Task>`.)
- **1.4** [alfy-bot/src/modules/task/overdue-recurring.service.spec.ts](alfy-bot/src/modules/task/overdue-recurring.service.spec.ts) (modify) — добавить два теста в `describe('processForUser — freeze branch')`:
  - **a)** Кандидат с `pomodoroConfig` (значения отличаются от дефолтов: `pomodoroCount: 6, pomodoroDuration: 30, shortBreak: 7, longBreak: 20, longBreakInterval: 3, pomodoroCompleted: 4`). Assert: `freezeAndCreateNext.mock.calls[0][1].pomodoroConfig` — instance of `PomodoroConfig`, c теми же 5 значениями, `pomodoroCompleted === 0`.
  - **b)** Кандидат без `pomodoroConfig` (`pomodoroConfig: null`). Assert: `successorData.pomodoroConfig` отсутствует/undefined.
- Commit: `fix(recurring): carry pomodoro config to overdue successor`

### Test strategy

TDD: yes (unit-test пишем сначала — тривиально подтвердит RED перед фиксом). Existing spec инфра использует `makeTask` factory, новых хелперов не нужно — `pomodoroConfig` строится инлайн в тесте.

### Backwards-compat

Существующие `tasks` без `pomodoro_configs` — без изменений; freeze-ветка ведёт себя как раньше (helper не вызывается). Существующие freeze-тесты не assert'ят `pomodoroConfig` → не сломаются.

### Open questions / risks

- TypeORM cascade на OneToOne: production-`task.service.ts:create` уже пользуется этим же паттерном (`taskData.pomodoroConfig = new PomodoroConfig()`), значит работает. Но `tx.create(Task, partial); tx.save(created)` в `freezeAndCreateNext` — другой путь. Подтвердим в `up:uverify` через ручной SQLite-смоук: создать рекуррент-задачу с pomodoro + dueDate в прошлом + `onMissed='freeze'`, дёрнуть cron, проверить `pomodoro_configs`-строку у successor'а.

## Verify

**Result:** passed

Positive:
- Unit: `freeze` ветка с `pomodoroConfig` → successor получает свежий `PomodoroConfig` (instance), 5 настроек скопированы (6/30/7/20/3), `pomodoroCompleted=0`, `id`/`taskId` не выставлены (TypeORM выставит при cascade-save)
- Unit: `freeze` ветка без `pomodoroConfig` → `successor.pomodoroConfig === undefined`
- Все 8 тестов в `overdue-recurring.service.spec.ts` зелёные; 105 task-module тестов — зелёные

Negative:
- `shift`-ветка не задета: тесты «сдвигает dueDate» и «серия закончилась» зелёные

Invariants:
- `buildNextInstance` (домен) не модифицирован — diff ограничен `overdue-recurring.service.{ts,spec.ts}`
- TypeORM cascade на `Task.pomodoroConfig` — production-проверено в smoke (см. ниже)

Smoke: `POST /api/tasks/_dev/process-overdue` после SQL-вставки рекуррент-задачи (daily, freeze, dueDate=−2d, pomodoro: count=6, duration=30, sb=7, lb=20, lbi=3, completed=4) → старая `isOverdue=1, recurrence=null`; новый successor с `recurringParentId` указывает на старую, несёт **6/30/7/20/3 + pomodoroCompleted=0.0**. Smoke-данные удалены.

## Conclusion

Outcome: cron-freeze ветка `OverdueRecurringService.processForUser` теперь клонирует `pomodoroConfig` на successor (5 настроек копируются, `pomodoroCompleted=0`); HEAD `b8bcff0`.

Invariants:
- Domain `buildNextInstance` не модифицирован — diff ограничен `overdue-recurring.service.{ts,spec.ts}` (verify: `git show b8bcff0 --stat`)
- Shift-ветка не задета — там та же task-строка, переносить нечего; тесты «сдвигает dueDate» и «серия закончилась» зелёные
- Cascade на `Task.pomodoroConfig` (OneToOne, cascade=true) надёжно сохраняет новый `pomodoro_configs` row — паттерн идентичен production-проверенному `task.service.ts:create` (`taskData.pomodoroConfig = new PomodoroConfig()`); подтверждено e2e SQLite-смоуком (создал → дёрнул `_dev/process-overdue` → новый row с `count=6, duration=30, sb=7, lb=20, lbi=3, completed=0.0`)
- Out of scope: `task.service.ts:177-187` (complete-recurring → next instance) уже корректно носит pomodoro, так что bug-зоны нет
