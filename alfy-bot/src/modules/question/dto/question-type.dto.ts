import { ApiProperty } from '@nestjs/swagger';

export class QuestionTypeDto {
  @ApiProperty({
    example: 'rating',
    description: 'Идентификатор типа вопроса',
  })
  type: string;

  @ApiProperty({
    example: 'Оценка (числа)',
    description: 'Человекочитаемое название типа',
  })
  label: string;

  @ApiProperty({
    example: 'Оцени продуктивность (1-5)',
    description: 'Пример формулировки вопроса',
  })
  example: string;

  @ApiProperty({
    required: false,
    example: [1, 2, 3, 4, 5],
    description: 'Варианты ответа (для типов с фиксированным набором)',
  })
  options?: (string | number)[];
}
