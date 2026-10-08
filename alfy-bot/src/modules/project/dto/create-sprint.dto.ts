import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSprintDto {
  @ApiPropertyOptional({ example: 'Спринт 3' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiPropertyOptional({ example: 'Запустить онбординг' })
  @IsOptional()
  @IsString()
  goal?: string;
}
