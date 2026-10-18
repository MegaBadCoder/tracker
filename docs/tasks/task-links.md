# Постоянные ссылки задач

**Status:** done
**Branch:** codex/task-markdown
**Worktree:** /Users/v/projects/Alfy/.worktrees/task-markdown
**Mode:** interactive
**Goal:** Пользователь копирует ссылку задачи и открывает её в отдельной вкладке с рабочей карточкой, включая холодную загрузку и возврат после входа. Useless if: работает только из уже загруженного списка, открывает чужую задачу или теряет URL после входа.

## Context
TaskDetailDialog общий для всех представлений, но не имеет ссылок; router не содержит отдельного task route; GET /tasks/:id отсутствует. LoginView после входа ведёт в корень.

## Design
Канонический URL /tasks/:taskId (постоянный UUID); общий диалог получает копирование ссылки с результатом/ошибкой и настоящий anchor новой вкладки. Не показывать ссылки временных/виртуальных задач. Отдельная страница загружает задачу по GET /tasks/:id, показывает существующую карточку и использует штатные handlers обновления. Loading, 404, error+retry; close/deletion ведут в проект либо входящие. При смене id поздний ответ не открывает прежнюю задачу. Login redirect только локальный разрешённый маршрут, без external/protocol-relative. TDD yes. План автоапрув по предпочтению пользователя.

### Invariants
- IV1 — GET возвращает только задачу текущего пользователя с полями getAll; unknown/foreign -> 404, unauthorized -> 401.
- IV2 — Ссылка стабильна, загрузка независима от текущего списка, ошибки не маскируются как not-found.
- IV3 — Login redirect не позволяет уйти на внешний URL; clipboard error не сообщает успех.

## Plan
### PH1 — API
- alfy-bot/src/modules/task/task.controller.ts + task.service.ts: GET :id после статических GET routes, UUID validation, getOne(userId,id):Promise<Task>, attachGoalIds.
- backend unit/HTTP tests: owned/foreign/missing/unauthorized and timer route untouched.
- Commit feat(tasks): fetch individual tasks securely
### PH2 — Page and auth
- alfy-bot-frontend/src/features/tasks/model/task-store.ts: fetchTask(id):Promise<Task> merge single task, throw on errors.
- router/index.ts + views/TaskView.vue: route /tasks/:taskId, load/error/404/retry, stale request handling, existing detail handlers, close/delete navigation.
- views/LoginView.vue, VerifyEmailView.vue, ResetPasswordView.vue, api/client.ts + auth redirect helper: preserve requested local URL across email/Telegram login; safe redirect validation.
- tests corresponding store/view/router/login behavior.
- Commit feat(tasks): open task permalinks after direct navigation and login
### PH3 — Links in card
- features/tasks/ui/TaskDetailDialog.vue and new TaskLinkActions.vue: task.id prop; canonical link, copy with success/error, new tab anchor; virtual/temp hidden; no edit needed for readonly.
- features/tasks/lib/task-link.ts and tests: local path builder for persisted UUID.
- tests UI clipboard success/reject/no support, href/target/rel, invalid ids.
- Commit feat(tasks): copy and open task permalinks

### Interfaces
- IF1 — GET /tasks/:id -> Task same fields as list; auth required, owned scoped.
- IF2 — TaskLinkActions.vue props {taskId:string}; handles all link display/copy.
### Interface graph
- PH1 -> IF1 @ alfy-bot/src/modules/task/ alfy-bot/test/task-links.e2e-spec.ts
- PH2 IF1 -> @ alfy-bot-frontend/src/features/tasks/model/task-store.ts alfy-bot-frontend/src/router/ alfy-bot-frontend/src/views/TaskView.vue alfy-bot-frontend/src/views/LoginView.vue alfy-bot-frontend/src/views/VerifyEmailView.vue alfy-bot-frontend/src/views/ResetPasswordView.vue alfy-bot-frontend/src/api/client.ts alfy-bot-frontend/tests/api/client.spec.ts alfy-bot-frontend/src/lib/auth-redirect.ts alfy-bot-frontend/tests/features/tasks/model/ alfy-bot-frontend/tests/views/ alfy-bot-frontend/tests/router/ alfy-bot-frontend/tests/lib/auth-redirect.spec.ts
- PH3 -> IF2 @ alfy-bot-frontend/src/features/tasks/ui/TaskDetailDialog.vue alfy-bot-frontend/src/features/tasks/ui/TaskLinkActions.vue alfy-bot-frontend/src/features/tasks/lib/task-link.ts alfy-bot-frontend/tests/features/tasks/ui/TaskLinkActions.spec.ts alfy-bot-frontend/tests/features/tasks/ui/TaskDetailDialog.spec.ts alfy-bot-frontend/tests/features/tasks/lib/task-link.spec.ts

## Validation
Focused TDD, type-check/build/lint, real browser cold direct link + edit/reload/404, independent review.

### PH2 scope clarification
- Полный вход включает подтверждение email, сброс пароля и 401 при истёкшем токене: эти три пути также сохраняют безопасный redirect. Изменения ограничены адресом возврата, протокол авторизации не меняется.

### PH2 validation
- RED: fetchTask отсутствует (2 failing tests), safe redirect helper отсутствует (import failure). GREEN: 32 focused tests (store/view/auth/router/interceptor), vue-tsc, production build.
- Новые файлы проходят ESLint; у изменённых старых файлов остаются существующие style violations, массового форматирования не было.

## Verify
Result: passed
- IV1: 143 backend unit и 6 HTTP tests; owned list/get parity, foreign/missing 404, anonymous 401, invalid UUID 400, timer route unchanged. Backend build passed.
- IV2/IV3: общий повторный прогон 95 frontend tests в 11 suites, включая Markdown, copy/reject, холодную загрузку, late responses, login continuation и запрет внешнего redirect. Type-check/build passed; новых lint ошибок нет.
- Browser smoke: прямой /tasks/UUID загрузил карточку без списка; копирование показало успех; редактирование Markdown сохранилось после reload; missing UUID показал понятный 404. New-tab anchor href/target/rel проверены тестами; встроенный браузер не предоставил отдельную popup-вкладку после клика.
- Screenshot: /Users/v/.codex/visualizations/2026/10/09/01a120ab-bf2f-7d90-a51f-5fca7d78316d/task-links.png.

## Conclusion
Постоянная ссылка загружает рабочую карточку с сохранением Markdown и возвратом после авторизации; реализация 1049926. Итоговые 111 frontend tests и production build прошли.

Review findings resolved:
- Поздняя ошибка сохранения A скрывала открытую B: rollback всех трёх путей ищет актуальный индекс по ID и меняет выбранную карточку только при совпадении ID. Регрессии подтверждены RED → GREEN.
- Задача могла загрузиться раньше Agile-проекта: watcher учитывает также тип проекта и догружает группы/спринты/релизы при его появлении. Регрессия RED → GREEN.
- Независимое повторное ревью подтвердило оба исправления без новых важных замечаний.

Plan adherence: расширен только адрес возврата в существующих verify/reset/401 путях; исправления общих обработчиков ограничены выявленными гонками при прямой навигации. IV1 подтверждён HTTP tests; IV2 — браузером и stale-response tests; IV3 — auth/clipboard tests.
