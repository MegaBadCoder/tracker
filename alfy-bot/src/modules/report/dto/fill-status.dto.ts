import { ApiProperty } from '@nestjs/swagger';

export class FillStatusEntryDto {
  @ApiProperty({
    example: '2026-06-14',
    description: 'Due-дата в формате YYYY-MM-DD',
  })
  date: string;

  @ApiProperty({
    example: false,
    description:
      'true если на эту дату уже есть ответ (строка в report_answers)',
  })
  filled: boolean;
}
