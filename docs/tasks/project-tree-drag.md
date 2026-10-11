# Перенос проектов между уровнями

**Status:** done
**Branch:** fix/pomodoro-play-pause
**Worktree:** none
**Mode:** interactive
**Goal:** В локальном интерфейсе перетаскиванием пользователь делает проект дочерним, переносит его к другому родителю или в корень вместе с потомками; структура и порядок сохраняются после reload.

## Context
Todoist Help, Create a sub-project (обновлено 2026-08-28): https://www.todoist.com/help/todoist/features/create-a-sub-project-in-todoist-aTA15C70 — горизонтальный drag меняет вложенность. Исходный код Todoist недоступен; воспроизводим документированный UX, а не заявляем знание реализации. Его ограничение в три уровня не переносим в существующие неограниченные деревья Alfy.
Сейчас каждый уровень — отдельный vuedraggable без переноса между уровнями. PATCH parentId и reorder — разные запросы. UI выбора родителя исключает потомков, но API блокирует только прямое self-parent.

## Design
Один плоский список видимых строк с вычисляемой глубиной вместо независимых sortable-уровней. Перетаскивание за ручку через PointerEvents: порог начала, горизонтальный сдвиг меняет глубину, вертикальный — позицию; линия и текст показывают назначение. Переносимая ветка исключена из кандидатов. Escape, pointercancel, отпускание вне списка отменяют перенос; край scroll-панели прокручивает список. Свёрнутый родитель раскрывается после успешного drop внутрь него. Дополнительно «На уровень выше» в меню.
Альтернатива — связанные vuedraggable — не даёт предсказуемого горизонтального изменения глубины и допускает промежуточные удаления/добавления; замена ограничена деревом проектов.
Новый PATCH /projects/:id/move {parentId: string|null, beforeId: string|null} атомарно меняет родителя и соседский порядок. Проверки принадлежности и отсутствия циклов выполняются внутри транзакции; ответ — актуальный список проектов. Прежние endpoint остаются совместимыми.
TDD: yes — проекция назначения, store HTTP-контракт, серверный план переноса.

### Invariants
- IV1 — Нельзя сделать проект потомком себя; чужие проекты не меняются.
- IV2 — Потомки сохраняются при переносе ветки; parentId и порядок фиксируются атомарно.
- IV3 — Отмена или ошибка не меняют локальное дерево; ошибка видна пользователю.
- IV4 — Сортировка соседей, меню, сворачивание и drop задач на проекты продолжают работать.

## Plan
### PH1 — Полный перенос дерева
- Backend project/dto/move-project.dto.ts, project.controller.ts, project.service.ts, domain/project-repository.port.ts, infrastructure/typeorm-project.repository.ts: move API и transactional repository; lib/plan-project-move.ts — расчёт с валидацией; unit и SQLite integration tests.
- Frontend projects/lib/project-tree-drag.ts: flatten/projection; lib/use-project-tree-drag.ts: pointer lifecycle и autoscroll. UI ProjectTreeList/Item/Nav: плоские строки, ручка, индикатор, событие relocate; model/types и project-store: moveProject(id,parentId,beforeId), один PATCH без optimistic частичных записей.
- Тесты: child/root/other-parent, целая ветка, циклы, invalid anchor, failure/cancel, HTTP payload и обновление состояния.
- Browser smoke: локальный UI→реальный ProjectController→SQLite в памяти, drag туда/обратно, reload, Escape; дополнительно touch и task-drop регрессия по доступным проверкам.
- Commit: feat(projects): drag branches between hierarchy levels.

## Verify
Result: passed
- CK1 (IV1) — циклы через себя/ребёнка/внука и чужой родитель отклонены; SQLite подтверждает отсутствие изменений чужой ветки.
- CK2 (IV2) — fault injection через SQLite trigger после изменения соседей полностью откатывает транзакцию; descendant parentId сохраняется.
- CK3 (IV3) — store HTTP failure не меняет дерево; Chromium Escape и отпускание вне списка не отправляют запрос.
- CK4 (IV4) — 104 frontend tests (проекты + task DnD), 74 backend project tests; frontend/backend builds проходят.
- Smoke: реальный UI → ProjectController/Service → SQLite :memory: с тестовым auth guard; мышью вложить ветку, reload, вынести в корень, перенести к свёрнутому родителю, touch-outdent при 390px. Проверены БД и отсутствие JS errors. Пропущенный beforeId возвращает HTTP 400.
- Todoist: воспроизведён документированный жест; реализация независимая, лимит в 3 уровня не добавлен.

- CK5 — два параллельных переноса сначала завершались ошибкой SQLite BEGIN; общая очередь writeTree устраняет конфликт и повторно проверяет иерархию после предыдущей записи. Тест взаимоисключающих переносов и rename одновременно с move проходит.
- CK6 — найденный ревью обход через старый PATCH закрыт: update и move используют общую транзакционную запись. Реальный HTTP PATCH с родителем-потомком возвращает 400.
- CK7 — браузерный touchCancel не отправляет move; удержание drag у нижнего края длинной панели увеличивает scrollTop.

## Conclusion
Цель подтверждена полным локальным browser→API→SQLite сценарием; реализация `dc0b441`, исправления `bc9d19e` и последующий fix reorder.

### Review fixes
- Старый update допускал циклы: перенесён в общий writeTree; поля, отсутствующие в DTO, сохраняются, ответ перечитывается после записи.
- Конкурирующие изменения дерева выполняются последовательно на одном SQLite-соединении.
- Reorder тоже переведён в user-scoped writeTree: тест сначала воспроизвёл изменение чужого проекта; после исправления весь запрос отклоняется без частичных записей. UI-сортировка через меню проверена повторным smoke.

### Deviations from plan
- Защищены прежние update/reorder: независимое ревью показало, что иначе они обходят общие инварианты дерева. Внешние сигнатуры endpoint сохранены.

### Hands-off decisions
- Дизайн и план автоматически одобрены согласно действующей инструкции пользователя.
