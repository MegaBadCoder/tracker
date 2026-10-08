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
import { ReleaseService } from './release.service';
import { CreateReleaseDto } from './dto/create-release.dto';
import { UpdateReleaseDto } from './dto/update-release.dto';
import { ReleaseReleaseDto } from './dto/release-release.dto';
import { AssignGroupReleaseDto } from './dto/assign-group-release.dto';

interface AuthRequest extends Request {
  user: JwtPayload;
}

@ApiTags('releases')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/releases')
export class ReleaseController {
  constructor(private readonly releaseService: ReleaseService) {}

  @Get()
  @ApiOperation({ summary: 'Релизы проекта, включая выпущенные' })
  async list(
    @Request() req: AuthRequest,
    @Param('projectId') projectId: string,
  ) {
    return this.releaseService.list(req.user.sub, projectId);
  }

  @Post()
  @ApiOperation({ summary: 'Создать релиз' })
  async create(
    @Request() req: AuthRequest,
    @Param('projectId') projectId: string,
    @Body() dto: CreateReleaseDto,
  ) {
    return this.releaseService.create(req.user.sub, projectId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Обновить имя, описание и даты релиза' })
  async update(
    @Request() req: AuthRequest,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() dto: UpdateReleaseDto,
  ) {
    return this.releaseService.update(req.user.sub, projectId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Удалить релиз (задачи остаются без релиза)' })
  async delete(
    @Request() req: AuthRequest,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ) {
    return this.releaseService.delete(req.user.sub, projectId, id);
  }

  @Post(':id/release')
  @ApiOperation({
    summary: 'Выпустить релиз, перенеся незавершённые задачи',
  })
  async release(
    @Request() req: AuthRequest,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() dto: ReleaseReleaseDto,
  ) {
    return this.releaseService.release(req.user.sub, projectId, id, dto);
  }

  @Post(':id/assign-group')
  @ApiOperation({
    summary: 'Назначить релиз всем задачам эпика или истории',
  })
  async assignGroup(
    @Request() req: AuthRequest,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() dto: AssignGroupReleaseDto,
  ) {
    return this.releaseService.assignGroup(req.user.sub, projectId, id, dto);
  }
}
