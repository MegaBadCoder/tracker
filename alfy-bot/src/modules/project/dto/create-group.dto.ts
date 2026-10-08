import { IsOptional, IsString, IsUUID, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateGroupDto {
  @ApiProperty({ example: 'Онбординг пользователей' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ example: 'epic-uuid' })
  @IsOptional()
  @IsUUID('4')
  parentId?: string;

  @ApiPropertyOptional({ example: 'Описание эпика' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: '#00ff00' })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional({ example: '2026-01-01', nullable: true })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate?: string | null;

  @ApiPropertyOptional({ example: '2026-01-31', nullable: true })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dueDate?: string | null;
}
