import { Markup } from 'telegraf';

export const GOALS_MENU_KEYBOARD = Markup.keyboard([
  ['📊 Создать отчет', '📝 Список целей'],
  ['➕ Добавить цель', '✏️ Редактировать цель'],
  ['📈 Статистика', '⬅️ Назад в главное меню'],
]).resize();

export const MAIN_MENU_KEYBOARD = Markup.keyboard([
  ['📋 Цели'],
  ['⚙️ Настройки'],
  ['ℹ️ Помощь'],
]).resize();
