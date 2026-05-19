import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
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
import { ReportService } from './application/report.service';
import { AnalyticsEntryDto } from './dto/question-analytics.dto';

interface AuthRequest extends Request {
  user: JwtPayload;
}

@ApiTags('analytics')
@ApiBearerAuth()
@UseGuards(JwtOrApiTokenGuard)
@Controller('questions')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Get(':questionId/analytics')
  @ApiOperation({
    summary: 'История ответов по вопросу с заполнением пропущенных дат',
  })
  @ApiOkResponse({ type: [AnalyticsEntryDto] })
  @ApiNotFoundResponse({ description: 'Вопрос или цель не найдены' })
  @ApiForbiddenResponse({ description: 'Вопрос не принадлежит пользователю' })
  @ApiUnauthorizedResponse({ description: 'Невалидный или отсутствующий JWT' })
  getQuestionAnalytics(
    @Request() req: AuthRequest,
    @Param('questionId', ParseIntPipe) questionId: number,
  ): Promise<AnalyticsEntryDto[]> {
    return this.reportService.getQuestionAnalytics(questionId, req.user.sub);
  }
}
