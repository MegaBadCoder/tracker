---
name: Alfy project architecture conventions
description: Layer structure, folder conventions, and known patterns for the Alfy monorepo (NestJS backend + Vue frontend)
type: project
---

Backend (alfy-bot/src/):
- `shared/entities/` — TypeORM entity classes. Decorated with TypeORM decorators (infrastructure concern leaking into domain). This is a known trade-off for this project size.
- `modules/<feature>/domain/` — abstract port classes (repository interfaces). Clean use-case layer. TaskRepositoryPort and UserRepositoryPort follow the pattern correctly.
- `modules/<feature>/application/` — application services (e.g., UserService). Depend only on ports and entities.
- `modules/<feature>/infrastructure/` — TypeORM repository implementations that fulfill the port.
- `modules/<feature>/<feature>.service.ts` — some services (e.g., TaskService, TimerSessionService) live at the module root without a sub-folder, bypassing the domain/application/infrastructure split used elsewhere.
- `modules/<feature>/dto/` — DTOs with class-validator + Swagger decorators.

Key architectural observation: TaskService correctly uses TaskRepositoryPort (port pattern). TimerSessionService does NOT follow the port pattern — it directly injects Repository<TimerSession> and Telegraf.

Frontend (alfy-bot-frontend/src/):
- `features/<feature>/model/` — Pinia stores (application logic layer)
- `features/<feature>/lib/` — utilities and services (intended as adapter layer)
- `features/<feature>/types/` — type definitions (domain types)
- `api/client.ts` — HTTP client (infrastructure)

**Why:** Project follows Clean Architecture partly. The task feature has a port layer; the timer feature does not. This is a recurring gap, not a global pattern.
**How to apply:** When reviewing timer or new features, check whether they bypass the port abstraction that task already established.
