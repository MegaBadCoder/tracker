import { DataSource } from 'typeorm';

/**
 * Скрипт миграции данных из старой схемы в новую
 * 
 * Старая схема:
 * - goals.question_config = JSON массив вопросов
 * - reports.answers = JSON массив ответов
 * 
 * Новая схема:
 * - goal_questions - отдельная таблица
 * - report_answers - отдельная таблица
 */

interface OldQuestionConfig {
  type: string;
  question: string;
  canSkip: boolean;
}

interface OldAnswer {
  question: string;
  answer: string;
  type: string;
}

interface OldGoal {
  id: number;
  user_id: number;
  goal_name: string;
  goal_start: string;
  goal_end: string;
  status: string;
  question_config: string; // JSON string
  createdAt: Date;
}

interface OldReport {
  id: number;
  user_id: number;
  goal_id: number;
  status: string;
  answers: string; // JSON string
  createdAt: Date;
  updatedAt: Date;
}

async function migrate() {
  console.log('🚀 Начало миграции данных...\n');

  const dataSource = new DataSource({
    type: 'sqlite',
    database: 'data/database.sqlite',
    synchronize: false, // Важно! Не перезаписываем схему
  });

  await dataSource.initialize();
  console.log('✅ Подключение к БД установлено\n');

  try {
    // Шаг 1: Создать новые таблицы вручную (если synchronize был false)
    console.log('📋 Шаг 1: Создание новых таблиц...');
    
    await dataSource.query(`
      CREATE TABLE IF NOT EXISTS goal_questions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        goal_id INTEGER NOT NULL,
        question TEXT NOT NULL,
        type TEXT NOT NULL,
        can_skip INTEGER DEFAULT 0,
        order_index INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE CASCADE
      )
    `);

    await dataSource.query(`
      CREATE INDEX IF NOT EXISTS idx_goal_questions_goal_active 
      ON goal_questions(goal_id, is_active)
    `);

    await dataSource.query(`
      CREATE INDEX IF NOT EXISTS idx_goal_questions_goal_order 
      ON goal_questions(goal_id, order_index)
    `);

    await dataSource.query(`
      CREATE TABLE IF NOT EXISTS report_answers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        report_id INTEGER NOT NULL,
        question_id INTEGER NOT NULL,
        answer_text TEXT NOT NULL,
        answer_number REAL,
        answer_bool INTEGER,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE,
        FOREIGN KEY (question_id) REFERENCES goal_questions(id)
      )
    `);

    await dataSource.query(`
      CREATE INDEX IF NOT EXISTS idx_report_answers_report 
      ON report_answers(report_id)
    `);

    await dataSource.query(`
      CREATE INDEX IF NOT EXISTS idx_report_answers_question 
      ON report_answers(question_id)
    `);

    await dataSource.query(`
      CREATE INDEX IF NOT EXISTS idx_report_answers_number 
      ON report_answers(answer_number)
    `);

    console.log('✅ Таблицы созданы\n');

    // Шаг 2: Мигрировать вопросы из goals.question_config
    console.log('📋 Шаг 2: Миграция вопросов из goals...');
    
    const oldGoals = await dataSource.query(
      'SELECT * FROM goals'
    ) as OldGoal[];

    console.log(`Найдено целей: ${oldGoals.length}`);

    const questionMap = new Map<string, number>(); // "goal_id:question_text" -> question_id

    for (const goal of oldGoals) {
      try {
        const questionConfig: OldQuestionConfig[] = JSON.parse(goal.question_config);
        
        console.log(`  Цель #${goal.id}: "${goal.goal_name.slice(0, 50)}..."`);
        console.log(`    Вопросов: ${questionConfig.length}`);

        for (let i = 0; i < questionConfig.length; i++) {
          const q = questionConfig[i];
          
          await dataSource.query(
            `INSERT INTO goal_questions 
             (goal_id, question, type, can_skip, order_index, is_active, createdAt) 
             VALUES (?, ?, ?, ?, ?, 1, ?)`,
            [
              goal.id,
              q.question,
              q.type,
              q.canSkip ? 1 : 0,
              i,
              goal.createdAt
            ]
          );

          // Получаем ID только что вставленной записи
          const result = await dataSource.query(
            `SELECT id FROM goal_questions WHERE goal_id = ? AND question = ? AND order_index = ?`,
            [goal.id, q.question, i]
          );

          const questionId = result[0].id;
          const key = `${goal.id}:${q.question}`;
          questionMap.set(key, questionId);

          console.log(`      ✓ Вопрос ${i + 1}: "${q.question.slice(0, 40)}..." -> ID ${questionId}`);
        }
      } catch (error) {
        console.error(`    ❌ Ошибка при обработке цели #${goal.id}:`, error.message);
      }
    }

    console.log(`✅ Создано вопросов: ${questionMap.size}\n`);

    // Шаг 3: Мигрировать ответы из reports.answers
    console.log('📋 Шаг 3: Миграция ответов из reports...');
    
    const oldReports = await dataSource.query(
      'SELECT * FROM reports'
    ) as OldReport[];

    console.log(`Найдено отчётов: ${oldReports.length}`);

    let migratedAnswers = 0;
    let skippedAnswers = 0;

    for (const report of oldReports) {
      try {
        const answers: OldAnswer[] = JSON.parse(report.answers);
        
        console.log(`  Отчёт #${report.id} (goal_id: ${report.goal_id}, status: ${report.status})`);
        console.log(`    Ответов: ${answers.length}`);

        for (const ans of answers) {
          const key = `${report.goal_id}:${ans.question}`;
          const questionId = questionMap.get(key);

          if (!questionId) {
            console.warn(`    ⚠️  Вопрос не найден: "${ans.question.slice(0, 40)}..."`);
            skippedAnswers++;
            continue;
          }

          // Нормализация ответа
          let answerNumber: number | null = null;
          let answerBool: number | null = null;

          if (ans.type === 'rating' || ans.type === 'number') {
            const n = Number(ans.answer.replace(',', '.'));
            if (!isNaN(n)) answerNumber = n;
          }

          if (ans.type === 'yes_no') {
            const lower = ans.answer.toLowerCase().trim();
            if (['да', 'yes', 'true', '1'].includes(lower)) answerBool = 1;
            if (['нет', 'no', 'false', '0'].includes(lower)) answerBool = 0;
          }

          await dataSource.query(
            `INSERT INTO report_answers 
             (report_id, question_id, answer_text, answer_number, answer_bool, createdAt) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
              report.id,
              questionId,
              ans.answer,
              answerNumber,
              answerBool,
              report.createdAt
            ]
          );

          migratedAnswers++;
          console.log(`      ✓ "${ans.question.slice(0, 30)}..." -> "${ans.answer.slice(0, 20)}..."`);
        }
      } catch (error) {
        console.error(`    ❌ Ошибка при обработке отчёта #${report.id}:`, error.message);
      }
    }

    console.log(`✅ Создано ответов: ${migratedAnswers}`);
    if (skippedAnswers > 0) {
      console.log(`⚠️  Пропущено ответов (не найден вопрос): ${skippedAnswers}`);
    }
    console.log();

    // Шаг 4: Создать бэкап старых колонок и удалить их
    console.log('📋 Шаг 4: Очистка старых данных...');
    
    // Бэкап (на всякий случай)
    await dataSource.query(`
      CREATE TABLE IF NOT EXISTS _backup_goals AS 
      SELECT id, question_config FROM goals
    `);
    
    await dataSource.query(`
      CREATE TABLE IF NOT EXISTS _backup_reports AS 
      SELECT id, answers FROM reports
    `);

    console.log('✅ Бэкап создан в таблицах _backup_goals и _backup_reports');

    // Удаление старых колонок в SQLite требует пересоздания таблицы
    console.log('⚠️  ВНИМАНИЕ: Для удаления старых колонок нужно пересоздать таблицы');
    console.log('   Это можно сделать позже через TypeORM synchronize или вручную');
    console.log('   Пока старые колонки остаются, но не используются\n');

    // Статистика
    console.log('📊 Статистика миграции:');
    console.log(`   Целей: ${oldGoals.length}`);
    console.log(`   Вопросов: ${questionMap.size}`);
    console.log(`   Отчётов: ${oldReports.length}`);
    console.log(`   Ответов: ${migratedAnswers}`);
    if (skippedAnswers > 0) {
      console.log(`   Пропущено: ${skippedAnswers}`);
    }

    console.log('\n✅ Миграция завершена успешно!');
    console.log('\n📝 Следующие шаги:');
    console.log('   1. Проверь данные в новых таблицах');
    console.log('   2. Обнови код приложения под новую схему');
    console.log('   3. Протестируй создание новых отчётов');
    console.log('   4. Если всё ок - можешь удалить бэкап таблицы:\n');
    console.log('      DROP TABLE _backup_goals;');
    console.log('      DROP TABLE _backup_reports;\n');

  } catch (error) {
    console.error('\n❌ Ошибка миграции:', error);
    throw error;
  } finally {
    await dataSource.destroy();
  }
}

migrate().catch(console.error);
