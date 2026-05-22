import {
  BadRequestException,
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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { JwtOrApiTokenGuard } from '../auth/guards/jwt-or-api-token.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { ReportService } from '../report/application/report.service';
import { QuestionService } from './application/question.service';
import { AnswerQuestionDto } from './dto/answer-question.dto';
import { CreateQuestionDto } from './dto/create-question.dto';
import { PhotoGalleryEntryDto } from './dto/photo-gallery-response.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { UploadPhotoAnswerDto } from './dto/upload-photo-answer.dto';
import { UpdateScheduleDto } from '../goal/dto/update-schedule.dto';
import { HabitWithHistoryDto } from './dto/habit-response.dto';
import { QuestionDto, ScheduleDto } from '../goal/dto/goal-response.dto';

interface AuthRequest extends Request {
  user: JwtPayload;
}

@ApiTags('questions')
@ApiBearerAuth()
@UseGuards(JwtOrApiTokenGuard)
@Controller('questions')
export class QuestionController {
  constructor(
    private readonly questionService: QuestionService,
    private readonly reportService: ReportService,
  ) {}

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

  @Post(':id/answers')
  @ApiOperation({ summary: 'Отметить ответ на вопрос за дату' })
  @ApiCreatedResponse({ schema: { example: { ok: true } } })
  @ApiUnauthorizedResponse({ description: 'Невалидный или отсутствующий JWT' })
  async answerQuestion(
    @Request() req: AuthRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AnswerQuestionDto,
  ): Promise<{ ok: true }> {
    await this.reportService.addAnswer(
      req.user.sub,
      id,
      dto.scheduled_date,
      dto.answer,
    );
    return { ok: true };
  }

  @Post(':id/answers/photo')
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (req, file, cb) =>
        /^image\//.test(file.mimetype)
          ? cb(null, true)
          : cb(new BadRequestException('Only images are allowed'), false),
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        photo: { type: 'string', format: 'binary' },
        scheduled_date: { type: 'string', example: '2026-05-22' },
      },
      required: ['photo', 'scheduled_date'],
    },
  })
  @ApiOperation({ summary: 'Загрузить фото-ответ на photo-вопрос' })
  @ApiCreatedResponse({ schema: { example: { ok: true } } })
  async uploadPhotoAnswer(
    @Request() req: AuthRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UploadPhotoAnswerDto,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<{ ok: true }> {
    if (!file) throw new BadRequestException('photo file is required');
    await this.reportService.addPhotoAnswer(
      req.user.sub,
      id,
      dto.scheduled_date,
      {
        buffer: file.buffer,
        mime: file.mimetype,
      },
    );
    return { ok: true };
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

  @Get(':id/photo-gallery')
  @ApiOperation({
    summary: 'Галерея фото-ответов (DESC по дате, presigned URL TTL 1ч)',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiOkResponse({ type: [PhotoGalleryEntryDto] })
  async getPhotoGallery(
    @Request() req: AuthRequest,
    @Param('id', ParseIntPipe) id: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ): Promise<PhotoGalleryEntryDto[]> {
    return this.reportService.getPhotoGallery(
      req.user.sub,
      id,
      limit,
      offset,
    ) as Promise<PhotoGalleryEntryDto[]>;
  }
}
