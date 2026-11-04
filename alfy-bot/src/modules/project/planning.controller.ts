import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtOrApiTokenGuard } from '../auth/guards/jwt-or-api-token.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { PlanningService } from './planning.service';
import {
  PlanningMoveDto,
  PlanningOrderDto,
  PlanningProposalDto,
  PlanningUndoDto,
} from './dto/planning.dto';

interface AuthRequest {
  user: JwtPayload;
}

@ApiTags('planning')
@ApiBearerAuth()
@UseGuards(JwtOrApiTokenGuard)
@Controller('projects/:projectId/planning')
export class PlanningController {
  constructor(private readonly service: PlanningService) {}

  @Get()
  context(
    @Request() req: AuthRequest,
    @Param('projectId') projectId: string,
    @Query('sprintId') sprintId?: string,
  ) {
    return this.service.context(req.user.sub, projectId, sprintId ?? null);
  }

  @Post('proposal')
  proposal(
    @Request() req: AuthRequest,
    @Param('projectId') projectId: string,
    @Body() dto: PlanningProposalDto,
  ) {
    return this.service.proposal(req.user.sub, projectId, dto);
  }

  @Post('move')
  move(
    @Request() req: AuthRequest,
    @Param('projectId') projectId: string,
    @Body() dto: PlanningMoveDto,
  ) {
    return this.service.move(req.user.sub, projectId, dto);
  }

  @Post('undo')
  undo(
    @Request() req: AuthRequest,
    @Param('projectId') projectId: string,
    @Body() dto: PlanningUndoDto,
  ) {
    return this.service.undo(req.user.sub, projectId, dto.undoToken);
  }

  @Patch('order')
  reorder(
    @Request() req: AuthRequest,
    @Param('projectId') projectId: string,
    @Body() dto: PlanningOrderDto,
  ) {
    return this.service.reorder(req.user.sub, projectId, dto);
  }
}
