import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtOrApiTokenGuard } from '../auth/guards/jwt-or-api-token.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { StoryWorkflowService } from './story-workflow.service';
import { ReplaceStoryWorkflowDto } from './dto/story-workflow.dto';

interface AuthRequest extends Request {
  user: JwtPayload;
}

@ApiTags('story-workflow')
@ApiBearerAuth()
@UseGuards(JwtOrApiTokenGuard)
@Controller('projects/:projectId/story-workflow')
export class StoryWorkflowController {
  constructor(private readonly workflow: StoryWorkflowService) {}

  @Get()
  @ApiOperation({ summary: 'Каталог статусов историй проекта' })
  get(@Request() req: AuthRequest, @Param('projectId') projectId: string) {
    return this.workflow.get(req.user.sub, projectId);
  }

  @Put()
  @ApiOperation({ summary: 'Сохранить каталог статусов историй' })
  replace(
    @Request() req: AuthRequest,
    @Param('projectId') projectId: string,
    @Body() dto: ReplaceStoryWorkflowDto,
  ) {
    return this.workflow.replace(req.user.sub, projectId, dto.statuses);
  }
}
