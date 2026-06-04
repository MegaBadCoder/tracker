import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtOrApiTokenGuard } from '../auth/guards/jwt-or-api-token.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import {
  GoalReportStatus,
  ReportQueueItem,
  ReportService,
} from './application/report.service';
import {
  GoalReportStatusDto,
  ReportQueueItemDto,
} from './dto/goal-report-status.dto';
import { toLocalISO } from './lib/date';

interface AuthRequest extends Request {
  user: JwtPayload;
}

@ApiTags('goal-reports')
@ApiBearerAuth()
@UseGuards(JwtOrApiTokenGuard)
@Controller('goals')
export class GoalReportController {
  constructor(private readonly reportService: ReportService) {}

  /** Сегодняшняя дата в формате YYYY-MM-DD по локальному времени. */
  private todayLocal(): string {
    return toLocalISO(new Date());
  }

  // Двухсегментный путь `reports/queue` — НЕ `report-queue`: одиночный литерал
  // `goals/report-queue` перехватывается `GoalController @Get(':id')` (Express 5 /
  // path-to-regexp v8 не поддерживает inline-regex `:id(\\d+)`, а порядок
  // контроллеров определяется import-порядком модулей). Двухсегментный путь не
  // может быть захвачен одиночным `:id`. См. goal-report.controller.e2e-spec.ts.
  @Get('reports/queue')
  @ApiOperation({
    summary: 'Очередь целей с неотвеченными due-вопросами на дату',
  })
  @ApiOkResponse({ type: [ReportQueueItemDto] })
  @ApiUnauthorizedResponse({ description: 'Невалидный или отсутствующий JWT' })
  getReportQueue(
    @Request() req: AuthRequest,
    @Query('date') date?: string,
  ): Promise<ReportQueueItem[]> {
    return this.reportService.getReportQueue(
      req.user.sub,
      date ?? this.todayLocal(),
    );
  }

  @Get(':id/report-status')
  @ApiOperation({
    summary: 'Статус отчёта по цели на дату: due-вопросы и их ответы',
  })
  @ApiOkResponse({ type: GoalReportStatusDto })
  @ApiNotFoundResponse({ description: 'Цель не найдена' })
  @ApiForbiddenResponse({ description: 'Цель не принадлежит пользователю' })
  @ApiUnauthorizedResponse({ description: 'Невалидный или отсутствующий JWT' })
  getGoalReportStatus(
    @Request() req: AuthRequest,
    @Param('id', ParseIntPipe) id: number,
    @Query('date') date?: string,
  ): Promise<GoalReportStatus> {
    return this.reportService.getGoalReportStatus(
      req.user.sub,
      id,
      date ?? this.todayLocal(),
    );
  }
}
