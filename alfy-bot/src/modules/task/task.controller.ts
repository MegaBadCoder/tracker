import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { TaskService } from './task.service';
import { TimerSessionService } from './timer-session.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { UpsertTimerSessionDto } from './dto/upsert-timer-session.dto';

interface AuthRequest extends Request {
  user: JwtPayload;
}

@ApiTags('tasks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tasks')
export class TaskController {
  constructor(
    private readonly taskService: TaskService,
    private readonly timerService: TimerSessionService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Список задач пользователя' })
  async getAll(@Request() req: AuthRequest) {
    return this.taskService.getAll(req.user.sub);
  }

  @Post()
  @ApiOperation({ summary: 'Создать задачу' })
  async create(@Request() req: AuthRequest, @Body() dto: CreateTaskDto) {
    return this.taskService.create(req.user.sub, dto);
  }

  // Timer routes must be before :id routes to avoid route conflicts
  @Get('timer')
  @ApiOperation({ summary: 'Получить последнюю сессию таймера' })
  async getActiveTimer(@Request() req: AuthRequest) {
    return this.timerService.getLatest(req.user.sub);
  }

  @Put('timer')
  @ApiOperation({ summary: 'Создать/обновить сессию таймера' })
  async upsertTimer(
    @Request() req: AuthRequest,
    @Body() dto: UpsertTimerSessionDto,
  ) {
    return this.timerService.upsert(req.user.sub, dto);
  }

  @Delete('timer')
  @ApiOperation({ summary: 'Деактивировать таймер' })
  async deactivateTimer(@Request() req: AuthRequest) {
    return this.timerService.deactivate(req.user.sub);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Обновить задачу' })
  async update(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.taskService.update(req.user.sub, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Удалить задачу' })
  async delete(@Request() req: AuthRequest, @Param('id') id: string) {
    return this.taskService.delete(req.user.sub, id);
  }

  @Patch(':id/pomodoro')
  @ApiOperation({ summary: 'Обновить прогресс помодоро' })
  async updatePomodoro(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Body() body: { pomodoroCompleted: number },
  ) {
    return this.taskService.updatePomodoro(
      req.user.sub,
      id,
      body.pomodoroCompleted,
    );
  }
}
