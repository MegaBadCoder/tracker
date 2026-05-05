# Subtle overdue styling + bottom-of-list sort

**Status:** done
**Branch:** main
**Worktree:** none
**Mode:** interactive

## Original request

> Скрывать просроченные мы делали надо сделать чтобы красным было только кольца чек-бокса и тэг просрочена и чтобы они были внизу когда отображаются вместе с выполненными

Сейчас overdue-задачи орут красным во весь экран: красный border-l, красный фон, жирный красный заголовок. Хочется тише — только маркер на чек-боксе + явный бейдж «Просрочена», и опускать их вниз списка вместе с completed.

## Spec (Small — Design skipped)

**Visual changes (TaskCard.vue):**
- Удалить из контейнера: `border-l-4 border-red-500 bg-red-500/10 dark:bg-red-500/20` (line 9)
- Удалить из заголовка: красный текст для overdue (lines 28-34) — заодно уходит pre-existing typo `task.isOverdueфы`
- Кольцо `RoundCheckbox` — красное при `task.isOverdue` (нужна prop'a / variant в самом компоненте)
- Новый бейдж в линейке meta-chips: «Просрочена» с красным иконом/фоном (паттерн как у `task.recurrence` — `bg-red-500/10 text-red-600 dark:text-red-400`)
- Overdue-задача всё ещё `cursor-pointer` (открытие в read-only диалоге работает), но drag/edit блокирует backend как раньше

**Sort changes (TasksView.vue, ProjectView.vue, BoardView.vue если применимо):**
- Sort key: live (top) → completed → overdue (самый низ)
- Внутри overdue-группы порядок не специфицирован — оставить natural (по dueDate / order). Ключ для sort: `task.completed ? (task.isOverdue ? 3 : 2) : (task.isOverdue ? 1 : 0)` — мелкая ascending стрелка.

**UI/UX guidance:** консультация со skill `/ui-ux-pro-max` на Plan-этапе для тонкости оттенка кольца и расположения бейджа.

## Plan

Approach: разнести изменения на (1) визуал — кольцо `RoundCheckbox` принимает `overdue` проп, `TaskCard` теряет красный контейнер/заголовок и обзаводится бейджем «Просрочена», (2) сорт-вес — все 4 списка задач (TasksView, ProjectView+GroupedListView×2) переходят на единый weight `isOverdue×2 + completed×1` (live=0, completed=1, overdue=2, overdue+completed=3). Calendar и Board не задеваются.

UI-выбор без отдельного вызова `/ui-ux-pro-max` — существующие паттерны проекта дают однозначный ответ: бейдж в стиле уже-существующего `recurrence`-чипа (`bg-red-500/10 text-red-600 dark:text-red-400 rounded-full px-2 py-0.5`), иконка `AlertCircle` (lucide, стандарт для warning), позиция — первым в meta-линейке для discoverability при потере крупных визуальных маркеров. Кольцо: `border-red-500` для overdue-unchecked.

### Phase 1 — Subtler visuals

- **1.1** [alfy-bot-frontend/src/components/ui/roundCheckbox/RoundCheckbox.vue](alfy-bot-frontend/src/components/ui/roundCheckbox/RoundCheckbox.vue) (modify)
  - Добавить prop `overdue?: boolean` (default `false`) в `Props` interface и `withDefaults`.
  - В template'e шаблона заменить `border-gray-300` на условную: `props.overdue && !modelValue ? 'border-red-500' : modelValue ? 'border-blue-500' : 'border-gray-300'`. (Для checked-overdue — оставляем синий, не нужен сценарий, overdue не может быть completed.)
- **1.2** [alfy-bot-frontend/src/features/tasks/ui/TaskCard.vue:5-13](alfy-bot-frontend/src/features/tasks/ui/TaskCard.vue#L5-L13) (modify)
  - Удалить из class-binding `task.isOverdue ? 'border-l-4 border-red-500 bg-red-500/10 dark:bg-red-500/20' : task.completed && 'opacity-50'` → оставить только `task.completed && 'opacity-50'`. (Overdue-задачи теряют opacity-эффект, но это OK: они визуально маркируются кольцом + бейджем.)
- **1.3** [alfy-bot-frontend/src/features/tasks/ui/TaskCard.vue:15-21](alfy-bot-frontend/src/features/tasks/ui/TaskCard.vue#L15-L21) (modify) — `RoundCheckbox`
  - Добавить `:overdue="task.isOverdue"`. `:disabled="task.isOverdue"` оставить — input всё ещё неинтерактивен. Но в `RoundCheckbox` шаблоне нужно убрать `disabled && 'opacity-50'` для случая `overdue` — иначе кольцо красное и при этом 50% opacity, выглядит как «выключенное», теряется акцент. Условие: `disabled && !overdue && 'opacity-50'`.
- **1.4** [alfy-bot-frontend/src/features/tasks/ui/TaskCard.vue:25-38](alfy-bot-frontend/src/features/tasks/ui/TaskCard.vue#L25-L38) (modify) — заголовок
  - Удалить весь overdue-клаусс (включая typo `task.isOverdueфы`). Финальный class: `text-sm truncate ${task.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`.
- **1.5** [alfy-bot-frontend/src/features/tasks/ui/TaskCard.vue:41-111](alfy-bot-frontend/src/features/tasks/ui/TaskCard.vue#L41-L111) (modify) — meta-чипы
  - Перед `projectName`-бейджем добавить новый: `<Badge v-if="task.isOverdue" ... class="gap-1 text-[11px] px-2 py-0.5 h-5 border-transparent rounded-full bg-red-500/10 text-red-600 dark:text-red-400"><AlertCircle :size="11" />Просрочена</Badge>`.
  - Импортировать `AlertCircle` из `lucide-vue-next` (line 143).
  - Расширить `hasMeta` computed (line 161) — включить `props.task.isOverdue`, чтобы бейдж не висел в одиночку без раскрытой meta-секции, если других чипов нет.
- Commit: `feat(tasks): subtle overdue styling — red ring + badge instead of full-card red`

### Phase 2 — Sort overdue to bottom

Sort weight (ascending): `(t.isOverdue ? 2 : 0) + (t.completed ? 1 : 0)` → live=0, completed=1, overdue-live=2, overdue+completed=3.

- **2.1** [alfy-bot-frontend/src/views/TasksView.vue:60-66](alfy-bot-frontend/src/views/TasksView.vue#L60-L66) (modify) — `sortedTasks` comparator
  - Заменить `if (a.completed === b.completed) return 0; return a.completed ? 1 : -1;` на разницу weight'ов: `const w = (t: Task) => (t.isOverdue ? 2 : 0) + (t.completed ? 1 : 0); return w(a) - w(b);`. Хелпер можно прямо в файле.
- **2.2** [alfy-bot-frontend/src/views/ProjectView.vue:62-67](alfy-bot-frontend/src/views/ProjectView.vue#L62-L67) (modify) — `filteredTasks` comparator
  - Аналогично, secondary sort по `(a.order ?? 0) - (b.order ?? 0)` сохранить как tie-break.
- **2.3** [alfy-bot-frontend/src/features/projects/ui/GroupedListView.vue:78-91](alfy-bot-frontend/src/features/projects/ui/GroupedListView.vue#L78-L91) (modify) — две comparator'ов
  - Оба: добавить weight-сравнение перед существующим `(a.order ?? 0) - (b.order ?? 0)`.
- Commit: `feat(tasks): sort overdue tasks to bottom of list`

### Test strategy

TDD: no — UI/UX-визуал, тестируется глазами.

- Smoke в `up:uverify` через chrome-devtools на запущенном фронте: открыть Inbox с overdue-родителем (smoke-данные сейчас живые в БД), проверить:
  - Контейнер задачи без красного фона/бордера
  - Кольцо чек-бокса красное
  - Бейдж «Просрочена» в meta-линейке
  - Заголовок не красный
  - При toggle «скрывать просроченные» OFF и видимых completed — overdue ниже completed в списке
- Существующие 134/142 frontend тестов остаются на том же уровне (8 fails baseline, не наше).

### Backwards-compat

Никаких schema/API изменений. `RoundCheckbox` props расширяются опциональным полем — все существующие call-sites продолжают работать (default `false`).

## Verify

**Result:** passed

Positive (на живой overdue-задаче `17995a55-...` в Inbox):
- Контейнер: `bg-red`/`border-red` отсутствуют — глобальный красный фон/бордер ушёл
- Заголовок: класс `red` отсутствует, не жирный
- Кольцо `RoundCheckbox`: `border-red-500`, `border-gray` отсутствует
- Бейдж «Просрочена» с red-tinted фоном присутствует в meta-линейке
- Sort: idx 0-5 live → idx 6-14 completed → idx 15 overdue (последний). Порядок live → completed → overdue точно по спеке

Negative:
- Не-overdue задачи (idx 0-14) не имеют `border-red` на кольце и бейджа «Просрочена»

Invariants:
- vue-tsc clean (exit 0, без output)
- Pre-existing typo `task.isOverdueфы` подтверждённо удалён (`grep ... → GONE`)

Smoke: chrome-devtools на запущенном vite (5173) → DOM-проверка контейнера/заголовка/кольца/бейджа на overdue-task ID `17995a55`, sort-проверка через `[data-task-id]`-итерацию по 16 задачам

## Conclusion

Outcome: overdue теряет «кричащий» красный фон/border/title; вместо них — красное кольцо `RoundCheckbox` + бейдж «Просрочена», и опускается в самый низ списка после completed; HEAD `7ffda1a` (2 коммита `6035ebe` + `7ffda1a`).

Invariants:
- Calendar / Board не задеты — diff ограничен `RoundCheckbox`, `TaskCard`, `TasksView`, `ProjectView`, `GroupedListView` (verify: `git diff --stat e6d3204..7ffda1a`)
- Sort-весы консистентны во всех 4 точках: `(t.isOverdue ? 2 : 0) + (t.completed ? 1 : 0)` → live=0, completed=1, overdue=2, оба=3 (verify: chrome-devtools показал idx 0-5 live → 6-14 completed → 15 overdue)
- Badge-стайлинг идентичен существующему recurrence-чипу (rounded-full, h-5, gap-1, text-[11px], bg-{color}-500/10) — single source of truth для chip-паттерна сохраняется
- Pre-existing typo `task.isOverdueфы` подтверждённо удалён
