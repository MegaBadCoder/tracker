import { IsOptional, IsString, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class StartSprintDto {
  @ApiProperty({ example: '2026-01-01' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate: string;

  @ApiProperty({ example: '2026-01-14' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  endDate: string;

  @ApiPropertyOptional({ example: 'Запустить онбординг' })
  @IsOptional()
  @IsString()
  goal?: string;
}
