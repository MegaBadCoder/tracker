import { Command, Ctx, Hears, On, Start, Update } from 'nestjs-telegraf';
import { Context, Scenes } from 'telegraf';
import { Telegraf } from 'telegraf';
import { OnModuleInit } from '@nestjs/common';
import { InjectBot } from 'nestjs-telegraf';
import {
  GOALS_MENU_KEYBOARD,
  MAIN_MENU_KEYBOARD,
} from '../../shared/constants/keyboards';
import { AuthService } from '../auth/auth.service';

interface BotContext extends Context {
  scene: Scenes.SceneContextScene<BotContext>;
}

@Update()
export class BotUpdate implements OnModuleInit {
  constructor(
    private readonly authService: AuthService,
    @InjectBot() private readonly bot: Telegraf,
  ) {}

  async onModuleInit() {
    const url = process.env.WEBAPP_URL;
    if (!url) {
      console.warn('[BotUpdate] WEBAPP_URL is not set, skipping menu button');
      return;
    }

    try {
      await this.bot.telegram.setChatMenuButton({
        menuButton: {
          type: 'web_app',
          text: 'Открыть трекер',
          web_app: { url },
        },
      });
      console.log(`[BotUpdate] Menu button set to ${url}`);
    } catch (error) {
      console.error('[BotUpdate] Failed to set menu button:', error);
    }
  }

  private getMainMenuKeyboard() {
    return MAIN_MENU_KEYBOARD;
  }

  private getGoalsMenuKeyboard() {
    return GOALS_MENU_KEYBOARD;
  }

  @Start()
  async start(@Ctx() ctx: BotContext) {
    if (!ctx.from) return;

    const telegramId = ctx.from.id;
    const username = ctx.from.username;
    const firstName = ctx.from.first_name;

    const user = await this.authService.findOrCreateTelegramUser(telegramId, {
      username,
      firstName,
    });

    await ctx.reply(
      `Привет, ${user.firstName || 'друг'}! Я Alfy бот 👋\n\nВыбери действие из меню ниже:`,
      this.getMainMenuKeyboard(),
    );
  }

  @Command('menu')
  async menu(@Ctx() ctx: BotContext) {
    await ctx.reply('📱 Главное меню:', this.getMainMenuKeyboard());
  }

  @Command('help')
  @Hears('ℹ️ Помощь')
  async help(@Ctx() ctx: BotContext) {
    const helpMessage = `
📋 Доступные команды:

/start - Начать работу с ботом
/menu - Показать главное меню
/report - Создать отчет по цели
/cancel - Отменить текущее действие
/help - Показать это сообщение

📱 Используй кнопки меню для быстрого доступа к функциям!
    `.trim();

    await ctx.reply(helpMessage);
  }

  @Command('cancel')
  async cancel(@Ctx() ctx: BotContext) {
    await ctx.scene.leave();
    await ctx.reply(
      '❌ Действие отменено. Возвращаю в главное меню.',
      this.getMainMenuKeyboard(),
    );
  }

  @Hears('📋 Цели')
  async goalsMenu(@Ctx() ctx: BotContext) {
    await ctx.reply(
      '📋 Раздел "Цели"\n\nВыбери действие:',
      this.getGoalsMenuKeyboard(),
    );
  }

  @Command('report')
  @Hears('📊 Создать отчет')
  async report(@Ctx() ctx: BotContext) {
    await ctx.scene.enter('report');
  }

  @Hears('📝 Список целей')
  async myGoals(@Ctx() ctx: BotContext) {
    await ctx.scene.enter('list-goals');
  }

  @Hears('➕ Добавить цель')
  async addGoal(@Ctx() ctx: BotContext) {
    await ctx.scene.enter('create-goal');
  }

  @Hears('✏️ Редактировать цель')
  async editGoal(@Ctx() ctx: BotContext) {
    await ctx.scene.enter('edit-goal');
  }

  @Hears('📈 Статистика')
  async statistics(@Ctx() ctx: BotContext) {
    await ctx.reply('🚧 Раздел "Статистика" в разработке');
  }

  @Hears('⬅️ Назад в главное меню')
  async backToMain(@Ctx() ctx: BotContext) {
    await ctx.reply('📱 Главное меню:', this.getMainMenuKeyboard());
  }

  @Hears('⚙️ Настройки')
  async settings(@Ctx() ctx: BotContext) {
    await ctx.reply('🚧 Раздел "Настройки" в разработке');
  }

  @On('text')
  async onText(@Ctx() ctx: BotContext) {
    if (!ctx.message || !('text' in ctx.message)) return;

    const text = ctx.message.text;

    if (
      text.startsWith('/') ||
      text.includes('📋') ||
      text.includes('📊') ||
      text.includes('📝') ||
      text.includes('➕') ||
      text.includes('✏️') ||
      text.includes('📈') ||
      text.includes('⬅️') ||
      text.includes('⚙️') ||
      text.includes('ℹ️')
    ) {
      return;
    }

    await ctx.reply(
      '👋 Привет! Используй /menu чтобы увидеть доступные команды.',
    );
  }
}
