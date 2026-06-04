import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class QuestionReportItemDto {
  @ApiProperty({ example: 5, description: 'ID вопроса' })
  questionId: number;

  @ApiProperty({ example: 'Сколько страниц прочитал?' })
  question: string;

  @ApiProperty({ example: 'number', description: 'Тип вопроса' })
  type: string;

  @ApiProperty({
    example: false,
    description: 'Можно ли пропустить вопрос (необязательный)',
  })
  can_skip: boolean;

  @ApiPropertyOptional({
    example: '30',
    nullable: true,
    description: 'Целевое значение, если задано',
  })
  target_value: string | null;

  @ApiProperty({
    example: true,
    description: 'Дан ли ответ на этот вопрос на указанную дату',
  })
  answered: boolean;

  @ApiPropertyOptional({
    example: '15',
    nullable: true,
    description: 'Текстовое значение ответа, если ответ дан',
  })
  answer_text: string | null;

  @ApiPropertyOptional({
    example: 15,
    nullable: true,
    description: 'Числовое значение ответа, если ответ дан',
  })
  answer_number: number | null;

  @ApiPropertyOptional({
    example: null,
    nullable: true,
    description: 'Булево значение ответа, если ответ дан',
  })
  answer_bool: boolean | null;
}

export class GoalReportStatusDto {
  @ApiProperty({ example: 10, description: 'ID цели' })
  goalId: number;

  @ApiProperty({
    example: '2026-02-20',
    description: 'Дата отчёта в формате YYYY-MM-DD',
  })
  date: string;

  @ApiPropertyOptional({
    example: '2026-02-18',
    nullable: true,
    description: 'Последняя незаполненная дата (до сегодня) или null',
  })
  lastUnfilledDate: string | null;

  @ApiProperty({ type: [QuestionReportItemDto] })
  questions: QuestionReportItemDto[];

  @ApiProperty({
    example: false,
    description: 'true если все обязательные due-вопросы отвечены',
  })
  allDone: boolean;
}

export class ReportQueueItemDto {
  @ApiProperty({ example: 10, description: 'ID цели' })
  goalId: number;

  @ApiProperty({ example: 'Читать книгу' })
  goalName: string;

  @ApiProperty({
    example: 2,
    description: 'Число неотвеченных due-вопросов на дату',
  })
  pendingCount: number;
}
