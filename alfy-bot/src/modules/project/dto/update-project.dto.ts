import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

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
}
