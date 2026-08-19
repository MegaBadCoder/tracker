import { IsOptional, IsString, IsUUID } from 'class-validator';
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
}
