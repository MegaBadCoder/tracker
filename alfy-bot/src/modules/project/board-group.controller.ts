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
import { SetGroupReleaseDto } from './dto/set-group-release.dto';
import { BoardGroupService } from './board-group.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { ReorderDto } from './dto/reorder.dto';

interface AuthRequest extends Request {
  user: JwtPayload;
}

@ApiTags('board-groups')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/groups')
export class BoardGroupController {
  constructor(
    private readonly groupService: BoardGroupService,
    private readonly releaseService: ReleaseService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Дерево эпиков/историй проекта' })
  async getTree(
    @Request() req: AuthRequest,
    @Param('projectId') projectId: string,
  ) {
    return this.groupService.getTree(req.user.sub, projectId);
  }

  @Post()
  @ApiOperation({ summary: 'Создать эпик или историю' })
  async create(
    @Request() req: AuthRequest,
    @Param('projectId') projectId: string,
    @Body() dto: CreateGroupDto,
  ) {
    return this.groupService.create(req.user.sub, projectId, dto);
  }

  @Patch('reorder')
  @ApiOperation({ summary: 'Изменить порядок групп' })
  async reorder(
    @Request() req: AuthRequest,
    @Param('projectId') projectId: string,
    @Body() dto: ReorderDto,
  ) {
    return this.groupService.reorder(req.user.sub, projectId, dto.orderedIds);
  }

  @Patch(':id/release')
  @ApiOperation({ summary: 'Назначить или снять релиз истории' })
  async setRelease(
    @Request() req: AuthRequest,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() dto: SetGroupReleaseDto,
  ) {
    return this.releaseService.setGroupRelease(
      req.user.sub,
      projectId,
      id,
      dto.releaseId,
    );
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Обновить эпик или историю' })
  async update(
    @Request() req: AuthRequest,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() dto: UpdateGroupDto,
  ) {
    return this.groupService.update(req.user.sub, projectId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Удалить эпик или историю' })
  async delete(
    @Request() req: AuthRequest,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ) {
    return this.groupService.delete(req.user.sub, projectId, id);
  }
}
