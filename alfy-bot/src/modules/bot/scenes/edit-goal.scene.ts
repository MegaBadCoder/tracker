import { Scene, SceneEnter, On, Ctx, Action, Command } from 'nestjs-telegraf';
import { Context, Scenes, Markup } from 'telegraf';
import { GOALS_MENU_KEYBOARD } from '../../../shared/constants/keyboards';
import { Goal } from '../../../shared/entities';
import { GoalService } from '../../goal/application/goal.service';
import { UserService } from '../../user/application/user.service';

interface SessionData extends Scenes.SceneSessionData {
  goalId?: number;
  currentStep?: 'name' | 'date' | 'select';
  newGoalName?: string;
  originalGoalEnd?: string;
  currentGoals?: Goal[];
  messageId?: number;
}

interface SceneContext extends Context {
  session: SessionData & Scenes.SceneSession<SessionData>;
  scene: Scenes.SceneContextScene<SceneContext>;
}

@Scene('edit-goal')
export class EditGoalScene {
  constructor(
    private goalService: GoalService,
    private userService: UserService,
  ) {}

  @SceneEnter()
  async onEnter(@Ctx() ctx: SceneContext) {
    if (!ctx.from) return;

    await ctx.reply('Редактирование цели', Markup.removeKeyboard());

    const user = await this.userService.findOrCreate(ctx.from.id, {});
    const goals = await this.goalService.findActiveByUser(user.id);

    if (goals.length === 0) {
      await ctx.reply('У тебя пока нет целей для редактирования');
      return await ctx.scene.leave();
    }

    ctx.session.currentGoals = goals;
    ctx.session.currentStep = 'select';

    const displayGoals = goals.slice(0, 5);
    let message = '✏️ Выбери цель для редактирования:\n\n';
    displayGoals.forEach((goal, index) => {
      message += `${index + 1}. ${goal.goal_name.slice(0, 100)}\n\n`;
    });

    if (goals.length > 5) {
      message += `\n... и еще ${goals.length - 5}\n\n`;
    }

    message += '💬 Введи номер цели или нажми кнопку';

    const buttons = displayGoals.map((g, index) => [
      {
        text: `${index + 1}`,
        callback_data: `goal_${g.id}`,
      },
    ]);

    buttons.push([{ text: '❌ Отмена', callback_data: 'cancel_edit' }]);

    const msg = await ctx.reply(message, {
      reply_markup: {
        inline_keyboard: buttons,
      },
    });

    ctx.session.messageId = msg.message_id;
  }

  @Action(/goal_(\d+)/)
  async selectGoal(@Ctx() ctx: SceneContext & { match: RegExpMatchArray }) {
    if (!ctx.from) return;

    const goalId = parseInt(ctx.match[1]);
    await ctx.answerCbQuery();

    if (ctx.session.messageId) {
      try {
        await ctx.deleteMessage(ctx.session.messageId);
      } catch {
        // ignore
      }
      ctx.session.messageId = undefined;
    }

    await this.startEditing(ctx, goalId);
  }

  private async startEditing(@Ctx() ctx: SceneContext, goalId: number) {
    const goal = await this.goalService.findById(goalId);

    if (!goal) {
      await ctx.reply('Цель не найдена');
      return await ctx.scene.leave();
    }

    ctx.session.goalId = goalId;
    ctx.session.currentStep = 'name';
    ctx.session.originalGoalEnd = goal.goal_end;

    await ctx.reply(
      `Редактирование цели: ${goal.goal_name.slice(0, 100)}\n\n📝 Введи новое описание цели:`,
    );
  }

  @Action('keep_date')
  async keepDate(@Ctx() ctx: SceneContext) {
    if (!ctx.session.goalId || !ctx.session.newGoalName) return;

    await ctx.answerCbQuery();

    const updatedGoal = await this.goalService.update(ctx.session.goalId, {
      goal_name: ctx.session.newGoalName,
    });

    await ctx.editMessageText(
      `✅ Цель обновлена!\n\nНовое описание: ${updatedGoal.goal_name}\nДата окончания: ${updatedGoal.goal_end}`,
    );

    await ctx.reply('📋 Раздел "Цели"', GOALS_MENU_KEYBOARD);

    ctx.session.goalId = undefined;
    ctx.session.currentStep = undefined;
    ctx.session.newGoalName = undefined;
    ctx.session.originalGoalEnd = undefined;

    return await ctx.scene.leave();
  }

  @Action('change_date')
  async changeDate(@Ctx() ctx: SceneContext) {
    await ctx.answerCbQuery();
    ctx.session.currentStep = 'date';

    await ctx.editMessageText('📅 Введи новую дату окончания цели:');
  }

  @Action('cancel_edit')
  async cancelEdit(@Ctx() ctx: SceneContext) {
    await ctx.answerCbQuery();
    await ctx.editMessageText('❌ Редактирование отменено');

    await ctx.reply('📋 Раздел "Цели"', GOALS_MENU_KEYBOARD);

    return await ctx.scene.leave();
  }

  @Command('cancel')
  async cancel(@Ctx() ctx: SceneContext) {
    await ctx.reply('❌ Редактирование отменено');

    await ctx.reply('📋 Раздел "Цели"', GOALS_MENU_KEYBOARD);

    return await ctx.scene.leave();
  }

  @On('text')
  async handleText(@Ctx() ctx: SceneContext) {
    if (!ctx.from || !ctx.message || !('text' in ctx.message)) return;

    const text = ctx.message.text;

    if (ctx.session.currentStep === 'select') {
      const goalNumber = parseInt(text.trim());

      if (isNaN(goalNumber) || !ctx.session.currentGoals) {
        return;
      }

      const displayGoals = ctx.session.currentGoals.slice(0, 5);
      if (goalNumber < 1 || goalNumber > displayGoals.length) {
        await ctx.reply(
          `❌ Неверный номер. Введи число от 1 до ${displayGoals.length}`,
        );
        return;
      }

      if (ctx.session.messageId) {
        try {
          await ctx.deleteMessage(ctx.session.messageId);
        } catch {
          // ignore
        }
        ctx.session.messageId = undefined;
      }

      const goal = displayGoals[goalNumber - 1];
      await this.startEditing(ctx, goal.id);
      return;
    }

    if (ctx.session.currentStep === 'name') {
      ctx.session.newGoalName = text;

      await ctx.reply(
        `Текущая дата окончания: ${ctx.session.originalGoalEnd}\n\nХочешь изменить дату окончания?`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '✅ Изменить дату', callback_data: 'change_date' }],
              [{ text: '⏭ Оставить текущую', callback_data: 'keep_date' }],
            ],
          },
        },
      );
    } else if (ctx.session.currentStep === 'date') {
      if (!ctx.session.goalId || !ctx.session.newGoalName) return;

      const updatedGoal = await this.goalService.update(ctx.session.goalId, {
        goal_name: ctx.session.newGoalName,
        goal_end: text,
      });

      await ctx.reply(
        `✅ Цель обновлена!\n\nНовое описание: ${updatedGoal.goal_name}\nДата окончания: ${updatedGoal.goal_end}`,
      );

      await ctx.reply(
        '📋 Раздел "Цели"',
        Markup.keyboard([
          ['📊 Создать отчет', '📝 Список целей'],
          ['➕ Добавить цель', '✏️ Редактировать цель'],
          ['📈 Статистика', '⬅️ Назад в главное меню'],
        ]).resize(),
      );

      ctx.session.goalId = undefined;
      ctx.session.currentStep = undefined;
      ctx.session.newGoalName = undefined;
      ctx.session.originalGoalEnd = undefined;

      return await ctx.scene.leave();
    }
  }
}
