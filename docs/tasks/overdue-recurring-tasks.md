# Overdue state for recurring tasks past midnight

**Status:** done
**Branch:** main
**Worktree:** none
**Mode:** interactive

## Seed (raw user description)

> нужно в backend и frontend добавить режим для повторяемых задач, что каждый день в 12 часов ночи по часовому поясу пользователя его старая задача если не выполнена, то она ставится как просроченная и не выполненная в тот день и у нее есть какой-то статус просроченной задачи в календаре она отображается красным и ее нельзя передвинуть или изменить, только удалить, но старая задача больше не имеет привязки к созданию новых в расписании и не влияет на призраков

Working interpretation (to be validated in Design):

- Каждый день в 00:00 по часовому поясу пользователя — джоба проходит по его задачам.
- Если задача (с привязкой к конкретному дню — `dueDate`/материализованная инстанция повторяющейся) не была завершена к этому моменту — она помечается особым статусом «просрочена» (`overdue`).
- В календаре такая задача отображается красным.
- Просроченную задачу нельзя двигать/редактировать — только удалить.
- Просроченная задача больше не участвует в логике повторений: не влияет на генерацию следующих экземпляров и не влияет на virtual projections («призраков»).

## Design

### Purpose & scope

Для повторяющихся задач (с `recurrence`) ввести два режима поведения, выбираемые на самой задаче:

1. **`shift`** (по умолчанию) — если инстанция не выполнена к полуночи в часовом поясе пользователя, её `dueDate` сдвигается вперёд на ближайшую валидную дату ≥ сегодня. Задача остаётся редактируемой и активной.
2. **`freeze`** — старая инстанция замораживается как «просрочена» (красная, immutable, удаляется только целиком), её recurrence-привязка снимается, цепочка повторений продолжается через свежесозданную инстанцию на следующую валидную дату.

Только инстанции recurring-задач (`recurrence != null`) попадают в обработку. Обычные one-off задачи с просроченным `dueDate` ведут себя как сейчас (красный текст urgency, редактируемы).

### Chosen approach

**Hourly UTC cron + per-user TZ check + ветвление по `onMissed`.**

`@Cron('0 * * * *')` (каждый час, на :00 UTC) итерирует пользователей. Для каждого вычисляет `now_user_local = shiftToUserWallClock(now, user.tz)`. Если `now_user_local.getUTCHours() === 0` — запускает обработку для этого пользователя. Это срабатывает один раз в сутки на пользователя и корректно покрывает дробные TZ (Индия +5:30, Непал +5:45) — у каждого найдётся UTC-час, на который попадает их 00:00.

В одной обработке pass'а:
- Достаём кандидатов: `userId AND recurrence IS NOT NULL AND completed = false AND isOverdue = false AND dueDate < startOfTodayUtc`.
- Для каждого — ветвимся по `task.onMissed`:
  - **freeze** — единая транзакция: `markOverdue(task)` (`isOverdue=true`, `recurrence=null`) + `createNextInstance(task, nextDueDate)` если серия не закончилась.
  - **shift** — единая транзакция: `task.dueDate = findNextOccurrenceOnOrAfter(rule, currentDue, startOfTodayLocal, completedCount)` через итерацию `computeNextDueDate`. Если итерация даёт `null` (серия завершена) — обнуляем `recurrence`, `dueDate` оставляем.

`isOverdue=false` в фильтре обеспечивает идемпотентность повторного запуска в тот же час.

### Data model

Backend (`Task` entity, `shared/entities/task.entity.ts`):

```ts
@Column({ type: 'boolean', default: false })
isOverdue: boolean;

@Column({ type: 'varchar', default: 'shift' })
onMissed: 'shift' | 'freeze';
```

Frontend (`features/tasks/model/types.ts`):

```ts
isOverdue?: boolean
onMissed?: 'shift' | 'freeze'
```

Каждая инстанция в цепочке несёт собственную копию `onMissed` (так же как `recurrence`). При freeze-цикле новая инстанция наследует `onMissed` от старой.

### Lifecycle / transitions

Состояние «frozen overdue» = `isOverdue: true` ∧ `recurrence: null` ∧ `completed: false`. Обнуление `recurrence` достаточно для того, чтобы фронтовый ghost-проектор автоматически перестал генерировать призраков из этой задачи (он уже фильтрует по `task.recurrence`). Никаких изменений в проекторе не требуется.

`recurringParentId` сохраняется — для исторической связи с цепочкой. `recurringCompletedCount` на корне НЕ инкрементируется при overdue — overdue не считается выполнением и не приближает `endCount`.

При создании новой инстанции (freeze-цикл): через тот же `buildNextInstance(old, nextDate, parentId(old))`, что и существующий `completeRecurringTask`. `parentId(old) = old.recurringParentId ?? old.id`.

### Cron implementation

Файл: `alfy-bot/src/modules/task/infrastructure/overdue-recurring.scheduler.ts` (по аналогии с `timer-expiry.scheduler.ts`).

Application-операция в `task.service.ts` (или новый `OverdueRecurringService`): `processOverdueRecurring(userId, tz)`.

Доменный helper в `modules/task/domain/recurrence.utils.ts`: `findNextOccurrenceOnOrAfter(rule, currentDue, refDateLocal, completedCount): Date | null`. Реализация — итеративный вызов `computeNextDueDate` пока результат < `refDateLocal`. Bound: ≤ ~400 итераций (для yearly с большим completedCount).

Список users: добавить метод в существующий `UserSettingsPort` (или ввести `UserRepositoryPort`) — `listAllUserIds(): Promise<number[]>`. Решение по конкретному порту — в plan-стадии.

### API / immutability

- Сервисный guard в `task.service.ts:update()`: если `task.isOverdue === true`, бросать `BadRequestException('Overdue task cannot be modified.')` — аналогично существующему virtual-id guard'у.
- `DELETE /tasks/:id` — без изменений (удаление overdue разрешено).
- `CreateTaskDto` и `UpdateTaskDto` принимают `onMissed?: 'shift' | 'freeze'` (опционально, default `'shift'` на entity-уровне).
- Менять `onMissed` у живой задачи разрешено; следующий cron-проход применит новый режим.

### Frontend changes

1. **Calendar event styling** — `CalendarEventBlock.vue`, `AllDaySection.vue`: новая ветка для `event.task.isOverdue` (красный, насыщеннее priority-high; cursor `not-allowed`). Drag/resize и checkbox toggle гардятся проверкой `isOverdue` рядом с существующей `isVirtual`.
2. **TaskDetailDialog** — пробрасывать `editable: false` при `task.isOverdue`. Уже есть инфраструктура read-only.
3. **TaskCard** (списки задач) — красный бейдж/фон при overdue, отключить чекбокс и inline-edit.
4. **Recurrence editor** (`RecurrencePicker.vue`, `RecurrencePickerContent.vue`) — radio в секции «Если пропущено»:
   - ○ На будущий день или сегодня (по умолчанию) → `'shift'`
   - ○ Подсвечивать пропущенные → `'freeze'`
   Виден только когда recurrence включена.
5. **Task store** (`task-store.ts`) — `parseTask` пробрасывает `isOverdue` и `onMissed` из ответа.
6. **Ghost-проектор** (`features/calendar/lib/calendar-events.ts`) — изменений НЕ требуется (overdue приходят с `recurrence: null`, фильтрация уже есть).
7. **Refetch** — фронт узнаёт о новых overdue/shifted-данных через существующий `fetchTasks()` на mount `CalendarView`/`TasksView`. Polling/websocket — out of scope.

### Backwards-compat

- Schema: `synchronize: true` подтянет обе колонки. Существующие строки получат `isOverdue: false`, `onMissed: 'shift'`.
- **Поведенческое изменение** для существующих recurring: с первой полночи после деплоя их пропущенные инстанции будут авто-сдвигаться. Принято юзером как улучшение (option a) — без отдельной data-миграции в `'freeze'`.
- API: PATCH overdue → 400. Старые клиенты не отправят такого запроса (FE и BE релизятся вместе).
- Frontend: отсутствие `isOverdue`/`onMissed` в старом ответе трактуется как `undefined`/falsy. Совместимо.

### Tradeoffs that settled it

- **Hourly cron** vs per-task scheduled job: нет очередевой инфраструктуры в проекте, hourly — идиома существующего `TimerExpiryScheduler`. На текущем масштабе (десятки–сотни юзеров) полная итерация дёшева.
- **Boolean `isOverdue` + nullable `recurrence`** vs `status: enum`: две независимые семантики (immutability vs «не источник ghosts») — естественно отделить. `recurrence: null` бесплатно отключает ghost-проекцию.
- **Enum `onMissed`** vs boolean `freezeOnMissed`: enum читается лучше в коде и легче расширить (`'pause'`, `'ask'`) при необходимости.
- **Default `'shift'`**: расходный путь — не копить «зомби-просроченных» в календаре. Совпадает с интуицией большинства users (todo-app паттерн).

### Unknowns

- `UserSettingsPort.listAllUserIds()` vs новый `UserRepositoryPort` — решится в plan-стадии (зависит от того, что уже есть).
- Точная граница `bound` итераций в `findNextOccurrenceOnOrAfter` для yearly с большим `completedCount` — определится на тестах в plan-стадии.

### TODO / known limitations

- **Vacation mode** — отдельная фича. При длительном отсутствии user'а cron создаёт стенку красных задач (в freeze-режиме) или просто двигает (в shift). Механизм пауз recurrence — out of scope этой задачи.
- Оптимизация cron'а при 10k+ users (timezone-bucket индексация) — преждевременно.

### TDD

**TDD: yes** — для доменной логики и бранчей сервисного метода. Регрессии в recurrence-вычислениях и в TZ-маркировке overdue будут стоить дорого; покрытие нужно.

Тесты:
- `recurrence.utils.spec.ts`: `findNextOccurrenceOnOrAfter` — daily/weekly (Mon/Wed/Fri)/monthly/yearly + `endCount` exhausted.
- `task.service.spec.ts`: `processOverdueRecurring` — freeze-ветка (создание новой + mark old), shift-ветка (только update dueDate), idempotency, серия закончилась.
- `timezone.spec.ts`: уже покрывает shift/back; добавить sanity для дробных TZ если ещё нет.
- API: integration тест — PATCH overdue → 400.
- Frontend: type-check + ручная проверка drag/resize/edit/checkbox/радио в браузере. UI-снимков не делаем.

### Invariants

- `onMissed ∈ {'shift', 'freeze'}`. Default `'shift'`.
- `isOverdue === true` ⇒ `recurrence === null` ∧ `completed === false` ∧ `onMissed === 'freeze'`.
- В цепочке `recurringParentId` всегда не более одной активной инстанции: `recurrence != null && !completed && !isOverdue`.
- API `PATCH /tasks/:id` отвергается если `task.isOverdue === true` (только DELETE разрешён).
- `recurringCompletedCount` инкрементируется только при `completed=true`, не при overdue или shift.
- Cron идемпотентен в пределах одного UTC-часа (фильтр `isOverdue = false` + shift-результат стабилен после первого прохода для свежей даты).
- Доменная логика recurrence остаётся timezone-agnostic: TZ-сдвиги делаются в application-слое (`processOverdueRecurring`) перед вызовом доменных функций.
- Mark+create / shift-update — атомарны на одну задачу (одна транзакция).

### Principles

- Frozen-состояние выражается комбинацией двух флагов (`isOverdue: true` + `recurrence: null`), а не одной enum'ой — это позволяет ghost-проектору работать без изменений.
- Per-user TZ обработка — в infrastructure слое (scheduler), доменные функции остаются чистыми.
- Fail-fast на immutability: guard'ы кидают исключение, без silent fallbacks.
- Default-режим выбран в пользу простоты UX (shift), а не data-полноты (freeze). Юзер opt-in'ит freeze явно.

## Plan

Approach: 4 фазы, каждая — самодостаточный коммит. Backend-фундамент (entity/DTO/доменный helper/guard) → backend-обработка (service + scheduler) → frontend overdue-рендеринг → frontend radio. Phase 2 даёт первый видимый эффект cron'а; phase 3 делает его видимым для пользователя.

### Phase 1 — Backend foundations: схема, DTO, доменный helper, immutability guard

- **1.1** [alfy-bot/src/shared/entities/task.entity.ts:74-76](alfy-bot/src/shared/entities/task.entity.ts#L74-L76) (modify)
  - Добавить колонки сразу после `isAutoCreated`:
    - `@Column({ type: 'boolean', default: false }) isOverdue: boolean;`
    - `@Column({ type: 'simple-enum', enum: ['shift', 'freeze'], default: 'shift' }) onMissed: 'shift' | 'freeze';`
  - `synchronize: true` создаст колонки автоматически.
  - Invariant: `isOverdue === true ⇒ recurrence === null ∧ completed === false ∧ onMissed === 'freeze'` (енфорсится на write-path в Phase 2).

- **1.2** [alfy-bot/src/modules/task/domain/recurrence.utils.ts](alfy-bot/src/modules/task/domain/recurrence.utils.ts) (modify)
  - Расширить `RecurringTaskSnapshot` (lines 5-19) и `NextInstanceData` (lines 141-159) полем `onMissed: 'shift' | 'freeze'`.
  - В `buildNextInstance` (lines 165-189) копировать `onMissed` из `completedTask`.
  - Добавить новую функцию (после `buildNextInstance`):
    ```ts
    export function findNextOccurrenceOnOrAfter(
      currentDue: Date,
      rule: RecurrenceRule,
      refDateUtc: Date,
      completedCount = 0,
    ): Date | null
    ```
    Реализация: итеративно вызывать `computeNextDueDate` (передавая результат как новый `currentDue`), пока результат `< refDateUtc`. Возвращать первый результат `≥ refDateUtc` или `null` если серия закончилась. Bound: 500 итераций, после — throw.

- **1.3** [alfy-bot/src/modules/task/domain/recurrence.utils.spec.ts](alfy-bot/src/modules/task/domain/recurrence.utils.spec.ts) (modify)
  - Добавить describe `findNextOccurrenceOnOrAfter` с тестами:
    - daily(1), currentDue=yesterday, ref=today → today
    - weekly Mon/Wed/Fri, currentDue=last Wed, ref=Thursday → next Friday
    - weekly Mon/Wed/Fri, currentDue=last Friday, ref=Saturday → next Monday
    - monthly 15th, currentDue=прошлый 15-й, ref=16-е → 15-е следующего месяца
    - yearly, currentDue=прошлый год, ref=сегодня → следующее годовое вхождение
    - endCount достигнут → null
    - endDate в прошлом → null

- **1.4** [alfy-bot/src/modules/task/dto/create-task.dto.ts:104-109](alfy-bot/src/modules/task/dto/create-task.dto.ts#L104-L109) (modify)
  - Добавить после поля `recurrence`:
    ```ts
    @ApiPropertyOptional({ enum: ['shift', 'freeze'] })
    @IsOptional()
    @IsIn(['shift', 'freeze'])
    onMissed?: 'shift' | 'freeze';
    ```

- **1.5** [alfy-bot/src/modules/task/dto/update-task.dto.ts:6-23](alfy-bot/src/modules/task/dto/update-task.dto.ts#L6-L23) (modify)
  - Добавить `isOverdue?: never;` к списку server-only полей (рядом с `pomodoroCount?: never;`). `onMissed` уже наследуется через `PartialType(CreateTaskDto)`.

- **1.6** [alfy-bot/src/modules/task/task.service.ts:74-126](alfy-bot/src/modules/task/task.service.ts#L74-L126) (modify)
  - В `update()` после virtual-id check (line 79-81) добавить:
    ```ts
    if (task.isOverdue) {
      throw new BadRequestException('Overdue task cannot be modified.');
    }
    ```
    (Перенести `findById` выше guard'а, либо проверить после `findById`.)
  - Invariant: API `PATCH /tasks/:id` отвергается если `task.isOverdue === true`.

- **1.7** [alfy-bot/src/modules/task/task.service.spec.ts](alfy-bot/src/modules/task/task.service.spec.ts) (modify)
  - Добавить тест: `update()` на `task.isOverdue=true` бросает `BadRequestException`.

- Commit: `feat(task): add isOverdue/onMissed fields, recurrence helper, immutability guard`

### Phase 2 — Backend overdue processing: service + scheduler

- **2.1** [alfy-bot/src/modules/task/domain/task-repository.port.ts](alfy-bot/src/modules/task/domain/task-repository.port.ts) (modify)
  - Добавить:
    ```ts
    abstract findOverdueRecurringCandidates(
      userId: number,
      dueBeforeUtc: Date,
    ): Promise<Task[]>;
    abstract markOverdue(taskId: string): Promise<void>;
    ```
  - `findOverdueRecurringCandidates` фильтр: `userId AND recurrence IS NOT NULL AND completed = false AND isOverdue = false AND dueDate < :dueBeforeUtc`.
  - `markOverdue` атомарно: `isOverdue = true, recurrence = null`.

- **2.2** [alfy-bot/src/modules/task/infrastructure/typeorm-task.repository.ts](alfy-bot/src/modules/task/infrastructure/typeorm-task.repository.ts) (modify)
  - Реализовать оба метода через `Repository<Task>` (`createQueryBuilder` для фильтра, `update` для пометки).

- **2.3** [alfy-bot/src/modules/task/domain/user-settings.port.ts:1-3](alfy-bot/src/modules/task/domain/user-settings.port.ts#L1-L3) (modify)
  - Добавить: `abstract listAllUserIds(): Promise<number[]>;` (рядом с `getTimezone`).
  - Решение по порту: оставить на `UserSettingsPort` (scheduler уже его потребляет, новый порт лишний).

- **2.4** [alfy-bot/src/modules/task/infrastructure/typeorm-user-settings.adapter.ts](alfy-bot/src/modules/task/infrastructure/typeorm-user-settings.adapter.ts) (modify)
  - Реализовать `listAllUserIds()` через `userRepo.find({ select: ['id'] })` → `.map(u => u.id)`.

- **2.5** `alfy-bot/src/modules/task/overdue-recurring.service.ts` (create)
  - Новый `@Injectable()` сервис:
    ```ts
    export class OverdueRecurringService {
      constructor(
        private readonly taskRepo: TaskRepositoryPort,
        private readonly userSettings: UserSettingsPort,
      ) {}
      async processForUser(userId: number, tz: string): Promise<void>
      async processAllUsersAtMidnight(nowUtc: Date): Promise<void>
    }
    ```
  - `processAllUsersAtMidnight`: итерирует `userSettings.listAllUserIds()`. Для каждого получает `tz`, вычисляет `nowLocal = shiftToUserWallClock(nowUtc, tz)`. Если `nowLocal.getUTCHours() === 0` — вызывает `processForUser`.
  - `processForUser`: вычисляет `startOfTodayLocal` (zeroed hours/min/sec/ms на `nowLocal`), `startOfTodayUtc = shiftBackToUtc(startOfTodayLocal, tz)`. Достаёт `findOverdueRecurringCandidates(userId, startOfTodayUtc)`. Для каждого ветвится:
    - `task.onMissed === 'freeze'`: вычислить `nextDueDate = computeNextDueDate(zonedDue, rule, completedCount)` (с TZ-сдвигами как в существующем `completeRecurringTask` lines 159-167). Транзакция: `markOverdue(task.id)` + если `nextDueDate` — `taskRepo.create(buildNextInstance(task, nextDueDate, parentId))` (parentId = `task.recurringParentId ?? task.id`).
    - `task.onMissed === 'shift'`: вычислить `nextDueDateLocal = findNextOccurrenceOnOrAfter(zonedCurrentDue, rule, startOfTodayLocal, completedCount)`. Если `null` — `task.recurrence = null` (серия окончена), `taskRepo.save(task)`. Иначе — `task.dueDate = shiftBackToUtc(nextDueDateLocal, tz)`, `taskRepo.save(task)`.

- **2.6** `alfy-bot/src/modules/task/overdue-recurring.service.spec.ts` (create)
  - Тесты с моками `TaskRepositoryPort`, `UserSettingsPort`:
    - freeze-ветка: 1 candidate с `onMissed='freeze'`, daily, → `markOverdue` вызван + `create` вызван с правильным `dueDate` и `onMissed='freeze'` (унаследовано через `buildNextInstance`).
    - shift-ветка: 1 candidate с `onMissed='shift'`, daily, dueDate=yesterday → `save` вызван с `dueDate=сегодня`. `markOverdue` НЕ вызван.
    - shift-ветка endCount exhausted: `findNextOccurrenceOnOrAfter` → `null` → `save` с `recurrence=null`, `isOverdue` НЕ ставится.
    - Idempotency: пустой candidates список → ноль вызовов.
    - TZ: пользователь UTC+5, `nowUtc=19:00 UTC` (что в локали = 00:00) → `processForUser` вызван; `nowUtc=18:00 UTC` (= 23:00 локали) → НЕ вызван.

- **2.7** `alfy-bot/src/modules/task/infrastructure/overdue-recurring.scheduler.ts` (create)
  - По образцу `timer-expiry.scheduler.ts`:
    ```ts
    @Injectable()
    export class OverdueRecurringScheduler {
      constructor(private readonly service: OverdueRecurringService) {}
      @Cron('0 * * * *')
      async run(): Promise<void> {
        await this.service.processAllUsersAtMidnight(new Date());
      }
    }
    ```

- **2.8** [alfy-bot/src/modules/task/task.module.ts:30-47](alfy-bot/src/modules/task/task.module.ts#L30-L47) (modify)
  - Зарегистрировать `OverdueRecurringService` и `OverdueRecurringScheduler` в `providers`. Импорты — соответственно.

- Commit: `feat(task): add hourly overdue-recurring processing`

### Phase 3 — Frontend wiring + overdue UI

- **3.1** [alfy-bot-frontend/src/features/tasks/model/types.ts:16-49](alfy-bot-frontend/src/features/tasks/model/types.ts#L16-L49) (modify)
  - Добавить в `Task`: `isOverdue?: boolean`, `onMissed?: 'shift' | 'freeze'`.

- **3.2** [alfy-bot-frontend/src/features/tasks/model/task-store.ts:22-41](alfy-bot-frontend/src/features/tasks/model/task-store.ts#L22-L41) (modify)
  - В `parseTask` пробросить:
    - `isOverdue: (raw.isOverdue as boolean) ?? false`
    - `onMissed: (raw.onMissed as 'shift' | 'freeze') ?? 'shift'`

- **3.3** [alfy-bot-frontend/src/features/calendar/lib/calendar-styles.ts](alfy-bot-frontend/src/features/calendar/lib/calendar-styles.ts) (modify)
  - Добавить экспорт:
    ```ts
    export const OVERDUE_EVENT_CLASSES = 'bg-red-500/40 border-red-500/70 text-white backdrop-blur-sm'
    ```

- **3.4** [alfy-bot-frontend/src/features/calendar/ui/CalendarEventBlock.vue:1-99](alfy-bot-frontend/src/features/calendar/ui/CalendarEventBlock.vue#L1-L99) (modify)
  - Computed `isOverdue = computed(() => !!props.event.task.isOverdue)`.
  - Класс: при `isOverdue` → `OVERDUE_EVENT_CLASSES` + `cursor-not-allowed` (приоритет выше, чем completed/virtual/priority).
  - В `onPointerDown` (line 90): добавить `if (isOverdue.value) return`.
  - Resize-handle (line 36): не рендерить если `isOverdue` (`v-if="event.resizable && !isOverdue"`).
  - Чекбокс (line 17-24): `:disabled="isOverdue"` или `v-if="!isVirtual && !isOverdue"`.

- **3.5** [alfy-bot-frontend/src/features/calendar/ui/AllDaySection.vue](alfy-bot-frontend/src/features/calendar/ui/AllDaySection.vue) (modify)
  - Аналогично: класс при `event.task.isOverdue` → красный, `:draggable="!event.isVirtual && !event.task.isOverdue"`.

- **3.6** [alfy-bot-frontend/src/features/tasks/ui/TaskDetailDialog.vue](alfy-bot-frontend/src/features/tasks/ui/TaskDetailDialog.vue) (modify)
  - Где компонент читает `editable` (props default `true`) — wrap в computed: `effectiveEditable = computed(() => props.editable && !props.task?.isOverdue)`. Использовать `effectiveEditable` в шаблоне вместо `editable` во всех местах. ЛИБО точечно в `TasksView`/`ProjectView`, которые открывают диалог, передавать `:editable="!task.isOverdue"`. Точное место решит исполнитель в зависимости от того, где меньше изменений.

- **3.7** [alfy-bot-frontend/src/features/tasks/ui/TaskCard.vue](alfy-bot-frontend/src/features/tasks/ui/TaskCard.vue) (modify)
  - При `task.isOverdue`: добавить класс на корневой div — `border-l-2 border-red-500 bg-red-500/5`. Чекбокс [строка 13-18](alfy-bot-frontend/src/features/tasks/ui/TaskCard.vue#L13-L18): `disabled` + игнор toggle. Кнопку delete оставить активной. Drag — этот компонент не drag'абелен сам по себе; ограничение применять там, где он используется в drag-контексте (TasksView/ProjectView).

- **3.8** Поиск всех drag/move-источников по `taskStore.updateTask(... dueDate ...)` — опционально, но рекомендуется добавить guard в самом store перед PATCH:
  - [alfy-bot-frontend/src/features/tasks/model/task-store.ts](alfy-bot-frontend/src/features/tasks/model/task-store.ts) — в `updateTask`: если локальная копия задачи `isOverdue === true` и updates содержит запрещённые поля — возвращать ранний реджект и не делать PATCH (бэк всё равно отдаст 400, но FE-guard избегает оптимистичной mutation).

- Commit: `feat(tasks): render overdue recurring tasks as immutable red`

### Phase 4 — Frontend recurrence picker radio

- **4.1** [alfy-bot-frontend/src/features/tasks/ui/RecurrencePickerContent.vue:99-105](alfy-bot-frontend/src/features/tasks/ui/RecurrencePickerContent.vue#L99-L105) (modify)
  - Расширить props: добавить `onMissed?: 'shift' | 'freeze'`. Расширить emits: `(e: 'update:onMissed', value: 'shift' | 'freeze'): void`.
  - В шаблоне после блока `<template v-if="modelValue">` (line 23-32) добавить секцию radio (видна только когда `modelValue` не null):
    ```vue
    <template v-if="modelValue">
      <div class="h-px bg-border/40 my-1" />
      <div class="px-3 py-2 space-y-1.5">
        <label class="text-[11px] text-muted-foreground font-medium">Если пропущено</label>
        <button @click="$emit('update:onMissed', 'shift')" :class="[..., onMissed === 'shift' && '...active...']">
          На будущий день или сегодня
        </button>
        <button @click="$emit('update:onMissed', 'freeze')" :class="[..., onMissed === 'freeze' && '...active...']">
          Подсвечивать пропущенные
        </button>
      </div>
    </template>
    ```
    Стиль кнопок — как у preset'ов (single-select look).

- **4.2** [alfy-bot-frontend/src/features/tasks/ui/RecurrencePicker.vue](alfy-bot-frontend/src/features/tasks/ui/RecurrencePicker.vue) (modify)
  - Если десктопный wrapper передаёт props через — пробросить `onMissed` и эмитить `update:onMissed`.

- **4.3** [alfy-bot-frontend/src/features/tasks/ui/TaskDetailDialog.vue](alfy-bot-frontend/src/features/tasks/ui/TaskDetailDialog.vue) (modify)
  - Добавить `localOnMissed = ref<'shift' | 'freeze'>('shift')`, синхронизировать с `task.onMissed` в watch (lines 722-745).
  - В двух местах использования `RecurrencePicker`/`RecurrencePickerContent` — пробросить `:on-missed="localOnMissed"` и слушать `@update:on-missed="localOnMissed = $event; emitUpdate({ onMissed: $event })"`.

- Commit: `feat(tasks): add onMissed radio to recurrence picker`

### Test strategy

TDD: yes — для domain helper и application service. Failing tests пишутся ДО реализации в каждой фазе.

- Phase 1.3 (domain): покрытие `findNextOccurrenceOnOrAfter` для всех 4 frequencies + endCount/endDate. Failing first.
- Phase 1.7 (service): `update()` overdue → throws. Failing first.
- Phase 2.6 (service): freeze/shift/endCount/idempotency/TZ-gate. Failing first.
- Phase 3-4 (frontend): `pnpm vue-tsc --noEmit` + ручной smoke-test (drag overdue, resize overdue, checkbox overdue, открытие диалога overdue, переключение radio при создании recurring задачи). UI snapshot/E2E не пишем.

### Order & dependencies

Строго последовательно: Phase 1 → 2 → 3 → 4. Phase 2 требует 1.2 (доменный helper) и 1.1 (колонки entity). Phase 3 требует 1.1+1.4 (поля API). Phase 4 не требует Phase 3 технически, но логически после неё (без overdue-рендеринга radio бессмыслен в UI-проверке).

### Open questions / risks / rollback

- **Risk: race условие cron'а с пользовательским PATCH `completed=true` в момент выполнения cron'а.** Маловероятно (один час на пользователя), и финальное состояние корректно: либо completed (через `completeRecurringTask`) и cron его не подберёт, либо overdue если cron успел первым. Mitigation: фильтр `completed = false` гарантирует, что cron не задвоит цепочку.
- **Risk: shift-ветка обновляет `dueDate` без вызова существующего hook'а.** Текущий `update()` помечает `isAutoCreated = false` при пользовательском редактировании ([task.service.ts:112-114](alfy-bot/src/modules/task/task.service.ts#L112-L114)). Cron'овый shift не должен сбрасывать `isAutoCreated` — это автоматическое движение, не пользовательское. Implementation: `taskRepo.save(task)` напрямую, минуя `update()`. Обозначено в 2.5.
- **Rollback:** Phase 1-2 — коммиты можно откатить, новые колонки остаются в БД (TypeORM `synchronize` не дропает их), это безопасно. Phase 3-4 — чистый UI rollback.

### Backwards-compat (restated)

- Schema: новые колонки с дефолтами; существующие строки получают `isOverdue=false`, `onMissed='shift'`. Ничего не ломается.
- Behavioral: с первой полночи после деплоя существующие recurring (которые без `onMissed` поля принимают default `'shift'`) начнут авто-сдвигать просроченный `dueDate`. Принято Design'ом (option a).
- API: PATCH overdue → 400. FE и BE релизятся одновременно, FE сам не отправит запрос. Старые third-party клиенты — ломается graceful (HTTP 400 с понятным message).

## Verify

**Result:** passed

Positive:
- Backend specs: `pnpm exec jest src/modules/task/{domain/recurrence.utils.spec.ts,task.service.spec.ts,overdue-recurring.service.spec.ts}` → 3 suites, 83 tests pass
- Backend build: `pnpm build` (alfy-bot) → exit 0
- Frontend type-check: `pnpm exec vue-tsc --noEmit` → exit 0
- Frontend build: `pnpm build` (alfy-bot-frontend) → 67 modules transformed, exit 0

Negative:
- `update()` на `isOverdue=true` бросает `BadRequestException` (task.service.spec test).
- Shift-ветка с исчерпанным `endCount` обнуляет `recurrence`, не вызывает `markOverdue` (overdue-recurring.service.spec).
- Идемпотентность: пустой `findOverdueRecurringCandidates` → ноль downstream-вызовов (overdue-recurring.service.spec).

Invariants:
- Domain слой timezone-agnostic — `grep -n "shiftToUserWallClock\|shiftBackToUtc" recurrence.utils.ts` → 0 совпадений.
- Cron не инкрементит `recurringCompletedCount` — читает только в `overdue-recurring.service.ts:50`, без `++`/`save` корня по этому полю.
- `markOverdue` атомарно ставит `isOverdue=true, recurrence=null` (single `repo.update`), что гарантирует комбинированный frozen-state в одной транзакции.
- TZ-gate при `nowUtc=19:00Z`: UTC user пропускается, UTC+5 user обрабатывается (overdue-recurring.service.spec).

Notes:
- **Live UI smoke deferred** — требует поднять backend+frontend и вручную выставить `isOverdue=true` на задаче в SQLite, чтобы визуально проверить красный рендеринг в `CalendarEventBlock`/`AllDaySection`/`TaskCard`/`TaskDetailDialog` и блокировку drag/resize/edit. Рекомендуется ручная проверка перед merge: `cd alfy-bot && pnpm start:dev` + `cd alfy-bot-frontend && pnpm dev`, затем `sqlite3 alfy-bot/data/database.sqlite "UPDATE tasks SET isOverdue=1, recurrence=NULL WHERE id='<id>'"` на тестовой задаче.
- **Live cron firing deferred** — scheduler сработает в полночь по часовому поясу пользователя; синтетически тестировался через моки. Для немедленной проверки: добавить `@Cron('*/30 * * * * *')` временно или вызвать `service.processAllUsersAtMidnight(new Date())` через тестовый эндпоинт.

## Conclusion

Outcome: feature shipped в 6 коммитах `f64aa67..7207ce7` — overdue/onMissed для recurring задач с двумя режимами (`shift` default / `freeze`), hourly TZ-aware cron, иммутабельность UI для frozen-задач, radio в picker'е.

Invariants:
- `isOverdue=true ⇒ recurrence=null` — атомарно через `freezeAndCreateNext.manager.transaction` (commit 7207ce7).
- Single active instance в цепочке — freeze branch транзакционно переводит старую → frozen и создаёт новую; shift branch не дублирует.
- `recurringCompletedCount` не инкрементируется при overdue/shift — grep по сервису, только чтение в `overdue-recurring.service.ts:50`.
- Cron идемпотентен — фильтр `isOverdue=false AND dueDate<startOfTodayUtc` исключает уже обработанные после freeze (флаг) и shift (передвинутый dueDate).
- Domain `recurrence.utils.ts` timezone-agnostic — 0 импортов TZ-helper'ов; shifts только в application слое.
- API PATCH overdue → 400 — guard в `task.service.ts:88-90`, тест в `task.service.spec.ts`.

Plan adherence:
- `TaskForm.vue` wiring добавлен сверх плана Phase 4 (consistency fix, commit 4fbadff) — без него новые recurring задачи не имели UI-выбора onMissed.

Review findings:
- Important #1 (atomicity): freeze branch делал `markOverdue` + `create` как два независимых awaits — на крах между ними цепочка ломалась навсегда. Resolved в 7207ce7 заменой на `freezeAndCreateNext` с `manager.transaction`. Reviewer's reverse-order предложение отвергнуто — оно создавало другую failure mode (дубликат active instance в окне ретрая).

Future work:
- **Vacation mode** — пользователь в отпуске получает «стену» из 30 frozen-overdue (или 30 авто-сдвигов в shift). Механизм пауз recurrence — отдельная фича. Justification: design's `## TODO / known limitations` явно вынес это out of scope.
- **TZ-bucket оптимизация cron'а** при 10k+ users. Justification: design's `## Unknowns` пометил преждевременным.

Verified by: live UI smoke и live cron firing задеферрены — оба требуют ручного шага (выставить `isOverdue=1` в SQLite + дождаться часовой границы UTC, либо временно урезать cron expression). Шаги задокументированы в `## Verify → Notes`.
