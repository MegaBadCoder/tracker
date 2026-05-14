import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsBoolean, IsOptional, IsIn } from 'class-validator';

export class UpdateQuestionDto {
  @ApiPropertyOptional({ example: 'Сколько воды выпил?' })
  @IsString()
  @IsOptional()
  question?: string;

  @ApiPropertyOptional({
    example: 'number',
    enum: ['text', 'rating', 'emoji_rating', 'yes_no', 'number', 'time_spent'],
  })
  @IsString()
  @IsOptional()
  @IsIn(['text', 'rating', 'emoji_rating', 'yes_no', 'number', 'time_spent'])
  type?: string;

  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  can_skip?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  is_habit?: boolean;

  @ApiPropertyOptional({
    example: '100',
    description:
      'Эталонное значение (цель). Для number — числовой ориентир на графике.',
    nullable: true,
  })
  @IsString()
  @IsOptional()
  target_value?: string;
}
