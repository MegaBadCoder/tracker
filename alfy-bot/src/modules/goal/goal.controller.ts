import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { GoalStatus } from '../../shared/constants/goal-statuses';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { GoalService } from './application/goal.service';
import { GoalDto } from './dto/goal-response.dto';

interface AuthRequest extends Request {
  user: JwtPayload;
}

@ApiTags('goals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('goals')
export class GoalController {
  constructor(private readonly goalService: GoalService) { }

  @Get()
  @ApiOperation({ summary: 'Список целей пользователя' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['active', 'completed'],
    description:
      'Фильтр по статусу. Без параметра — все цели (кроме удалённых)',
  })
  @ApiOkResponse({ type: [GoalDto] })
  @ApiUnauthorizedResponse({ description: 'Невалидный или отсутствующий JWT' })
  async findAll(
    @Request() req: AuthRequest,
    @Query('status') status?: string,
  ): Promise<GoalDto[]> {
    const userId = req.user.sub;

    if (status) {
      return this.goalService.findByStatus(
        userId,
        status as GoalStatus,
      ) as Promise<GoalDto[]>;
    }

    return this.goalService.findAllByUser(userId) as Promise<GoalDto[]>;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Цель по ID с вопросами и расписаниями' })
  @ApiOkResponse({ type: GoalDto })
  @ApiNotFoundResponse({ description: 'Цель не найдена' })
  @ApiUnauthorizedResponse({ description: 'Невалидный или отсутствующий JWT' })
  async findOne(
    @Request() req: AuthRequest,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<GoalDto> {
    const goal = await this.goalService.findById(id);

    if (!goal || goal.user_id !== req.user.sub) {
      throw new NotFoundException(`Goal #${id} not found`);
    }

    return goal as GoalDto;
  }
}
