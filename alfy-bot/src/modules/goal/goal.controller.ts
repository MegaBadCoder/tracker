import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { GoalStatus } from '../../shared/constants/goal-statuses';
import { Goal } from '../../shared/entities';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { GoalService } from './application/goal.service';
import { AddQuestionsDto } from './dto/add-questions.dto';
import { CreateGoalDto } from './dto/create-goal.dto';
import { GoalDto, QuestionDto } from './dto/goal-response.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';

interface AuthRequest extends Request {
  user: JwtPayload;
}

@ApiTags('goals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('goals')
export class GoalController {
  constructor(private readonly goalService: GoalService) {}

  @Get()
  @ApiOperation({ summary: 'Список целей пользователя' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['active', 'completed', 'archived', 'deleted'],
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

  @Post()
  @ApiOperation({ summary: 'Создать новую цель' })
  @ApiCreatedResponse({ type: GoalDto })
  @ApiBadRequestResponse({ description: 'Невалидное тело запроса' })
  @ApiUnauthorizedResponse({ description: 'Невалидный или отсутствующий JWT' })
  async create(
    @Request() req: AuthRequest,
    @Body() dto: CreateGoalDto,
  ): Promise<GoalDto> {
    const startMs = Date.parse(dto.goal_start);
    const endMs = Date.parse(dto.goal_end);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
      throw new BadRequestException(
        'goal_start или goal_end не является валидной датой',
      );
    }
    if (endMs <= startMs) {
      throw new BadRequestException('goal_end должен быть позже goal_start');
    }

    const created = await this.goalService.create(req.user.sub, dto);
    return { ...created, questions: [] } as GoalDto;
  }

  @Post(':id/questions')
  @ApiOperation({ summary: 'Добавить вопросы к цели с расписаниями' })
  @ApiCreatedResponse({ type: [QuestionDto] })
  @ApiBadRequestResponse({ description: 'Невалидное тело запроса' })
  @ApiNotFoundResponse({ description: 'Цель не найдена' })
  @ApiUnauthorizedResponse({ description: 'Невалидный или отсутствующий JWT' })
  async addQuestions(
    @Request() req: AuthRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddQuestionsDto,
  ): Promise<QuestionDto[]> {
    await this.assertOwnedGoal(req, id);

    for (const q of dto.questions) {
      if (q.scheduleType === 'weekly_days') {
        if (!q.selectedDays || q.selectedDays.length < 1) {
          throw new BadRequestException(
            'selectedDays обязателен (минимум 1 элемент) при scheduleType=weekly_days',
          );
        }
      }
      if (q.scheduleType === 'interval') {
        if (!q.intervalDays || q.intervalDays < 1) {
          throw new BadRequestException(
            'intervalDays обязателен (>=1) при scheduleType=interval',
          );
        }
      }
    }

    const questions = await this.goalService.addQuestionsWithSchedules(
      id,
      dto.questions,
    );
    return questions as QuestionDto[];
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Обновить цель (статус и/или имя)' })
  @ApiOkResponse({ type: GoalDto })
  @ApiNotFoundResponse({ description: 'Цель не найдена' })
  @ApiUnauthorizedResponse({ description: 'Невалидный или отсутствующий JWT' })
  async update(
    @Request() req: AuthRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateGoalDto,
  ): Promise<GoalDto> {
    await this.assertOwnedGoal(req, id);

    if (dto.status) {
      await this.goalService.updateGoalStatus(id, dto.status);
    }
    if (dto.goal_name) {
      await this.goalService.update(id, { goal_name: dto.goal_name });
    }

    const updated = await this.goalService.findById(id);
    if (!updated) {
      throw new NotFoundException(`Goal #${id} not found`);
    }
    return updated as GoalDto;
  }

  private async assertOwnedGoal(
    req: AuthRequest,
    id: number,
  ): Promise<Goal> {
    const goal = await this.goalService.findById(id);
    if (!goal || goal.user_id !== req.user.sub) {
      throw new NotFoundException(`Goal #${id} not found`);
    }
    return goal;
  }
}
