import { Scene, SceneEnter, On, Ctx, Action, Command } from 'nestjs-telegraf';
import { Context, Scenes, Markup } from 'telegraf';
import { GOALS_MENU_KEYBOARD } from '../../../shared/constants/keyboards';
import { MESSAGES } from '../../../shared/constants/messages';
import { formatDate } from '../../../shared/utils/date-ui.util';
import { QuestionType } from '../../../shared/types/question-types';
import { generateQuestionButtons } from '../../../shared/utils/question-ui.util';
import { Goal, Question } from '../../../shared/entities';
import { GoalService } from '../../goal/application/goal.service';
import { ReportService } from '../../report/application/report.service';
import { ScheduleService } from '../../goal/application/schedule.service';
import { AuthService } from '../../auth/auth.service';

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface SessionData extends Scenes.SceneSessionData {
  goalId?: number;
  userId?: number;
  targetDate?: string;
  currentQuestionIndex?: number;
  questions?: Question[];
  lastQuestionMessageId?: number;
  preselectedGoalId?: number;
  pendingCurrentGoalId?: number;
  availableGoals?: Goal[];
  lastMediaGroupId?: string;
}

interface SceneContext extends Context {
  session: SessionData & Scenes.SceneSession<SessionData>;
  scene: Scenes.SceneContextScene<SceneContext>;
}

interface TextRoute {
  match: (ctx: SceneContext) => boolean;
  handle: (ctx: SceneContext, answer: string) => Promise<void>;
}

@Scene('report')
export class ReportScene {
  private readonly textRoutes: TextRoute[] = [
    {
      match: (ctx) => this.isInGoalSelection(ctx),
      handle: (ctx, answer) => this.handleGoalSelection(ctx, answer),
    },
    {
      match: (ctx) => this.isInReportFlow(ctx),
      handle: (ctx, answer) => this.handleReportAnswer(ctx, answer),
    },
  ];

  constructor(
    private goalService: GoalService,
    private reportService: ReportService,
    private authService: AuthService,
    private scheduleService: ScheduleService,
  ) {}

  private async askQuestion(ctx: SceneContext, question: Question) {
    const currentIndex = ctx.session.currentQuestionIndex ?? 0;
    const totalQuestions = ctx.session.questions?.length ?? 0;
    const progressText = `📊 Вопрос ${currentIndex + 1} из ${totalQuestions}\n\n`;
    const questionText =
      question.type === 'photo'
        ? progressText + `📷 ${question.question}\n\nПришли фото`
        : progressText + question.question;

    const buttons = generateQuestionButtons(question.type as QuestionType);

    const extraButtons: { text: string; callback_data: string }[][] = [];

    if (question.can_skip) {
      extraButtons.push([
        { text: '⏭ Пропустить', callback_data: 'skip_question' },
      ]);
    }

    extraButtons.push([
      { text: '❌ Отменить отчет', callback_data: 'cancel_report_action' },
    ]);

    const allButtons = buttons ? [...buttons, ...extraButtons] : extraButtons;

    const sentMessage = await ctx.reply(questionText, {
      reply_markup: {
        inline_keyboard: allButtons,
      },
    });
    ctx.session.lastQuestionMessageId = sentMessage.message_id;
  }

  private async processAnswer(ctx: SceneContext, answer: string) {
    if (
      !ctx.session.userId ||
      !ctx.session.targetDate ||
      ctx.session.currentQuestionIndex === undefined ||
      !ctx.session.questions
    )
      return;

    const currentQuestion =
      ctx.session.questions[ctx.session.currentQuestionIndex];

    if (!currentQuestion) return;

    await this.reportService.addAnswer(
      ctx.session.userId,
      currentQuestion.id,
      ctx.session.targetDate,
      answer,
    );

    await this.moveToNextQuestion(ctx);
  }

  private async processPhotoAnswer(
    ctx: SceneContext,
    buffer: Buffer,
    mime: string,
  ) {
    if (
      !ctx.session.userId ||
      !ctx.session.targetDate ||
      ctx.session.currentQuestionIndex === undefined ||
      !ctx.session.questions
    )
      return;

    const currentQuestion =
      ctx.session.questions[ctx.session.currentQuestionIndex];
    if (!currentQuestion) return;

    await this.reportService.addPhotoAnswer(
      ctx.session.userId,
      currentQuestion.id,
      ctx.session.targetDate,
      { buffer, mime },
    );

    await this.moveToNextQuestion(ctx);
  }

  private async moveToNextQuestion(ctx: SceneContext) {
    if (
      !ctx.session.questions ||
      ctx.session.currentQuestionIndex === undefined
    )
      return;

    if (ctx.session.lastQuestionMessageId) {
      try {
        await ctx.deleteMessage(ctx.session.lastQuestionMessageId);
      } catch {
        // ignore
      }
    }

    ctx.session.currentQuestionIndex++;

    if (ctx.session.currentQuestionIndex >= ctx.session.questions.length) {
      await this.finishReport(ctx);
      return;
    }

    const nextQuestion =
      ctx.session.questions[ctx.session.currentQuestionIndex];
    await this.askQuestion(ctx, nextQuestion);
  }

  private async finishReport(ctx: SceneContext) {
    ctx.session.lastMediaGroupId = undefined;
    await ctx.reply('✅ Отчет сохранен!');

    if (ctx.session.pendingCurrentGoalId) {
      const goalId = ctx.session.pendingCurrentGoalId;
      ctx.session.pendingCurrentGoalId = undefined;
      await this.startReport(ctx, goalId, todayISO());
    } else {
      await this.offerNextGoal(ctx);
    }
  }

  private async offerNextGoal(ctx: SceneContext) {
    if (!ctx.from) return;

    const user = await this.authService.findOrCreateTelegramUser(
      ctx.from.id,
      {},
    );
    const allGoals = await this.goalService.findActiveByUser(user.id);
    const today = todayISO();

    const remainingGoals: Goal[] = [];
    for (const goal of allGoals) {
      if (goal.id === ctx.session.goalId) continue;
      if (!this.scheduleService.hasAnyQuestionDueToday(goal)) continue;
      const filled = await this.reportService.isDateFilled(
        goal.id,
        today,
        goal,
      );
      if (!filled) {
        remainingGoals.push(goal);
      }
    }

    if (remainingGoals.length > 0) {
      let message = '📋 Есть еще цели для отчета:\n\n';
      remainingGoals.forEach((goal, index) => {
        message += `${index + 1}. ${goal.goal_name}\n\n`;
      });
      message += 'Напиши номер цели или нажми кнопку:';

      ctx.session.availableGoals = remainingGoals;

      await ctx.reply(message, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '❌ Нет, спасибо', callback_data: 'no_more' }],
          ],
        },
      });

      ctx.session.goalId = undefined;
      ctx.session.targetDate = undefined;
      ctx.session.currentQuestionIndex = undefined;
      ctx.session.questions = undefined;
      ctx.session.lastQuestionMessageId = undefined;
    } else {
      await ctx.reply('🎉 Все цели закрыты!');
      return await ctx.scene.leave();
    }
  }

  @SceneEnter()
  async onEnter(@Ctx() ctx: SceneContext) {
    if (!ctx.from) return;

    await ctx.reply('Создание отчета', Markup.removeKeyboard());

    const user = await this.authService.findOrCreateTelegramUser(
      ctx.from.id,
      {},
    );
    ctx.session.userId = user.id;

    if (ctx.session.preselectedGoalId) {
      const goalId = ctx.session.preselectedGoalId;
      delete ctx.session.preselectedGoalId;
      await this.checkUnfilledOrStart(ctx, goalId);
      return;
    }

    const allGoals = await this.goalService.findActiveByUser(user.id);
    const today = todayISO();

    const availableGoals: Goal[] = [];
    for (const goal of allGoals) {
      if (!this.scheduleService.hasAnyQuestionDueToday(goal)) continue;
      const filled = await this.reportService.isDateFilled(
        goal.id,
        today,
        goal,
      );
      if (!filled) {
        availableGoals.push(goal);
      }
    }

    if (availableGoals.length === 0) {
      await ctx.reply('🎉 По всем целям уже есть отчет на сегодня!');
      return await ctx.scene.leave();
    }

    let message = '📋 Твои цели:\n\n';
    availableGoals.forEach((goal, index) => {
      message += `${index + 1}. ${goal.goal_name}\n\n`;
    });
    message += 'Напиши номер цели для отчета:';

    ctx.session.availableGoals = availableGoals;
    await ctx.reply(message, {
      reply_markup: {
        inline_keyboard: [[{ text: '❌ Назад', callback_data: 'no_more' }]],
      },
    });
  }

  @Action('no_more')
  async noMore(@Ctx() ctx: SceneContext) {
    await ctx.answerCbQuery();
    await ctx.editMessageText('Отлично! Возвращаю в меню целей');
    await ctx.reply('📋 Раздел "Цели"', GOALS_MENU_KEYBOARD);
    return await ctx.scene.leave();
  }

  private async checkUnfilledOrStart(ctx: SceneContext, goalId: number) {
    ctx.session.availableGoals = undefined;
    const unfilledDate = await this.reportService.findLastUnfilledDate(goalId);

    if (unfilledDate) {
      ctx.session.goalId = goalId;
      ctx.session.pendingCurrentGoalId = goalId;

      const dateStr = formatDate(new Date(unfilledDate));

      await ctx.reply(
        MESSAGES.OVERDUE.HAS_OVERDUE(dateStr),
        Markup.inlineKeyboard([
          [
            {
              text: MESSAGES.OVERDUE.FILL,
              callback_data: `fill_unfilled_${unfilledDate}`,
            },
            {
              text: MESSAGES.OVERDUE.SKIP,
              callback_data: 'skip_unfilled',
            },
          ],
          [
            {
              text: MESSAGES.OVERDUE.CANCEL,
              callback_data: 'cancel_unfilled',
            },
          ],
        ]),
      );
    } else {
      await this.startReport(ctx, goalId, todayISO());
    }
  }

  @Action(/fill_unfilled_(.+)/)
  async fillUnfilled(@Ctx() ctx: SceneContext & { match: RegExpMatchArray }) {
    await ctx.answerCbQuery();

    const targetDate = ctx.match[1];
    const goalId = ctx.session.goalId;
    if (!goalId) return;

    const goal = await this.goalService.findById(goalId);
    if (!goal) {
      await ctx.reply('Цель не найдена');
      return await ctx.scene.leave();
    }

    await ctx.editMessageText(
      `Заполняем просроченный отчёт за ${formatDate(new Date(targetDate))} по цели: ${goal.goal_name.slice(0, 100)}`,
    );

    await this.startReport(ctx, goalId, targetDate);
  }

  @Action('skip_unfilled')
  async skipUnfilled(@Ctx() ctx: SceneContext) {
    await ctx.answerCbQuery();
    ctx.session.pendingCurrentGoalId = undefined;

    await ctx.editMessageText('⏭ Пропущено');

    const goalId = ctx.session.goalId;
    if (goalId) {
      await this.startReport(ctx, goalId, todayISO());
    }
  }

  @Action('cancel_unfilled')
  async cancelUnfilled(@Ctx() ctx: SceneContext) {
    await ctx.answerCbQuery();
    ctx.session.pendingCurrentGoalId = undefined;
    ctx.session.goalId = undefined;
    await ctx.editMessageText('❌ Отменено');
    await ctx.reply('📋 Раздел "Цели"', GOALS_MENU_KEYBOARD);
    return await ctx.scene.leave();
  }

  private async startReport(
    ctx: SceneContext,
    goalId: number,
    targetDate: string,
  ) {
    if (!ctx.from) return;

    const goal = await this.goalService.findById(goalId);
    if (!goal) {
      await ctx.reply('Цель не найдена');
      return await ctx.scene.leave();
    }

    if (!ctx.session.userId) {
      const user = await this.authService.findOrCreateTelegramUser(
        ctx.from.id,
        {},
      );
      ctx.session.userId = user.id;
    }

    const unanswered = await this.reportService.getUnansweredQuestions(
      goalId,
      targetDate,
    );

    ctx.session.availableGoals = undefined;
    ctx.session.goalId = goalId;
    ctx.session.targetDate = targetDate;
    ctx.session.questions = unanswered;
    ctx.session.currentQuestionIndex = 0;
    ctx.session.lastMediaGroupId = undefined;

    if (unanswered.length === 0) {
      await ctx.reply('✅ Все вопросы на эту дату уже отвечены!');
      await this.offerNextGoal(ctx);
      return;
    }

    const isToday = targetDate === todayISO();
    if (isToday) {
      await ctx.reply(`Отчет по цели: ${goal.goal_name.slice(0, 100)}`);
    }

    await this.askQuestion(ctx, unanswered[0]);
  }

  @Action('skip_question')
  async skipQuestion(@Ctx() ctx: SceneContext) {
    await ctx.answerCbQuery('✓ Вопрос пропущен');
    await this.moveToNextQuestion(ctx);
  }

  @Action('cancel_report_action')
  async cancelReportAction(@Ctx() ctx: SceneContext) {
    await ctx.answerCbQuery();
    ctx.session.lastQuestionMessageId = undefined;
    await ctx.reply('❌ Отчет отменен');
    await ctx.scene.leave();
  }

  @Command('cancel')
  async cancelReport(@Ctx() ctx: SceneContext) {
    ctx.session.lastQuestionMessageId = undefined;
    await ctx.reply('❌ Отчет отменен');
    await ctx.scene.leave();
  }

  @Action(/answer_(.+)/)
  async handleButtonAnswer(
    @Ctx() ctx: SceneContext & { match: RegExpMatchArray },
  ) {
    if (!ctx.from) return;

    const answer = ctx.match[1];
    await ctx.answerCbQuery();

    await this.processAnswer(ctx, answer);
  }

  private isInGoalSelection(ctx: SceneContext): boolean {
    return !!(ctx.session.availableGoals && !ctx.session.goalId);
  }

  private async handleGoalSelection(
    ctx: SceneContext,
    answer: string,
  ): Promise<void> {
    const goals = ctx.session.availableGoals!;
    const num = parseInt(answer);

    if (isNaN(num) || num < 1 || num > goals.length) {
      await ctx.reply(`❌ Напиши номер от 1 до ${goals.length}`);
      return;
    }

    const goal = goals[num - 1];
    ctx.session.availableGoals = undefined;
    await this.checkUnfilledOrStart(ctx, goal.id);
  }

  private isInReportFlow(ctx: SceneContext): boolean {
    return !!(
      ctx.session.questions && ctx.session.currentQuestionIndex !== undefined
    );
  }

  private async handleReportAnswer(
    ctx: SceneContext,
    answer: string,
  ): Promise<void> {
    const question =
      ctx.session.questions?.[ctx.session.currentQuestionIndex ?? -1];
    const qType = question?.type as QuestionType;

    if (qType === 'photo') {
      await ctx.reply('📷 Нужно фото. Пришли фотографию.');
      return;
    }

    if (qType === 'number' && isNaN(parseFloat(answer))) {
      await ctx.reply('❌ Введи число. Попробуй ещё раз.');
      return;
    }

    if (qType === 'rating') {
      const num = parseInt(answer);
      if (isNaN(num) || num < 1 || num > 5) {
        await ctx.reply('❌ Введи число от 1 до 5.');
        return;
      }
    }

    await this.processAnswer(ctx, answer);
  }

  @On('text')
  async handleTextAnswer(@Ctx() ctx: SceneContext) {
    if (!ctx.from || !ctx.message || !('text' in ctx.message)) return;

    const answer = ctx.message.text;

    try {
      const route = this.textRoutes.find(({ match }) => match(ctx));
      if (route) await route.handle(ctx, answer);
    } catch (e) {
      console.error('handleTextAnswer error:', e);
      await ctx.reply(
        '⚠️ Что-то пошло не так. Попробуй ещё раз или введи /cancel',
      );
    }
  }

  @On('photo')
  async handlePhoto(@Ctx() ctx: SceneContext) {
    if (!this.isCurrentQuestionPhoto(ctx)) return;
    if (!ctx.message || !('photo' in ctx.message) || !ctx.message.photo) return;

    const mediaGroupId = (ctx.message as { media_group_id?: string })
      .media_group_id;
    if (mediaGroupId && ctx.session.lastMediaGroupId === mediaGroupId) return;
    if (mediaGroupId) ctx.session.lastMediaGroupId = mediaGroupId;

    const photos = ctx.message.photo;
    const best = photos[photos.length - 1];

    try {
      const link = await ctx.telegram.getFileLink(best.file_id);
      const res = await fetch(link.toString());
      if (!res.ok) throw new Error(`fetch ${res.status}`);
      const buffer = Buffer.from(await res.arrayBuffer());
      await this.processPhotoAnswer(ctx, buffer, 'image/jpeg');
    } catch (e) {
      console.error('handlePhoto error:', e);
      await ctx.reply('⚠️ Не удалось обработать фото. Попробуй ещё раз.');
    }
  }

  @On('document')
  async handleDocumentImage(@Ctx() ctx: SceneContext) {
    if (!this.isCurrentQuestionPhoto(ctx)) return;
    if (!ctx.message || !('document' in ctx.message) || !ctx.message.document)
      return;

    const doc = ctx.message.document;
    const mime = doc.mime_type ?? '';
    if (!mime.startsWith('image/')) {
      await ctx.reply('❌ Только фото. Пришли изображение.');
      return;
    }

    try {
      const link = await ctx.telegram.getFileLink(doc.file_id);
      const res = await fetch(link.toString());
      if (!res.ok) throw new Error(`fetch ${res.status}`);
      const buffer = Buffer.from(await res.arrayBuffer());
      await this.processPhotoAnswer(ctx, buffer, mime);
    } catch (e) {
      console.error('handleDocumentImage error:', e);
      await ctx.reply('⚠️ Не удалось обработать файл. Попробуй ещё раз.');
    }
  }

  private isCurrentQuestionPhoto(ctx: SceneContext): boolean {
    if (
      !ctx.session.questions ||
      ctx.session.currentQuestionIndex === undefined
    )
      return false;
    const q = ctx.session.questions[ctx.session.currentQuestionIndex];
    return q?.type === 'photo';
  }
}
