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

**Shared (non-feature) layer map:**
- `src/types/` — Domain: pure TypeScript types and ambient declarations (e.g., telegram.d.ts)
- `src/stores/` — Application: Pinia stores (global state)
- `src/api/` — Infrastructure: axios HTTP calls, localStorage token management
- `src/router/` — Infrastructure: Vue Router config + nav link data structures
- `src/components/` — Presentation (composed): non-primitive UI components
- `src/components/ui/` — Presentation (primitives): shadcn-vue style atoms
- `src/views/` — Presentation (pages): route-level components

**Why:** Feature-based organization groups all concerns of a feature together rather than layer-first folder hierarchy. The dependency rule still applies within each feature folder.

**How to apply:** When reviewing files, classify by their subfolder role. A file in `ui/` importing from `api/` directly is acceptable (UI uses API composables). A file in `model/` importing from `ui/` or `api/` is a hard violation.

**Known recurring violation patterns (shared layers):**
- `src/api/auth.ts` calls `useUserStore()` — Infrastructure writing into Application. Return data to caller instead.
- `src/stores/user-store.ts` calls `localStorage` and reads `window.Telegram` directly — Infrastructure concerns inside Application layer.
- `src/components/AppLayout.vue` hard-codes `/tasks` route check — layout should read `route.meta.sectionLinks` instead.
- `src/components/UserSection.vue` owns `navLinks` + active-route logic — should receive links as props or split into UserNavDropdown.
- `src/components/SidebarNav.vue` and `AppSidebar.vue` import `NavLink` type from `@/router/nav` — type should live in `src/types/`.
