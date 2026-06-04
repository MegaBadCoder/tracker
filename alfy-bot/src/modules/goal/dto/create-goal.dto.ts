import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Min,
  ValidateIf,
} from 'class-validator';

export class CreateGoalDto {
  @ApiProperty({
    example: 'Читать 30 минут в день',
    minLength: 1,
    maxLength: 200,
  })
  @IsString()
  @Length(1, 200)
  goal_name: string;

  @ApiPropertyOptional({
    example: '2026-02-01',
    description:
      'Дата начала цели в формате YYYY-MM-DD. Обязательна для обычных целей, не требуется для global',
    nullable: true,
  })
  @ValidateIf((o: CreateGoalDto) => !o.is_global)
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'goal_start должен быть в формате YYYY-MM-DD',
  })
  goal_start?: string | null;

  @ApiPropertyOptional({
    example: '2026-05-01',
    description:
      'Дата окончания цели в формате YYYY-MM-DD. Обязательна для обычных целей, не требуется для global',
    nullable: true,
  })
  @ValidateIf((o: CreateGoalDto) => !o.is_global)
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'goal_end должен быть в формате YYYY-MM-DD',
  })
  goal_end?: string | null;

  @ApiPropertyOptional({
    example: false,
    description: 'Глобальная цель (без дат и вопросов, может иметь подцели)',
  })
  @IsOptional()
  @IsBoolean()
  is_global?: boolean;

  @ApiPropertyOptional({
    example: 1,
    description:
      'ID родительской global-цели, к которой привязывается эта цель',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  parent_goal_id?: number;
}
