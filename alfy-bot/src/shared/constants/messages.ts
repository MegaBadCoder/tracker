export const MESSAGES = {
  GOAL_CREATION: {
    CHOOSE_TYPE: 'Какую цель хочешь поставить?',
    ENTER_NAME: 'Какая у тебя цель?',
    CHOOSE_START: 'Когда начинаешь?',
    CHOOSE_END: 'До какого числа?',
    SUCCESS: '✅ Цель поставлена!',
    TYPE_IN_DEVELOPMENT:
      '🚧 Этот тип цели в разработке\n\nПока доступны только простые цели.',
  },
  SMART: {
    QUESTIONS_STUB:
      '🎯 SMART вопросы (скоро)\n\nЗдесь будут вопросы по SMART с помощью LLM',
  },
  GLOBAL: {
    QUESTIONS_STUB:
      '🌍 Global параметры (скоро)\n\nЗдесь будут вопросы для глобальной цели',
  },
  POINT_A: {
    QUESTION: 'Зафиксировать точку A? (текущее состояние)',
  },
  GOALS_LIST: {
    TITLE: 'Твои цели',
    NO_GOALS: 'У тебя пока нет целей',
    NO_ACTIVE: 'Нет активных целей',
    NO_COMPLETED: 'Нет достигнутых целей',
    NO_DELETED: 'Нет удалённых целей',
    SHOWING_FIRST: (count: number, total: number) =>
      `Показаны первые ${count} из ${total} целей`,
    VIEW_ALL_WEBAPP: 'Смотреть все в WebApp',
    GOAL_DETAILS: 'Подробнее',
    DELETE: 'Удалить',
    ACHIEVED: 'Достигнута',
    ACTIVATE: 'Активировать',
    GOAL_COMPLETED: '✅ Цель отмечена как достигнутая!',
    GOAL_DELETED: '🗑 Цель удалена',
    GOAL_ACTIVATED: '🎯 Цель снова активна',
    ENTER_NUMBER_HINT: '\n💡 Напиши номер цели для просмотра деталей',
    INVALID_NUMBER: 'Такой цели нет. Напиши номер от 1 до ',
  },
  SCHEDULE: {
    CHOOSE_FREQUENCY: 'Как часто хочешь отчитываться?',
    DAILY: 'Каждый день',
    WEEKLY_DAYS: 'Определённые дни недели',
    INTERVAL: 'Через N дней',
    PICK_DAYS: 'Выбери дни отчёта (нажми чтобы отметить):',
    ENTER_INTERVAL: 'Через сколько дней?',
    MIN_ONE_DAY: 'Выбери хотя бы один день',
  },
  OVERDUE: {
    HAS_OVERDUE: (date: string) => `У вас есть незаполненный отчёт за ${date}.`,
    FILL: 'Заполнить',
    SKIP: 'Пропустить',
    CANCEL: 'Отменить',
  },
  QUESTION_SETUP: {
    OFFER: 'Хочешь настроить вопросы для отчётов?',
    CHOOSE_TYPE: 'Выбери тип вопроса:',
    ENTER_TEXT: (typeName: string) =>
      `Напиши текст вопроса для типа "${typeName}":`,
    CAN_SKIP: 'Можно ли пропустить этот вопрос?',
    ADDED: (count: number) => `Добавлено вопросов: ${count}`,
    DONE: 'Готово, сохранить',
    TARGET_VALUE: 'Какое эталонное значение (цель)? Это будет линия-ориентир на графике.',
    TARGET_VALUE_ERROR: 'Введи число',
    TARGET_VALUE_SKIP: 'Пропустить',
  },
  ERRORS: {
    DATE_IN_PAST: 'Дата уже прошла',
    DATE_TOO_FAR: (years: number) => `Слишком далеко (макс ${years} лет)`,
    END_BEFORE_START: 'Дата окончания должна быть позже начала',
    INVALID_FORMAT: 'Не понял дату. Попробуй: дд.мм.гггг',
  },
} as const;
