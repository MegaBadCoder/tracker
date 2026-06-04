export type QuestionType =
  | 'text'
  | 'rating'
  | 'emoji_rating'
  | 'yes_no'
  | 'number'
  | 'time_spent'
  | 'photo';

export interface QuestionTypeConfig {
  type: QuestionType;
  label: string;
  description: string;
  example: string;
  options?: string[] | number[];
  ui_component: string;
}

export const QUESTION_TYPES: Record<QuestionType, QuestionTypeConfig> = {
  text: {
    type: 'text',
    label: 'Текстовый ввод',
    description: 'Свободный текстовый ответ',
    example: 'Что сделал сегодня?',
    options: undefined,
    ui_component: 'textarea',
  },
  rating: {
    type: 'rating',
    label: 'Оценка (числа)',
    description: 'Числовая оценка по шкале',
    example: 'Оцени продуктивность (1-5)',
    options: [1, 2, 3, 4, 5],
    ui_component: 'buttons/slider',
  },
  emoji_rating: {
    type: 'emoji_rating',
    label: 'Оценка (смайлики)',
    description: 'Оценка эмоджи',
    example: 'Как прошёл день?',
    options: ['😕', '😐', '🙂', '😊', '🔥'],
    ui_component: 'emoji_buttons',
  },
  yes_no: {
    type: 'yes_no',
    label: 'Да/Нет',
    description: 'Бинарный выбор',
    example: 'Выполнил запланированное?',
    options: ['Да', 'Нет'],
    ui_component: 'inline_buttons',
  },
  number: {
    type: 'number',
    label: 'Число',
    description: 'Числовое значение',
    example: 'Сколько страниц написал?',
    ui_component: 'number_input',
  },
  time_spent: {
    type: 'time_spent',
    label: 'Затраченное время',
    description: 'Диапазон времени',
    example: 'Сколько времени потратил?',
    options: ['<30 мин', '30-60', '1-2ч', '2+ч'],
    ui_component: 'buttons',
  },
  photo: {
    type: 'photo',
    label: 'Фото',
    description: 'Фотография на дату',
    example: 'Сделай фото себя сегодня',
    ui_component: 'photo_upload',
  },
};

export interface QuestionConfig {
  type: QuestionType;
  question: string;
  canSkip: boolean;
  options?: string[];
  validation?: Record<string, any>;
}
