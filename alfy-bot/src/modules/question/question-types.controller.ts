import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtOrApiTokenGuard } from '../auth/guards/jwt-or-api-token.guard';
import { QUESTION_TYPES } from '../../shared/types/question-types';
import { QuestionTypeDto } from './dto/question-type.dto';

@ApiTags('question-types')
@ApiBearerAuth()
@UseGuards(JwtOrApiTokenGuard)
@Controller('question-types')
export class QuestionTypesController {
  @Get()
  @ApiOperation({ summary: 'Каталог типов вопросов (single source of truth)' })
  @ApiOkResponse({ type: [QuestionTypeDto] })
  findAll(): QuestionTypeDto[] {
    return Object.values(QUESTION_TYPES).map((c) => ({
      type: c.type,
      label: c.label,
      example: c.example,
      options: c.options,
    }));
  }
}
