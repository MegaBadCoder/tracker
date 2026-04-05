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
import { ProjectService } from './project.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ReorderDto } from './dto/reorder.dto';

interface AuthRequest extends Request {
  user: JwtPayload;
}

@ApiTags('projects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects')
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @Get()
  @ApiOperation({ summary: 'Все проекты пользователя (плоский список)' })
  async getAll(@Request() req: AuthRequest) {
    return this.projectService.getAll(req.user.sub);
  }

  @Post()
  @ApiOperation({ summary: 'Создать проект' })
  async create(@Request() req: AuthRequest, @Body() dto: CreateProjectDto) {
    return this.projectService.create(req.user.sub, dto);
  }

  @Patch('reorder')
  @ApiOperation({ summary: 'Изменить порядок проектов' })
  async reorder(@Request() req: AuthRequest, @Body() dto: ReorderDto) {
    return this.projectService.reorder(req.user.sub, dto.orderedIds);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Получить проект с колонками' })
  async getById(@Request() req: AuthRequest, @Param('id') id: string) {
    return this.projectService.getById(req.user.sub, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Обновить проект' })
  async update(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projectService.update(req.user.sub, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Удалить проект' })
  async delete(@Request() req: AuthRequest, @Param('id') id: string) {
    return this.projectService.delete(req.user.sub, id);
  }
}
