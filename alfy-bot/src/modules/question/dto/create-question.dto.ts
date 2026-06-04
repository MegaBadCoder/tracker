import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsBoolean,
  IsOptional,
  IsIn,
  IsArray,
  IsNumber,
} from 'class-validator';

export class CreateQuestionDto {
  @ApiProperty({ example: 'Сколько воды выпил?' })
  @IsString()
  question: string;

  @ApiProperty({
    example: 'number',
    enum: [
      'text',
      'rating',
      'emoji_rating',
      'yes_no',
      'number',
      'time_spent',
      'photo',
    ],
  })
  @IsString()
  @IsIn([
    'text',
    'rating',
    'emoji_rating',
    'yes_no',
    'number',
    'time_spent',
    'photo',
  ])
  type: string;

  @ApiPropertyOptional({ example: false, default: false })
  @IsBoolean()
  @IsOptional()
  can_skip?: boolean;

  @ApiPropertyOptional({
    example: '100',
    description:
      'Эталонное значение (цель). Для number — числовой ориентир на графике.',
    nullable: true,
  })
  @IsString()
  @IsOptional()
  target_value?: string;

  @ApiPropertyOptional({
    example: 'daily',
    enum: ['daily', 'weekly_days', 'interval'],
  })
  @IsString()
  @IsOptional()
  @IsIn(['daily', 'weekly_days', 'interval'])
  frequency_type?: string;

  @ApiPropertyOptional({ example: [1, 3, 5], type: [Number] })
  @IsArray()
  @IsNumber({}, { each: true })
  @IsOptional()
  days_of_week?: number[];

  @ApiPropertyOptional({ example: 3 })
  @IsNumber()
  @IsOptional()
  interval_days?: number;
}
