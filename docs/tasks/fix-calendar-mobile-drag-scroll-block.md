# Fix calendar mobile drag scroll block

**Status:** done
**Branch:** fix/calendar-mobile-drag-scroll-block
**Worktree:** none
**Mode:** interactive

## Design

**Проблема.** В `CalendarView` на мобильном устройстве пользователь не может скроллить сетку часов (`HourGrid`) ни вертикально (по часам), ни горизонтально (по дням). Любое касание трека немедленно запускает draw-to-create задачи.

**Root cause.**
- `alfy-bot-frontend/src/features/calendar/ui/HourGrid.vue:28` — на трек-элементе стоит `style="touch-action: none"`, что полностью отключает нативный pan браузера на всей рабочей зоне календаря.
- `alfy-bot-frontend/src/features/calendar/lib/use-create-slot-drag.ts:45` — `onPointerDown` не различает `pointerType` и стартует drag-create мгновенно при любом касании, сразу же делая `setPointerCapture`.

В сочетании это означает: на мобиле первое же касание сетки превращается в drag-режим, а нативный scroll невозможен в принципе.

**Чужой паттерн в проекте уже есть.** `alfy-bot-frontend/src/features/tasks/lib/dnd/use-drag-source.ts` обрабатывает мобильный drag через long-press 350ms + threshold 8px + cancel при движении до срабатывания таймера. CLAUDE.md фиксирует эту конвенцию.

**Выбранный подход (Option A): long-press 350ms для активации drag-create на touch.**

1. Снять `style="touch-action: none"` с трек-элемента в `HourGrid.vue`. Браузер сможет нативно обрабатывать pan-x и pan-y до тех пор, пока мы не захватим pointer.
2. В `useCreateSlotDrag.onPointerDown` ветвление по `pointerType`:
   - **`mouse`** — текущее поведение без изменений (мгновенный старт, threshold для показа overlay — 3px).
   - **`touch` / `pen`** — long-press 350ms. Стартуем таймер, не вызываем `setPointerCapture` сразу. Слушаем `pointermove`: если палец сдвинулся > 8px до срабатывания таймера → cleanup, не drag (браузер уже пошёл скроллить). По таймеру → `triggerHaptic()`, `setPointerCapture`, дальше прежний `onMove`/`onUp`/`onCancel`.
3. `triggerHaptic()` — копия из `use-drag-source.ts` (Telegram WebApp HapticFeedback `impactOccurred('light')`).

**Заметная out-of-scope деталь.** `CalendarEventBlock.vue:16` тоже использует `touch-action: none`. Это значит на мобиле невозможно скроллить, ставя палец на существующий блок события. Это отдельная проблема (касается DnD существующих событий, путь через `usePointerDnd`), и тоже требует long-press-гейта. **Не входит в эту задачу** — пометим в выводе как отдельный кандидат.

**Unknowns / риски.**
- iOS Safari может выдавать `pointercancel` при начале pan'а — корректно, наш cleanup это перехватит.
- iOS контекстное меню по long-press на тексте — у нас тут пустая сетка без текста и без `user-select`, риск низкий. На сетке уже стоит `select-none` через родительский контейнер.
- Не тестируем код юнит-тестами: тайминги pointer-событий и pointer capture в jsdom/happy-dom неуправляемы. Существующий `use-drag-source.ts` тоже без тестов. Проверим вручную на мобиле (touch-эмуляция devtools + реальное устройство если доступно).

**TDD: no** (reason: gesture timing + pointer capture в touch-окружении нестабильно тестируются; проектный паттерн `use-drag-source.ts` тоже без юнит-тестов; верификация через ручной mobile smoke + devtools touch emulation).

### Invariants
- На мобиле нативный вертикальный скролл `gridRef` (`WeeklyCalendar.vue:11`) работает, когда палец стартует на пустой сетке часов и сразу движется (без задержки).
- На мобиле нативный горизонтальный pan по дням работает аналогично.
- Drag-create на мобиле активируется только после long-press 350ms без значимого движения (≤ 8px).
- Desktop (`pointerType === 'mouse'`) — поведение без изменений: drag-create стартует на mousedown, overlay появляется при движении > 3px.
- При активации drag-create на mobile — haptic feedback через Telegram WebApp.
- Constants — численные значения long-press и threshold берутся из тех же значений, что в `use-drag-source.ts` (350ms, 8px), чтобы не было разнобоя.

### Principles
- Mirror project convention. Не изобретаем новый таймер/порог — берём из `use-drag-source.ts`.
- Никакого широкого `touch-action: none`. Применять только когда нужно (например на CalendarEventBlock — отдельная задача).
- Mouse-путь не трогаем. Все изменения изолированы веткой по `pointerType`.

## Plan

Approach: переписать `useCreateSlotDrag.onPointerDown` так, чтобы для mouse поведение не менялось, а для touch/pen drag-create активировался только после long-press 350ms без движения > 8px; параллельно убрать `touch-action: none` с трек-элемента `HourGrid`, чтобы пустил нативный скролл до момента pointer capture.

### Phase 1 — Long-press gate + снятие touch-action

- **1.1** `alfy-bot-frontend/src/features/calendar/lib/use-create-slot-drag.ts:1-117` (modify)
  - Добавить константы (на уровне модуля): `LONG_PRESS_DELAY_MS = 350`, `TOUCH_DRAG_THRESHOLD_PX = 8`. Значения зеркалят `features/tasks/lib/dnd/use-drag-source.ts`.
  - Добавить модульную функцию `triggerHaptic(): void` — копия из `use-drag-source.ts:29-31` (Telegram WebApp HapticFeedback `impactOccurred('light')`).
  - В `onPointerDown(e: PointerEvent)`:
    - Сохранить ранние проверки (`button !== 0`, `ctrl/meta`, `target.closest('[data-calendar-event-block]')`, `track` available) и расчёт `initialX/Y/initialDate/initialMinutes` — без изменений.
    - **Не** вызывать `track.setPointerCapture` сразу. Не сбрасывать overlay-state до того, как реально стартует drag.
    - Извлечь "настоящий" старт drag в локальную функцию `startDrag(initialEvent: PointerEvent)`, которая делает: установить `startMinutes/overlayTop/overlayLeft/overlayHeight/showOverlay=false`, `track.setPointerCapture(initialEvent.pointerId)`, навесить `pointermove`/`pointerup`/`pointercancel` (текущий код `onMove`/`onUp`/`onCancel`, использующие замкнутые `initialDate/initialMinutes/initialX/initialY/rect`).
    - Ветвление по `e.pointerType`:
      - `'mouse'` → вызвать `startDrag(e)` немедленно. Поведение mouse сохраняется бит-в-бит.
      - `'touch' | 'pen'` → запустить long-press: `setTimeout(..., LONG_PRESS_DELAY_MS)`. До срабатывания таймера слушать на `window` `pointermove`/`pointerup`/`pointercancel`: если движение > `TOUCH_DRAG_THRESHOLD_PX` (евклидово), либо `pointerup`, либо `pointercancel` — `clearTimeout` + снять оконные слушатели, drag не стартует (нативный scroll работает). По срабатыванию таймера — `triggerHaptic()`, снять оконные слушатели, вызвать `startDrag(e)`.
  - Invariants: desktop без изменений (mouse путь), touch активируется только после long-press, константы из общего паттерна, scroll работает до захвата pointer.

- **1.2** `alfy-bot-frontend/src/features/calendar/ui/HourGrid.vue:28` (modify)
  - Удалить атрибут `style="touch-action: none"` с трек-`<div>`. Браузеру нужен дефолтный `touch-action: auto`, чтобы родительский `gridRef` (overflow-auto в `WeeklyCalendar.vue:11`) принимал нативные pan-жесты до момента, как `useCreateSlotDrag` сделает `setPointerCapture`.
  - Invariants: нативный pan-x/pan-y работает на пустой сетке; long-press всё ещё может захватить pointer, потому что `setPointerCapture` после паузы без движения — pointer ещё не "отдан" скроллу.

- Commit: `fix(calendar): long-press на mobile для drag-create в сетке часов`

### New / changed interfaces

```ts
// use-create-slot-drag.ts (внутренние, не экспортируются)
const LONG_PRESS_DELAY_MS = 350
const TOUCH_DRAG_THRESHOLD_PX = 8
function triggerHaptic(): void

// Сигнатура экспорта useCreateSlotDrag без изменений.
// Возврат { showOverlay, overlayStyle, overlayHeight, overlayTimeLabel, onPointerDown } — без изменений.
```

### Test strategy

Per Design, `TDD: no`. Ручная верификация (см. Verify):
- Mobile (Chrome DevTools touch emulation + при возможности реальный iOS/Android):
  - **positive (drag-create)**: палец вниз на пустой ячейке, держать 350ms без движения → haptic (на устройстве) + overlay появляется → растягивание задаёт длительность → up создаёт задачу.
  - **negative (scroll)**: палец вниз и сразу движение > 8px → overlay НЕ появляется, нативный скролл календаря работает (и вертикально, и горизонтально).
  - **negative (отмена long-press)**: палец вниз, движение > 8px ДО 350ms → overlay не появляется, никакая задача не создаётся.
- Desktop:
  - **regression**: mousedown + drag → overlay при > 3px движения, задача создаётся.
  - **clean click**: mousedown без движения → no create, no overlay (порог 3px не превышен).
- Скролл over существующих event-блоков (`CalendarEventBlock` с собственным `touch-action: none`) — out of scope, отмечаем для отдельной задачи.

### Backwards compatibility

Из Design: ломающих API/схем нет. Меняется только поведение жестов внутри `CalendarView` на touch. Desktop без регрессий. Других потребителей `useCreateSlotDrag` нет (`grep` в repo не находит других импортов).

### Order & dependencies

Один фазовый коммит. 1.1 и 1.2 безопасно идут в одном коммите: они зависят друг от друга (без 1.2 long-press всё равно не дал бы native scroll начаться — touch-action блокировал бы pointermove до scroll-захвата, и наш timer бы стрелял; точнее, native pan был бы недоступен и фикс был бы ложным). Обе правки делаются вместе.

### Open questions / risks / rollback

- **iOS Safari pointer cancel timing.** Если Safari агрессивно отдаёт `pointercancel` сразу при первом небольшом movement (< 8px), long-press может никогда не сработать. Митигация: в touch-ветке также обрабатываем `pointercancel` как "отменили намерение drag" — это поведение и так корректно (значит браузер забрал жест под scroll). Дополнительно: thresold 8px выбран по проектному прецеденту, не повышаем без необходимости.
- **iOS контекстное меню на long-press.** На текстовых элементах iOS показывает callout. Трек — пустая div без текста, в проекте уже `select-none` на родителе. Риск низкий.
- **Rollback.** Один коммит → `git revert` возвращает прежнее поведение полностью.

## Verify

**Result:** passed (static + build); real-device mobile smoke deferred to user

Positive (static / code):
- Mouse-путь не изменён: ветка `if (e.pointerType === 'mouse') { startDrag(); return }` сохраняет прежний порядок `setPointerCapture` + listeners + threshold 3px для overlay (diff `git show 68aa53c -- alfy-bot-frontend/src/features/calendar/lib/use-create-slot-drag.ts`).
- Touch/pen-путь добавляет `setTimeout(..., LONG_PRESS_DELAY_MS)` + window-слушатели + `triggerHaptic()` перед `startDrag()`.
- Константы зеркалят `use-drag-source.ts`: `LONG_PRESS_DELAY_MS=350`, `TOUCH_DRAG_THRESHOLD_PX=8` (grep на оба файла).
- `triggerHaptic()` — копия из `use-drag-source.ts:29-31`.

Negative (static / code):
- Cleanup в touch-ветке (`cleanupWait`) вызывается из `onWaitMove` при движении > 8px, из `onWaitEnd` на pointerup/pointercancel — drag не стартует, native scroll получает жест.
- Раньше срабатывания таймера `setPointerCapture` не вызывается → браузеру нечего отменять в pan-режиме.

Invariants:
- `touch-action: none` снят с трека `HourGrid`; `grep -n "touch-action" alfy-bot-frontend/src/features/calendar/ui/*.vue` показывает только `CalendarEventBlock.vue:16` (явно out-of-scope).
- Сигнатура экспорта `useCreateSlotDrag` без изменений: `{ showOverlay, overlayStyle, overlayHeight, overlayTimeLabel, onPointerDown }`.
- `npx vue-tsc --noEmit -p tsconfig.app.json` → 0 ошибок.
- `npx vitest run src/features/calendar` → 4 passed.
- `npm run build` → ok, vite + PWA service worker сгенерированы.

Smoke (mobile, real device) — **DEFERRED**: верификацию настоящего touch-поведения нельзя воспроизвести через DevTools touch emulation надёжно (CSS `touch-action` x scroll-engine отличается). Чеклист для ручной проверки:
1. Открыть `/calendar` на iPhone/Android.
2. Быстрый свайп пальцем вниз/вверх на пустой сетке часов → календарь скроллится вертикально, overlay создания НЕ появляется.
3. Быстрый свайп влево/вправо на пустой сетке часов → переключаются дни горизонтально, overlay НЕ появляется.
4. Удержать палец на пустой ячейке ≥ 350ms без движения → лёгкая вибрация + появляется overlay "Новая задача".
5. Не отпуская — потянуть вниз → высота overlay растёт, время в подписи меняется.
6. Отпустить → открывается диалог создания задачи с прокинутыми датой и временем.
7. Desktop регрессия: курсором кликнуть-потянуть на пустой ячейке → overlay появляется при движении > 3px.

Notes: real-device smoke — единственное, что осталось у пользователя. Если что-то из чеклиста (особенно п. 2-3) не работает — баг не починен, возвращаемся в execute с конкретикой какой жест/устройство.

## Conclusion

Outcome: long-press 350ms gate в `useCreateSlotDrag` + снятие `touch-action: none` с трека `HourGrid` восстанавливают нативный mobile scroll, сохраняя drag-create через осознанный long-press. Коммит `68aa53c`.

Invariants:
- Native vertical scroll работает на пустой сетке — `touch-action: none` снят с track div (`HourGrid.vue:24-28`), `setPointerCapture` отложен до срабатывания таймера.
- Native horizontal pan работает по дням — та же причина.
- Drag-create на touch активируется только после 350ms без движения > 8px — `setTimeout(LONG_PRESS_DELAY_MS)` + `onWaitMove` cancel на превышении threshold (`use-create-slot-drag.ts:127-157`).
- Desktop mouse путь не изменён — ветка `if (e.pointerType === 'mouse') { startDrag(); return }` вызывает прежнюю логику немедленно (line 121-123).
- Haptic feedback при активации — `triggerHaptic()` перед `startDrag()` в timer-callback (line 131).
- Константы зеркалят `use-drag-source.ts` — `LONG_PRESS_DELAY_MS=350`, `TOUCH_DRAG_THRESHOLD_PX=8`, проверено grep'ом.

Review findings:
- Important #2 (race: timer fires at t≈349ms после pointerup → `setPointerCapture` на inactive pointer): принят как **parity-not-regression** — тот же риск в `use-drag-source.ts:120-161`. Исправление только здесь создаст разнобой; если решать, то для обоих файлов отдельной задачей.
- Important #3 (window-listener leak при unmount во время wait): принят как **parity-not-regression** — `use-drag-source.ts` тоже не имеет `onUnmounted` cleanup для in-flight long-press. Решать вместе с #2.
- Minor #4-6 (`e.button` на touch, hoisting `cleanupWait`, дубль координат): не действую — pre-existing или приемлемые.

Future work:
- Применить тот же long-press gate к `usePointerDnd` (drag/resize существующих событий) и снять `touch-action: none` с `CalendarEventBlock.vue:16`. Justification: per Design "out-of-scope" — это отдельный DnD-путь, заслуживает отдельной задачи и тестов.
- Закрыть race-условие и unmount-leak в обоих long-press реализациях (`use-create-slot-drag.ts` + `use-drag-source.ts`). Justification: parity-not-regression, не возникло в этой задаче, но реальный риск; решать вместе одним коммитом.

Verified by: static + type + build + calendar unit tests прошли локально; real-device mobile smoke deferred — чеклист в Verify-секции (быстрый свайп → scroll; long-press → создание; desktop регрессия).
