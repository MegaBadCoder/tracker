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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { ProjectColumnService } from './project-column.service';
import { CreateColumnDto } from './dto/create-column.dto';
import { UpdateColumnDto } from './dto/update-column.dto';
import { ReorderDto } from './dto/reorder.dto';

interface AuthRequest extends Request {
  user: JwtPayload;
}

@ApiTags('project-columns')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/columns')
export class ProjectColumnController {
  constructor(private readonly columnService: ProjectColumnService) {}

  @Get()
  @ApiOperation({ summary: 'Колонки проекта' })
  async getAll(
    @Request() req: AuthRequest,
    @Param('projectId') projectId: string,
  ) {
    return this.columnService.getAllByProject(req.user.sub, projectId);
  }

  @Post()
  @ApiOperation({ summary: 'Создать колонку' })
  async create(
    @Request() req: AuthRequest,
    @Param('projectId') projectId: string,
    @Body() dto: CreateColumnDto,
  ) {
    return this.columnService.create(req.user.sub, projectId, dto);
  }

  @Patch('reorder')
  @ApiOperation({ summary: 'Изменить порядок колонок' })
  async reorder(
    @Request() req: AuthRequest,
    @Param('projectId') projectId: string,
    @Body() dto: ReorderDto,
  ) {
    return this.columnService.reorder(req.user.sub, projectId, dto.orderedIds);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Обновить колонку' })
  async update(
    @Request() req: AuthRequest,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() dto: UpdateColumnDto,
  ) {
    return this.columnService.update(req.user.sub, projectId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Удалить колонку' })
  async delete(
    @Request() req: AuthRequest,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ) {
    return this.columnService.delete(req.user.sub, projectId, id);
  }
}
