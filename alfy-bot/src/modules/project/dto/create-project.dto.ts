import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const TASK_KEY_PREFIX_PATTERN = /^[A-Z][A-Z0-9]{1,9}$/;

export class CreateProjectDto {
  @ApiProperty({ example: 'Мой проект' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ example: 'Описание проекта' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsOptional()
  @IsUUID()
  parentId?: string;

  @ApiPropertyOptional({ example: 'list', enum: ['list', 'board'] })
  @IsOptional()
  @IsIn(['list', 'board'])
  viewMode?: 'list' | 'board';

  @ApiPropertyOptional({ example: 'simple', enum: ['simple', 'agile'] })
  @IsOptional()
  @IsIn(['simple', 'agile'])
  type?: 'simple' | 'agile';

  @ApiPropertyOptional({ example: 'star' })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional({ example: '#ff0000' })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional({
    example: 'ALF',
    description:
      'Префикс ключей задач agile-проекта: 2-10 символов, A-Z и цифры, первая буква',
  })
  @ValidateIf(
    (o: CreateProjectDto) =>
      o.taskKeyPrefix !== undefined && o.taskKeyPrefix !== null,
  )
  @Matches(TASK_KEY_PREFIX_PATTERN)
  taskKeyPrefix?: string | null;
}
