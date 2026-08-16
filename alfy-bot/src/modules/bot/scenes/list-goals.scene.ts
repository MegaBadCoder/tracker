import { Action, Command, Ctx, On, Scene, SceneEnter } from 'nestjs-telegraf';
import { Context, Markup, Scenes } from 'telegraf';
import type { GoalStatus } from '../../../shared/constants/goal-statuses';
import {
  GOAL_STATUSES,
  GOAL_STATUS_LABELS,
} from '../../../shared/constants/goal-statuses';
import { GOALS_MENU_KEYBOARD } from '../../../shared/constants/keyboards';
import { MESSAGES } from '../../../shared/constants/messages';
import { formatDate } from '../../../shared/utils/date-ui.util';
import { Goal } from '../../../shared/entities';
import { GoalService } from '../../goal/application/goal.service';
import { ReportService } from '../../report/application/report.service';
import { AuthService } from '../../auth/auth.service';

interface ListGoalsSessionData extends Scenes.SceneSessionData {
  messageId?: number;
  currentFilter: GoalStatus | 'all';
  currentGoals?: Goal[];
  preselectedGoalId?: number;
}

interface SceneContext extends Context {
  session: ListGoalsSessionData & Scenes.SceneSession<ListGoalsSessionData>;
  scene: Scenes.SceneContextScene<SceneContext>;
}

@Scene('list-goals')
export class ListGoalsScene {
  constructor(
    private goalService: GoalService,
    private authService: AuthService,
    private reportService: ReportService,
  ) {}

  @SceneEnter()
  async onEnter(@Ctx() ctx: SceneContext) {
    if (!ctx.from) return;

    await ctx.reply('Список целей', Markup.removeKeyboard());

    ctx.session.currentFilter = GOAL_STATUSES.ACTIVE;
    ctx.session.messageId = undefined;
    await this.showGoalsList(ctx);
  }

  @Action(/filter_(.+)/)
  async handleFilterChange(
    @Ctx() ctx: SceneContext & { match: RegExpMatchArray },
  ) {
    await ctx.answerCbQuery();
    const filter = ctx.match[1] as GoalStatus | 'all';
    ctx.session.currentFilter = filter;
    await this.showGoalsList(ctx);
  }

  @Action(/create_report_(\d+)/)
  async createReport(@Ctx() ctx: SceneContext & { match: RegExpMatchArray }) {
    await ctx.answerCbQuery();
    const goalId = parseInt(ctx.match[1]);

    ctx.session.preselectedGoalId = goalId;

    await ctx.scene.enter('report');
  }

  @Action(/goal_action_(\d+)_(.+)/)
  async handleGoalAction(
    @Ctx() ctx: SceneContext & { match: RegExpMatchArray },
  ) {
    await ctx.answerCbQuery();
    const goalId = parseInt(ctx.match[1]);
    const action = ctx.match[2];

    switch (action) {
      case 'details':
        await this.showGoalDetails(ctx, goalId);
        break;
      case 'delete':
        await this.showDeleteConfirmation(ctx, goalId);
        break;
      case 'complete':
        await this.updateGoalStatus(ctx, goalId, GOAL_STATUSES.COMPLETED);
        break;
      case 'activate':
        await this.updateGoalStatus(ctx, goalId, GOAL_STATUSES.ACTIVE);
        break;
    }
  }

  @Action('open_webapp')
  async openWebApp(@Ctx() ctx: SceneContext) {
    await ctx.answerCbQuery('WebApp в разработке');
  }

  @Action(/confirm_delete_(\d+)/)
  async confirmDelete(@Ctx() ctx: SceneContext & { match: RegExpMatchArray }) {
    await ctx.answerCbQuery();
    const goalId = parseInt(ctx.match[1]);

    await this.goalService.updateGoalStatus(goalId, GOAL_STATUSES.DELETED);
    await ctx.editMessageText(MESSAGES.GOALS_LIST.GOAL_DELETED);
    ctx.session.messageId = undefined;
    await this.showGoalsList(ctx);
  }

  @Action(/cancel_delete_(\d+)/)
  async cancelDelete(@Ctx() ctx: SceneContext & { match: RegExpMatchArray }) {
    await ctx.answerCbQuery();
    const goalId = parseInt(ctx.match[1]);
    await this.showGoalDetails(ctx, goalId);
  }

  @Action('back_to_list')
  async backToList(@Ctx() ctx: SceneContext) {
    await ctx.answerCbQuery();

    if (ctx.session.messageId) {
      try {
        await ctx.deleteMessage(ctx.session.messageId);
      } catch {
        // ignore
      }
      ctx.session.messageId = undefined;
    }

    await this.showGoalsList(ctx);
  }

  @Action('back_to_goals_menu')
  async backToGoalsMenu(@Ctx() ctx: SceneContext) {
    await ctx.answerCbQuery();
    await ctx.editMessageText('Возвращаю в меню целей...');
    await ctx.reply('📋 Раздел "Цели"', GOALS_MENU_KEYBOARD);
    await ctx.scene.leave();
  }

  @Command('cancel')
  async cancel(@Ctx() ctx: SceneContext) {
    await ctx.reply('❌ Просмотр целей отменен');
    await ctx.scene.leave();
  }

  @On('text')
  async handleTextInput(@Ctx() ctx: SceneContext) {
    if (!ctx.message || !('text' in ctx.message)) return;

    const text = ctx.message.text.trim();
    const goalNumber = parseInt(text);

    if (isNaN(goalNumber) || !ctx.session.currentGoals) {
      return;
    }

    const displayGoals = ctx.session.currentGoals.slice(0, 5);
    if (goalNumber < 1 || goalNumber > displayGoals.length) {
      await ctx.reply(
        `${MESSAGES.GOALS_LIST.INVALID_NUMBER}${displayGoals.length}`,
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
    await this.showGoalDetails(ctx, goal.id);
  }

  private async showGoalsList(@Ctx() ctx: SceneContext) {
    if (!ctx.from) return;

    const goals = await this.getFilteredGoals(ctx);
    ctx.session.currentGoals = goals;

    const message = this.formatGoalsList(goals, ctx.session.currentFilter);
    const buttons = this.generateButtons(goals, ctx.session.currentFilter);

    if (ctx.session.messageId) {
      try {
        await ctx.editMessageText(message, buttons);
      } catch {
        const msg = await ctx.reply(message, buttons);
        ctx.session.messageId = msg.message_id;
      }
    } else {
      const msg = await ctx.reply(message, buttons);
      ctx.session.messageId = msg.message_id;
    }
  }

  private async getFilteredGoals(@Ctx() ctx: SceneContext): Promise<Goal[]> {
    if (!ctx.from) return [];

    const user = await this.authService.findOrCreateTelegramUser(
      ctx.from.id,
      {},
    );

    if (ctx.session.currentFilter === 'all') {
      return await this.goalService.findAllByUser(user.id);
    }

    return await this.goalService.findByStatus(
      user.id,
      ctx.session.currentFilter,
    );
  }

  private generateButtons(goals: Goal[], filter: string) {
    const buttons: Array<Array<{ text: string; callback_data: string }>> = [];

    buttons.push([
      {
        text: filter === 'active' ? '✓ Активные' : 'Активные',
        callback_data: 'filter_active',
      },
      {
        text: filter === 'all' ? '✓ Все' : 'Все',
        callback_data: 'filter_all',
      },
      {
        text: filter === 'completed' ? '✓ Достигнутые' : 'Достигнутые',
        callback_data: 'filter_completed',
      },
    ]);

    if (goals.length > 5) {
      buttons.push([
        {
          text: `📱 ${MESSAGES.GOALS_LIST.VIEW_ALL_WEBAPP as string}`,
          callback_data: 'open_webapp',
        },
      ]);
    }

    buttons.push([
      {
        text: '⬅️ Назад в меню целей',
        callback_data: 'back_to_goals_menu',
      },
    ]);

    return Markup.inlineKeyboard(buttons);
  }

  private formatGoalsList(goals: Goal[], filter: string): string {
    const filterLabel =
      filter === 'all' ? 'Все' : GOAL_STATUS_LABELS[filter as GoalStatus];
    let message = `${MESSAGES.GOALS_LIST.TITLE} (${filterLabel})\n\n`;

    if (goals.length === 0) {
      message += this.getNoGoalsMessage(filter);
      return message;
    }

    const displayGoals = goals.slice(0, 5);
    displayGoals.forEach((goal, index) => {
      message += `${index + 1}. ${goal.goal_name}\n`;
      message += '\n';
      if (goal.goal_start && goal.goal_end) {
        message += `📅 ${formatDate(new Date(goal.goal_start))} — ${formatDate(new Date(goal.goal_end))}\n`;
      }
      if (index < displayGoals.length - 1) {
        message += '\n';
      }
    });
    message += '\n';

    if (goals.length > 5) {
      message += `${MESSAGES.GOALS_LIST.SHOWING_FIRST(5, goals.length)}\n`;
    }

    message += MESSAGES.GOALS_LIST.ENTER_NUMBER_HINT;

    return message;
  }

  private getNoGoalsMessage(filter: string): string {
    switch (filter) {
      case 'active':
        return MESSAGES.GOALS_LIST.NO_ACTIVE;
      case 'completed':
        return MESSAGES.GOALS_LIST.NO_COMPLETED;
      case 'deleted':
        return MESSAGES.GOALS_LIST.NO_DELETED;
      default:
        return MESSAGES.GOALS_LIST.NO_GOALS;
    }
  }

  private async showGoalDetails(@Ctx() ctx: SceneContext, goalId: number) {
    if (!ctx.from) return;

    const goal = await this.goalService.findById(goalId);

    if (!goal) {
      await ctx.answerCbQuery('Цель не найдена');
      return;
    }

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const filledToday = await this.reportService.isDateFilled(
      goal.id,
      todayStr,
    );

    const statusLabel = this.getStatusLabel(goal.status);

    let reportStatusText = '';
    if (filledToday) {
      reportStatusText = '\n✅ Отчет на сегодня заполнен';
    }

    const periodLine =
      goal.goal_start && goal.goal_end
        ? `📅 Период: ${formatDate(new Date(goal.goal_start))} - ${formatDate(new Date(goal.goal_end))}\n`
        : '';

    const message = `📋 ${goal.goal_name}

${periodLine}📊 Статус: ${statusLabel}
❓ Вопросов для отчетов: ${goal.questions?.length || 0}${reportStatusText}

Создана: ${formatDate(goal.createdAt)}`.trim();

    const actionButtons: Array<{ text: string; callback_data: string }> = [];

    if (goal.status === GOAL_STATUSES.ACTIVE && !filledToday) {
      actionButtons.push({
        text: '📊 Создать отчет',
        callback_data: `create_report_${goal.id}`,
      });
    }

    if (goal.status === GOAL_STATUSES.ACTIVE) {
      actionButtons.push(
        {
          text: '🗑 Удалить',
          callback_data: `goal_action_${goal.id}_delete`,
        },
        {
          text: '✅ Достигнута',
          callback_data: `goal_action_${goal.id}_complete`,
        },
      );
    } else {
      actionButtons.push({
        text: '🔄 Активировать',
        callback_data: `goal_action_${goal.id}_activate`,
      });
    }

    const keyboard = [
      actionButtons.length > 0 ? actionButtons : [],
      [{ text: '⬅️ Назад к списку', callback_data: 'back_to_list' }],
    ].filter((row) => row.length > 0);

    try {
      await ctx.editMessageText(message, Markup.inlineKeyboard(keyboard));
    } catch {
      const msg = await ctx.reply(message, Markup.inlineKeyboard(keyboard));
      ctx.session.messageId = msg.message_id;
    }
  }

  private getStatusLabel(status: string): string {
    switch (status) {
      case GOAL_STATUSES.ACTIVE:
        return 'Активная';
      case GOAL_STATUSES.COMPLETED:
        return 'Достигнутая';
      case GOAL_STATUSES.DELETED:
        return 'Удалённая';
      default:
        return status;
    }
  }

  private async showDeleteConfirmation(ctx: SceneContext, goalId: number) {
    const goal = await this.goalService.findById(goalId);
    if (!goal) return;

    const message = `⚠️ Удалить цель «${goal.goal_name}»?\n\nЦель будет перемещена в удалённые.`;

    const keyboard = Markup.inlineKeyboard([
      [
        { text: '✅ Да, удалить', callback_data: `confirm_delete_${goalId}` },
        { text: '❌ Отмена', callback_data: `cancel_delete_${goalId}` },
      ],
    ]);

    try {
      await ctx.editMessageText(message, keyboard);
    } catch {
      const msg = await ctx.reply(message, keyboard);
      ctx.session.messageId = msg.message_id;
    }
  }

  private async updateGoalStatus(
    ctx: SceneContext,
    goalId: number,
    status: GoalStatus,
  ) {
    await this.goalService.updateGoalStatus(goalId, status);
    if (status === GOAL_STATUSES.COMPLETED) {
      await this.goalService.update(goalId, { outcome: 'success' });
    } else if (status === GOAL_STATUSES.ACTIVE) {
      await this.goalService.update(goalId, { outcome: null });
    }

    let message = '';
    switch (status) {
      case GOAL_STATUSES.COMPLETED:
        message = MESSAGES.GOALS_LIST.GOAL_COMPLETED;
        break;
      case GOAL_STATUSES.DELETED:
        message = MESSAGES.GOALS_LIST.GOAL_DELETED;
        break;
      case GOAL_STATUSES.ACTIVE:
        message = MESSAGES.GOALS_LIST.GOAL_ACTIVATED;
        break;
    }

    await ctx.answerCbQuery(message);
    await this.showGoalsList(ctx);
  }
}
