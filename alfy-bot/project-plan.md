# Сущность Project

## Цель

Добавить сущность Project для группировки задач. Проекты поддерживают вложенность (проект внутри проекта, любой уровень), два режима отображения (Список и Доска с кастомными колонками). Задачи без проекта отображаются как «Входящие» (`projectId = null`).

---

## Новая структура БД

### Таблица: `projects`

| Поле | Тип | Ограничения | Описание |
|------|-----|-------------|----------|
| `id` | uuid | PK | Уникальный идентификатор |
| `userId` | number | NOT NULL, FK → users.id | Владелец проекта |
| `parentId` | uuid \| null | FK → projects.id, nullable, onDelete SET NULL | Родительский проект |
| `title` | string | NOT NULL | Название проекта |
| `description` | text \| null | nullable | Описание |
| `viewMode` | text | NOT NULL, default `'list'` | `'list'` \| `'board'` |
| `icon` | text \| null | nullable | Ссылка/имя иконки |
| `color` | text \| null | nullable | Цвет иконки (hex) |
| `order` | integer | NOT NULL, default `0` | Порядок среди siblings |
| `createdAt` | datetime | auto | Дата создания |
| `updatedAt` | datetime | auto | Дата обновления |

**Связи:**
- `ManyToOne → User` (userId)
- `ManyToOne → Project` (parentId, self-referencing, onDelete: SET NULL)
- `OneToMany → Project` (children)
- `OneToMany → ProjectColumn` (columns)
- `OneToMany → Task` (tasks)

**При удалении проекта:**
- Дочерние проекты → `parentId = null` (становятся корневыми)
- Колонки → CASCADE (удаляются)
- Задачи → `projectId = null` (попадают во «Входящие»)

---

### Таблица: `project_columns`

| Поле | Тип | Ограничения | Описание |
|------|-----|-------------|----------|
| `id` | uuid | PK | Уникальный идентификатор |
| `projectId` | uuid | NOT NULL, FK → projects.id, onDelete CASCADE | Проект-владелец |
| `title` | string | NOT NULL | Название колонки |
| `order` | integer | NOT NULL, default `0` | Порядок колонки |
| `color` | text \| null | nullable | Цвет колонки |
| `createdAt` | datetime | auto | Дата создания |
| `updatedAt` | datetime | auto | Дата обновления |

**Связи:**
- `ManyToOne → Project` (projectId, onDelete: CASCADE)
- `OneToMany → Task` (tasks)

---

### Изменения в таблице `tasks`

Новые поля:

| Поле | Тип | Ограничения | Описание |
|------|-----|-------------|----------|
| `projectId` | uuid \| null | FK → projects.id, nullable, onDelete SET NULL | Проект задачи (null = Входящие) |
| `columnId` | uuid \| null | FK → project_columns.id, nullable, onDelete SET NULL | Колонка на доске |
| `order` | integer | NOT NULL, default `0` | Порядок в списке/колонке |

**Новые связи:**
- `ManyToOne → Project` (projectId, nullable, onDelete: SET NULL)
- `ManyToOne → ProjectColumn` (columnId, nullable, onDelete: SET NULL)

---

## Структура модуля

```
src/modules/project/
├── domain/
│   ├── project-repository.port.ts
│   └── project-column-repository.port.ts
├── infrastructure/
│   ├── typeorm-project.repository.ts
│   └── typeorm-project-column.repository.ts
├── dto/
│   ├── create-project.dto.ts
│   ├── update-project.dto.ts
│   ├── create-column.dto.ts
│   ├── update-column.dto.ts
│   ├── reorder-columns.dto.ts
│   ├── reorder-projects.dto.ts
│   ├── move-task.dto.ts
│   └── reorder-tasks.dto.ts
├── project.controller.ts
├── project-column.controller.ts
├── project-task.controller.ts
├── project.service.ts
├── project-column.service.ts
├── project.service.spec.ts
├── project-column.service.spec.ts
├── project-task.service.spec.ts
└── project.module.ts
```

Entity-файлы:
- `src/shared/entities/project.entity.ts`
- `src/shared/entities/project-column.entity.ts`

---

## API Endpoints

### ProjectController — `/projects`

| Метод | Путь | Описание | Body | Response |
|-------|------|----------|------|----------|
| GET | `/projects` | Все проекты (плоский список с parentId) | — | `Project[]` |
| GET | `/projects/:id` | Проект с колонками | — | `Project` |
| POST | `/projects` | Создать проект | `CreateProjectDto` | `Project` |
| PATCH | `/projects/:id` | Обновить проект | `UpdateProjectDto` | `Project` |
| DELETE | `/projects/:id` | Удалить проект | — | `void` |
| PATCH | `/projects/reorder` | Изменить порядок | `ReorderProjectsDto` | `void` |

### ProjectColumnController — `/projects/:projectId/columns`

| Метод | Путь | Описание | Body | Response |
|-------|------|----------|------|----------|
| GET | `/projects/:projectId/columns` | Колонки проекта | — | `ProjectColumn[]` |
| POST | `/projects/:projectId/columns` | Создать колонку | `CreateColumnDto` | `ProjectColumn` |
| PATCH | `/projects/:projectId/columns/:id` | Обновить колонку | `UpdateColumnDto` | `ProjectColumn` |
| DELETE | `/projects/:projectId/columns/:id` | Удалить колонку | — | `void` |
| PATCH | `/projects/:projectId/columns/reorder` | Изменить порядок | `ReorderColumnsDto` | `void` |

### ProjectTaskController — `/projects/:projectId/tasks`

| Метод | Путь | Описание | Body | Response |
|-------|------|----------|------|----------|
| PATCH | `/projects/:projectId/tasks/:taskId/move` | Переместить задачу | `MoveTaskDto` | `Task` |
| PATCH | `/projects/:projectId/tasks/reorder` | Изменить порядок задач | `ReorderTasksDto` | `void` |

> **Архитектурное решение:** move/reorder задач — в ProjectModule, а не TaskModule. Это изолирует знание о структуре проекта и исключает циклическую зависимость. TaskModule не зависит от ProjectModule.

### Изменения в TaskController

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/tasks?projectId=...` | Фильтрация по проекту (null = Входящие, не указан = все) |

---

## DTO

### CreateProjectDto
```typescript
{
  title: string;                // @IsString, required
  description?: string;         // @IsOptional, @IsString
  parentId?: string;            // @IsOptional, @IsUUID
  viewMode?: 'list' | 'board';  // @IsOptional, @IsIn(['list', 'board']), default 'list'
  icon?: string;                // @IsOptional, @IsString
  color?: string;               // @IsOptional, @IsString
}
```

### UpdateProjectDto
`PartialType(CreateProjectDto)` — все поля опциональны.

### CreateColumnDto
```typescript
{
  title: string;     // @IsString, required
  color?: string;    // @IsOptional, @IsString
}
```

### UpdateColumnDto
`PartialType(CreateColumnDto)`

### ReorderColumnsDto / ReorderProjectsDto
```typescript
{
  orderedIds: string[];  // @IsArray, @IsUUID(4, { each: true })
}
```

### MoveTaskDto
```typescript
{
  projectId?: string | null;  // @IsOptional — null = Входящие
  columnId?: string | null;   // @IsOptional — null = убрать из колонки
  order?: number;             // @IsOptional, @IsNumber
}
```

### ReorderTasksDto
```typescript
{
  orderedIds: string[];  // @IsArray, @IsUUID(4, { each: true })
  columnId?: string;     // @IsOptional — reorder внутри колонки
}
```

### Изменения в CreateTaskDto / UpdateTaskDto
```typescript
// Добавить:
projectId?: string;       // @IsOptional, @IsUUID
columnId?: string;        // @IsOptional, @IsUUID
```

---

## Сигнатуры сервисов

### ProjectService

```typescript
class ProjectService {
  getAll(userId: number): Promise<Project[]>;
  getById(userId: number, id: string): Promise<Project>;
  create(userId: number, dto: CreateProjectDto): Promise<Project>;
  update(userId: number, id: string, dto: UpdateProjectDto): Promise<Project>;
  delete(userId: number, id: string): Promise<void>;
  reorder(userId: number, orderedIds: string[]): Promise<void>;
}
```

### ProjectColumnService

```typescript
class ProjectColumnService {
  getAllByProject(userId: number, projectId: string): Promise<ProjectColumn[]>;
  create(userId: number, projectId: string, dto: CreateColumnDto): Promise<ProjectColumn>;
  update(userId: number, projectId: string, id: string, dto: UpdateColumnDto): Promise<ProjectColumn>;
  delete(userId: number, projectId: string, id: string): Promise<void>;
  reorder(userId: number, projectId: string, orderedIds: string[]): Promise<void>;
}
```

### Порты (абстрактные классы)

**ProjectRepositoryPort:**
```typescript
abstract class ProjectRepositoryPort {
  abstract findAllByUser(userId: number): Promise<Project[]>;
  abstract findById(id: string, userId: number): Promise<Project | null>;
  abstract findByIdWithRelations(id: string, userId: number): Promise<Project | null>;
  abstract create(data: Partial<Project>): Promise<Project>;
  abstract save(project: Project): Promise<Project>;
  abstract delete(id: string, userId: number): Promise<boolean>;
  abstract reorder(updates: { id: string; order: number }[]): Promise<void>;
}
```

**ProjectColumnRepositoryPort:**
```typescript
abstract class ProjectColumnRepositoryPort {
  abstract findAllByProject(projectId: string): Promise<ProjectColumn[]>;
  abstract findById(id: string, projectId: string): Promise<ProjectColumn | null>;
  abstract create(data: Partial<ProjectColumn>): Promise<ProjectColumn>;
  abstract save(column: ProjectColumn): Promise<ProjectColumn>;
  abstract delete(id: string, projectId: string): Promise<boolean>;
  abstract reorder(updates: { id: string; order: number }[]): Promise<void>;
}
```

### Изменения в TaskService / TaskRepositoryPort

```typescript
// Новые методы TaskRepositoryPort:
abstract findAllByProject(userId: number, projectId: string | null): Promise<Task[]>;
abstract updatePosition(taskId: string, userId: number, projectId: string | null, columnId: string | null, order: number): Promise<Task | null>;
abstract reorderTasks(updates: { id: string; order: number }[]): Promise<void>;
```

> **Зависимости:** ProjectModule импортирует TaskModule. TaskModule экспортирует TaskRepositoryPort. ProjectService инжектирует TaskRepositoryPort для move/reorder.

---

## Тесты (TDD)

### `project.service.spec.ts`

```
describe('ProjectService')
  describe('getAll')
    ✅ возвращает все проекты пользователя
    ✅ возвращает пустой массив если проектов нет
    ✅ не включает проекты другого пользователя

  describe('getById')
    ✅ возвращает проект с колонками
    ✅ бросает NotFoundException если проект не найден
    ✅ бросает NotFoundException если проект принадлежит другому пользователю

  describe('create')
    ✅ создаёт проект с viewMode по умолчанию list
    ✅ создаёт проект с viewMode board
    ✅ создаёт вложенный проект (parentId)
    ✅ создаёт проект с icon и color
    ✅ создаёт проект без icon и color (остаются null)
    ❌ бросает NotFoundException если parentId не существует
    ❌ бросает BadRequestException если title пустой
    ❌ бросает BadRequestException если viewMode невалидный (не 'list'/'board')
    ❌ бросает ForbiddenException если parentId указывает на проект другого пользователя

  describe('update')
    ✅ обновляет title и viewMode
    ✅ обновляет color проекта
    ✅ обновляет icon проекта
    ✅ сбрасывает color в null
    ✅ сбрасывает icon в null
    ✅ обновляет несколько полей одновременно (title + icon + color)
    ✅ перемещает проект в другой родительский (обновление parentId)
    ❌ бросает BadRequestException при попытке установить parentId = собственный id (циклическая ссылка)
    ❌ бросает BadRequestException при попытке переместить проект в своего потомка (цикл A→B→C→A)
    ❌ бросает NotFoundException если parentId указывает на несуществующий проект
    ❌ бросает ForbiddenException если parentId указывает на проект другого пользователя

  describe('delete')
    ✅ удаляет проект
    ❌ бросает NotFoundException если проект не найден
    ❌ бросает NotFoundException при повторном удалении уже удалённого проекта

  describe('reorder')
    ✅ обновляет порядок проектов по переданным ID
    ❌ игнорирует несуществующие ID в массиве
    ❌ игнорирует ID проектов другого пользователя
    ❌ бросает BadRequestException если массив пустой
```

### `project-column.service.spec.ts`

```
describe('ProjectColumnService')
  describe('getAllByProject')
    ✅ возвращает колонки проекта отсортированные по order
    ✅ бросает NotFoundException если проект не найден

  describe('create')
    ✅ создаёт колонку с автоматическим order
    ✅ создаёт колонку с указанным color
    ❌ бросает NotFoundException если проект не найден
    ❌ бросает ForbiddenException если проект принадлежит другому пользователю
    ❌ бросает BadRequestException если title пустой
    ❌ бросает BadRequestException если проект имеет viewMode='list'

  describe('update')
    ✅ обновляет title колонки
    ❌ бросает NotFoundException если колонка не найдена
    ❌ бросает NotFoundException если колонка принадлежит другому проекту
    ❌ бросает ForbiddenException если projectId принадлежит другому пользователю

  describe('delete')
    ✅ удаляет колонку
    ❌ бросает NotFoundException если колонка не найдена
    ❌ бросает NotFoundException если колонка не принадлежит указанному projectId

  describe('reorder')
    ✅ обновляет порядок колонок по переданным ID
    ❌ бросает BadRequestException если в массиве есть ID колонок из другого проекта
    ❌ бросает BadRequestException если массив пустой
```

### `project-task.service.spec.ts`

```
describe('ProjectTaskService — move & reorder')
  describe('moveTask')
    ✅ перемещает задачу в проект
    ✅ перемещает задачу из проекта во Входящие (projectId=null)
    ✅ перемещает задачу в колонку на доске
    ✅ перемещает задачу между колонками одного проекта
    ✅ устанавливает order при перемещении
    ❌ бросает NotFoundException если taskId не существует
    ❌ бросает NotFoundException если projectId не существует
    ❌ бросает NotFoundException если columnId не существует
    ❌ бросает ForbiddenException если задача принадлежит другому пользователю
    ❌ бросает ForbiddenException если проект принадлежит другому пользователю
    ❌ бросает BadRequestException если columnId принадлежит другому проекту
    ❌ бросает BadRequestException если columnId указан но projectId=null
    ❌ бросает BadRequestException если columnId указан но проект в viewMode='list'
    ❌ бросает BadRequestException если order отрицательный

  describe('reorderTasks')
    ✅ обновляет порядок задач по переданным ID
    ✅ обновляет порядок задач внутри колонки
    ❌ бросает BadRequestException если массив пустой
    ❌ игнорирует ID задач другого пользователя
    ❌ игнорирует ID задач из другого проекта/колонки
```

### `project.controller.spec.ts`

```
describe('ProjectController')
  ✅ GET /projects — возвращает 200 и массив проектов
  ✅ GET /projects/:id — возвращает 200 и проект
  ✅ POST /projects — возвращает 201 и созданный проект
  ✅ PATCH /projects/:id — возвращает 200 и обновлённый проект
  ✅ DELETE /projects/:id — возвращает 200
  ❌ GET /projects/:id — возвращает 404 для несуществующего
  ❌ POST /projects — возвращает 400 если title отсутствует
  ❌ POST /projects — возвращает 400 если parentId не UUID
  ❌ POST /projects — возвращает 400 если viewMode не 'list'/'board'
  ❌ PATCH /projects/:id — возвращает 400 если id не UUID
  ❌ PATCH /projects/:id — возвращает 404 если проект не найден

describe('ProjectColumnController')
  ❌ POST /projects/:projectId/columns — возвращает 400 если title отсутствует
  ❌ POST /projects/:projectId/columns — возвращает 404 если projectId не существует

describe('ProjectTaskController')
  ❌ PATCH /projects/:projectId/tasks/:taskId/move — возвращает 400 если columnId не UUID
  ❌ PATCH /projects/:projectId/tasks/:taskId/move — возвращает 404 если taskId не существует
```

---

## Архитектурные решения

1. **Дерево проектов строится на фронтенде** — бэкенд отдаёт плоский список с `parentId`, фронт собирает дерево в store

2. **move/reorder задач — в ProjectModule** — endpoint `/projects/:projectId/tasks/:taskId/move` изолирует знание о колонках внутри модуля проекта. TaskModule не зависит от ProjectModule

3. **Валидация «columnId принадлежит projectId»** — в сервисном слое (ProjectTaskService), не в контроллере и не в репозитории

4. **Reorder через bulk** — порты используют `reorder(updates: {id, order}[])`, а не save в цикле

5. **Entity-файлы не импортируют из modules/** — типы определяются в entity или в `shared/`, чтобы не нарушать Dependency Rule

---

## Порядок реализации (TDD)

### Фаза 1: Entities + Ports
- [ ] Создать `src/shared/entities/project.entity.ts`
- [ ] Создать `src/shared/entities/project-column.entity.ts`
- [ ] Обновить `src/shared/entities/task.entity.ts` — добавить `projectId`, `columnId`, `order`
- [ ] Создать `src/modules/project/domain/project-repository.port.ts`
- [ ] Создать `src/modules/project/domain/project-column-repository.port.ts`
- [ ] Обновить `src/modules/task/domain/task-repository.port.ts` — добавить `updatePosition`, `reorderTasks`, `findAllByProject`
- [ ] Добавить `Project`, `ProjectColumn` в `app.module.ts`

### Фаза 2: Тесты (RED)
- [ ] Написать `src/modules/project/project.service.spec.ts`
- [ ] Написать `src/modules/project/project-column.service.spec.ts`
- [ ] Написать `src/modules/project/project-task.service.spec.ts`
- [ ] Написать `src/modules/project/project.controller.spec.ts`

### Фаза 3: Сервисы (GREEN)
- [ ] Реализовать `src/modules/project/project.service.ts`
- [ ] Реализовать `src/modules/project/project-column.service.ts`
- [ ] Реализовать логику moveTask/reorderTasks в ProjectModule

### Фаза 4: DTO
- [ ] Создать все DTO из `src/modules/project/dto/`
- [ ] Обновить `CreateTaskDto`, `UpdateTaskDto`

### Фаза 5: Репозитории (Infrastructure)
- [ ] Реализовать `src/modules/project/infrastructure/typeorm-project.repository.ts`
- [ ] Реализовать `src/modules/project/infrastructure/typeorm-project-column.repository.ts`
- [ ] Обновить `src/modules/task/infrastructure/typeorm-task.repository.ts`

### Фаза 6: Контроллеры + Модуль
- [ ] Создать `src/modules/project/project.controller.ts`
- [ ] Создать `src/modules/project/project-column.controller.ts`
- [ ] Создать `src/modules/project/project-task.controller.ts`
- [ ] Создать `src/modules/project/project.module.ts`
- [ ] Обновить `src/app.module.ts` — подключить `ProjectModule`
- [ ] Обновить `src/modules/task/task.module.ts` — экспортировать `TaskRepositoryPort`

### Фаза 7: Рефакторинг
- [ ] Проверить все тесты проходят
- [ ] Проверить каскадное поведение при удалении
- [ ] Проверить фильтрацию `GET /tasks?projectId=...`

---

## Чеклист перед деплоем

- [ ] Все entity созданы и связи настроены
- [ ] TypeORM synchronize обновил БД
- [ ] Тесты проходят
- [ ] CRUD проектов работает
- [ ] CRUD колонок работает
- [ ] Перемещение задач между проектами/колонками работает
- [ ] Задачи без проекта отображаются как «Входящие»
- [ ] Удаление проекта корректно обрабатывает дочерние проекты и задачи
