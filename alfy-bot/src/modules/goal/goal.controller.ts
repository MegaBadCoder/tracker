import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { GoalStatus } from '../../shared/constants/goal-statuses';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { GoalService } from './application/goal.service';
import {
  GoalDto,
  QuestionDto,
  ScheduleDto,
} from './dto/goal-response.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';

interface AuthRequest extends Request {
  user: JwtPayload;
}

@ApiTags('goals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('goals')
export class GoalController {
  constructor(private readonly goalService: GoalService) { }

  @Get()
  @ApiOperation({ summary: 'Список целей пользователя' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['active', 'completed'],
    description:
      'Фильтр по статусу. Без параметра — все цели (кроме удалённых)',
  })
  @ApiOkResponse({ type: [GoalDto] })
  @ApiUnauthorizedResponse({ description: 'Невалидный или отсутствующий JWT' })
  async findAll(
    @Request() req: AuthRequest,
    @Query('status') status?: string,
  ): Promise<GoalDto[]> {
    const userId = req.user.sub;

    if (status) {
      return this.goalService.findByStatus(
        userId,
        status as GoalStatus,
      ) as Promise<GoalDto[]>;
    }

    return this.goalService.findAllByUser(userId) as Promise<GoalDto[]>;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Цель по ID с вопросами и расписаниями' })
  @ApiOkResponse({ type: GoalDto })
  @ApiNotFoundResponse({ description: 'Цель не найдена' })
  @ApiUnauthorizedResponse({ description: 'Невалидный или отсутствующий JWT' })
  async findOne(
    @Request() req: AuthRequest,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<GoalDto> {
    const goal = await this.goalService.findById(id);

    if (!goal || goal.user_id !== req.user.sub) {
      throw new NotFoundException(`Goal #${id} not found`);
    }

    return goal as GoalDto;
  }

  @Get('questions/:questionId')
  @ApiOperation({ summary: 'Вопрос по ID с расписанием' })
  @ApiOkResponse({ type: QuestionDto })
  @ApiNotFoundResponse({ description: 'Вопрос не найден' })
  @ApiUnauthorizedResponse({ description: 'Невалидный или отсутствующий JWT' })
  async findQuestion(
    @Request() req: AuthRequest,
    @Param('questionId', ParseIntPipe) questionId: number,
  ): Promise<QuestionDto> {
    const question = await this.goalService.findQuestionById(questionId);

    const ownerUserId = question?.goal?.user_id ?? question?.user_id;
    if (!question || ownerUserId !== req.user.sub) {
      throw new NotFoundException(`Question #${questionId} not found`);
    }

    return question as unknown as QuestionDto;
  }

  @Patch('questions/:questionId/schedule')
  @ApiOperation({
    summary: 'Изменить расписание вопроса',
    description:
      'Варианты:\n' +
      '- **Каждый день:** `{ "frequency_type": "daily" }`\n' +
      '- **По дням недели:** `{ "frequency_type": "weekly_days", "days_of_week": [1,3,5] }` (Пн, Ср, Пт)\n' +
      '- **Раз в N дней:** `{ "frequency_type": "interval", "interval_days": 3 }`',
  })
  @ApiOkResponse({ type: ScheduleDto })
  @ApiNotFoundResponse({ description: 'Вопрос не найден' })
  @ApiUnauthorizedResponse({ description: 'Невалидный или отсутствующий JWT' })
  async updateSchedule(
    @Request() req: AuthRequest,
    @Param('questionId', ParseIntPipe) questionId: number,
    @Body() dto: UpdateScheduleDto,
  ): Promise<ScheduleDto> {
    const question = await this.goalService.findQuestionById(questionId);

    const ownerUserId = question?.goal?.user_id ?? question?.user_id;
    if (!question || ownerUserId !== req.user.sub) {
      throw new NotFoundException(`Question #${questionId} not found`);
    }

    return this.goalService.updateQuestionSchedule(questionId, {
      frequency_type: dto.frequency_type,
      days_of_week: dto.days_of_week,
      interval_days: dto.interval_days,
    }) as unknown as Promise<ScheduleDto>;
  }
}
