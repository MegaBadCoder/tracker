import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { QuestionService } from './application/question.service';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { UpdateScheduleDto } from '../goal/dto/update-schedule.dto';
import { HabitWithHistoryDto } from './dto/habit-response.dto';
import { QuestionDto, ScheduleDto } from '../goal/dto/goal-response.dto';

interface AuthRequest extends Request {
  user: JwtPayload;
}

@ApiTags('questions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('questions')
export class QuestionController {
  constructor(private readonly questionService: QuestionService) {}

  @Get('habits')
  @ApiOperation({ summary: 'Все активные привычки пользователя с историей' })
  @ApiQuery({ name: 'days', required: false, enum: [7, 14, 30] })
  @ApiOkResponse({ type: [HabitWithHistoryDto] })
  @ApiUnauthorizedResponse({ description: 'Невалидный или отсутствующий JWT' })
  async getHabits(
    @Request() req: AuthRequest,
    @Query('days', new DefaultValuePipe(7), ParseIntPipe) days: number,
  ): Promise<HabitWithHistoryDto[]> {
    return this.questionService.getHabitsWithHistory(req.user.sub, days);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Вопрос по ID' })
  @ApiOkResponse({ type: QuestionDto })
  @ApiNotFoundResponse({ description: 'Вопрос не найден' })
  @ApiUnauthorizedResponse({ description: 'Невалидный или отсутствующий JWT' })
  async findOne(
    @Request() req: AuthRequest,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<QuestionDto> {
    const question = await this.questionService.findById(id, req.user.sub);
    return question as unknown as QuestionDto;
  }

  @Post('habits')
  @ApiOperation({ summary: 'Создать привычку' })
  @ApiCreatedResponse({ type: QuestionDto })
  @ApiUnauthorizedResponse({ description: 'Невалидный или отсутствующий JWT' })
  async createHabit(
    @Request() req: AuthRequest,
    @Body() dto: CreateQuestionDto,
  ): Promise<QuestionDto> {
    const habit = await this.questionService.createHabit(req.user.sub, dto);
    return habit as unknown as QuestionDto;
  }

  @Patch(':id/schedule')
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
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateScheduleDto,
  ): Promise<ScheduleDto> {
    return this.questionService.updateSchedule(id, req.user.sub, {
      frequency_type: dto.frequency_type,
      days_of_week: dto.days_of_week,
      interval_days: dto.interval_days,
    }) as unknown as Promise<ScheduleDto>;
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Обновить вопрос' })
  @ApiOkResponse({ type: QuestionDto })
  @ApiNotFoundResponse({ description: 'Вопрос не найден' })
  @ApiUnauthorizedResponse({ description: 'Невалидный или отсутствующий JWT' })
  async update(
    @Request() req: AuthRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateQuestionDto,
  ): Promise<QuestionDto> {
    const question = await this.questionService.updateQuestion(
      id,
      req.user.sub,
      dto,
    );
    return question as unknown as QuestionDto;
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Деактивировать вопрос (soft delete)' })
  @ApiOkResponse({ description: 'Вопрос деактивирован' })
  @ApiNotFoundResponse({ description: 'Вопрос не найден' })
  @ApiUnauthorizedResponse({ description: 'Невалидный или отсутствующий JWT' })
  async deactivate(
    @Request() req: AuthRequest,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    await this.questionService.deactivate(id, req.user.sub);
  }

  @Get(':id/answer-count')
  @ApiOperation({
    summary: 'Количество сохранённых ответов на вопрос',
    description:
      'Используется фронтом, чтобы предупредить о неоднородности интерпретации при смене типа вопроса.',
  })
  @ApiOkResponse({ schema: { example: { count: 12 } } })
  @ApiNotFoundResponse({ description: 'Вопрос не найден' })
  @ApiUnauthorizedResponse({ description: 'Невалидный или отсутствующий JWT' })
  async getAnswerCount(
    @Request() req: AuthRequest,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ count: number }> {
    const count = await this.questionService.countAnswers(id, req.user.sub);
    return { count };
  }
}
