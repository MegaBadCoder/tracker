import { IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateColumnDto {
  @ApiProperty({ example: 'To Do' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ example: '#00ff00' })
  @IsOptional()
  @IsString()
  color?: string;
}
