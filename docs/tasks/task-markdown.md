# Markdown в описании задачи

**Status:** done
**Branch:** codex/task-markdown
**Worktree:** /Users/v/projects/Alfy/.worktrees/task-markdown
**Mode:** interactive
**Goal:** Пользователь читает описание задачи с оформленными кликабельными ссылками и редактирует Markdown по отдельной кнопке. Useless if: ссылки не открываются, исходный текст теряется или просмотр случайно включает редактор.

## Context
- TaskDetailDialog использует ContentEditableInput с сохранением по blur и ограничением описания в 10 строк.
- Общего Markdown renderer на клиенте нет; описание хранится строкой и доступно через MCP.

## Design
Режим чтения по умолчанию: Markdown-ссылки, обычные HTTP(S) URL, базовое форматирование и переносы строк. Редактирование исходника через кнопку, textarea и Сохранить/Отмена; Escape отменяет. В readonly режиме редактирование недоступно. Хранение и API остаются строковыми. Используем markdown-it с html=false и безопасной валидацией URL; внешние ссылки в новой вкладке с noopener noreferrer. Изображения не загружаются, показываются текстом. Богатый WYSIWYG добавил бы преобразование формата без необходимости; самописный regex-парсер не покрывает Markdown корректно. TDD: yes.

### Invariants
- IV1 — Исходный Markdown сохраняется без преобразования в HTML; отмена не отправляет update.
- IV2 — HTML не исполняется; опасные схемы ссылок не кликабельны.
- IV3 — Readonly и смена задачи не сохраняют черновик другой задачи; просмотр не активирует редактирование.

## Plan
### PH1 — Renderer
- src/shared/ui/MarkdownContent.vue (new), package.json/package-lock.json: markdown-it, html=false, linkify, breaks; styles, safe links, disabled images. Public prop content:string.
- tests/shared/ui/MarkdownContent.spec.ts: named/bare links, unsafe links/raw HTML, newlines, code/list, image no remote load.
- Commit: feat(tasks): render safe Markdown descriptions
### PH2 — Editor integration
- src/features/tasks/ui/TaskDetailDialog.vue: replace description contenteditable with reusable TaskDescription.vue, remove obsolete description-only state; update still uses emitUpdate.
- src/features/tasks/ui/TaskDescription.vue (new): props description:string, editable:boolean; emit save(description:string). Preview/edit, explicit Save/Cancel, Escape, raw draft, collapse long preview, reset on task switch (key task.id).
- tests/features/tasks/ui/: tests preview/edit/save/cancel/readonly, task switch integration and only expected update.
- Commit: feat(tasks): edit descriptions with explicit controls

### Interfaces
- IF1 — MarkdownContent.vue props {content:string}, safe formatted preview with no network image loads.
### Interface graph
- PH1 -> IF1 @ alfy-bot-frontend/src/shared/ui/MarkdownContent.vue alfy-bot-frontend/tests/shared/ui/MarkdownContent.spec.ts alfy-bot-frontend/package.json alfy-bot-frontend/package-lock.json
- PH2 IF1 -> @ alfy-bot-frontend/src/features/tasks/ui/TaskDescription.vue alfy-bot-frontend/src/features/tasks/ui/TaskDetailDialog.vue alfy-bot-frontend/tests/features/tasks/ui/

### Validation
Tests first; frontend build/type-check/scoped lint; browser smoke and independent review. Plan auto-approved per user preference in this session.

## Verify
Result: passed
- CK1 (IV1) — 48 tests passed: именованные/обычные ссылки, исходный Markdown, save/cancel, readonly, переключение задачи и Escape без закрытия карточки.
- CK2 (IV2) — Тесты подтвердили экранирование HTML, запрет опасных схем и отсутствие загрузки изображений.
- CK3 (IV3) — Смена task.id сбрасывает редактор; отмена и readonly не отправляют update.
- Type-check, production build и scoped lint пройдены.
- Browser smoke с локальным API/SQLite: Markdown сохранён через карточку, форматирование и ссылки видны после перезагрузки; отменённый черновик не сохранён. Снимок: /Users/v/.codex/visualizations/2026/10/09/01a120ab-bf2f-7d90-a51f-5fca7d78316d/task-markdown.png.

## Conclusion
Описание задачи поддерживает форматированные ссылки и отдельное редактирование исходного Markdown; реализация b9f43dd. Независимое ревью не выявило critical/important замечаний, повторный прогон 48 тестов прошёл. После ревью тест клика изолирован от сетевого перехода; 7 тестов компонента повторно прошли.

Invariants: IV1 подтверждён точным payload и браузерным сохранением/отменой; IV2 — негативными тестами renderer; IV3 — readonly, Escape и сменой task.id в интеграционных тестах.
