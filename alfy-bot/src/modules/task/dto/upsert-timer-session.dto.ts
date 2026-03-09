import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpsertTimerSessionDto {
  @ApiProperty({ example: 'uuid-task-id' })
  @IsString()
  taskId: string;

  @ApiProperty({ example: 1 })
  @IsNumber()
  phase: number;

  @ApiPropertyOptional({ example: 1710000000000 })
  @IsOptional()
  @IsNumber()
  lastStartTime?: number | null;

  @ApiPropertyOptional({ example: 300 })
  @IsOptional()
  @IsNumber()
  countTimeAfterPause?: number | null;

  @ApiPropertyOptional({ example: '2026-03-09T12:30:00.000Z' })
  @IsOptional()
  @IsString()
  expiresAt?: string | null;

  @ApiProperty({ example: true })
  @IsBoolean()
  isActive: boolean;
}
