import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtOrApiTokenGuard } from '../auth/guards/jwt-or-api-token.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { SprintService } from './sprint.service';
import { CreateSprintDto } from './dto/create-sprint.dto';
import { UpdateSprintDto } from './dto/update-sprint.dto';
import { StartSprintDto } from './dto/start-sprint.dto';
import { CompleteSprintDto } from './dto/complete-sprint.dto';

interface AuthRequest extends Request {
  user: JwtPayload;
}

@ApiTags('sprints')
@ApiBearerAuth()
@UseGuards(JwtOrApiTokenGuard)
@Controller('projects/:projectId/sprints')
export class SprintController {
  constructor(private readonly sprintService: SprintService) {}

  @Get()
  @ApiOperation({ summary: 'Спринты проекта, включая закрытые' })
  async list(
    @Request() req: AuthRequest,
    @Param('projectId') projectId: string,
  ) {
    return this.sprintService.list(req.user.sub, projectId);
  }

  @Post()
  @ApiOperation({ summary: 'Создать спринт' })
  async create(
    @Request() req: AuthRequest,
    @Param('projectId') projectId: string,
    @Body() dto: CreateSprintDto,
  ) {
    return this.sprintService.create(req.user.sub, projectId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Обновить имя, цель и даты спринта' })
  async update(
    @Request() req: AuthRequest,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() dto: UpdateSprintDto,
  ) {
    return this.sprintService.update(req.user.sub, projectId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Удалить спринт (задачи уходят в бэклог)' })
  async delete(
    @Request() req: AuthRequest,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ) {
    return this.sprintService.delete(req.user.sub, projectId, id);
  }

  @Post(':id/start')
  @ApiOperation({ summary: 'Запустить спринт' })
  async start(
    @Request() req: AuthRequest,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() dto: StartSprintDto,
  ) {
    return this.sprintService.start(req.user.sub, projectId, id, dto);
  }

  @Post(':id/complete')
  @ApiOperation({
    summary: 'Завершить спринт, перенеся незавершённые задачи',
  })
  async complete(
    @Request() req: AuthRequest,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() dto: CompleteSprintDto,
  ) {
    return this.sprintService.complete(req.user.sub, projectId, id, dto);
  }
}
