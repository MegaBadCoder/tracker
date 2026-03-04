# Рефакторинг системы отчетов

## Цель
Перевести хранение отчетов с JSON-полей на нормализованную структуру с отдельными таблицами для вопросов и ответов. Это позволит:
- Делать SQL-аналитику (агрегации, фильтры)
- Отслеживать пропуски вопросов
- Версионировать вопросы (history через is_active)
- Хранить типизированные ответы для метрик

---

## Новая структура БД

### Таблица: `goals`
- `id` — PK
- `user_id` — FK to users
- `goal_name` — название цели
- `goal_start` — дата начала
- `goal_end` — дата окончания
- `status` — `active` / `completed` / `archived`
- `createdAt` — дата создания

**Изменение:** Убрать поле `question_config` (JSON)

**Связи:** 1:N с `goal_questions`, 1:N с `reports`

---

### Таблица: `goal_questions` (новая)
- `id` — PK
- `goal_id` — FK to goals
- `question` — текст вопроса
- `type` — `rating` / `yes_no` / `text` / `number` / `emoji_rating` / `time_spent`
- `can_skip` — boolean (можно ли пропустить)
- `order_index` — порядковый номер вопроса
- `is_active` — boolean (для soft delete/версионирования)
- `createdAt` — дата создания

**Индексы:**
- `(goal_id, is_active)`
- `(goal_id, order_index)`

**Связи:** N:1 с `goals`, 1:N с `report_answers`

---

### Таблица: `reports`
- `id` — PK
- `user_id` — FK to users
- `goal_id` — FK to goals
- `status` — `in_progress` / `completed` / `cancelled` / `expired`
- `createdAt` — дата создания
- `updatedAt` — дата обновления

**Изменение:** Убрать поле `answers` (JSON)

**Индексы:**
- `(user_id, goal_id, status)`
- `(createdAt)`

**Связи:** N:1 с `users`, N:1 с `goals`, 1:N с `report_answers`

---

### Таблица: `report_answers` (новая)
- `id` — PK
- `report_id` — FK to reports (ON DELETE CASCADE)
- `question_id` — FK to goal_questions
- `answer_text` — text (всегда заполнено, исходный ответ)
- `answer_number` — real, nullable (для rating/number/time_spent)
- `answer_bool` — boolean, nullable (для yes_no)
- `createdAt` — дата ответа

**Индексы:**
- `(report_id)`
- `(question_id)`
- `(answer_number)` — для аналитики
- `(answer_bool)` — для аналитики

**Связи:** N:1 с `reports`, N:1 с `goal_questions`

---

## Задачи

### Этап 1: Создание новых entities

- [ ] **1.1** Создать `src/entities/goal-question.entity.ts`
  - Поля: id, goal_id, question, type, can_skip, order_index, is_active, createdAt
  - Связи: @ManyToOne с Goal, @OneToMany с ReportAnswer
  - Индексы: `@Index(['goal_id', 'is_active'])`

- [ ] **1.2** Создать `src/entities/report-answer.entity.ts`
  - Поля: id, report_id, question_id, answer_text, answer_number, answer_bool, createdAt
  - Связи: @ManyToOne с Report (onDelete: CASCADE), @ManyToOne с GoalQuestion
  - Индексы: `@Index(['report_id'])`, `@Index(['question_id'])`, `@Index(['answer_number'])`

- [ ] **1.3** Обновить `src/entities/goal.entity.ts`
  - Удалить: `@Column('simple-json') question_config`
  - Добавить: `@OneToMany(() => GoalQuestion, (q) => q.goal) questions: GoalQuestion[]`

- [ ] **1.4** Обновить `src/entities/report.entity.ts`
  - Удалить: `@Column('simple-json') answers: ReportAnswer[]` и интерфейс ReportAnswer
  - Добавить: `@OneToMany(() => ReportAnswer, (a) => a.report, { cascade: true }) answers: ReportAnswer[]`

- [ ] **1.5** Добавить новые entities в `app.module.ts`
  - В `TypeOrmModule.forRoot()`: добавить `GoalQuestion`, `ReportAnswer` в entities
  - В `TypeOrmModule.forFeature()`: добавить `GoalQuestion`, `ReportAnswer`

---

### Этап 2: Обновление сервисов

#### 2.1 GoalService

- [ ] **2.1.1** Добавить `@InjectRepository(GoalQuestion)`
- [ ] **2.1.2** Метод создания цели — создавать Goal + N записей GoalQuestion
  ```ts
  async createGoal(data: CreateGoalDto): Promise<Goal> {
    const goal = await this.goalRepo.save({ /* goal data */ });
    
    const questions = data.questions.map((q, index) => 
      this.goalQuestionRepo.create({
        goal_id: goal.id,
        question: q.question,
        type: q.type,
        can_skip: q.canSkip,
        order_index: index,
        is_active: true
      })
    );
    
    await this.goalQuestionRepo.save(questions);
    return goal;
  }
  ```

- [ ] **2.1.3** Метод получения цели с вопросами:
  ```ts
  async findById(id: number): Promise<Goal> {
    return this.goalRepo.findOne({
      where: { id },
      relations: ['questions'],
      order: { questions: { order_index: 'ASC' } }
    });
  }
  ```

- [ ] **2.1.4** Метод обновления вопросов (soft delete старых + создание новых)

#### 2.2 ReportService

- [ ] **2.2.1** Добавить `@InjectRepository(ReportAnswer)`
- [ ] **2.2.2** Удалить метод `addAnswer(reportId, question, answer, type)`
- [ ] **2.2.3** Создать новый метод с нормализацией:
  ```ts
  async addAnswer(
    reportId: number,
    questionId: number,
    answerText: string
  ): Promise<void> {
    const question = await this.goalQuestionRepo.findOne({ 
      where: { id: questionId } 
    });
    if (!question) throw new Error('Question not found');
    
    const normalized = this.normalizeAnswer(answerText, question.type);
    
    const answer = this.reportAnswerRepo.create({
      report_id: reportId,
      question_id: questionId,
      answer_text: answerText,
      answer_number: normalized.answer_number,
      answer_bool: normalized.answer_bool
    });
    
    await this.reportAnswerRepo.save(answer);
  }
  
  private normalizeAnswer(answer: string, type: string) {
    const trimmed = answer.trim();
    const lower = trimmed.toLowerCase();
    
    let answer_number: number | null = null;
    let answer_bool: boolean | null = null;
    
    if (type === 'number' || type === 'rating') {
      const n = Number(trimmed.replace(',', '.'));
      if (!isNaN(n)) answer_number = n;
    }
    
    if (type === 'yes_no') {
      if (['да', 'yes', 'true', '1'].includes(lower)) answer_bool = true;
      if (['нет', 'no', 'false', '0'].includes(lower)) answer_bool = false;
    }
    
    return { answer_number, answer_bool };
  }
  ```

- [ ] **2.2.4** Обновить метод `hasReportToday()` — работает без изменений

- [ ] **2.2.5** Создать метод валидации обязательных вопросов:
  ```ts
  async canCompleteReport(reportId: number): Promise<{
    canComplete: boolean;
    missingQuestions: GoalQuestion[];
  }> {
    const report = await this.reportRepo.findOne({
      where: { id: reportId },
      relations: ['goal', 'goal.questions', 'answers']
    });
    
    const requiredQuestions = report.goal.questions.filter(
      q => q.is_active && !q.can_skip
    );
    
    const answeredIds = report.answers.map(a => a.question_id);
    
    const missingQuestions = requiredQuestions.filter(
      q => !answeredIds.includes(q.id)
    );
    
    return {
      canComplete: missingQuestions.length === 0,
      missingQuestions
    };
  }
  ```

- [ ] **2.2.6** Обновить `completeReport()` — добавить валидацию перед status='completed'

---

### Этап 3: Обновление ReportScene

- [ ] **3.1** Обновить `@SceneEnter()`:
  - Загружать цели с вопросами: `relations: ['questions']`
  - Фильтровать только активные вопросы: `questions.filter(q => q.is_active)`

- [ ] **3.2** Обновить `selectGoal()`:
  - В сессию сохранять массив GoalQuestion вместо конфига
  - `ctx.session.questions = goal.questions.filter(q => q.is_active).sort((a,b) => a.order_index - b.order_index)`

- [ ] **3.3** Обновить `askQuestion()`:
  - Принимать `GoalQuestion` вместо конфига
  - **Добавить кнопку "Пропустить" если `question.can_skip === true`:**
    ```ts
    if (question.can_skip) {
      buttons.push([
        { text: '⏭ Пропустить', callback_data: 'skip_question' }
      ]);
    }
    ```

- [ ] **3.4** Обновить `processAnswer()`:
  - Вызывать `reportService.addAnswer(reportId, question.id, answerText)`
  - Передавать `question_id` вместо текста вопроса

- [ ] **3.5** Добавить обработчик пропуска:
  ```ts
  @Action('skip_question')
  async skipQuestion(@Ctx() ctx: SceneContext) {
    await ctx.answerCbQuery('✓ Вопрос пропущен');
    
    // НЕ создаём запись в report_answers (Lazy Insert)
    
    // Переход к следующему вопросу
    ctx.session.currentQuestionIndex++;
    
    if (ctx.session.currentQuestionIndex >= ctx.session.questions.length) {
      // Все вопросы пройдены
      const validation = await this.reportService.canCompleteReport(
        ctx.session.reportId
      );
      
      if (validation.canComplete) {
        await this.reportService.completeReport(ctx.session.reportId);
        await ctx.reply('✅ Отчет сохранен!');
        // ... остальная логика
      } else {
        // Показать пропущенные обязательные
        await this.showMissingRequired(ctx, validation.missingQuestions);
      }
    } else {
      const nextQuestion = ctx.session.questions[ctx.session.currentQuestionIndex];
      await this.askQuestion(ctx, nextQuestion);
    }
  }
  ```

- [ ] **3.6** Добавить метод показа пропущенных обязательных:
  ```ts
  private async showMissingRequired(
    ctx: SceneContext, 
    questions: GoalQuestion[]
  ) {
    let message = '⚠️ Пропущены обязательные вопросы:\n\n';
    questions.forEach((q, i) => {
      message += `${i + 1}. ${q.question}\n`;
    });
    message += '\nВернуться к ним?';
    
    await ctx.reply(message, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '✅ Вернуться', callback_data: 'return_to_missing' }],
          [{ text: '❌ Отменить отчёт', callback_data: 'cancel_report' }]
        ]
      }
    });
  }
  ```

---

### Этап 4: Дополнительные задачи

- [ ] **4.1** Добавить cronjob для пометки expired отчётов:
  ```ts
  // В main.ts или app.module.ts добавить:
  import { ScheduleModule } from '@nestjs/schedule';
  
  // В ReportService:
  @Cron('59 23 * * *') // каждый день в 23:59
  async expireOldReports() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    await this.reportRepo.update(
      { 
        status: 'in_progress',
        createdAt: LessThan(today)
      },
      { status: 'expired' }
    );
  }
  ```

- [ ] **4.2** Обновить типы в `src/types/question-types.ts` — убрать `QuestionConfig` если не используется

- [ ] **4.3** Тесты: обновить `test/questions.test.ts` под новую структуру

---

### Этап 5: Миграция данных (есть 4 цели и 5 отчётов)

**✅ Скрипт миграции создан:** `scripts/migrate-to-new-schema.ts`

**Что делает скрипт:**
1. Создаёт новые таблицы `goal_questions` и `report_answers`
2. Читает `goals.question_config` (JSON) → создаёт записи в `goal_questions`
3. Читает `reports.answers` (JSON) → создаёт записи в `report_answers`
4. Нормализует ответы (answer_number, answer_bool)
5. Создаёт бэкап таблицы `_backup_goals` и `_backup_reports`
6. Выводит подробную статистику

**Запуск миграции:**

- [ ] **5.1** Установить зависимости (если нужно):
  ```bash
  npm install
  ```

- [ ] **5.2** Запустить скрипт миграции:
  ```bash
  npx ts-node --project tsconfig.json scripts/migrate-to-new-schema.ts
  ```

- [ ] **5.3** Проверить вывод скрипта — должно быть:
  ```
  ✅ Миграция завершена успешно!
  Целей: 4
  Вопросов: ~8 (по 2 вопроса на цель)
  Отчётов: 5
  Ответов: ~10
  ```

- [ ] **5.4** Проверить данные в новых таблицах:
  ```bash
  sqlite3 data/database.sqlite "SELECT COUNT(*) FROM goal_questions;"
  sqlite3 data/database.sqlite "SELECT COUNT(*) FROM report_answers;"
  ```

- [ ] **5.5** Проверить пример данных:
  ```bash
  sqlite3 data/database.sqlite "SELECT gq.question, ra.answer_text FROM report_answers ra JOIN goal_questions gq ON ra.question_id = gq.id LIMIT 5;"
  ```

**После успешной миграции:**
- Старые колонки `question_config` и `answers` останутся в БД (SQLite не позволяет легко удалить колонки)
- Бэкап в таблицах `_backup_goals` и `_backup_reports`
- Можно удалить бэкап после тестирования: `DROP TABLE _backup_goals; DROP TABLE _backup_reports;`

---

## Примеры аналитики после миграции

### Средняя оценка продуктивности за месяц
```sql
SELECT 
  gq.question,
  AVG(ra.answer_number) as avg_rating,
  COUNT(*) as total_answers
FROM report_answers ra
JOIN goal_questions gq ON ra.question_id = gq.id
JOIN reports r ON ra.report_id = r.id
WHERE gq.type = 'rating'
  AND r.status = 'completed'
  AND r.createdAt >= date('now', '-30 days')
GROUP BY gq.id;
```

### Какие вопросы чаще пропускают
```sql
SELECT 
  gq.question,
  COUNT(DISTINCT r.id) as total_reports,
  COUNT(ra.id) as answered_count,
  COUNT(DISTINCT r.id) - COUNT(ra.id) as skipped_count,
  ROUND((COUNT(DISTINCT r.id) - COUNT(ra.id)) * 100.0 / COUNT(DISTINCT r.id), 1) as skip_rate
FROM goal_questions gq
CROSS JOIN reports r
LEFT JOIN report_answers ra 
  ON ra.question_id = gq.id 
  AND ra.report_id = r.id
WHERE r.goal_id = gq.goal_id
  AND r.status = 'completed'
  AND gq.is_active = true
  AND gq.can_skip = true
GROUP BY gq.id
ORDER BY skip_rate DESC;
```

### Пропуски по дням
```sql
SELECT 
  DATE(r.createdAt) as report_date,
  COUNT(*) as total_questions,
  COUNT(ra.id) as answered,
  COUNT(*) - COUNT(ra.id) as skipped
FROM reports r
CROSS JOIN goal_questions gq
LEFT JOIN report_answers ra 
  ON ra.report_id = r.id 
  AND ra.question_id = gq.id
WHERE r.status = 'completed'
  AND gq.goal_id = r.goal_id
  AND gq.is_active = true
GROUP BY DATE(r.createdAt)
ORDER BY report_date DESC;
```

---

## Чеклист перед деплоем

- [ ] Все entity созданы и связи настроены
- [ ] TypeORM synchronize обновил БД (или миграции применены)
- [ ] Старые данные мигрированы (если нужно)
- [ ] Тесты проходят
- [ ] Бот работает: создание отчёта, пропуск вопросов, завершение
- [ ] Cronjob для expired настроен
- [ ] Аналитика работает (тестовые запросы)
