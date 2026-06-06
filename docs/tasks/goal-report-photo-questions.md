# Goal Report Photo Questions

**Status:** done
**Branch:** feat/goal-report-photo-questions (base: ci/pre-merge-checks @ a9b1c4e)
**Worktree:** .worktrees/feat-goal-report-photo-questions
**Mode:** interactive

## Design

### Цель
Добавить новый тип вопроса `photo` к целям. Пользователь присылает 1 фото на дату через Telegram-бота; на странице вопроса в web показывается грид-галерея всех фото по этому вопросу с подписями-датами и сортировкой DESC (от свежих к старым). Web-загрузка ответов сейчас — только REST-эндпоинт; UI кнопки добавим отдельной задачей.

### Чужие границы (out of scope)
- Multi-photo на одну дату — фича явно «1 фото/дата» (как карусель похудения; пере-загрузка перезаписывает).
- Web UI загрузки фото из браузера — только API.
- Просмотр галереи в Telegram-боте.
- Доступ к фото через MCP / alfy-mcp tools.

### Хранение
**Подход A (выбран):** добавить колонку `report_answers.photo_key TEXT NULL` (S3 object key). 1:1 идеально ложится на «1 фото/дата». Галерея — один SELECT по `report_answers WHERE question_id=? AND photo_key IS NOT NULL ORDER BY scheduled_date DESC`.

Отброшенные варианты:
- **B — отдельная таблица `report_answer_photos`** — оверкилл при «1 фото/дата»; добавляет порт + репо + join.
- **C — полиморфные `attachments`** — overengineering ради одной фичи.

`answer_text` остаётся NOT NULL — для photo-ответов пишем пустую строку `''`; рендеринг для photo идёт через `photo_key`, не через `answer_text`.

### S3 интеграция
- **Зависимость:** `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` в `alfy-bot/package.json`. ESM SDK v3, ~5MB.
- **Порт:** `StoragePort` в `alfy-bot/src/shared/storage/` — единый интерфейс для бэка и бота, чтобы детали S3 не текли в application/scene слой:
  ```
  upload(key, buffer, mime): Promise<void>
  getSignedReadUrl(key, ttlSeconds): Promise<string>
  delete(key): Promise<void>
  ```
- **Адаптер:** `S3StorageAdapter` (infrastructure) — конфигурация из env (`S3_*`), читает прямо через `ConfigService` (Nest).
- **Bucket-policy:** приватный. Объекты выдаются только подписанными URL, TTL 1h. Бэк никогда не возвращает сырой `photo_key` клиенту — только URL.
- **Ключи:** `goal-reports/{userId}/{questionId}/{scheduledDate}-{uuid}.{ext}` — упорядочено для возможной life-cycle политики, no clash на пере-загрузку.
- **MIME / лимиты:** `image/jpeg`, `image/png`, `image/webp`, `image/heic`. Максимум 10MB (Telegram сам режет ≥20MB; на web проверяем явно в multer-конфиге).
- **Пере-загрузка:** перед записью нового `photo_key` вызываем `storage.delete(old_key)` чтобы не плодить orphans (best-effort, ошибка delete не валит запрос).

### REST (для web и future-uses)
- `POST /questions/:id/answers/photo` — multipart (`multer`, memoryStorage). Body: `scheduled_date` + файл `photo`. Возвращает `{ ok: true }`.
- `GET /questions/:id/photo-gallery?limit=50&offset=0` → `[{ scheduled_date: '2026-05-21', url: 'https://...' }, ...]` DESC. URL подписан, TTL 1h.

Эндпоинты — `QuestionController` (рядом с существующим `POST /:id/answers`). Owner-checks через `assertOwnership`, как уже принято.

### Telegram-бот (report.scene.ts)
- Если текущий вопрос `type === 'photo'` — `askQuestion` пишет «📷 Пришли фото» (без inline-кнопок ответов; cancel/skip остаются если применимы).
- Новый хэндлер `@On('photo')`: берёт фото с лучшим разрешением (`message.photo` отсортирован по размеру, last = biggest), скачивает через `bot.telegram.getFileLink()`, грузит в S3 через `StoragePort`, сохраняет answer с `photo_key`, идёт дальше.
- Новый хэндлер `@On('document')`: если `mime_type` начинается с `image/` — тот же путь; иначе подсказка «Только фото».
- Если в текущем вопросе тип photo, а пришёл text — текущая `handleReportAnswer` отвечает «Нужно фото».
- Альбом (media_group): телеграф доставляет элементы отдельными апдейтами. Берём первое фото (по группе нет надёжного агрегата без буферизации); остальные элементы группы игнорируются с тихим ack (раз правило «1 фото/дата»).
- Скачивание из TG CDN — через `fetch(fileLink)` (Node 22+, fetch — встроен).

### Web (frontend)
- `alfy-bot-frontend/src/features/goals/ui/steps/question-types.ts` — добавить опцию `{ type: 'photo', emoji: '📷', label: 'Фото', example: 'Сделай фото сегодня' }`.
- `alfy-bot-frontend/src/components/reports/visuals/PhotoGalleryVisual.vue` — новый компонент: грид (например 3 колонки на mobile, 4-5 на desktop через Tailwind), каждая ячейка — `<img>` с подписью даты, клик → fullscreen lightbox. Источник данных — отдельный API-вызов `/questions/:id/photo-gallery`.
- `alfy-bot-frontend/src/components/reports/visuals/QuestionVisual.vue` — новая ветка для `type === 'photo'` → `<PhotoGalleryVisual>`.
- `alfy-bot-frontend/src/views/QuestionReportView.vue` — для photo-вопросов аналитика-через-расписание не нужна; делаем отдельную ветку загрузки данных через `fetchPhotoGallery` вместо `fetchQuestionAnalytics`.
- `alfy-bot-frontend/src/api/reports.ts` — новый клиент `fetchPhotoGallery(questionId): Promise<PhotoEntry[]>`.

### DB-миграция
SQLite + `synchronize: true` → новая колонка `photo_key` создастся при старте. Существующие строки получат `NULL` — корректно (только photo-вопросы её используют).

### Backwards-compat
Greenfield: нет existing 'photo' вопросов, нет attachments. Добавление enum-значения и nullable колонки — безопасно. Внешние потребители схемы — alfy-mcp — типу photo не подвержены (MCP не получает доступ к фото в этой задаче).

### Unknowns
- **Timeweb S3 endpoint для Path-Style + virtual-hosted** — мы выставили `S3_FORCE_PATH_STYLE=true`. Presigned URL подписи на presigner v3 проверим в верификации; если Timeweb требует SignatureV4 с конкретным host header, может понадобиться `forcePathStyle` flag на клиенте.
- **Загрузка из бота на больших фото** — Telegraph CDN иногда тормозит; таймаут fetch'a и retry-стратегия — простой single-shot, ошибка → сообщение «Не получилось, попробуй ещё раз».

TDD: yes (storage adapter, report service photo-path, repository photo gallery query, bot scene photo branch, PhotoGalleryVisual).

### Invariants
- `report_answers.photo_key` заполнен ⇒ соответствующий вопрос имеет `type === 'photo'` (но не обратно — photo-ответ можно ещё не сдать).
- Photo bytes никогда не пишутся в БД; в БД только S3 object key.
- Сырые `photo_key` никогда не возвращаются в HTTP-ответах — только presigned URL.
- В `report_answers` остаётся ровно одна строка на пару `(question_id, scheduled_date)`; для photo-ответов тот же инвариант.
- S3 bucket остаётся приватным.

### Principles
- При re-upload старый S3 object удаляется (best-effort) — никаких orphans.
- Хранилище за портом `StoragePort` — детали S3 не утекают за пределы `shared/storage/infrastructure/`.
- AWS SDK ошибки не пробрасываются клиенту as-is — преобразуются в `InternalServerErrorException` с короткими user-safe сообщениями.
- Бот реагирует на photo/document только когда текущий вопрос `type === 'photo'`; в остальных контекстах photo-ивент игнорируется.
- Презентация (URL для клиента) — всегда presigned, не сырой `key`, не публичный URL.
- Frontend пути для photo-визуала не зависят от `analyticsToDataPoints` — фото имеют свою линию данных.

## Plan

Approach: 6 фаз, каждая — отдельный коммит. Сначала фундамент (storage port + S3-адаптер), потом enum type, потом БД-колонка + расширения портов репозитория, потом REST-эндпоинты, потом telegram-бот, последняя — фронтенд-галерея. Порядок выбран так, чтобы каждая фаза была независимо тестируема, а enum-значение 'photo' до фазы 4 принималось ботом/REST как валидный тип (просто без фото-функционала).

### Phase 1 — Storage port + S3 adapter

- **1.0** `alfy-bot/package.json` (modify) — добавить deps: `@aws-sdk/client-s3@^3`, `@aws-sdk/s3-request-presigner@^3`, `multer@^1.4`, `@types/multer@^1` (devDep). `@nestjs/platform-express` уже есть.
- **1.1** `alfy-bot/src/shared/storage/domain/storage.port.ts` (create)
  - `abstract class StoragePort { upload(key, body: Buffer, contentType): Promise<void>; getSignedReadUrl(key, ttlSeconds: number): Promise<string>; delete(key): Promise<void>; }`
- **1.2** `alfy-bot/src/shared/storage/infrastructure/s3-storage.adapter.ts` (create)
  - `class S3StorageAdapter extends StoragePort` — конструктор инжектит `ConfigService`, создаёт `S3Client` с `{ endpoint, region, credentials, forcePathStyle: S3_FORCE_PATH_STYLE === 'true' }`.
  - `upload`: `PutObjectCommand` с `Bucket`, `Key`, `Body`, `ContentType`.
  - `getSignedReadUrl`: `getSignedUrl(client, new GetObjectCommand({...}), { expiresIn: ttlSeconds })`.
  - `delete`: `DeleteObjectCommand`. Swallow `NoSuchKey`/`NotFound` (best-effort).
- **1.3** `alfy-bot/src/shared/storage/storage.module.ts` (create) — `@Module({ providers: [{ provide: StoragePort, useClass: S3StorageAdapter }], exports: [StoragePort] })`. Глобально не помечаем — импортируется явно ReportModule/BotModule.
- **1.4** `alfy-bot/src/shared/storage/infrastructure/s3-storage.adapter.spec.ts` (create) — TDD: моки `S3Client.send` и `getSignedUrl` через `jest.mock('@aws-sdk/client-s3')` и `'@aws-sdk/s3-request-presigner'`. Поведения: upload вызывает PutObjectCommand с правильным Bucket/Key/Body/ContentType; delete swallows NoSuchKey; getSignedReadUrl передаёт `expiresIn`.
- Invariants: S3 detail скрыт за `StoragePort`; адаптер не утекает за пределы `shared/storage/infrastructure/`.
- Commit: `feat(storage): add S3 storage port and adapter`

### Phase 2 — 'photo' question type enum

- **2.1** `alfy-bot/src/shared/types/question-types.ts:1-7` (modify) — добавить `'photo'` в union `QuestionType`.
- **2.2** `alfy-bot/src/shared/types/question-types.ts:18-66` (modify) — добавить ключ `photo` в `QUESTION_TYPES`: `{ type: 'photo', label: 'Фото', description: 'Фотография на дату', example: 'Сделай фото себя сегодня', ui_component: 'photo_upload' }` (без `options`).
- **2.3** `alfy-bot/src/modules/question/dto/create-question.dto.ts:17-22` (modify) — добавить `'photo'` в `enum:` и `@IsIn` (две строки).
- **2.4** `alfy-bot/src/modules/question/dto/update-question.dto.ts:10-17` (modify) — то же.
- **2.5** `alfy-bot/src/modules/goal/dto/add-questions.dto.ts:22-27` (modify) — то же.
- **2.6** `alfy-bot/src/modules/goal/dto/goal-response.dto.ts:41-45` (modify) — расширить `enum:` в Swagger-декораторе.
- **2.7** `alfy-bot/src/shared/utils/question-ui.util.ts:19-60` (modify) — `generateQuestionButtons` для type=photo возвращает `null` (явный case или default fallback, как сейчас для 'text'/'number').
- **2.8** `alfy-bot-frontend/src/types/index.ts:3` (modify) — добавить `'photo'` в `QuestionType` union.
- **2.9** `alfy-bot-frontend/src/features/goals/ui/steps/question-types.ts:15-22` (modify) — добавить `{ type: 'photo', emoji: '📷', label: 'Фото', example: 'Сделай фото себя сегодня' }`.
- Test strategy: existing 246/206 baseline остаются зелёными. Новый юнит-тест не требуется (плоское расширение enum).
- Commit: `feat(questions): add 'photo' to question type enum`

### Phase 3 — photo_key column + repository

- **3.1** `alfy-bot/src/shared/entities/report-answer.entity.ts:30-40` (modify) — добавить `@Column({ type: 'text', nullable: true }) photo_key: string | null;`. SQLite + `synchronize:true` создаст колонку при старте.
- **3.2** `alfy-bot/src/modules/report/domain/report-answer-repository.port.ts:3-8` (modify) — расширить `AnswerData` полем `photo_key: string | null` (опционально, default null в реализации).
- **3.3** `alfy-bot/src/modules/report/domain/report-answer-repository.port.ts:9-40` (modify) — добавить абстрактный метод:
  - `findPhotosByQuestion(questionId: number, limit: number, offset: number): Promise<ReportAnswer[]>` — возвращает строки где `photo_key IS NOT NULL`, ORDER BY `scheduled_date` DESC.
  - `findByQuestionAndDate(questionId: number, scheduledDate: string): Promise<ReportAnswer | null>` — нужен для re-upload (удалить старый ключ).
- **3.4** `alfy-bot/src/modules/report/infrastructure/typeorm-report-answer.repository.ts:19-94` (modify)
  - `save`: добавить `photo_key: data.photo_key ?? null` в create.
  - `findByQuestionAndDate`: `this.repo.findOne({ where: { question_id, scheduled_date } })`.
  - `findPhotosByQuestion`: `this.repo.find({ where: { question_id, photo_key: Not(IsNull()) }, order: { scheduled_date: 'DESC' }, take: limit, skip: offset })`.
- **3.5** `alfy-bot/src/modules/report/infrastructure/typeorm-report-answer.repository.spec.ts` (create) — TDD: in-memory sqlite, проверить что save с photo_key пишет колонку, findPhotosByQuestion возвращает DESC и игнорирует NULL'ы, findByQuestionAndDate возвращает null/строку.
- Invariants: ровно одна строка на `(question_id, scheduled_date)` — обеспечивается существующим `save` (через `findByUserQuestionAndDate`+update? — проверить в impl, существующий `save` всегда создаёт новую строку → надо переделать на upsert).
- **Замечание по упсерту:** текущий `save` всегда создаёт новую строку. Это уже потенциальный баг (две строки на дату при двух ответах). Проверить в Phase 3 — если так, превратить save в upsert: `findByQuestionAndDate` → update existing или create. Не выходим за рамки задачи, чиним только если поведение действительно дублирует.
- Commit: `feat(reports): add photo_key column and gallery query`

### Phase 4 — REST upload + gallery endpoints

- **4.1** `alfy-bot/src/modules/report/application/report.service.ts:21-49` (modify) — добавить методы:
  - `addPhotoAnswer(userId, questionId, scheduledDate: string, photo: { buffer: Buffer; mime: string }): Promise<void>`
    - findQuestion → assert type==='photo'
    - assert ownership (через goal.user_id как сейчас в addAnswer)
    - ext = mimeToExt(mime) (jpg|png|webp|heic) — throw BadRequest если не поддержано
    - key = `goal-reports/${userId}/${questionId}/${scheduledDate}-${randomUUID()}.${ext}`
    - storage.upload(key, buffer, mime)
    - existing = answerRepo.findByQuestionAndDate(qid, scheduledDate); if existing?.photo_key → storage.delete(existing.photo_key) best-effort
    - answerRepo.save(...) с photo_key=key, answer_text=''
  - `getPhotoGallery(userId, questionId, limit, offset): Promise<{ scheduled_date: string; url: string }[]>`
    - findQuestion → assert ownership + type==='photo'
    - rows = answerRepo.findPhotosByQuestion(qid, limit, offset)
    - return rows.map(r => ({ scheduled_date, url: storage.getSignedReadUrl(r.photo_key, 3600) }))
  - Помощник `mimeToExt(mime: string): string` приватный.
  - Constructor injects `StoragePort`.
- **4.2** `alfy-bot/src/modules/report/report.module.ts:11-22` (modify) — `imports: [..., StorageModule]`.
- **4.3** `alfy-bot/src/modules/question/question.controller.ts:111-127` (modify) — добавить рядом с `POST :id/answers`:
  - `POST :id/answers/photo` с `@UseInterceptors(FileInterceptor('photo', { storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: (req, file, cb) => /^image\//.test(file.mimetype) ? cb(null, true) : cb(new BadRequestException('only images'), false) }))`
  - body `{ scheduled_date: string }` (DTO `UploadPhotoAnswerDto` с `@IsDateString`)
  - вызывает `reportService.addPhotoAnswer(req.user.sub, id, dto.scheduled_date, { buffer: file.buffer, mime: file.mimetype })`
- **4.4** `alfy-bot/src/modules/question/question.controller.ts:159-174` (modify) — добавить:
  - `GET :id/photo-gallery?limit=50&offset=0` с `@Query` пайпами, дефолты limit=50/offset=0.
  - вызывает `reportService.getPhotoGallery(req.user.sub, id, limit, offset)`.
- **4.5** `alfy-bot/src/modules/question/dto/upload-photo-answer.dto.ts` (create) — `class UploadPhotoAnswerDto { @IsDateString() scheduled_date: string; }`
- **4.6** `alfy-bot/src/modules/question/dto/photo-gallery-response.dto.ts` (create) — `class PhotoGalleryEntryDto { scheduled_date: string; url: string; }` (для Swagger).
- **4.7** `alfy-bot/src/modules/report/application/report.service.spec.ts` (modify) — TDD: addPhotoAnswer happy path (storage.upload вызван, repo.save с photo_key), re-upload удаляет старый ключ best-effort, BadRequest на не-photo тип, BadRequest на unsupported mime. getPhotoGallery возвращает DESC с подписанными URL.
- Invariants: bytes не пишутся в БД; URL — только presigned; bucket приватный (адаптер уже знает).
- Commit: `feat(api): photo answer upload and gallery endpoints`

### Phase 5 — Telegram bot photo handler

- **5.1** `alfy-bot/src/modules/bot/scenes/report.scene.ts:61-89` (modify) — `askQuestion`: если `question.type === 'photo'`, текст «📷 Пришли фото», `buttons = null`, отключить answer-кнопки. cancel/skip остаются.
- **5.2** `alfy-bot/src/modules/bot/scenes/report.scene.ts:91-113` (modify) — новый метод `processPhotoAnswer(ctx, buffer: Buffer, mime: string)` рядом с `processAnswer`: вызывает `reportService.addPhotoAnswer(...)` затем `moveToNextQuestion`.
- **5.3** `alfy-bot/src/modules/bot/scenes/report.scene.ts:478-493` (modify) — `handleTextAnswer`: после route lookup, если `isInReportFlow(ctx)` и current question type === 'photo' и пришёл text → reply «Нужно фото».
- **5.4** `alfy-bot/src/modules/bot/scenes/report.scene.ts` (modify) — добавить хэндлеры (после `@On('text')`):
  - `@On('photo')`: проверка current question — type photo; `photo = ctx.message.photo[ctx.message.photo.length - 1]` (last = biggest); если есть `ctx.message.media_group_id` и `ctx.session.lastMediaGroupId === media_group_id` — silent ack (уже обработали первое); иначе set `ctx.session.lastMediaGroupId`, скачать `bot.telegram.getFileLink(photo.file_id)` → `fetch(url).arrayBuffer()` → Buffer → mime=`image/jpeg` (TG photos всегда jpeg); `processPhotoAnswer`.
  - `@On('document')`: если `ctx.message.document.mime_type?.startsWith('image/')` — тот же путь (file_id из document); иначе reply «Только фото».
- **5.5** `alfy-bot/src/modules/bot/scenes/report.scene.ts:19-30` (modify) — добавить `lastMediaGroupId?: string` в `SessionData`.
- **5.6** `alfy-bot/src/modules/bot/bot.module.ts:1-21` (modify) — импорт `StorageModule` (для transitive deps, если нужно; ReportService уже инжектится через ReportModule).
- **5.7** `alfy-bot/src/modules/bot/scenes/report.scene.spec.ts` (modify) — TDD: photo happy path (фейк telegraf ctx с `message.photo`, замокать `bot.telegram.getFileLink` и `fetch`, проверить `reportService.addPhotoAnswer` вызван); document-image happy path; document-pdf → reply «Только фото»; text для photo-вопроса → reply «Нужно фото»; media_group дубль игнорируется.
- Invariants: photo/document обрабатываются только если current question type='photo'.
- Commit: `feat(bot): handle photo answers in report scene`

### Phase 6 — Frontend gallery visual

- **6.1** `alfy-bot-frontend/src/api/reports.ts:1-14` (modify) — добавить:
  - `interface PhotoGalleryEntry { scheduled_date: string; url: string }`
  - `async function fetchPhotoGallery(questionId, limit=50, offset=0): Promise<PhotoGalleryEntry[]>` → `api.get('/questions/:id/photo-gallery', { params: { limit, offset } })`
- **6.2** `alfy-bot-frontend/src/components/reports/visuals/PhotoGalleryVisual.vue` (create)
  - props: `questionText: string`, `entries: PhotoGalleryEntry[]` (DESC, как пришло с бэка)
  - layout: `<div class="grid grid-cols-3 sm:grid-cols-4 gap-2">` цикл по entries; каждая ячейка — `<button>` обёртка с `<img :src="entry.url" loading="lazy" class="aspect-square object-cover rounded-md">` и `<span class="text-xs">{{ formatDate(entry.scheduled_date) }}</span>`.
  - lightbox: shadcn-vue `Dialog` (если есть в `components/ui/dialog`) или простой fullscreen overlay с `<img>` на клик.
  - Empty state: «Пока нет фото».
- **6.3** `alfy-bot-frontend/src/components/reports/visuals/QuestionVisual.vue:1-59` (modify) — добавить prop `photoEntries?: PhotoGalleryEntry[]`, ветка `<PhotoGalleryVisual v-if="question.type === 'photo'" :question-text="question.question" :entries="photoEntries ?? []">` *перед* остальными.
- **6.4** `alfy-bot-frontend/src/views/QuestionReportView.vue:74-91` (modify) — `onMounted`: если type === 'photo' (нужно сначала получить question), грузить `fetchPhotoGallery`, иначе `fetchQuestionAnalytics`. Хранить `photoEntries` в ref. В template (line 131): прокидывать `:photo-entries="photoEntries"` в `QuestionVisual`; ветка `v-else` для пустого состояния — отдельная для photo (нет dataPoints).
- **6.5** `alfy-bot-frontend/tests/components/reports/visuals/PhotoGalleryVisual.spec.ts` (create) — TDD: рендерит грид из N entries, эмитит порядок DESC (как пришло), показывает empty state на пустом списке.
- **6.6** `alfy-bot-frontend/tests/components/reports/visuals/QuestionVisual.spec.ts` (create или modify, если уже есть) — для type='photo' рендерит PhotoGalleryVisual.
- Commit: `feat(frontend): photo gallery on question report view`

### Test strategy

- **TDD: yes** для бэка (storage adapter, report service photo path, repository) и фронта (PhotoGalleryVisual). Тесты пишутся первыми в каждой фазе.
- **Bot scene** — добавление кейсов в существующий `report.scene.spec.ts` (там уже мокается goal/report service).
- **e2e не делаем** — task-файл не требует, manual smoke test в фазе uverify покроет.
- **Frontend types** — `vue-tsc --noEmit` после каждой фазы (CLAUDE.md рекомендация).

### Order & dependencies

- Phase 1 независима (только новый модуль и зависимости).
- Phase 2 независима (плоское расширение enum).
- Phase 3 зависит от ничего, но Phase 4 зависит от Phase 1 + 3.
- Phase 5 зависит от Phase 4 (использует `reportService.addPhotoAnswer`).
- Phase 6 зависит от Phase 4 (вызывает `GET /photo-gallery`).
- Возможна параллельность фаз 1+2+3, но executor идёт последовательно — это нормально.

### Backwards-compat

Greenfield-фича по содержанию, риски минимальные:
- Новый enum-value 'photo' — клиенты, не знающие про него, продолжают работать (никто не пришлёт его в DTO без знания).
- Новая nullable колонка `photo_key` — SQLite `synchronize:true` добавит без проблем; существующие строки получат NULL.
- `AnswerData.photo_key` опционален (default null) — все существующие вызовы `save()` остаются совместимыми.
- alfy-mcp типу photo не обращается; tools работают как раньше.
- Frontend `QuestionType` union расширяется — компоненты с `if (type === 'photo')` явно ветвятся, остальные fallback в `TextLogVisual` (нет визуальной поломки).

### Open questions / risks

- **`save()` upsert vs insert** (см. 3.4 замечание): если текущий `save` не делает upsert и при двух ответах создаёт две строки — это лежащий баг, который мы вылечим в Phase 3. Подтвердить чтением `findByUserQuestionAndDate` в existing коде. Если фикс выходит за пределы — surface user.
- **Timeweb S3 path-style подпись**: presigned URL могут требовать конкретный host header; если в uverify подписанный URL вернёт `SignatureDoesNotMatch`, переключить `forcePathStyle` или endpoint host (см. unknown из Design).
- **media_group ID hold**: `lastMediaGroupId` живёт в session — между разными отчётами может остаться старый. Очищать в `startReport` / `finishReport`.
- **Откат**: каждая фаза — отдельный коммит, `git revert` точечно. БД-колонка `photo_key` пере-создаваться не будет, но nullable, поэтому откат code-only безопасен.

## Verify

**Result:** passed

Positive:
- alfy-bot `npm run build` → `dist/src/main.js` создан, без TS-ошибок
- alfy-bot-frontend `npm run build` → vue-tsc + vite чисто, PWA сборка ОК
- alfy-bot тесты: **281/281** (246 baseline + 35 новых)
- alfy-bot-frontend тесты: **212/212** (206 baseline + 6 новых)
- alfy-mcp тесты: **110/110** (regression — без изменений)
- Lint на production-коде (без spec): **0 ошибок**
- Live S3 roundtrip с реальными кредами Timeweb (forcePathStyle=true, region=ru-1): upload → presigned GET → fetch → sha256 идентичен → delete. Тестировал тем же SDK-кодом, что в `S3StorageAdapter`.

Negative:
- POST photo answer на не-photo вопрос → `BadRequestException` (unit-тест в `report.service.spec.ts`)
- Upload unsupported mime → `BadRequestException` (unit-тест)
- Multer fileFilter блокирует non-image (`fileFilter` в `question.controller.ts:97`)
- Bot @On('photo') в контексте не-photo вопроса → silent return (unit-тест `report.scene.spec.ts`)
- Bot @On('document') с не-image mime → reply «Только фото», `addPhotoAnswer` не вызывается (unit-тест)
- Текст на photo-вопрос → reply «Нужно фото», ответ не сохраняется (unit-тест)
- media_group дубль → второе фото игнорируется (unit-тест)

Invariants:
- `photo_key` не присутствует ни в одном HTTP DTO (`grep photo_key src/modules/*/dto/` пусто)
- `ReportAnswer` entity — все колонки скаляры (int/text/real/boolean); нет Buffer/blob
- `S3StorageAdapter` не выставляет ACL/public-read (grep пусто) — bucket остаётся приватным
- `save()` upsert: повторный ответ обновляет существующую строку (unit-тесты `typeorm-report-answer.repository.spec.ts:93+`)

Smoke: live S3 upload+presigned GET+fetch roundtrip — bytes match, ROUNDTRIP OK

Notes:
- Live e2e (curl против nest + UI в браузере + реальный Telegram-чат) — не запускался из-за необходимости настройки JWT/токенов/реального бота. Покрытие компенсировано юнит-тестами на каждом слое (controller → service → repo, scene → service, frontend компонент) и одним live-roundtrip'ом против реального S3.
- Лишний pre-existing lint-mess (~69 ошибок в spec-файлах, в основном `any` для моков) — не разбирался, не вводился этой задачей.
- Доп. коммиты во время verify: `e006678` (chore: типизация media_group_id cast) + `d4a9470` (chore: prettier --fix форматирование).

## Conclusion

Outcome: тип вопроса `photo` поддерживается end-to-end (бэк/бот/фронт) с приватным S3, presigned URL и галереей DESC. HEAD: `622d142`.

Invariants:
- `photo_key` filled ⇒ type='photo' — проверка в `report.service.ts:212`, ветка падает с `BadRequestException` на не-photo
- Photo bytes не в БД — все колонки `report-answer.entity.ts` остались скалярами (text/int/real/bool)
- Сырой `photo_key` не возвращается клиенту — grep DTO пустой; `getPhotoGallery` отдаёт только `{ scheduled_date, url: presigned }`
- One row per (question_id, scheduled_date) — `save()` теперь upsert (cd919a3, тесты `typeorm-report-answer.repository.spec.ts:93+`)
- S3 bucket приватный — адаптер не выставляет ACL/public-read; всё чтение через presigned GET TTL 1h

Plan adherence: Phase 3 расширен upsert-фиксом `save()` (cd919a3) — pre-existing баг, без него Phase 4 ломал инвариант «one row»; одобрено пользователем как «общий upsert» вместо локального костыля.

Review findings:
- Important #1 (orphan + потеря старого фото на save-failure): зафикшен в `622d142` — порядок `find → upload → save → delete-old (только при успехе)`, плюс cleanup нового ключа на исключении save(). Закреплено двумя новыми тестами.
- Important #2 (мёртвая ветка `existing.photo_key !== key` — UUID не может совпасть): убрана в `622d142`.

Future work:
- Web UI загрузки фото-ответа (multipart-форма / drag-and-drop) — Design явно скоупит «только API endpoint в этой задаче, UI потом». Эндпоинт `POST /questions/:id/answers/photo` готов.
- Просмотр галереи в Telegram — Design out-of-scope.
- MCP exposure photo-tools — Design out-of-scope.

Verified by:
- Live S3 roundtrip против реального Timeweb bucket (upload → presigned GET → fetch → sha256 match → delete). E2e HTTP-нагрузка против запущенного nest + UI в браузере + реальный Telegram-чат — не запускался, покрытие компенсировано юнит-тестами на каждом слое.
