import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtOrApiTokenGuard } from '../auth/guards/jwt-or-api-token.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { TaskService, UpdateTaskResponse } from './task.service';
import { TimerSessionService } from './timer-session.service';
import { OverdueRecurringService } from './overdue-recurring.service';
import { UserSettingsPort } from './domain/user-settings.port';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { UpdateChecklistDto } from './dto/update-checklist.dto';
import { UpdatePomodoroConfigDto } from './dto/update-pomodoro-config.dto';
import { UpsertTimerSessionDto } from './dto/upsert-timer-session.dto';
import { ReorderInboxTasksDto } from './dto/reorder-inbox-tasks.dto';
import { MoveTaskToInboxDto } from './dto/move-task-inbox.dto';
import { MaterializeOccurrenceDto } from './dto/materialize-occurrence.dto';

interface AuthRequest extends Request {
  user: JwtPayload;
}

@ApiTags('tasks')
@ApiBearerAuth()
@UseGuards(JwtOrApiTokenGuard)
@Controller('tasks')
export class TaskController {
  constructor(
    private readonly taskService: TaskService,
    private readonly timerService: TimerSessionService,
    private readonly overdueService: OverdueRecurringService,
    private readonly userSettings: UserSettingsPort,
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

  // Dev-only: trigger overdue-recurring cron for current user immediately
  @Post('_dev/process-overdue')
  @ApiOperation({
    summary: 'DEV: запустить overdue-recurring обработку прямо сейчас',
  })
  async processOverdueDev(@Request() req: AuthRequest) {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('Dev-only endpoint');
    }
    const userId = req.user.sub;
    const tz = await this.userSettings.getTimezone(userId);
    await this.overdueService.processForUser(userId, tz, new Date());
    return { ok: true, userId, tz };
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

  // Inbox reorder/move routes must be before :id routes to avoid route conflicts
  @Patch('reorder')
  @ApiOperation({ summary: 'Переупорядочить задачи в Inbox' })
  async reorderInbox(
    @Request() req: AuthRequest,
    @Body() dto: ReorderInboxTasksDto,
  ) {
    return this.taskService.reorderInboxTasks(req.user.sub, dto);
  }

  @Patch(':id/move-to-inbox')
  @ApiOperation({ summary: 'Переместить задачу в Inbox' })
  async moveToInbox(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: MoveTaskToInboxDto,
  ) {
    return this.taskService.moveToInbox(req.user.sub, id, dto);
  }

  @Put(':id/checklist')
  @ApiOperation({ summary: 'Заменить чеклист задачи' })
  async updateChecklist(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: UpdateChecklistDto,
  ) {
    return this.taskService.updateChecklist(req.user.sub, id, dto);
  }

  @Put(':id/pomodoro-config')
  @ApiOperation({ summary: 'Обновить/создать помодоро-конфигурацию' })
  async updatePomodoroConfig(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: UpdatePomodoroConfigDto,
  ) {
    return this.taskService.updatePomodoroConfig(req.user.sub, id, dto);
  }

  @Delete(':id/pomodoro-config')
  @ApiOperation({ summary: 'Удалить помодоро-конфигурацию' })
  async deletePomodoroConfig(
    @Request() req: AuthRequest,
    @Param('id') id: string,
  ) {
    return this.taskService.updatePomodoroConfig(req.user.sub, id, null);
  }

  @Post(':id/materialize')
  @ApiOperation({ summary: 'Проявить виртуальное вхождение повторяющейся задачи' })
  async materialize(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: MaterializeOccurrenceDto,
  ) {
    return this.taskService.materializeOccurrence(req.user.sub, id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Обновить задачу' })
  async update(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
  ): Promise<UpdateTaskResponse> {
    return this.taskService.update(req.user.sub, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Удалить задачу' })
  async delete(@Request() req: AuthRequest, @Param('id') id: string) {
    return this.taskService.delete(req.user.sub, id);
  }

  @Patch(':id/pomodoro')
  @ApiOperation({ summary: 'Инкремент выполненных помодоро' })
  async incrementPomodoro(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Body() body: { increment: number },
  ) {
    await this.taskService.incrementPomodoro(req.user.sub, id, body.increment);
  }
}
