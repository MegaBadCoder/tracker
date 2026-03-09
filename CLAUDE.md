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
