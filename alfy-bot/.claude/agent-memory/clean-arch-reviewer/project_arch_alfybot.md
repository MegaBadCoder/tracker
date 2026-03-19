---
name: alfy-bot backend architecture overview
description: Layer conventions, folder structure, and key patterns in the alfy-bot NestJS backend
type: project
---

Alfy-bot backend is a NestJS monolith under `/Users/v/projects/Alfy/alfy-bot/src/`.

**Layer mapping:**
- `src/shared/entities/` — TypeORM entities (infrastructure/ORM layer, NOT clean domain entities — they carry TypeORM decorators)
- `src/modules/<feature>/domain/` — domain ports (abstract repository classes), domain interfaces
- `src/modules/<feature>/<feature>.service.ts` — application use-case layer
- `src/modules/<feature>/infrastructure/typeorm-*.repository.ts` — infrastructure adapters implementing the domain ports
- `src/modules/<feature>/<feature>.controller.ts` — interface adapter (HTTP)
- `src/modules/<feature>/dto/` — interface adapter DTOs

**Known architectural notes:**
- `Task` entity in `shared/entities/task.entity.ts` imports `ChecklistData` from the domain port (`task-repository.port.ts`). This is a mild layer inversion: an entity (closer to infra) importing from domain. Low risk in practice here because `ChecklistData` is a pure data interface with no dependencies.
- `TaskRepositoryPort` (domain port) imports the `Task` TypeORM entity directly rather than a plain domain model. The domain and infra entity are not separated — a deliberate simplification.
- Cascade pattern: `Task.pomodoroConfig` has `cascade: true` + `eager: true`. The service mutates nested objects and calls `taskRepo.save(task)` to persist both tables in one shot via TypeORM cascade.
- `pomodoroRepo` is injected into `TypeOrmTaskRepository` but only used for the atomic `incrementPomodoroCompleted` operation (uses `Repository.increment` directly). All other PomodoroConfig mutations go through cascade on `taskRepo.save`.
- Dedicated sub-resource endpoints exist for checklist (`PUT /tasks/:id/checklist`) and pomodoro increment (`PATCH /tasks/:id/pomodoro`), but pomodoro config settings (count, duration, breaks) are bundled into the general `PATCH /tasks/:id` endpoint.

**Why:** Project is a pragmatic small app. Full entity/domain model separation was traded off for speed. The main tension is in the PomodoroConfig update path.
