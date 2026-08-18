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
  Put,
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
import { JwtOrApiTokenGuard } from '../auth/guards/jwt-or-api-token.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { GoalService } from './application/goal.service';
import { AddQuestionsDto } from './dto/add-questions.dto';
import { CreateGoalDto } from './dto/create-goal.dto';
import { GoalDto, QuestionDto } from './dto/goal-response.dto';
import { SetGoalTasksDto } from './dto/set-goal-tasks.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';
import { TaskGoalQueryPort } from '../task/domain/task-goal-query.port';

interface AuthRequest extends Request {
  user: JwtPayload;
}

@ApiTags('goals')
@ApiBearerAuth()
@UseGuards(JwtOrApiTokenGuard)
@Controller('goals')
export class GoalController {
  constructor(
    private readonly goalService: GoalService,
    private readonly taskGoals: TaskGoalQueryPort,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Список целей пользователя' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['active', 'completed', 'archived', 'deleted'],
    description:
      'Фильтр по статусу. Без параметра — все цели (кроме удалённых)',
  })
  @ApiQuery({
    name: 'scope',
    required: false,
    enum: ['global', 'regular', 'all'],
    description:
      'Фильтр по типу цели: global — только глобальные, regular — только обычные, all/без параметра — все',
  })
  @ApiOkResponse({ type: [GoalDto] })
  @ApiUnauthorizedResponse({ description: 'Невалидный или отсутствующий JWT' })
  async findAll(
    @Request() req: AuthRequest,
    @Query('status') status?: string,
    @Query('scope') scope?: 'global' | 'regular' | 'all',
  ): Promise<GoalDto[]> {
    const userId = req.user.sub;

    if (status) {
      return this.goalService.findByStatus(
        userId,
        status as GoalStatus,
        scope,
      ) as Promise<GoalDto[]>;
    }

    return this.goalService.findAllByUser(userId, scope) as Promise<GoalDto[]>;
  }

  @Get(':id/tasks')
  @ApiOperation({ summary: 'Задачи, привязанные к цели' })
  @ApiOkResponse({ description: 'Список задач цели' })
  @ApiNotFoundResponse({ description: 'Цель не найдена' })
  async listTasks(
    @Request() req: AuthRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.assertOwnedGoal(req, id);
    return this.taskGoals.listByGoal(req.user.sub, id);
  }

  @Put(':id/tasks')
  @ApiOperation({ summary: 'Заменить набор задач цели' })
  @ApiOkResponse({ description: '{ taskIds }' })
  @ApiNotFoundResponse({ description: 'Цель или задача не найдена' })
  async setTasks(
    @Request() req: AuthRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetGoalTasksDto,
  ) {
    await this.assertOwnedGoal(req, id);
    return this.taskGoals.replaceTaskLinksForGoal(
      req.user.sub,
      id,
      dto.taskIds,
    );
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

    if (goal.is_global) {
      goal.children = await this.goalService.findChildren(goal.id);
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
    if (dto.is_global && dto.parent_goal_id) {
      throw new BadRequestException(
        'global goal cannot have a parent (parent_goal_id)',
      );
    }

    if (dto.goal_start && dto.goal_end) {
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
    }

    if (dto.parent_goal_id) {
      await this.goalService.assertValidParent(
        req.user.sub,
        dto.parent_goal_id,
      );
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
    const goal = await this.assertOwnedGoal(req, id);

    if (goal.is_global) {
      throw new BadRequestException('global goal cannot have questions');
    }

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
    const goal = await this.assertOwnedGoal(req, id);

    if (dto.status) {
      await this.goalService.updateGoalStatus(id, dto.status);
      if (dto.status !== 'completed') {
        await this.goalService.update(id, { outcome: null });
      }
    }
    if (dto.outcome !== undefined) {
      await this.goalService.update(id, { outcome: dto.outcome });
    }
    if (dto.goal_name) {
      await this.goalService.update(id, { goal_name: dto.goal_name });
    }
    if ('parent_goal_id' in dto) {
      if (dto.parent_goal_id !== null && dto.parent_goal_id !== undefined) {
        if (goal.is_global) {
          throw new BadRequestException('global goal cannot have a parent');
        }
        await this.goalService.assertValidParent(
          req.user.sub,
          dto.parent_goal_id,
        );
        await this.goalService.update(id, {
          parent_goal_id: dto.parent_goal_id,
        });
      } else {
        await this.goalService.update(id, { parent_goal_id: null });
      }
    }

    const updated = await this.goalService.findById(id);
    if (!updated) {
      throw new NotFoundException(`Goal #${id} not found`);
    }
    return updated as GoalDto;
  }

  private async assertOwnedGoal(req: AuthRequest, id: number): Promise<Goal> {
    const goal = await this.goalService.findById(id);
    if (!goal || goal.user_id !== req.user.sub) {
      throw new NotFoundException(`Goal #${id} not found`);
    }
    return goal;
  }
}
