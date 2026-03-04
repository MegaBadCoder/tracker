import { DataSource } from 'typeorm';

/**
 * Миграция: убираем зависимость от таблицы reports
 *
 * 1. Добавляет user_id и scheduled_date в report_answers
 * 2. Бэкфиллит из reports
 * 3. Убирает report_id
 */

async function migrate() {
  console.log('🚀 Миграция report_answers: убираем reports...\n');

  const dataSource = new DataSource({
    type: 'sqlite',
    database: 'data/database.sqlite',
    synchronize: false,
  });

  await dataSource.initialize();
  console.log('✅ Подключение к БД установлено\n');

  try {
    // Проверяем, есть ли уже новые колонки
    const columns = await dataSource.query(`PRAGMA table_info(report_answers)`);
    const columnNames = columns.map((c: { name: string }) => c.name);

    if (columnNames.includes('scheduled_date') && columnNames.includes('user_id')) {
      console.log('⚠️  Колонки scheduled_date и user_id уже существуют. Пропускаем.');
      await dataSource.destroy();
      return;
    }

    // Шаг 1: Создаём новую таблицу
    console.log('📋 Шаг 1: Создание новой таблицы report_answers_new...');

    await dataSource.query(`
      CREATE TABLE report_answers_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        question_id INTEGER NOT NULL,
        scheduled_date TEXT NOT NULL,
        answer_text TEXT NOT NULL,
        answer_number REAL,
        answer_bool INTEGER,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (question_id) REFERENCES goal_questions(id)
      )
    `);

    // Шаг 2: Бэкфилл из reports
    console.log('📋 Шаг 2: Бэкфилл данных из reports...');

    const result = await dataSource.query(`
      INSERT INTO report_answers_new (id, user_id, question_id, scheduled_date, answer_text, answer_number, answer_bool, createdAt)
      SELECT
        ra.id,
        r.user_id,
        ra.question_id,
        COALESCE(r.scheduled_date, DATE(r.createdAt)),
        ra.answer_text,
        ra.answer_number,
        ra.answer_bool,
        ra.createdAt
      FROM report_answers ra
      JOIN reports r ON r.id = ra.report_id
      WHERE r.status = 'completed'
    `);

    const count = await dataSource.query('SELECT COUNT(*) as cnt FROM report_answers_new');
    console.log(`✅ Перенесено записей: ${count[0].cnt}`);

    // Шаг 3: Заменяем таблицу
    console.log('📋 Шаг 3: Замена таблицы...');

    await dataSource.query('DROP TABLE report_answers');
    await dataSource.query('ALTER TABLE report_answers_new RENAME TO report_answers');

    // Шаг 4: Создаём индексы
    console.log('📋 Шаг 4: Создание индексов...');

    await dataSource.query(`
      CREATE INDEX idx_report_answers_question_date
      ON report_answers(question_id, scheduled_date)
    `);

    await dataSource.query(`
      CREATE INDEX idx_report_answers_user_date
      ON report_answers(user_id, scheduled_date)
    `);

    await dataSource.query(`
      CREATE INDEX idx_report_answers_number
      ON report_answers(answer_number)
    `);

    console.log('✅ Индексы созданы');

    // Статистика
    const stats = await dataSource.query(`
      SELECT COUNT(DISTINCT user_id) as users,
             COUNT(DISTINCT question_id) as questions,
             COUNT(DISTINCT scheduled_date) as dates,
             COUNT(*) as total
      FROM report_answers
    `);

    console.log('\n📊 Статистика:');
    console.log(`   Пользователей: ${stats[0].users}`);
    console.log(`   Вопросов: ${stats[0].questions}`);
    console.log(`   Уникальных дат: ${stats[0].dates}`);
    console.log(`   Всего ответов: ${stats[0].total}`);

    console.log('\n✅ Миграция завершена!');
    console.log('\n⚠️  Таблица reports осталась в БД (можно удалить позже)');

  } catch (error) {
    console.error('\n❌ Ошибка миграции:', error);
    throw error;
  } finally {
    await dataSource.destroy();
  }
}

migrate().catch(console.error);
