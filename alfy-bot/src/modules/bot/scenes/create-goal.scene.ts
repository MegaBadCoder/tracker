import { addDays, addWeeks, startOfDay } from 'date-fns';
import { Action, Command, Ctx, On, Scene, SceneEnter } from 'nestjs-telegraf';
import { Context, Markup, Scenes } from 'telegraf';
import {
  END_DATE_OPTIONS,
  START_DATE_OPTIONS,
} from '../../../shared/constants/date-options';
import {
  GOAL_TYPES,
  GOAL_TYPE_CONFIG,
  GoalType,
} from '../../../shared/constants/goal-types';
import { GOALS_MENU_KEYBOARD } from '../../../shared/constants/keyboards';
import { MESSAGES } from '../../../shared/constants/messages';
import type { FrequencyType } from '../../../shared/constants/schedule-types';
import { DateParserService } from '../../../shared/services/date-parser.service';
import {
  QUESTION_TYPES,
  QuestionType,
} from '../../../shared/types/question-types';
import {
  calculateEndDate,
  formatDate,
  generateEndDateButtons,
  generateStartDateButtons,
  toISODate,
} from '../../../shared/utils/date-ui.util';
import { generateDayPickerKeyboard } from '../../../shared/utils/schedule-ui.util';
import { GoalService } from '../../goal/application/goal.service';
import { AuthService } from '../../auth/auth.service';

interface CreateGoalSessionData extends Scenes.SceneSessionData {
  messageId?: number;
  goalType?: GoalType;
  goalName?: string;
  startDate?: Date;
  endDate?: Date;
  awaitingCustomStart?: boolean;
  awaitingCustomEnd?: boolean;
  pointA?: boolean;
  scheduleType?: FrequencyType;
  selectedDays?: number[];
  intervalDays?: number;
  awaitingIntervalInput?: boolean;
  goalId?: number;
  questionsToAdd?: Array<{
    question: string;
    type: string;
    canSkip: boolean;
    scheduleType: FrequencyType;
    selectedDays?: number[];
    intervalDays?: number;
    targetValue?: string;
  }>;
  awaitingQuestionText?: boolean;
  selectedQuestionType?: string;
  questionSetupMessageId?: number;
  _pendingQuestionText?: string;
  _pendingCanSkip?: boolean;
  awaitingTargetValue?: boolean;
  _pendingTargetValue?: string;
}

interface SceneContext extends Context {
  session: CreateGoalSessionData & Scenes.SceneSession<CreateGoalSessionData>;
  scene: Scenes.SceneContextScene<SceneContext>;
}

@Scene('create-goal')
export class CreateGoalScene {
  constructor(
    private dateParser: DateParserService,
    private goalService: GoalService,
    private authService: AuthService,
  ) {}

  @SceneEnter()
  async onEnter(@Ctx() ctx: SceneContext) {
    await ctx.reply('Создание цели', Markup.removeKeyboard());

    const msg = await ctx.reply(
      MESSAGES.GOAL_CREATION.CHOOSE_TYPE,
      Markup.inlineKeyboard([
        [
          {
            text: `${GOAL_TYPE_CONFIG[GOAL_TYPES.SIMPLE].emoji} ${GOAL_TYPE_CONFIG[GOAL_TYPES.SIMPLE].label}`,
            callback_data: `type_${GOAL_TYPES.SIMPLE}`,
          },
        ],
        [
          {
            text: `${GOAL_TYPE_CONFIG[GOAL_TYPES.SMART].emoji} ${GOAL_TYPE_CONFIG[GOAL_TYPES.SMART].label}`,
            callback_data: `type_${GOAL_TYPES.SMART}`,
          },
        ],
        [
          {
            text: `${GOAL_TYPE_CONFIG[GOAL_TYPES.GLOBAL].emoji} ${GOAL_TYPE_CONFIG[GOAL_TYPES.GLOBAL].label}`,
            callback_data: `type_${GOAL_TYPES.GLOBAL}`,
          },
        ],
        [{ text: '❌ Отмена', callback_data: 'cancel_goal' }],
      ]),
    );
    ctx.session.messageId = msg.message_id;
  }

  @Action(/^type_(.+)/)
  async handleGoalType(@Ctx() ctx: SceneContext & { match: RegExpMatchArray }) {
    const goalType = ctx.match[1] as GoalType;
    const config = GOAL_TYPE_CONFIG[goalType];

    await ctx.answerCbQuery();

    if (!config.enabled) {
      await ctx.editMessageText(
        MESSAGES.GOAL_CREATION.TYPE_IN_DEVELOPMENT,
        Markup.inlineKeyboard([
          [
            {
              text: '⬅️ Назад к выбору',
              callback_data: 'back_to_type_selection',
            },
          ],
        ]),
      );
      return;
    }

    ctx.session.goalType = goalType;
    await ctx.editMessageText(
      `${config.emoji} ${config.label}\n\n${MESSAGES.GOAL_CREATION.ENTER_NAME}`,
      Markup.inlineKeyboard([
        [{ text: '❌ Отмена', callback_data: 'cancel_goal' }],
      ]),
    );
  }

  @Action('back_to_type_selection')
  async backToTypeSelection(@Ctx() ctx: SceneContext) {
    await ctx.answerCbQuery();
    await this.onEnter(ctx);
  }

  @Action('cancel_goal')
  async cancelGoal(@Ctx() ctx: SceneContext) {
    await ctx.answerCbQuery();
    await ctx.editMessageText('❌ Создание цели отменено');
    await ctx.reply('📋 Раздел "Цели"', GOALS_MENU_KEYBOARD);
    await ctx.scene.leave();
  }

  @Action(START_DATE_OPTIONS.TODAY)
  async handleStartToday(@Ctx() ctx: SceneContext) {
    await ctx.answerCbQuery();
    ctx.session.startDate = startOfDay(new Date());
    await this.showEndDateStep(ctx);
  }

  @Action(START_DATE_OPTIONS.TOMORROW)
  async handleStartTomorrow(@Ctx() ctx: SceneContext) {
    await ctx.answerCbQuery();
    ctx.session.startDate = addDays(startOfDay(new Date()), 1);
    await this.showEndDateStep(ctx);
  }

  @Action(START_DATE_OPTIONS.WEEK)
  async handleStartWeek(@Ctx() ctx: SceneContext) {
    await ctx.answerCbQuery();
    ctx.session.startDate = addWeeks(startOfDay(new Date()), 1);
    await this.showEndDateStep(ctx);
  }

  @Action(START_DATE_OPTIONS.CUSTOM)
  async handleStartCustom(@Ctx() ctx: SceneContext) {
    await ctx.answerCbQuery();
    ctx.session.awaitingCustomStart = true;
    await ctx.editMessageText(
      `📝 Цель: ${ctx.session.goalName}\n\n${MESSAGES.GOAL_CREATION.CHOOSE_START}\n\nМожно написать:\n• дд.мм.гггг (например: 25.01.2026)\n• Сегодня/Завтра\n• Через N дней/недель`,
      Markup.inlineKeyboard([
        [{ text: '⬅️ Назад', callback_data: 'back_to_start_options' }],
        [{ text: '❌ Отмена', callback_data: 'cancel_goal' }],
      ]),
    );
  }

  @Action('back_to_start_options')
  async backToStartOptions(@Ctx() ctx: SceneContext) {
    await ctx.answerCbQuery();
    await this.showStartDateStep(ctx);
  }

  @Action(/end_(.+)/)
  async handleEndDate(@Ctx() ctx: SceneContext & { match: RegExpMatchArray }) {
    await ctx.answerCbQuery();
    const option = `end_${ctx.match[1]}`;
    const state = ctx.session;

    if (!state.startDate) {
      return;
    }

    try {
      state.endDate = calculateEndDate(state.startDate, option);
      await this.askPointA(ctx);
    } catch {
      await ctx.reply('Ошибка при расчете даты');
    }
  }

  @Action(END_DATE_OPTIONS.CUSTOM)
  async handleEndCustom(@Ctx() ctx: SceneContext) {
    await ctx.answerCbQuery();
    ctx.session.awaitingCustomEnd = true;
    await ctx.editMessageText(
      `📝 Цель: ${ctx.session.goalName}\n📅 Старт: ${formatDate(ctx.session.startDate as Date)}\n\n${MESSAGES.GOAL_CREATION.CHOOSE_END}\n\nМожно написать:\n• дд.мм.гггг\n• Через N дней/недель/месяцев`,
      Markup.inlineKeyboard([
        [{ text: '⬅️ Назад', callback_data: 'back_to_end_options' }],
        [{ text: '❌ Отмена', callback_data: 'cancel_goal' }],
      ]),
    );
  }

  @Action('back_to_end_options')
  async backToEndOptions(@Ctx() ctx: SceneContext) {
    await ctx.answerCbQuery();
    await this.showEndDateStep(ctx);
  }

  @Action('pointa_yes')
  async handlePointAYes(@Ctx() ctx: SceneContext) {
    await ctx.answerCbQuery();
    ctx.session.pointA = true;
    await this.saveGoal(ctx);
  }

  @Action('pointa_no')
  async handlePointANo(@Ctx() ctx: SceneContext) {
    await ctx.answerCbQuery();
    ctx.session.pointA = false;
    await this.saveGoal(ctx);
  }

  @Action('schedule_daily')
  async handleScheduleDaily(@Ctx() ctx: SceneContext) {
    await ctx.answerCbQuery();
    ctx.session.scheduleType = 'daily';
    await this.addQuestionWithScheduleToList(ctx);
  }

  @Action('schedule_weekly')
  async handleScheduleWeekly(@Ctx() ctx: SceneContext) {
    await ctx.answerCbQuery();
    ctx.session.selectedDays = [];
    await this.showDayPicker(ctx);
  }

  @Action('schedule_interval')
  async handleScheduleInterval(@Ctx() ctx: SceneContext) {
    await ctx.answerCbQuery();
    await this.showIntervalStep(ctx);
  }

  @Action('schedule_back')
  async handleScheduleBack(@Ctx() ctx: SceneContext) {
    await ctx.answerCbQuery();
    await this.showQuestionScheduleStep(ctx);
  }

  @Action(/toggle_day_(\d+)/)
  async handleToggleDay(
    @Ctx() ctx: SceneContext & { match: RegExpMatchArray },
  ) {
    await ctx.answerCbQuery();
    const day = parseInt(ctx.match[1]);

    if (!ctx.session.selectedDays) {
      ctx.session.selectedDays = [];
    }

    const idx = ctx.session.selectedDays.indexOf(day);
    if (idx >= 0) {
      ctx.session.selectedDays.splice(idx, 1);
    } else {
      ctx.session.selectedDays.push(day);
    }

    await this.showDayPicker(ctx);
  }

  @Action('days_done')
  async handleDaysDone(@Ctx() ctx: SceneContext) {
    if (!ctx.session.selectedDays || ctx.session.selectedDays.length === 0) {
      await ctx.answerCbQuery(MESSAGES.SCHEDULE.MIN_ONE_DAY);
      return;
    }

    await ctx.answerCbQuery();
    ctx.session.scheduleType = 'weekly_days';
    await this.addQuestionWithScheduleToList(ctx);
  }

  @Action(/interval_(\d+)/)
  async handleIntervalPreset(
    @Ctx() ctx: SceneContext & { match: RegExpMatchArray },
  ) {
    await ctx.answerCbQuery();
    ctx.session.intervalDays = parseInt(ctx.match[1]);
    ctx.session.scheduleType = 'interval';
    await this.addQuestionWithScheduleToList(ctx);
  }

  @Action('setup_questions')
  async handleSetupQuestions(@Ctx() ctx: SceneContext) {
    await ctx.answerCbQuery();
    ctx.session.questionsToAdd = [];
    await this.showQuestionTypePicker(ctx);
  }

  @Action('skip_questions')
  async handleSkipQuestions(@Ctx() ctx: SceneContext) {
    await ctx.answerCbQuery();
    await ctx.editMessageText('Хорошо, вопросы можно настроить позже');
    await ctx.reply('📋 Раздел "Цели"', GOALS_MENU_KEYBOARD);
    await ctx.scene.leave();
  }

  @Action(/qtype_(.+)/)
  async handleQuestionType(
    @Ctx() ctx: SceneContext & { match: RegExpMatchArray },
  ) {
    await ctx.answerCbQuery();
    const type = ctx.match[1] as QuestionType;
    const config = QUESTION_TYPES[type];

    if (!config) return;

    ctx.session.selectedQuestionType = type;
    ctx.session.awaitingQuestionText = true;

    await ctx.editMessageText(
      `${MESSAGES.QUESTION_SETUP.ENTER_TEXT(config.label)}\n\nПример: ${config.example}`,
      Markup.inlineKeyboard([
        [{ text: '⬅️ Назад', callback_data: 'back_to_qtype_picker' }],
        [{ text: '❌ Отмена', callback_data: 'cancel_goal' }],
      ]),
    );
  }

  @Action('back_to_qtype_picker')
  async backToQtypePicker(@Ctx() ctx: SceneContext) {
    await ctx.answerCbQuery();
    ctx.session.awaitingQuestionText = false;
    await this.showQuestionTypePicker(ctx);
  }

  @Action('question_can_skip_yes')
  async handleCanSkipYes(@Ctx() ctx: SceneContext) {
    await ctx.answerCbQuery();
    ctx.session._pendingCanSkip = true;
    await this.showQuestionScheduleStep(ctx);
  }

  @Action('question_can_skip_no')
  async handleCanSkipNo(@Ctx() ctx: SceneContext) {
    await ctx.answerCbQuery();
    ctx.session._pendingCanSkip = false;
    await this.showQuestionScheduleStep(ctx);
  }

  @Action('back_to_can_skip')
  async backToCanSkip(@Ctx() ctx: SceneContext) {
    await ctx.answerCbQuery();
    const questionText = ctx.session._pendingQuestionText;
    const msgId = ctx.session.questionSetupMessageId || ctx.session.messageId;
    await ctx.telegram.editMessageText(
      ctx.chat?.id,
      msgId,
      undefined,
      `"${questionText}"\n\n${MESSAGES.QUESTION_SETUP.CAN_SKIP}`,
      Markup.inlineKeyboard([
        [
          {
            text: 'Да',
            callback_data: 'question_can_skip_yes',
          },
          { text: 'Нет', callback_data: 'question_can_skip_no' },
        ],
      ]),
    );
  }

  @Action('skip_target_value')
  async handleSkipTargetValue(@Ctx() ctx: SceneContext) {
    await ctx.answerCbQuery();
    ctx.session.awaitingTargetValue = false;
    ctx.session._pendingTargetValue = undefined;
    await this.showCanSkipStep(ctx);
  }

  @Action('questions_done')
  async handleQuestionsDone(@Ctx() ctx: SceneContext) {
    await ctx.answerCbQuery();
    await this.saveQuestions(ctx);
  }

  @Command('cancel')
  async cancel(@Ctx() ctx: SceneContext) {
    await ctx.reply('❌ Создание цели отменено');
    await ctx.reply('📋 Раздел "Цели"', GOALS_MENU_KEYBOARD);
    await ctx.scene.leave();
  }

  @On('text')
  async handleText(@Ctx() ctx: SceneContext) {
    if (!ctx.from || !ctx.message || !('text' in ctx.message)) return;

    const text = ctx.message.text;
    const userMessageId = ctx.message.message_id;

    try {
      await ctx.deleteMessage(userMessageId);
    } catch {
      // ignore
    }

    if (!ctx.session.goalName) {
      ctx.session.goalName = text;
      await this.showStartDateStep(ctx);
      return;
    }

    if (ctx.session.awaitingCustomStart) {
      const parseResult = this.dateParser.parse(text);

      if (!parseResult.success || !parseResult.date) {
        await ctx.telegram.editMessageText(
          ctx.chat?.id,
          ctx.session.messageId,
          undefined,
          `📝 Цель: ${ctx.session.goalName}\n\n❌ ${parseResult.error}\n\n${MESSAGES.GOAL_CREATION.CHOOSE_START}\n\nПопробуй ещё раз:`,
          Markup.inlineKeyboard([
            [{ text: '⬅️ Назад', callback_data: 'back_to_start_options' }],
            [{ text: '❌ Отмена', callback_data: 'cancel_goal' }],
          ]),
        );
        return;
      }

      const validation = this.dateParser.validateStartDate(parseResult.date);
      if (!validation.valid) {
        await ctx.telegram.editMessageText(
          ctx.chat?.id,
          ctx.session.messageId,
          undefined,
          `📝 Цель: ${ctx.session.goalName}\n\n❌ ${validation.error}\n\n${MESSAGES.GOAL_CREATION.CHOOSE_START}\n\nПопробуй ещё раз:`,
          Markup.inlineKeyboard([
            [{ text: '⬅️ Назад', callback_data: 'back_to_start_options' }],
            [{ text: '❌ Отмена', callback_data: 'cancel_goal' }],
          ]),
        );
        return;
      }

      ctx.session.startDate = parseResult.date;
      ctx.session.awaitingCustomStart = false;
      await this.showEndDateStep(ctx);
      return;
    }

    if (ctx.session.awaitingCustomEnd) {
      const parseResult = this.dateParser.parse(text);

      if (!parseResult.success || !parseResult.date) {
        await ctx.telegram.editMessageText(
          ctx.chat?.id,
          ctx.session.messageId,
          undefined,
          `📝 Цель: ${ctx.session.goalName}\n📅 Старт: ${formatDate(ctx.session.startDate as Date)}\n\n❌ ${parseResult.error}\n\n${MESSAGES.GOAL_CREATION.CHOOSE_END}\n\nПопробуй ещё раз:`,
          Markup.inlineKeyboard([
            [{ text: '⬅️ Назад', callback_data: 'back_to_end_options' }],
            [{ text: '❌ Отмена', callback_data: 'cancel_goal' }],
          ]),
        );
        return;
      }

      const validation = this.dateParser.validateEndDate(
        parseResult.date,
        ctx.session.startDate as Date,
      );
      if (!validation.valid) {
        await ctx.telegram.editMessageText(
          ctx.chat?.id,
          ctx.session.messageId,
          undefined,
          `📝 Цель: ${ctx.session.goalName}\n📅 Старт: ${formatDate(ctx.session.startDate as Date)}\n\n❌ ${validation.error}\n\n${MESSAGES.GOAL_CREATION.CHOOSE_END}\n\nПопробуй ещё раз:`,
          Markup.inlineKeyboard([
            [{ text: '⬅️ Назад', callback_data: 'back_to_end_options' }],
            [{ text: '❌ Отмена', callback_data: 'cancel_goal' }],
          ]),
        );
        return;
      }

      ctx.session.endDate = parseResult.date;
      ctx.session.awaitingCustomEnd = false;
      await this.askPointA(ctx);
      return;
    }

    if (ctx.session.awaitingIntervalInput) {
      const n = parseInt(text);
      if (isNaN(n) || n < 1) {
        const msgId =
          ctx.session.questionSetupMessageId || ctx.session.messageId;
        await ctx.telegram.editMessageText(
          ctx.chat?.id,
          msgId,
          undefined,
          `❌ Введи число больше 0\n\n${MESSAGES.SCHEDULE.ENTER_INTERVAL}`,
          Markup.inlineKeyboard([
            [
              { text: 'Каждые 2 дня', callback_data: 'interval_2' },
              { text: 'Каждые 3 дня', callback_data: 'interval_3' },
            ],
            [
              { text: 'Раз в неделю', callback_data: 'interval_7' },
              { text: 'Раз в 2 недели', callback_data: 'interval_14' },
            ],
            [{ text: '⬅️ Назад', callback_data: 'back_to_schedule' }],
            [{ text: '❌ Отмена', callback_data: 'cancel_goal' }],
          ]),
        );
        return;
      }

      ctx.session.awaitingIntervalInput = false;
      ctx.session.intervalDays = n;
      ctx.session.scheduleType = 'interval';
      await this.addQuestionWithScheduleToList(ctx);
      return;
    }

    if (ctx.session.awaitingTargetValue) {
      const num = Number(text);
      if (isNaN(num)) {
        const msgId =
          ctx.session.questionSetupMessageId || ctx.session.messageId;
        await ctx.telegram.editMessageText(
          ctx.chat?.id,
          msgId,
          undefined,
          `❌ ${MESSAGES.QUESTION_SETUP.TARGET_VALUE_ERROR}\n\n${MESSAGES.QUESTION_SETUP.TARGET_VALUE}`,
          Markup.inlineKeyboard([
            [
              {
                text: `⏭ ${MESSAGES.QUESTION_SETUP.TARGET_VALUE_SKIP}`,
                callback_data: 'skip_target_value',
              },
            ],
            [{ text: '❌ Отмена', callback_data: 'cancel_goal' }],
          ]),
        );
        return;
      }

      ctx.session.awaitingTargetValue = false;
      ctx.session._pendingTargetValue = text;
      await this.showCanSkipStep(ctx);
      return;
    }

    if (ctx.session.awaitingQuestionText && ctx.session.selectedQuestionType) {
      ctx.session.awaitingQuestionText = false;
      ctx.session._pendingQuestionText = text;

      if (ctx.session.selectedQuestionType === 'number') {
        await this.showTargetValueStep(ctx);
        return;
      }

      await this.showCanSkipStep(ctx);
      return;
    }
  }

  private async showStartDateStep(@Ctx() ctx: SceneContext) {
    const buttons = generateStartDateButtons() as Array<
      Array<{ text: string; callback_data: string }>
    >;
    buttons.push([{ text: '❌ Отмена', callback_data: 'cancel_goal' }]);
    await ctx.telegram.editMessageText(
      ctx.chat?.id,
      ctx.session.messageId,
      undefined,
      `📝 Цель: ${ctx.session.goalName}\n\n${MESSAGES.GOAL_CREATION.CHOOSE_START}`,
      Markup.inlineKeyboard(buttons),
    );
  }

  private async showEndDateStep(@Ctx() ctx: SceneContext) {
    const buttons = generateEndDateButtons() as Array<
      Array<{ text: string; callback_data: string }>
    >;
    buttons.push([{ text: '❌ Отмена', callback_data: 'cancel_goal' }]);
    await ctx.telegram.editMessageText(
      ctx.chat?.id,
      ctx.session.messageId,
      undefined,
      `📝 Цель: ${ctx.session.goalName}\n📅 Старт: ${formatDate(ctx.session.startDate as Date)}\n\n${MESSAGES.GOAL_CREATION.CHOOSE_END}`,
      Markup.inlineKeyboard(buttons),
    );
  }

  private async askPointA(@Ctx() ctx: SceneContext) {
    await ctx.editMessageText(
      `📝 Цель: ${ctx.session.goalName}\n📅 С: ${formatDate(ctx.session.startDate as Date)}\n📅 По: ${formatDate(ctx.session.endDate as Date)}\n\n${MESSAGES.POINT_A.QUESTION}`,
      Markup.inlineKeyboard([
        [{ text: 'Да', callback_data: 'pointa_yes' }],
        [{ text: 'Нет', callback_data: 'pointa_no' }],
        [{ text: '❌ Отмена', callback_data: 'cancel_goal' }],
      ]),
    );
  }

  private async showTargetValueStep(@Ctx() ctx: SceneContext) {
    ctx.session.awaitingTargetValue = true;
    const msgId = ctx.session.questionSetupMessageId || ctx.session.messageId;
    await ctx.telegram.editMessageText(
      ctx.chat?.id,
      msgId,
      undefined,
      `"${ctx.session._pendingQuestionText}"\n\n${MESSAGES.QUESTION_SETUP.TARGET_VALUE}`,
      Markup.inlineKeyboard([
        [
          {
            text: `⏭ ${MESSAGES.QUESTION_SETUP.TARGET_VALUE_SKIP}`,
            callback_data: 'skip_target_value',
          },
        ],
        [{ text: '❌ Отмена', callback_data: 'cancel_goal' }],
      ]),
    );
  }

  private async showCanSkipStep(@Ctx() ctx: SceneContext) {
    const questionText = ctx.session._pendingQuestionText;
    const msgId = ctx.session.questionSetupMessageId || ctx.session.messageId;
    await ctx.telegram.editMessageText(
      ctx.chat?.id,
      msgId,
      undefined,
      `"${questionText}"\n\n${MESSAGES.QUESTION_SETUP.CAN_SKIP}`,
      Markup.inlineKeyboard([
        [
          {
            text: 'Да',
            callback_data: 'question_can_skip_yes',
          },
          { text: 'Нет', callback_data: 'question_can_skip_no' },
        ],
      ]),
    );
  }

  private async showQuestionScheduleStep(@Ctx() ctx: SceneContext) {
    const questionText = ctx.session._pendingQuestionText;
    const msgId = ctx.session.questionSetupMessageId || ctx.session.messageId;
    try {
      await ctx.telegram.editMessageText(
        ctx.chat?.id,
        msgId,
        undefined,
        `📅 Как часто отвечать на вопрос:\n"${questionText}"\n\n${MESSAGES.SCHEDULE.CHOOSE_FREQUENCY}`,
        Markup.inlineKeyboard([
          [{ text: MESSAGES.SCHEDULE.DAILY, callback_data: 'schedule_daily' }],
          [
            {
              text: MESSAGES.SCHEDULE.WEEKLY_DAYS,
              callback_data: 'schedule_weekly',
            },
          ],
          [
            {
              text: MESSAGES.SCHEDULE.INTERVAL,
              callback_data: 'schedule_interval',
            },
          ],
          [{ text: '⬅️ Назад', callback_data: 'back_to_can_skip' }],
          [{ text: '❌ Отмена', callback_data: 'cancel_goal' }],
        ]),
      );
    } catch {
      const msg = await ctx.reply(
        `📅 Как часто отвечать на вопрос:\n"${questionText}"\n\n${MESSAGES.SCHEDULE.CHOOSE_FREQUENCY}`,
        Markup.inlineKeyboard([
          [{ text: MESSAGES.SCHEDULE.DAILY, callback_data: 'schedule_daily' }],
          [
            {
              text: MESSAGES.SCHEDULE.WEEKLY_DAYS,
              callback_data: 'schedule_weekly',
            },
          ],
          [
            {
              text: MESSAGES.SCHEDULE.INTERVAL,
              callback_data: 'schedule_interval',
            },
          ],
          [{ text: '⬅️ Назад', callback_data: 'back_to_can_skip' }],
          [{ text: '❌ Отмена', callback_data: 'cancel_goal' }],
        ]),
      );
      ctx.session.questionSetupMessageId = msg.message_id;
    }
  }

  private async showDayPicker(@Ctx() ctx: SceneContext) {
    const keyboard = generateDayPickerKeyboard(ctx.session.selectedDays || []);
    await ctx.editMessageText(
      MESSAGES.SCHEDULE.PICK_DAYS,
      Markup.inlineKeyboard(keyboard),
    );
  }

  private async showIntervalStep(@Ctx() ctx: SceneContext) {
    ctx.session.awaitingIntervalInput = true;
    await ctx.editMessageText(
      `${MESSAGES.SCHEDULE.ENTER_INTERVAL}\n\nИли напиши число:`,
      Markup.inlineKeyboard([
        [
          { text: 'Каждые 2 дня', callback_data: 'interval_2' },
          { text: 'Каждые 3 дня', callback_data: 'interval_3' },
        ],
        [
          { text: 'Раз в неделю', callback_data: 'interval_7' },
          { text: 'Раз в 2 недели', callback_data: 'interval_14' },
        ],
        [{ text: '⬅️ Назад', callback_data: 'back_to_schedule' }],
        [{ text: '❌ Отмена', callback_data: 'cancel_goal' }],
      ]),
    );
  }

  @Action('back_to_schedule')
  async backToSchedule(@Ctx() ctx: SceneContext) {
    await ctx.answerCbQuery();
    ctx.session.awaitingIntervalInput = false;
    await this.showQuestionScheduleStep(ctx);
  }

  private async saveGoal(@Ctx() ctx: SceneContext) {
    if (
      !ctx.from ||
      !ctx.session.goalName ||
      !ctx.session.startDate ||
      !ctx.session.endDate
    ) {
      return;
    }

    const user = await this.authService.findOrCreateTelegramUser(
      ctx.from.id,
      {},
    );

    const goal = await this.goalService.create(user.id, {
      goal_name: ctx.session.goalName,
      goal_start: toISODate(ctx.session.startDate),
      goal_end: toISODate(ctx.session.endDate),
    });

    ctx.session.goalId = goal.id;

    const config = GOAL_TYPE_CONFIG[ctx.session.goalType || GOAL_TYPES.SIMPLE];

    await ctx.editMessageText(
      `${MESSAGES.GOAL_CREATION.SUCCESS}\n\n${config.emoji} ${ctx.session.goalName}\n📅 С: ${formatDate(ctx.session.startDate)}\n📅 По: ${formatDate(ctx.session.endDate)}`,
    );

    await this.offerQuestionSetup(ctx);
  }

  private async offerQuestionSetup(@Ctx() ctx: SceneContext) {
    const msg = await ctx.reply(
      MESSAGES.QUESTION_SETUP.OFFER,
      Markup.inlineKeyboard([
        [{ text: '✅ Да, настроить', callback_data: 'setup_questions' }],
        [{ text: '⏭ Пропустить', callback_data: 'skip_questions' }],
      ]),
    );
    ctx.session.questionSetupMessageId = msg.message_id;
  }

  private async showQuestionTypePicker(@Ctx() ctx: SceneContext) {
    const count = ctx.session.questionsToAdd?.length || 0;
    const countText =
      count > 0 ? `\n\n${MESSAGES.QUESTION_SETUP.ADDED(count)}` : '';

    const typeButtons = Object.values(QUESTION_TYPES).map((config) => [
      {
        text: config.label,
        callback_data: `qtype_${config.type}`,
      },
    ]);

    const keyboard = [
      ...typeButtons,
      ...(count > 0
        ? [
            [
              {
                text: `✅ ${MESSAGES.QUESTION_SETUP.DONE}`,
                callback_data: 'questions_done',
              },
            ],
          ]
        : []),
      [{ text: '⏭ Пропустить', callback_data: 'skip_questions' }],
    ];

    const msgId = ctx.session.questionSetupMessageId || ctx.session.messageId;
    try {
      await ctx.telegram.editMessageText(
        ctx.chat?.id,
        msgId,
        undefined,
        `${MESSAGES.QUESTION_SETUP.CHOOSE_TYPE}${countText}`,
        Markup.inlineKeyboard(keyboard),
      );
    } catch {
      const msg = await ctx.reply(
        `${MESSAGES.QUESTION_SETUP.CHOOSE_TYPE}${countText}`,
        Markup.inlineKeyboard(keyboard),
      );
      ctx.session.questionSetupMessageId = msg.message_id;
    }
  }

  private async addQuestionWithScheduleToList(ctx: SceneContext) {
    const questionText = ctx.session._pendingQuestionText;
    const type = ctx.session.selectedQuestionType;
    const canSkip = ctx.session._pendingCanSkip;

    if (
      !questionText ||
      !type ||
      canSkip === undefined ||
      ctx.session.scheduleType === undefined
    ) {
      return;
    }

    if (!ctx.session.questionsToAdd) {
      ctx.session.questionsToAdd = [];
    }

    ctx.session.questionsToAdd.push({
      question: questionText,
      type,
      canSkip,
      scheduleType: ctx.session.scheduleType,
      selectedDays: ctx.session.selectedDays
        ? [...ctx.session.selectedDays]
        : undefined,
      intervalDays: ctx.session.intervalDays,
      targetValue: ctx.session._pendingTargetValue,
    });

    ctx.session._pendingQuestionText = undefined;
    ctx.session._pendingCanSkip = undefined;
    ctx.session._pendingTargetValue = undefined;
    ctx.session.selectedQuestionType = undefined;
    ctx.session.scheduleType = undefined;
    ctx.session.selectedDays = undefined;
    ctx.session.intervalDays = undefined;

    await this.showQuestionTypePicker(ctx);
  }

  private async saveQuestions(@Ctx() ctx: SceneContext) {
    const goalId = ctx.session.goalId;
    const questions = ctx.session.questionsToAdd;

    if (goalId && questions && questions.length > 0) {
      await this.goalService.addQuestionsWithSchedules(goalId, questions);
    }

    const msgId = ctx.session.questionSetupMessageId || ctx.session.messageId;
    try {
      await ctx.telegram.editMessageText(
        ctx.chat?.id,
        msgId,
        undefined,
        `✅ Сохранено вопросов: ${questions?.length || 0}`,
      );
    } catch {
      // ignore
    }

    await ctx.reply('📋 Раздел "Цели"', GOALS_MENU_KEYBOARD);
    await ctx.scene.leave();
  }
}
