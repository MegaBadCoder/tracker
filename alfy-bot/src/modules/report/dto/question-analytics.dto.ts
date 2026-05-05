import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AnalyticsEntryDto {
  @ApiProperty({
    example: '2026-02-01',
    description: 'Дата в формате YYYY-MM-DD',
  })
  date: string;

  @ApiPropertyOptional({
    example: '15',
    nullable: true,
    description:
      'Текстовое значение ответа. "Не было заполнено" если пропущено для текстового типа',
  })
  answer_text: string | null;

  @ApiPropertyOptional({
    example: 15,
    nullable: true,
    description: '0 если пропущено для числового типа (number, rating)',
  })
  answer_number: number | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  answer_bool: boolean | null;

  @ApiProperty({
    example: true,
    description: 'false если дата была запланирована, но ответ не был дан',
  })
  filled: boolean;
}
