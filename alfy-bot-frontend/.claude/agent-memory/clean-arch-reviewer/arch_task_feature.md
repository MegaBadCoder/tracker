---
name: tasks feature architectural patterns and recurring issues
description: Observed patterns, violations, and duplication hotspots in src/features/tasks (updated after sub-component extraction refactor)
type: project
---

## Well-structured parts
- `model/types.ts` and `model/constants.ts` are clean: no framework deps, pure domain types.
- `lib/formatters.ts`, `lib/priority.ts`, `lib/dateTime.ts` are clean pure-function utilities. Correctly imported by UI components.
- `lib/urgency.ts` — getDueDateUrgency correctly extracted from UI. URGENCY_CLASSES map still leaks Tailwind strings into this layer (see open issue below).
- `api/tasks-api.ts` properly sits at the infrastructure boundary.
- Extracted sub-components (TagsEditor, PriorityPicker, DeadlinePicker, PomodoroSettings) eliminate the prior duplication. All have correct inward dependency direction.

## Open issues after extraction refactor

### Runtime bug
- `TaskForm.vue` line 296: `JSON.parse(JSON.stringify(form))` corrupts Date fields into strings despite `as Task` cast. Replace with `structuredClone(form)`.

### Type placement
- `Priority` type is exported from `model/constants.ts` (line 1) instead of `model/types.ts`. This forces types.ts to import from constants.ts, inverting the natural read order. Fix: move Priority to types.ts.

### Stale import
- `TaskDetailDialog.vue` imports `getTimeString` from lib/dateTime (line 383) but no longer uses it directly after DeadlinePicker extraction. Remove it.

### Presentation concerns in non-UI layers
- `PRIORITY_COLORS` and `PRIORITY_ICON_COLORS` in model/constants.ts are Tailwind class strings — presentational, not domain values. Should move to lib/priority.ts.
- `URGENCY_CLASSES` in lib/urgency.ts maps to Tailwind strings. Should move to UI layer or a dedicated ui-helpers file.

### PomodoroSettings default coupling
- `PomodoroSettings.vue` imports `POMODORO_DEFAULTS` from model/constants to seed its prop defaults. The component should be a dumb renderer; parents (TaskForm, TaskDetailDialog) already seed defaults themselves. Remove the import and defaults from PomodoroSettings.

### checklistProgress on Task entity
- `Task` in model/types.ts carries `checklistProgress: { total, completed, progress }` — a derived/view-model field, not a domain property. TaskDetailDialog recomputes it locally from localChecklist anyway. Decide: either remove the field from Task and always compute it, or use task.checklistProgress for display and stop recomputing.

### ChecklistItem ID generation in UI
- `crypto.randomUUID()` called in TaskDetailDialog.vue (line 558) when creating ChecklistItem. ID generation is an application concern. Extract `createChecklistItem(text: string): ChecklistItem` to lib/ or model/.

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
