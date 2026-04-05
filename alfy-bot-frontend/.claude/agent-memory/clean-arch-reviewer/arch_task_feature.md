---
name: tasks feature architectural patterns and recurring issues
description: Observed patterns, violations, and duplication hotspots in src/features/tasks (updated after sub-component extraction refactor)
type: project
---

## Well-structured parts (confirmed 2026-03-18)
- `model/types.ts` is clean: no framework deps, pure domain types, zero outward imports.
- `model/constants.ts` clean except for Priority re-export (see open issues).
- `lib/formatters.ts`, `lib/dateTime.ts` are clean pure-function utilities. No framework deps.
- `lib/priority.ts` — clean aside from Tailwind strings in the constants (low severity).
- `lib/urgency.ts` — getDueDateUrgency is correct. URGENCY_CLASSES is the only issue.
- `api/tasks-api.ts` properly sits at the infrastructure boundary. No UI or model layer imports it directly. Only `views/TasksView.vue` uses useTasks().
- Extracted sub-components (TagsEditor, PriorityPicker, DeadlinePicker, PomodoroSettings) all have correct inward dependency direction. No cross-feature coupling anywhere.
- No UI component imports from the API layer directly (correct).

## Open issues (confirmed 2026-03-18 review pass)

### Runtime bug (RESOLVED)
- `TaskForm.vue` line 296: previously used `JSON.parse(JSON.stringify(form))`. Now fixed — uses `structuredClone(toRaw(form))` (line 309). Date fields preserved correctly.

### Type placement (CONFIRMED OPEN)
- `Priority` is defined in `model/types.ts` (line 1) and re-exported from `model/constants.ts` (lines 1–3). Both paths are live. TaskDetailDialog imports Priority from constants.ts (line 381); other files import from types.ts. Fix: remove re-export from constants.ts, update all callers to import from types.ts.

### Stale import (RESOLVED)
- `TaskDetailDialog.vue` no longer imports `getTimeString` directly. DeadlinePicker.vue owns that usage. Import removed.

### Presentation concerns in non-UI layers (CONFIRMED OPEN)
- `PRIORITY_COLORS` and `PRIORITY_ICON_COLORS` have been moved to `lib/priority.ts` (not constants.ts anymore). Still Tailwind strings in a lib file — acceptable for now, lower severity than urgency.
- `URGENCY_CLASSES` in `lib/urgency.ts` lines 11–16 remains a Tailwind class map in a lib/domain file. Should move to UI layer.

### PomodoroSettings default coupling (CONFIRMED OPEN)
- `PomodoroSettings.vue` still imports `POMODORO_DEFAULTS` from model/constants to seed prop defaults. Parents also seed defaults. The component is duplicating the defaults unnecessarily.

### checklistProgress on Task entity
- `Task` in model/types.ts carries `checklistProgress: { total, completed, progress }` — a derived/view-model field, not a domain property. TaskDetailDialog recomputes it locally from localChecklist anyway. Decide: either remove the field from Task and always compute it, or use task.checklistProgress for display and stop recomputing.

### ChecklistItem ID generation in UI
- `crypto.randomUUID()` called in TaskDetailDialog.vue (line 558) when creating ChecklistItem. ID generation is an application concern. Extract `createChecklistItem(text: string): ChecklistItem` to lib/ or model/.

## Sidebar refactor (2026-04-04): new shared infrastructure files

### src/stores/user-store.ts (Application layer)
- Violation: accesses `window.Telegram?.WebApp?.initDataUnsafe?.user` at construction time — SDK reference at application layer.
- Violation: reads/writes localStorage directly inside store methods — infrastructure concern not abstracted.
- Fix direction: move Telegram bootstrap to main.ts/bootstrap.ts; pass profile in. Optionally abstract storage behind a port.

### src/api/auth.ts (Infrastructure layer)
- Violation: calls `useUserStore().setUser()` directly after login — infrastructure mutating application state.
- Fix: return user profile data from authorize() functions; let the caller populate the store.

### src/components/UserSection.vue (Presentation)
- Imports navLinks from @/router/nav (infrastructure). Should receive links as a prop instead.

### src/components/SidebarNav.vue (Presentation)
- Imports NavLink type from @/router/nav. Should import from src/types/ once NavLink is moved there.

### src/router/nav.ts + tasks-nav.ts
- Icon components (Lucide) imported directly into routing infrastructure. Low severity — pragmatic pattern, but these arrays are really UI configuration, not routing rules.

### src/components/AppLayout.vue
- Hard-codes section-link resolution (`if route.path.startsWith('/tasks') return tasksNavLinks`). Consider route.meta.navLinks pattern as sections grow.

## Backend (alfy-bot) architectural notes

### Layer mapping
- `shared/entities/` — TypeORM entity classes decorated with `@Entity`. These are infrastructure-coupled (ORM decorators). Used directly as return types from the domain port (`TaskRepositoryPort`), which is the key tension point.
- `modules/<name>/domain/` — Repository ports (abstract classes). Application/domain layer.
- `modules/<name>/infrastructure/` — TypeORM repository implementations. Infrastructure layer.
- `modules/<name>/dto/` — Input DTOs with class-validator and Swagger decorators. Adapter (interface) layer.
- `modules/<name>/task.service.ts` — Application service (use case). Should only depend on domain port + entities.
- `modules/<name>/task.controller.ts` — NestJS controller. Adapter layer.

### Key tension: entities in shared/
- `TaskRepositoryPort` in domain/ imports `Task` from `shared/entities/`, which carries TypeORM decorators (`@Entity`, `@Column`, etc.). This means the domain port has a transitive dependency on the ORM. Tolerated as a known pragmatic trade-off in this codebase (not a new issue introduced by the checklist changes).

### ChecklistData interface placement (open issue)
- `ChecklistData` is defined in `domain/task-repository.port.ts`. The interface describes a data shape passed across the domain-infrastructure boundary. It is appropriate to live in the domain port file — it defines what the domain expects the repository to accept. However, the identical inline type `{ id: string; text: string; completed: boolean; order: number }[]` is duplicated in `task.entity.ts` (the column shape), `create-task.dto.ts`, and `update-checklist.dto.ts`. These are not referencing `ChecklistData` — a named shared type would reduce drift.

### NotFoundException now correctly in service (post-fix)
- `task.service.ts` owns all `NotFoundException` throws. Repository methods return `null` / `boolean` / `Promise<Task>`. This is correct: HTTP exception types belong in the application/adapter boundary, not in infrastructure.

### incrementPomodoro ownership check pattern
- After fix: `task.service.ts` `incrementPomodoro()` calls `findById(taskId, userId)` before delegating to repository — ownership verified at service layer. The repository `incrementPomodoroCompleted` remains userId-unaware (operates by taskId only), which is acceptable since the service gates it.

### updateChecklist double-fetch
- `task.service.ts updateChecklist()` calls `findById` to check ownership, then calls `taskRepo.updateChecklist()` which internally calls `findById` again (in `TypeOrmTaskRepository.updateChecklist`). Two round-trips to the DB for one operation. The repository could accept the already-fetched entity, or the ownership check could be folded into the UPDATE WHERE clause.

### Inline type in updateChecklist return
- `typeorm-task.repository.ts` line 77: `as Promise<Task>` cast after `findById` because TypeScript cannot narrow the post-update refetch to non-null. The cast is safe given the preceding UPDATE, but could be replaced by returning the entity assembled from the update data without refetching.

### Duplicated format strings
- Due date format strings ('d MMM yyyy', 'd MMM, HH:mm', 'MMM d', 'MMM d, HH:mm') are hardcoded in both TaskDetailDialog and TaskForm templates. Add named constants to lib/formatters.ts (e.g. DUE_DATE_FORMAT, DEADLINE_FORMAT).

### Calendar v-model type mismatch
- All three calendar usages (TaskDetailDialog line 212, TaskForm line 47, DeadlinePicker line 4) use `as any` cast on Calendar v-model because the shadcn Calendar component type doesn't accept Date | undefined directly. Investigate @/components/ui/calendar type signature and fix at the source.

### TaskFormData implicit inheritance
- TaskFormData extends Omit<Task, ...> so new Task fields are silently inherited by the form shape. Fields like checklist, subtasks, parentId have no form UI but are now implicitly in the submit payload. Consider making TaskFormData fully explicit.
