import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsString, MaxLength } from 'class-validator';

export class AnswerQuestionDto {
  @ApiProperty({
    example: '2026-05-19',
    description: 'Дата ответа (YYYY-MM-DD)',
  })
  @IsDateString()
  scheduled_date: string;

  @ApiProperty({ example: 'да', description: 'Текст ответа (до 200 символов)' })
  @IsString()
  @MaxLength(200)
  answer: string;
}
