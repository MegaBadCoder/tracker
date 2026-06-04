import { Command, Ctx, Hears, On, Start, Update } from 'nestjs-telegraf';
import { Context, Scenes } from 'telegraf';
import { Telegraf } from 'telegraf';
import { OnModuleInit } from '@nestjs/common';
import { NotFoundException } from '@nestjs/common';
import { InjectBot } from 'nestjs-telegraf';
import {
  GOALS_MENU_KEYBOARD,
  MAIN_MENU_KEYBOARD,
} from '../../shared/constants/keyboards';
import { AuthService } from '../auth/auth.service';
import { ApiTokenService } from '../auth/application/api-token.service';

interface BotContext extends Context {
  scene: Scenes.SceneContextScene<BotContext>;
}

@Update()
export class BotUpdate implements OnModuleInit {
  constructor(
    private readonly authService: AuthService,
    private readonly apiTokenService: ApiTokenService,
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

  @Command('mcp_token')
  async issueToken(@Ctx() ctx: Context) {
    if (!ctx.from || !ctx.message || !('text' in ctx.message)) return;

    const parts = ctx.message.text.trim().split(/\s+/);
    const name = parts.slice(1).join(' ').trim();

    if (!name) {
      await ctx.reply(
        'Использование: /mcp_token <name>\nПример: /mcp_token claude-desktop',
      );
      return;
    }

    const user = await this.authService.findOrCreateTelegramUser(
      ctx.from.id,
      {},
    );
    const { id, plaintext } = await this.apiTokenService.generate(
      user.id,
      name,
    );

    await ctx.reply(
      `🔑 Токен создан:\n\`${plaintext}\`\n\nid=${id} | name=${name}\n\n⚠️ Сохрани сейчас — повторно показан не будет.`,
      { parse_mode: 'Markdown' },
    );
  }

  @Command('mcp_tokens')
  async listTokens(@Ctx() ctx: Context) {
    if (!ctx.from) return;

    const user = await this.authService.findOrCreateTelegramUser(
      ctx.from.id,
      {},
    );
    const tokens = await this.apiTokenService.list(user.id);

    if (tokens.length === 0) {
      await ctx.reply('Нет активных токенов. /mcp_token <name> чтобы создать.');
      return;
    }

    const lines = tokens.map((t) => {
      const lastUsed = t.last_used_at ? t.last_used_at.toISOString() : 'never';
      const created = t.created_at.toISOString();
      return `id=${t.id} | name=${t.name} | prefix=${t.prefix}… | last_used=${lastUsed} | created=${created}`;
    });

    await ctx.reply(`Активные токены:\n\n${lines.join('\n')}`);
  }

  @Command('mcp_token_revoke')
  async revokeToken(@Ctx() ctx: Context) {
    if (!ctx.from || !ctx.message || !('text' in ctx.message)) return;

    const parts = ctx.message.text.trim().split(/\s+/);
    const rawId = parts[1];
    const id = Number(rawId);

    if (!rawId || !Number.isInteger(id) || id <= 0) {
      await ctx.reply(
        'Использование: /mcp_token_revoke <id>\nПример: /mcp_token_revoke 42',
      );
      return;
    }

    const user = await this.authService.findOrCreateTelegramUser(
      ctx.from.id,
      {},
    );

    try {
      await this.apiTokenService.revoke(id, user.id);
      await ctx.reply(`✅ Токен #${id} отозван.`);
    } catch (err) {
      if (err instanceof NotFoundException) {
        await ctx.reply(`Токен не найден (id=${id}).`);
        return;
      }
      throw err;
    }
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
