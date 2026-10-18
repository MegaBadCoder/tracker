# Возврат эпика или истории из спринта в бэклог

**Status:** executing
**Branch:** codex/group-sprint-backlog
**Worktree:** /Users/v/projects/Alfy/.worktrees/group-sprint-backlog
**Mode:** interactive
**Goal:** Пользователь на доске и агент через MCP возвращают историю или весь эпик с вложенными историями и задачами из выбранного спринта в бэклог, сохраняя проект и данные других спринтов. Useless if: структура удалена; задачи других спринтов изменены; UI сообщает успех при ошибке.

## Context
- Пользователь подтвердил возврат в бэклог, а не статус отмены.
- Старый setGroupSprint умеет переносить только историю и все её задачи вне закрытых спринтов; для удаления из одного конкретного спринта не подходит.
- На доске меню групп не содержит возврат в бэклог; эпик не имеет sprintId.

## Design
Новая атомарная команда с явным исходным спринтом. Для истории — её задачи и назначение истории, для эпика — прямые задачи и дочерние истории с задачами. Меняются только записи с исходным sprintId. Закрытый спринт недоступен; пустая группа допустима. Все задачи выбранной группы из спринта, включая выполненные, возвращаются в бэклог. Названия, статусы, родительские связи, релизы и колонки сохраняются. TDD: yes.

### Invariants
- IV1 — Изоляция по пользователю, проекту и исходному спринту; закрытые спринты неизменны.
- IV2 — Операция атомарна и идемпотентна, возвращает updated — число перенесённых задач.
- IV3 — Сами группы и задачи не удаляются; другие спринты и связи неизменны.

## Plan
### PH1 — REST
- alfy-bot/src/modules/project/sprint.controller.ts, sprint.service.ts, domain/sprint-repository.port.ts, infrastructure/typeorm-sprint.repository.ts: removeGroupFromSprint(userId,projectId,sprintId,groupId), POST /projects/:projectId/sprints/:sprintId/groups/:groupId/backlog.
- Unit + SQLite HTTP e2e: история/эпик, прямые задачи, чужой проект/закрытый спринт, другой спринт и релиз не затронуты, повторный вызов, rollback.
- Commit: feat(sprints): return groups from a selected sprint to backlog
### PH2 — Клиент и MCP
- Меню группы на доске вызывает команду для активного спринта; pending, ошибки, обновление задач и групп.
- MCP remove_group_from_sprint(projectId,sprintId,groupId): один POST, описание границ, SDK тесты и документация.
- По подтверждению пользователя доска показывает только группы активного спринта: историю по назначению или задачам; эпик по прямым задачам или видимой истории. Фильтры задач не скрывают принадлежность группы. После возврата пустая структура исчезает с доски, но сохраняется в бэклоге.
- Новая история с доски назначается активному спринту; отказ назначения сообщает, что история уже создана. Новый пустой эпик создаётся в бэклоге, открывается его карточка и показывается пояснение о назначении задач/историй.
- Стрелки меняют порядок видимых соседей, сохраняя скрытые группы в полном orderedIds.
- Commit: feat(board): return sprint groups to backlog

### Interfaces
- IF1 — POST /projects/:projectId/sprints/:sprintId/groups/:groupId/backlog → {updated:number}; тело не требуется.

### Validation
Реальный API/SQLite и MCP smoke, клиентские тесты и браузер, независимое ревью.

### Interface graph
- PH1 -> IF1 @ alfy-bot/src/modules/project/ alfy-bot/test/
- PH2 IF1 -> @ alfy-bot-frontend/src/features/projects/ alfy-bot-frontend/tests/features/projects/ alfy-mcp/
