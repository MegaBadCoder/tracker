---
name: alfy-bot-frontend layer conventions
description: Folder-to-layer mapping and architectural conventions for the alfy-bot-frontend project
type: project
---

Feature-based folder structure under `src/features/<feature>/`:
- `model/` — Domain layer: types.ts (entities), constants.ts (enums/labels). No framework imports. This is the innermost layer.
- `lib/` — Application utilities: pure functions (formatters, priority helpers, dateTime). No Vue, no infra.
- `api/` — Infrastructure/adapter layer: API calls (tasks-api.ts). Depends on model types.
- `ui/` — UI (adapter) layer: Vue SFCs. Imports from model/, lib/, and @/components/ui.

Shared UI components live in `src/components/ui/` (shadcn-vue style).
Views live in `src/views/` — compose feature UI components, handle routing-level state.

**Why:** Feature-based organization groups all concerns of a feature together rather than layer-first folder hierarchy. The dependency rule still applies within each feature folder.

**How to apply:** When reviewing files, classify by their subfolder role. A file in `ui/` importing from `api/` directly is acceptable (UI uses API composables). A file in `model/` importing from `ui/` or `api/` is a hard violation.
