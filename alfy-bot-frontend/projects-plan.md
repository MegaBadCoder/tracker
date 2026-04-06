# План: Frontend Projects Feature

## Контекст

Бэкенд Project модуль уже реализован (endpoints, entities, тесты). Нужно реализовать фронтенд: проекты в сайдбаре (дерево), выбор проекта при создании/редактировании задачи, бейдж проекта на TaskCard. Подход — TDD. Результат — MD-файл с планом + реализация.

## Deliverable

Файл `alfy-bot-frontend/projects-plan.md` с полной структурой: типы, API, store, компоненты, тесты (позитивные + негативные), фазы реализации.

---

## Структура файлов

### Новые файлы

```
src/features/projects/
├── api/projects-api.ts          # API calls к /projects
├── model/
│   ├── types.ts                 # Project, ProjectColumn, ProjectTreeNode
│   └── project-store.ts         # Pinia store (flat list + computed tree)
├── ui/
│   ├── ProjectPicker.vue        # Dropdown выбора проекта (reusable)
│   ├── ProjectTreeNav.vue       # Дерево проектов в сайдбаре
│   ├── ProjectTreeItem.vue      # Рекурсивный элемент дерева
│   ├── ProjectCreateDialog.vue  # Диалог создания/редактирования
│   └── ProjectBadge.vue         # Бейдж для TaskCard
├── lib/tree.ts                  # buildTree() — чистая функция
└── index.ts                     # Barrel exports

src/views/ProjectView.vue        # Вид задач внутри проекта

tests/features/projects/
├── lib/tree.spec.ts
├── api/projects-api.spec.ts
├── model/project-store.spec.ts
└── ui/
    ├── ProjectPicker.spec.ts
    ├── ProjectTreeNav.spec.ts
    └── ProjectBadge.spec.ts
```

### Модифицируемые файлы

| Файл | Изменения |
|------|-----------|
| `src/features/tasks/model/types.ts` | +projectId, +columnId, +order в Task |
| `src/features/tasks/model/task-store.ts` | parseTask уже spread'ит raw — работает; добавить tasksByProject computed |
| `src/features/tasks/ui/TaskCard.vue` | +ProjectBadge в meta chips |
| `src/features/tasks/ui/TaskForm.vue` | +ProjectPicker в toolbar |
| `src/features/tasks/ui/TaskDetailDialog.vue` | Заменить mock "Проект" (строки 186-199) на реальный ProjectPicker |
| `src/router/index.ts` | +route `/tasks/project/:projectId` |
| `src/components/AppSidebar.vue` | +ProjectTreeNav ниже SidebarNav |

---

## Типы

### `src/features/projects/model/types.ts`

```typescript
export type ViewMode = 'list' | 'board'

export interface Project {
  id: string
  parentId: string | null
  title: string
  description: string | null
  viewMode: ViewMode
  icon: string | null
  color: string | null
  order: number
}

export interface ProjectColumn {
  id: string
  projectId: string
  title: string
  order: number
  color: string | null
}

export interface ProjectTreeNode extends Project {
  children: ProjectTreeNode[]
}

export interface CreateProjectPayload {
  title: string
  parentId?: string | null
  description?: string | null
  viewMode?: ViewMode
  icon?: string | null
  color?: string | null
}

export type UpdateProjectPayload = Partial<CreateProjectPayload>
```

### Изменения в Task interface

```typescript
// Добавить в src/features/tasks/model/types.ts:
projectId?: string | null
columnId?: string | null
order?: number
```

---

## API — `src/features/projects/api/projects-api.ts`

```typescript
// Паттерн: прямые вызовы через axios instance (как в task-store.ts)
fetchProjects()       → GET /projects
fetchProject(id)      → GET /projects/:id
createProject(data)   → POST /projects
updateProject(id, d)  → PATCH /projects/:id
deleteProject(id)     → DELETE /projects/:id
reorderProjects(ids)  → PATCH /projects/reorder
moveTask(projId, taskId, data) → PATCH /projects/:projId/tasks/:taskId/move
```

---

## Store — `src/features/projects/model/project-store.ts`

```typescript
// Pinia setup store
state: projects: Project[], loading, error

computed:
  projectTree → buildTree(projects) // дерево из плоского списка
  projectMap  → Map<id, Project>    // O(1) lookup по id

actions:
  fetchProjects()
  createProject(data)  // optimistic + rollback
  updateProject(id, data)
  deleteProject(id)    // optimistic + rollback
```

**Ключевое решение:** дерево — computed из плоского массива. Единый источник правды.

---

## Компоненты

### ProjectPicker.vue
- Props: `modelValue: string | null`, `disabled?: boolean`
- Emits: `update:modelValue`
- UI: DropdownMenu → "Все входящие" + список проектов с отступами по глубине
- Используется в: TaskForm, TaskDetailDialog, ProjectView

### ProjectTreeNav.vue
- Рендерится в AppSidebar ниже SidebarNav (когда section = tasks)
- Заголовок "Проекты" + кнопка "+"
- Рекурсивно рендерит ProjectTreeItem

### ProjectTreeItem.vue
- Props: `node: ProjectTreeNode`, `depth: number`
- RouterLink к `/tasks/project/:id`
- Иконка (lucide) с цветом из `node.color`
- Отступ: `depth * 12px`
- Expand/collapse при наличии children

### ProjectBadge.vue
- Props: `name: string`, `color?: string | null`
- **Не обращается к store** — получает resolved данные через props от view
- Badge (FolderOpen icon, 11px) — стиль как у остальных meta chips
- Живёт в `src/features/projects/ui/`, но принимает только примитивы (нет cross-feature зависимости)

### ProjectCreateDialog.vue
- Dialog с полями: title, description, viewMode, icon, color, parentId
- Emits submit → store.createProject()

---

## Роутинг

В `src/router/index.ts`, внутри children tasks (строка 25-35):

```typescript
{
  path: 'project/:projectId',
  name: 'tasks-project',
  component: () => import('../views/ProjectView.vue'),
}
```

### ProjectView.vue
- Читает `route.params.projectId`
- Показывает заголовок проекта, TaskForm (с предзаполненным projectId), список задач проекта
- Фильтрует tasks по projectId (computed)

---

## Интеграция в существующие компоненты

### AppSidebar.vue — добавить named slot (строки 23, 37)
```vue
<SidebarNav v-if="links?.length" :links="links" />
<slot name="section-extra" />
```
> **Архитектурное решение:** AppSidebar остаётся agnostic — не импортирует ничего из features/.

### AppLayout.vue — рендерит ProjectTreeNav через slot
AppLayout уже знает какой section активен (через sectionNavRegistry). Расширяем sectionNavRegistry — добавляем `sectionExtraComponent`:
```typescript
const sectionExtraRegistry: Record<string, Component> = {
  tasks: ProjectTreeNav,  // lazy import
}
```
```vue
<AppSidebar :open="sidebarOpen" :links="sectionLinks" @close="closeSidebar">
  <template #section-extra>
    <component :is="sectionExtra" v-if="sectionExtra" />
  </template>
</AppSidebar>
```
> TasksLayout.vue — просто `<RouterView />`, не трогаем.

### TaskDetailDialog.vue (строки 186-199)
Заменить mock dropdown на:
```vue
<ProjectPicker v-model="localProjectId" :disabled="!editable" />
```
+ watch localProjectId → emitUpdate

### TaskForm.vue
- Добавить ProjectPicker кнопку в toolbar рядом с Location
- Добавить prop `initialProjectId?: string | null` для предзаполнения из ProjectView
- `form.projectId` инициализируется из prop

### TaskCard.vue (строка 31-85, meta chips)
> **Архитектурное решение:** TaskCard НЕ импортирует ProjectBadge напрямую. Вместо этого view (TasksView, ProjectView) резолвит имя проекта из projectMap и передаёт его через расширенный Task-like объект или дополнительный prop.

Вариант: расширить TaskCardProps:
```typescript
interface TaskCardProps {
  task: Task
  projectName?: string  // resolved в view из projectMap
}
```
```vue
<ProjectBadge v-if="projectName" :name="projectName" />
```
Или рендерить бейдж прямо в TaskCard без импорта ProjectBadge — просто Badge с текстом.

---

## Тесты (TDD)

### `tests/features/projects/lib/tree.spec.ts`

```
describe('buildTree')
  ✅ возвращает пустой массив для пустого списка
  ✅ строит плоский список без parentId как корневые узлы
  ✅ вкладывает дочерние элементы в родительские
  ✅ сортирует по order на каждом уровне
  ✅ обрабатывает 3+ уровня вложенности
  ✅ ставит узел с несуществующим parentId в корень
  ❌ игнорирует элементы с parentId = собственный id
  ❌ обрабатывает дубликаты id без ошибок
```

### `tests/features/projects/api/projects-api.spec.ts`

```
describe('projects API')
  ✅ fetchProjects отправляет GET /projects
  ✅ createProject отправляет POST /projects с payload
  ✅ updateProject отправляет PATCH /projects/:id
  ✅ deleteProject отправляет DELETE /projects/:id
  ❌ createProject пробрасывает ошибку при сбое сети
  ❌ fetchProjects пробрасывает ошибку при 500
```

### `tests/features/projects/model/project-store.spec.ts`

```
describe('useProjectStore')
  describe('fetchProjects')
    ✅ загружает и сохраняет список проектов
    ✅ устанавливает loading в true во время загрузки
    ❌ устанавливает error при ошибке API
    ❌ сбрасывает loading после ошибки

  describe('projectTree')
    ✅ вычисляет дерево из плоского списка
    ✅ обновляется при изменении projects

  describe('projectMap')
    ✅ содержит все проекты по id
    ✅ возвращает undefined для несуществующего id

  describe('createProject')
    ✅ добавляет optimistic проект в список
    ✅ заменяет temp проект на реальный после ответа
    ❌ откатывает optimistic при ошибке API

  describe('deleteProject')
    ✅ удаляет проект optimistically
    ❌ откатывает удаление при ошибке API

  describe('updateProject')
    ✅ обновляет проект в списке
    ❌ откатывает при ошибке API
```

### `tests/features/projects/ui/ProjectPicker.spec.ts`

```
describe('ProjectPicker')
  ✅ рендерит "Все входящие" когда modelValue null
  ✅ рендерит название проекта когда modelValue задан
  ✅ эмитит update:modelValue при выборе проекта
  ✅ показывает список проектов при открытии
  ❌ не эмитит при disabled
  ❌ показывает "Все входящие" при несуществующем projectId
```

### `tests/features/projects/ui/ProjectTreeNav.spec.ts`

```
describe('ProjectTreeNav')
  ✅ рендерит корневые проекты
  ✅ рендерит вложенные проекты с отступом
  ✅ генерирует ссылки /tasks/project/:id
  ✅ показывает кнопку создания проекта
  ❌ показывает пустое состояние при отсутствии проектов
```

### `tests/features/projects/ui/ProjectBadge.spec.ts`

```
describe('ProjectBadge')
  ✅ рендерит переданное название проекта
  ✅ показывает иконку FolderOpen
  ✅ применяет цвет если передан
  ❌ рендерит без цвета если color не передан
```

---

## Фазы реализации

### Фаза 1: Основа (без UI)
- [ ] types.ts — типы Project, ProjectTreeNode
- [ ] tree.spec.ts → tree.ts (buildTree)
- [ ] projects-api.spec.ts → projects-api.ts
- [ ] project-store.spec.ts → project-store.ts
- [ ] Обновить Task interface (+projectId, +columnId, +order)

### Фаза 2: UI компоненты
- [ ] ProjectBadge.spec.ts → ProjectBadge.vue
- [ ] ProjectPicker.spec.ts → ProjectPicker.vue
- [ ] ProjectTreeNav.spec.ts → ProjectTreeNav.vue + ProjectTreeItem.vue

### Фаза 3: Интеграция
- [ ] Route `/tasks/project/:projectId` + ProjectView.vue
- [ ] AppSidebar.vue — добавить `<slot name="section-extra" />`
- [ ] AppLayout.vue — sectionExtraRegistry + рендер ProjectTreeNav через slot
- [ ] TaskDetailDialog.vue — заменить mock на ProjectPicker
- [ ] TaskForm.vue — добавить ProjectPicker + prop `initialProjectId`
- [ ] TaskCard.vue — бейдж проекта через prop `projectName` (resolved в view)

### Фаза 4: Создание проектов
- [ ] ProjectCreateDialog.vue
- [ ] Интеграция в sidebar ("+" кнопка)

---

## Архитектурные решения

1. **Дерево = computed** из плоского массива → единый источник правды
2. **projectMap** для O(1) lookup по id (бейджи, пикер)
3. **ProjectPicker** — один компонент для 3 мест (TaskForm, TaskDetailDialog, ProjectView)
4. **Фильтрация по projectId на фронте** — tasks уже приходят все с projectId; computed фильтрует
5. **Сайдбар**: AppSidebar agnostic — предоставляет slot, TasksLayout рендерит ProjectTreeNav в slot
6. **Store отдельный**: project-store.ts не зависит от task-store.ts и наоборот
7. **Нет cross-feature импортов**: TaskCard не импортирует из projects/. View резолвит projectName из projectMap и передаёт через props
8. **ProjectBadge принимает примитивы** (name, color), не projectId — не обращается к store

## Верификация

- `pnpm test` — все новые тесты проходят
- Сайдбар показывает дерево проектов
- Создание задачи с projectId отправляет его на бэкенд
- TaskCard показывает бейдж проекта
- TaskDetailDialog позволяет менять проект
- Переход по `/tasks/project/:id` фильтрует задачи
