# UI conventions

## shadcn-vue

When working on Vue UI in this repository, especially in `alfy-bot-frontend`, use `https://www.shadcn-vue.com/` as the primary source of truth for component APIs, composition patterns, and installation choices.

Do not default to React shadcn docs for Vue work.

Before creating a new UI component:

1. Check whether it already exists in `alfy-bot-frontend/src/components/ui`.
2. Reuse or extend the existing component when possible.
3. If the component is missing, implement it in the `shadcn-vue` style used by this repo.

Project context:

- `alfy-bot-frontend/components.json` is the canonical shadcn config.
- UI components live in `alfy-bot-frontend/src/components/ui`.
- Use `@/lib/utils` and `cn` for class merging when appropriate.
- Follow the existing Vue 3 + TypeScript + Tailwind conventions.
- Do not add branding comments or AI-generated markers.

# Timezone conventions

All date/time operations must respect the user's timezone stored in `User.timezone` (IANA format, e.g. `"Europe/Moscow"`).

## Backend (`alfy-bot`)

- Dates are stored in the database as **UTC**.
- Domain functions (`recurrence.utils.ts`) operate on UTC fields (`getUTCDay`, `setUTCDate` etc.) and must remain timezone-agnostic.
- Before passing dates to domain functions, shift them from UTC to the user's wall clock using `shiftToUserWallClock(date, timezone)` from `modules/task/lib/timezone.ts`.
- After getting results from domain, shift back using `shiftBackToUtc(date, timezone)`.
- Obtain the user's timezone via `UserSettingsPort.getTimezone(userId)` — a narrow port injected into services.

## Frontend (`alfy-bot-frontend`)

- The browser's local time is assumed to match the user's timezone.
- Frontend date utilities (`recurrence.ts`, `dateTime.ts`) use local time methods (`getDay`, `setDate` etc.), not UTC.
- Calendar events and virtual projections are computed in local time — no explicit timezone conversion needed on frontend.
