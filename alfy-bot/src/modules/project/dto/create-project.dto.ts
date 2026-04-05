import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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

  @ApiPropertyOptional({ example: 'star' })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional({ example: '#ff0000' })
  @IsOptional()
  @IsString()
  color?: string;
}
