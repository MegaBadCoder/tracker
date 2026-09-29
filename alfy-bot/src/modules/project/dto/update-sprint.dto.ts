import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateSprintDto {
  @ApiPropertyOptional({ example: 'Спринт 3' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiPropertyOptional({ example: 'Запустить онбординг', nullable: true })
  @IsOptional()
  @IsString()
  goal?: string | null;

  @ApiPropertyOptional({ example: '2026-01-01', nullable: true })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate?: string | null;

  @ApiPropertyOptional({ example: '2026-01-14', nullable: true })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  endDate?: string | null;
}
