# Управление деревом проектов

**Status:** reviewing
**Branch:** fix/pomodoro-play-pause
**Worktree:** none
**Goal:** В локальном веб-интерфейсе пользователь удаляет проект с подтверждением, создаёт подпроект, сворачивает ветку, сохраняет порядок на любом уровне и прокручивает длинный сайдбар на desktop/mobile.
**Mode:** interactive

## Context
- ProjectTreeNav отправляет исходный computed-массив после drag; вложенные строки не sortable.
- API и формы поддерживают parentId; меню дерева содержит только редактирование.
- AppSidebar ограничен высотой экрана без overflow; у ProjectTreeItem нет toggle.
- Удаление в БД сохраняет детей и задачи через SET NULL; store удаляет только проект, оставляя устаревшие parentId.
- В рабочем дереве уже изменены ProjectPicker.vue, ProjectPickerContent.vue и тест picker: эти правки не входят в задачу.

## Design
Расширить существующие компоненты и vuedraggable: рекурсивный список с явной ручкой сортировки, кнопка раскрытия, меню «Создать подпроект / Изменить / Удалить». Порядок ручной среди соседей, перенос к другому родителю через существующую форму. Скрытые ветки хранятся в Pinia для синхронизации двух экземпляров sidebar. Удаление подтверждается существующим useConfirm; дети становятся корневыми, задачи переходят во входящие. Ошибки отображаются пользователю. Прокручивается содержимое панели под профилем.
Альтернативы: отдельная страница управления усложняет простой сценарий; новый DnD-движок увеличивает объём без пользы для этого запроса.
TDD: yes для store и контракта сортировки; визуальные изменения проверяются в браузере.

### Invariants
- IV1 — Удаление не теряет дочерние проекты и задачи; ошибка API сохраняет исходное состояние.
- IV2 — Сортировка передаёт новый порядок соседей и не меняет другие ветки; ошибка видна и откатывает порядок.
- IV3 — Сворачивание не удаляет данные; создание подпроекта передаёт выбранный parentId.
- IV4 — Последний проект доступен прокруткой на desktop/mobile; действия доступны с клавиатуры и touch.

## Plan
### PH1 — Управление проектами в сайдбаре
- `alfy-bot-frontend/src/features/projects/ui/ProjectTreeNav.vue:1-75`: создание с parentId, удаление через useConfirm, переход из удалённого проекта, обработка ошибок.
- `alfy-bot-frontend/src/features/projects/ui/ProjectTreeItem.vue:1-172`: toggle и меню, вложенный sortable список.
- Новый `ProjectTreeList.vue`: `nodes: ProjectTreeNode[]`, `depth: number`; события edit/create-child/delete/reorder; update:modelValue передаёт фактический порядок.
- `alfy-bot-frontend/src/features/projects/model/project-store.ts:8-151`: collapsedIds/toggleExpanded, согласованное удаление с parentId=null после успешного API.
- `alfy-bot-frontend/src/components/AppSidebar.vue:131-192`: ограниченная scroll-область в обоих вариантах.
- Диалоги создания/редактирования: видимые ошибки и защита повторного сохранения.
- Тесты projects: удаление родителя и ошибка, новый порядок и rollback, toggle, create-child, отмена удаления.
- Commit: `feat(projects): add sidebar tree management`.

## Code smells
- `alfy-bot/src/modules/project/project.service.ts:93` — reorder не использует userId; отдельная существующая проблема авторизации API, не расширяем её исправлением интерфейса.

## Verify
Result: passed
- CK1 (IV1) — тест сначала воспроизвёл исчезновение детей; после исправления дети остаются корневыми, внуки сохраняют родителя; ошибка DELETE не меняет дерево.
- CK2 (IV2) — новый порядок отправляется через update:modelValue, вложенная сортировка и rollback проверены; ошибка отображается.
- CK3 (IV3) — toggle и parentId проверены компонентными тестами и браузером.
- CK4 (IV4) — в Chromium при 1280×720 и 390×844 последний из 35 проектов видим после scroll; до исправления panel 720 / content 1580 / overflow visible.
- `npm run test:run -- tests/features/projects`: 80 passed; `npm run build`: passed.
- Smoke: локальное приложение в Chromium, изолированный API stub: создание подпроекта, collapse, reorder кнопками и native drag, reload, отмена/подтверждение удаления с сохранением детей; ошибок JS нет.
- Ограничение: браузерный smoke проверяет полный UI→HTTP путь на тестовом API, не реальный backend и БД.

## Conclusion
### Hands-off decisions
- Дизайн и план автоматически одобрены по прямой инструкции пользователя.
- Используем существующий контракт удаления SET NULL; не вводим каскадное удаление.
