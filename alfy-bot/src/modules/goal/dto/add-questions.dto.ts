import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import type { FrequencyType } from '../../../shared/constants/schedule-types';
import type { QuestionType } from '../../../shared/types/question-types';

export class QuestionWithScheduleItem {
  @ApiProperty({ example: 'Сколько страниц прочитал?' })
  @IsString()
  question: string;

  @ApiProperty({
    example: 'number',
    enum: ['text', 'rating', 'emoji_rating', 'yes_no', 'number', 'time_spent'],
  })
  @IsIn(['text', 'rating', 'emoji_rating', 'yes_no', 'number', 'time_spent'])
  type: QuestionType;

  @ApiProperty({ example: false })
  @IsBoolean()
  canSkip: boolean;

  @ApiProperty({
    example: 'daily',
    enum: ['daily', 'weekly_days', 'interval'],
  })
  @IsIn(['daily', 'weekly_days', 'interval'])
  scheduleType: FrequencyType;

  @ApiPropertyOptional({
    example: [1, 3, 5],
    description: 'Дни недели (0=Вс, 1=Пн, ..., 6=Сб). Для weekly_days.',
    type: [Number],
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  selectedDays?: number[];

  @ApiPropertyOptional({ example: 3, description: 'Интервал в днях. Для interval.' })
  @IsOptional()
  @IsInt()
  @Min(1)
  intervalDays?: number;

  @ApiPropertyOptional({
    example: '100',
    description: 'Эталонное значение. Только для type=number.',
  })
  @IsOptional()
  @IsString()
  targetValue?: string;
}

export class AddQuestionsDto {
  @ApiProperty({ type: () => [QuestionWithScheduleItem] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => QuestionWithScheduleItem)
  questions: QuestionWithScheduleItem[];
}
