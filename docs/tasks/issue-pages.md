# Страницы задач, историй и эпиков

**Status:** done
**Branch:** codex/issue-pages
**Worktree:** /Users/v/projects/Alfy/.worktrees/issue-pages
**Base:** adc9b59
**Mode:** hands-off
**Goal:** Пользователь Alfy открывает задачу, историю или эпик по постоянной ссылке как полноценную рабочую страницу, переходит по иерархии и редактирует те же данные в быстром просмотре; истории на доске сворачиваются без потери контекста. Useless if: URL всё ещё показывает только модалку; страница и preview имеют разные формы; глубокая ссылка требует сначала открыть доску; длинные зависимости обрезаются; сворачивание скрывает статус или теряется при возвращении.

## Context
- `/tasks/:taskId` уже существует, но TaskView открывает TaskDetailDialog; авторизация сохраняет redirect.
- Эпики/истории открываются через глобальный GroupDetailDialog без маршрутов. Его flex-колонки без min-width допускают переполнение, список всех зависимостей занимает всю боковую панель.
- AgileEpicBlock умеет сворачиваться, AgileStoryBlock — нет. Пользователь отдельно попросил сворачивание истории.
- Основной checkout содержит чужие незакоммиченные изменения; новая работа изолирована от origin/main.

## Design
Сохранить быстрый просмотр по клику с доски и существующие события. Постоянная ссылка задачи теперь открывает встроенную страницу без overlay; добавить `/tasks/project/:projectId/group/:groupId` для эпика/истории. В preview — копирование ссылки и переход на страницу; ссылки внутри полноценной страницы ведут на страницы связанных сущностей, с обычным Ctrl/Cmd-click. Страница содержит breadcrumbs, широкую область заголовка/описания/дочерних элементов и правую панель свойств; на узком экране одна колонка. Формы общие для страницы и preview, persistence через существующие stores/API. Не вводить отдельную модель issue или новые идентификаторы.

Быстрый просмотр остаётся диалогом, с ограниченной шириной, читаемыми переносами и доступным скроллом. Зависимости историй: выбранные видны, поиск по кандидатам, ограниченный прокручиваемый список вместо растягивания всей панели. Сохранить ручное применение условий.

Сворачивание истории — отдельная стрелка с aria-expanded; название продолжает открывать preview. В свёрнутом виде видны название, статус, счётчик и действия. «Добавить задачу» раскрывает историю. Состояние по projectId/storyId хранится в браузере, переживает remount/возврат/перезагрузку; существующая единая сетка колонок и DnD сохраняются.

Альтернативы: отдельные копии редакторов проще начать, но расходятся; превращение любого клика в переход ломает быстрый workflow доски. Выбраны общие редакторы и явные страницы при сохранении preview.
TDD: yes для маршрутов, загрузки/ошибок/гонок, редактирования и сворачивания; раскладка проверяется браузером.

### Invariants
- IV1 — URL задачи совместим; группы scoped by project; cold start, reload, login redirect, back/forward работают; 404 и сетевые ошибки различимы.
- IV2 — Одна форма/логика редактирования на сущность для page и preview; не теряются checklist, Pomodoro, workflow, даты, релиз, зависимости, удаление с подтверждением.
- IV3 — Page не открывает overlay; preview закрывается в исходный контекст; переходы по breadcrumbs/дочерним ссылкам корректны, устаревшие async ответы не переключают сущность.
- IV4 — Нет горизонтального обрезания контента на 390px и desktop; длинные названия/зависимости переносимы, keyboard focus и scroll доступны.
- IV5 — Свёрнутая история сохраняет заголовок/статус/счётчик и состояние по своей идентичности; добавление раскрывает, сетка/порядок/DnD не меняют данные.

## Plan

### PH1 — Полноценная задача
- `alfy-bot-frontend/src/features/tasks/ui/TaskDetailDialog.vue:1-1120`: извлечь общую форму в TaskDetailContent.vue, сохранить диалоговую оболочку и внешние props/events.
- `src/views/TaskView.vue:1-135`: встроенная общая форма, загрузка по URL, ошибки/retry, удаление, переходы по иерархии без overlay; при необходимости точечное расширение use-task-detail-handlers.ts для page opener.
- `tests/views/TaskView.spec.ts`, `tests/features/tasks/ui/TaskDetailDialog.spec.ts`, новый TaskDetailContent.spec.ts: page vs preview, cold load/edit, ошибки/late responses, frozen tasks и checklist/Pomodoro compatibility.
- Commit: feat(tasks): open permanent task links as full pages.

### PH2 — Эпики и истории
- `src/features/projects/ui/GroupDetailDialog.vue:1-470`: вынести общую GroupDetailContent.vue с явными projectId/groupId/presentation; wrapper сохраняет singleton preview и переключение task/group.
- Новый `src/views/GroupView.vue`: загрузить project-scoped данные через existing API/store, встроенный редактор, missing/error/retry, связанная навигация и подтверждаемое удаление; устранить гонки при смене route.
- `src/features/projects/ui/StoryPlanningFields.vue:1-74`: поиск/скролл зависимостей, min-width и переносы; сохранить payload и ручное применение.
- Existing GroupDetailDialog tests + новые GroupView/Content/StoryPlanningFields tests.
- Commit: feat(projects): add epic and story pages with shared quick preview.

### PH3 — Маршруты, ссылки и сворачивание
- `src/router/index.ts:30-80`: group route name=project-group; route/login tests, существующий task route не менять.
- Новые `features/projects/lib/group-link.ts`, `ui/GroupLinkActions.vue`: canonical path и копирование/новая вкладка; использовать общий link actions presentation с существующим TaskLinkActions если это уменьшает дублирование.
- `ui/GroupActionsMenu.vue:90-110`: явный пункт страницы рядом с preview, реальные href.
- `ui/AgileStoryBlock.vue:40-145`, новый `model/board-collapse-store.ts`: сохранение collapsed state, доступная стрелка, скрытые клетки, автопоказ добавления; tests collapse/remount/identity/grid.
- README/CLAUDE/task: страницы и различие с preview, проверка всего потока browser + независимый review.
- Commit: feat(navigation): link group pages and preserve collapsed stories.

### Interfaces
- IF1 — groupLinkPath(projectId:string, groupId:string): string|null — `/tasks/project/${projectId}/group/${groupId}` только persisted UUID; route name project-group, params projectId/groupId. Producer PH3, consumers PH1/PH2.
- IF2 — GroupLinkActions props `{projectId:string,groupId:string,type:'epic'|'story'}` — copy/new-tab actions using IF1; no mutations. Producer PH3, consumer PH2.
- IF3 — GroupView.vue — page route consumer, uses shared content, owns its task preview if needed; user clicks child title → canonical page. Producer PH2, consumer PH3 router.

### Interface graph
- PH1 IF1 -> @ alfy-bot-frontend/src/features/tasks/ui/TaskDetailDialog.vue alfy-bot-frontend/src/features/tasks/ui/TaskDetailContent.vue alfy-bot-frontend/src/features/tasks/lib/use-task-detail-handlers.ts alfy-bot-frontend/src/views/TaskView.vue alfy-bot-frontend/tests/views/TaskView.spec.ts alfy-bot-frontend/tests/features/tasks/ui/TaskDetailDialog.spec.ts alfy-bot-frontend/tests/features/tasks/ui/TaskDetailContent.spec.ts
- PH2 IF1, IF2 -> IF3 @ alfy-bot-frontend/src/features/projects/ui/GroupDetailDialog.vue alfy-bot-frontend/src/features/projects/ui/GroupDetailContent.vue alfy-bot-frontend/src/features/projects/ui/StoryPlanningFields.vue alfy-bot-frontend/src/views/GroupView.vue alfy-bot-frontend/tests/views/GroupView.spec.ts alfy-bot-frontend/tests/features/projects/ui/GroupDetailDialog.spec.ts alfy-bot-frontend/tests/features/projects/ui/GroupDetailContent.spec.ts alfy-bot-frontend/tests/features/projects/ui/StoryPlanningFields.spec.ts
- PH3 IF3 -> IF1, IF2 @ remaining frontend navigation/link/collapse files docs/ README.md CLAUDE.md

### Test strategy
Baseline focused TaskView/TaskDetail/GroupDetail and board suites; RED→GREEN core behavior; full frontend tests and build; local real API + browser desktop/mobile page/edit/reload/preview/dependency overflow/collapse, then independent review.

### Risks / rollback
- RK1 — Extracting forms affects many callers: preserve wrapper contract, run existing suites, phase commits allow isolated revert.
- RK2 — Store fetch catches errors or ensure returns early: pages must observe complete loading and display actual errors, never stale context.

## Verify

Result: passed

Happy-path:
- CK1 (IV1, IV2) — прямая ссылка требует предварительного открытия доски или показывает overlay — held: локальный API 3018/Vite 5188, холодные task/story страницы, переход task→epic; страницы без dialog, название и описание задачи, чеклист и зависимость сохранены через API и пережили reload.
- CK2 (IV2) — извлечение формы ломает checklist/Pomodoro/frozen или preview — held: существующие и новые тесты TaskDetailDialog/Content/View, GroupDetailDialog/Content/View.

Negative:
- CK3 (IV1, IV3) — ошибка сети выглядит как удалённая группа или поздний ответ меняет страницу — held after repair f8c2c30: ревью выявило обход active guard через мутирующий tasks.fetchTasks(); RED воспроизвёл late tasks response при переходе/после unmount. Чистый fetchTaskSnapshot применяется под guard; оба сценария GREEN, ошибочный fetch не коммитит частичные данные. Missing state также проверен в браузере.
- CK4 (IV2) — ошибка удаления уводит со страницы без сообщения — held: тесты отмены/ошибки удаления; GroupView показывает alert, TaskView восстанавливает редактор.

Invariants / assumptions:
- CK5 (IV4) — длинные зависимости распирают страницу — held: браузер desktop и 390 CSS px, document scrollWidth=390, поиск оставляет выбранную связь видимой, checked=true после reload; список ограничен по высоте.
- CK6 (IV5) — история теряет collapsed после remount или скрывает статус/добавление — held: AgileStoryCollapse 3 tests, новая Pinia восстанавливает localStorage, другая история независима, добавление раскрывает; AgileBoardView 26 tests сохраняют сетку.
- CK7 (IV3, IV4, IV5) — реальная доска/preview на 390/640px сохраняют возврат, скролл и collapse после reload — held: после отказа Chrome CUA проверка продолжена в IAB. Collapse пережил reload, AddTask раскрыл историю. Group preview clientWidth=scrollWidth=390/640, фильтр доступен; group→task preview без стека. Task mobile drawer Место принимает текст и закрывается Enter, обновлённое свойство видно в preview. Закрытие возвращает доску; меню «Открыть страницу» и back работают.

Interfaces:
- CK8 (IF1–IF3) — canonical links пересекаются с task/board или теряются после auth — held: route/group link tests, новый auth redirect test; ссылки child task и epic открыты в браузере.

Smoke: локальные реальные Nest API и Vite, синтетический проект, 14 длинных зависимостей; task/story/epic страницы, preview, collapse и сохранение проверены. После repair полный frontend test: 142 files / 1098 tests passed; build passed; scoped lint passed. В task-store.ts baseline/current имеют одинаковые 51 lint-ошибки, постороннее форматирование не менялось. Node 25 запускался с NODE_OPTIONS=--no-experimental-webstorage из-за существующей несовместимости тестового localStorage.
Goal: страницы, preview и сворачивание проверены напрямую на реальном локальном API; гонка CK3 устранена с отдельными регрессиями.
Notes: тестовый checklist изначально был создан без обязательного order; сервер правильно вернул 400, fixture исправлен, повторное сохранение и UI 1 из 1 подтвердились.

## Conclusion
Outcome: отдельные страницы задачи/истории/эпика, общий быстрый просмотр и сохранение сворачивания историй реализованы; implementation f8c2c30, независимое повторное ревью c7ec9a1 без новых замечаний.

Invariants:
- IV1/IV3 — route/auth/404/network/race тесты; реальный cold load, navigation/back и preview без стека.
- IV2 — общий редактор, существующие тесты сохранены; browser save/reload для названия, описания, checklist, dependency и mobile property.
- IV4 — desktop и 390px страницы, 390/640px preview без горизонтального переполнения.
- IV5 — реальная доска сохранила collapse после reload, AddTask раскрывает; 3 regression tests и 26 board tests.

Review findings: P2 race исправлен f8c2c30; повторное независимое ревью c7ec9a1 подтвердило исправление, 11/11 проверок passed.
Verified by: CK1–CK8, 1098 frontend tests и production build; скриншоты story-page.png и collapsed-story.png в каталоге визуализаций текущего чата.
Delivery: локальная ветка codex/issue-pages готова к PR; push/merge/deploy этой доработки не выполнялись. Worktree сохранён, временные локальные серверы остановлены.

### Hands-off decisions
- make: новый worktree от adc9b59, ранее согласованный автоапрув продолжается; production публикация этой новой доработки отдельна от завершённого предыдущего деплоя.
- udesign: сохраняем существующий quick-preview клик; страницы доступны по постоянным ссылкам и явным действиям, общие редакторы предотвращают расхождение.
- uplan: план auto-approved, PH1/PH2 независимые implementers, PH3 и интеграция контроллером; scope включает последнее дополнение о сворачивании.
- uexecute: PH1 fda9085, PH2 b200701, PH3 a90971d; общий helper удаления расширен observable error ref для сохранения boolean-контракта существующих callers.
- uverify: Chrome CUA перестал отвечать, использован IAB; CK7 выполнен без сокращения проверки.
- ureview: исправлена гонка tasks.fetchTasks — чистый снимок применяется под active guard вместе с данными группы; f8c2c30.

## Дополнение: наложение заголовков доски

Пользователь прислал наложение текста/стрелок на строку колонок. Воспроизведено в браузере на длинной доске: отдельные sticky-ячейки оставляли прозрачные промежутки gap-x-2, сквозь которые видны заголовки прокручиваемых групп. При scrollTop=86 hit-test промежутка попадал в обычную сетку, не в закреплённую шапку.

Исправление: единая sticky-строка с непрозрачным bg-background и subgrid, дочерние названия колонок сохраняют ширину и отступы. Горизонтальный скролл по-прежнему один. Контракт: при вертикальной прокрутке ни текст, ни кнопки групп не видны сквозь строку заголовков; при горизонтальной прокрутке названия остаются над своими колонками.

Verify: passed — regression RED→GREEN; 29 tests доски/сворачивания и scoped ESLint passed. Браузер: при scrollTop=50/86 промежуток перекрыт sticky-строкой; на ширине 640px и scrollLeft=256 колонки сохранили 260px, шапка 796px, непрозрачный фон. Остальные sticky-пути просмотрены: в planning шапка уже цельная. Скриншоты board-overlap-before.png / board-overlap-fixed.png в каталоге визуализаций чата.

Review: независимый reviewer проверил fb116c1..8ef109d, конкретных замечаний нет. Изменение завершено в codex/issue-pages, production не изменён.
