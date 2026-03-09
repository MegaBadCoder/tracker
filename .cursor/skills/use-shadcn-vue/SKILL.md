---
name: use-shadcn-vue
description: Builds and updates Vue UI with shadcn-vue components, patterns, and conventions. Use when working on Vue UI in this repository, especially in `alfy-bot-frontend`, or when the user asks for dialogs, forms, sheets, tables, sidebar, switches, dropdowns, or mentions shadcn/vue or shadcn-vue.
---

# Use shadcn-vue

## Source of truth

Use `https://www.shadcn-vue.com/` as the primary source for component APIs, composition patterns, and installation choices.

Do not use React shadcn docs as the default reference for Vue work.

## Project context

- Frontend target: `alfy-bot-frontend`
- shadcn config: `alfy-bot-frontend/components.json`
- UI components live in `alfy-bot-frontend/src/components/ui`
- Aliases already configured:
  - `@/components`
  - `@/components/ui`
  - `@/lib/utils`

## Rules

1. Reuse an existing component from `src/components/ui` before creating a new wrapper.
2. If a component is missing, implement it in the shadcn-vue style used by this repo.
3. Follow the project's existing Vue 3 + TypeScript + Tailwind conventions.
4. Prefer composition from shadcn-vue primitives over custom ad hoc markup.
5. Keep variants, class structure, and accessibility behavior aligned with shadcn-vue patterns.
6. Use `cn` from `@/lib/utils` for class merging when appropriate.
7. Do not add branding comments or AI-generated markers.

## Workflow

1. Check whether the needed UI already exists in `alfy-bot-frontend/src/components/ui`.
2. If it exists, reuse or extend it instead of rebuilding it.
3. If it does not exist, consult `https://www.shadcn-vue.com/` for the Vue version of the component.
4. Adapt the example to this repo's aliases, file layout, and styling conventions.
5. Keep public props and emits idiomatic for Vue and consistent with nearby components.

## Defaults

- For switches, dialogs, dropdowns, selects, popovers, sheets, tooltips, and similar primitives, follow shadcn-vue structure first.
- For form UI, prefer shadcn-vue building blocks over handwritten control wrappers.
- For icons, keep using the configured library from `components.json`.
- When unsure between a custom implementation and a shadcn-vue component, choose shadcn-vue.

## Examples

- User asks for a new Vue dialog: use the shadcn-vue dialog pattern.
- User asks for a settings form: compose it from shadcn-vue inputs, labels, selects, switches, and buttons.
- User asks to restyle a toggle or sidebar: first inspect existing `src/components/ui` components and bring them closer to shadcn-vue conventions instead of inventing a new pattern.
