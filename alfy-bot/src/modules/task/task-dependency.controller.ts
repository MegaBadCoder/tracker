import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtOrApiTokenGuard } from '../auth/guards/jwt-or-api-token.guard';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { SetTaskDependenciesDto } from './dto/set-task-dependencies.dto';
import { TaskDependencyService } from './task-dependency.service';

interface AuthRequest {
  user: JwtPayload;
}

@ApiTags('tasks')
@ApiBearerAuth()
@UseGuards(JwtOrApiTokenGuard)
@Controller('tasks')
export class TaskDependencyController {
  constructor(private readonly service: TaskDependencyService) {}

  @Get('dependencies/graph')
  @ApiOperation({ summary: 'Получить граф предшественников своих задач' })
  graph(@Request() request: AuthRequest) {
    return this.service.graph(request.user.sub);
  }

  @Put(':id/dependencies')
  @ApiOperation({ summary: 'Заменить предшественников задачи' })
  replace(
    @Request() request: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetTaskDependenciesDto,
  ) {
    return this.service.replace(request.user.sub, id, dto.dependencyIds);
  }
}
