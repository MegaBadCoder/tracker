# Перенос проектов удержанием

**Status:** reviewing
**Branch:** fix/pomodoro-play-pause
**Worktree:** none
**Goal:** Ручки drag отсутствуют; удержание названия запускает перенос, короткий клик открывает проект, обычный touch swipe прокручивает панель.
**Mode:** interactive

## Design
Удержание 350 мс мышью/touch/pen, отмена до активации при движении >8 px. Кнопки раскрытия и меню не запускают drag. После активации touchmove блокирует нативный scroll, click после drop не открывает проект. Существующая проекция, отмена и сохранение сохраняются.
TDD: yes — таймер, раннее движение, короткое нажатие, cleanup.

## Plan
Один frontend phase: use-project-tree-drag.ts — задержка активации/отмена и подавление click; ProjectTreeItem.vue — удалить ручку, слушать название; ProjectTreeList.vue — click capture. Обновить README/CLAUDE, проверить Chromium mouse/touch.
Дизайн и план автоматически одобрены по действующей инструкции пользователя.

## Verify
- 94 project tests и frontend build проходят. Новые тесты сначала воспроизвели отсутствие задержки и раннюю активацию вместо scroll.
- Chromium на тестовом API: ручек нет, short click открывает проект, mouse hold→indent и touch hold→outdent сохраняют маршрут, обычный touch swipe увеличивает scrollTop без move-запросов.
