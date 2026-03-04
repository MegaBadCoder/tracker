-- Миграция: переименование telegram_user_id в user_id

-- Переименовать колонку в таблице goals
ALTER TABLE goals RENAME COLUMN telegram_user_id TO user_id;

-- Переименовать колонку в таблице reports
ALTER TABLE reports RENAME COLUMN telegram_user_id TO user_id;

-- Проверка результата
SELECT 'Goals table:' as check_name;
PRAGMA table_info(goals);

SELECT 'Reports table:' as check_name;
PRAGMA table_info(reports);
