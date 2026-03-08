import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { QuestionService } from './application/question.service';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { QuestionDto } from '../goal/dto/goal-response.dto';

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
  @ApiOperation({ summary: 'Все активные привычки пользователя' })
  @ApiOkResponse({ type: [QuestionDto] })
  @ApiUnauthorizedResponse({ description: 'Невалидный или отсутствующий JWT' })
  async getHabits(@Request() req: AuthRequest): Promise<QuestionDto[]> {
    const habits = await this.questionService.getHabits(req.user.sub);
    return habits as unknown as QuestionDto[];
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
    // updateQuestion does ownership check and returns updated entity,
    // but for GET we just need to read — use updateQuestion with empty data
    // Actually let's just use the service to check ownership via a read
    const question = await this.questionService.updateQuestion(
      id,
      req.user.sub,
      {},
    );
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
}
