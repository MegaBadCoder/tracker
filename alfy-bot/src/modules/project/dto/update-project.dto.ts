import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  ValidateIf,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

const TASK_KEY_PREFIX_PATTERN = /^[A-Z][A-Z0-9]{1,9}$/;

export class UpdateProjectDto {
  @ApiPropertyOptional({ example: 'Мой проект' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ example: 'Описание проекта' })
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiPropertyOptional({ description: 'Set to null to remove parent' })
  @IsOptional()
  parentId?: string | null;

  @ApiPropertyOptional({ example: 'list', enum: ['list', 'board'] })
  @IsOptional()
  @IsIn(['list', 'board'])
  viewMode?: 'list' | 'board';

  @ApiPropertyOptional({ description: 'Set to null to remove icon' })
  @IsOptional()
  icon?: string | null;

  @ApiPropertyOptional({ description: 'Set to null to remove color' })
  @IsOptional()
  color?: string | null;

  @ApiPropertyOptional({
    example: 'ALF',
    description:
      'null убирает префикс. Префикс ключей задач agile-проекта: 2-10 символов, A-Z и цифры, первая буква',
  })
  @ValidateIf(
    (o: UpdateProjectDto) =>
      o.taskKeyPrefix !== undefined && o.taskKeyPrefix !== null,
  )
  @Matches(TASK_KEY_PREFIX_PATTERN)
  taskKeyPrefix?: string | null;
}
