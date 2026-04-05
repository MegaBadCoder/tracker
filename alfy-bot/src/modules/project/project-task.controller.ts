import {
  Body,
  Controller,
  Param,
  Patch,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { ProjectTaskService } from './project-task.service';
import { MoveTaskDto } from './dto/move-task.dto';
import { ReorderTasksDto } from './dto/reorder-tasks.dto';

interface AuthRequest extends Request {
  user: JwtPayload;
}

@ApiTags('project-tasks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/tasks')
export class ProjectTaskController {
  constructor(private readonly projectTaskService: ProjectTaskService) {}

  @Patch('reorder')
  @ApiOperation({ summary: 'Изменить порядок задач в проекте' })
  async reorder(
    @Request() req: AuthRequest,
    @Param('projectId') projectId: string,
    @Body() dto: ReorderTasksDto,
  ) {
    return this.projectTaskService.reorderTasks(
      req.user.sub,
      projectId,
      dto,
    );
  }

  @Patch(':taskId/move')
  @ApiOperation({ summary: 'Переместить задачу' })
  async move(
    @Request() req: AuthRequest,
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Body() dto: MoveTaskDto,
  ) {
    return this.projectTaskService.moveTask(
      req.user.sub,
      projectId,
      taskId,
      dto,
    );
  }
}
