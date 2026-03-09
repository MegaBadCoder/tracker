import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTaskDto {
  @ApiProperty({ example: 'Подготовить презентацию' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ example: 'Слайды для встречи в понедельник' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'high', enum: ['high', 'medium', 'low'] })
  @IsOptional()
  @IsString()
  priority?: 'high' | 'medium' | 'low';

  @ApiPropertyOptional({ example: '2026-03-15T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({ example: '2026-03-20T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  deadline?: string;

  @ApiPropertyOptional({ example: 'Офис' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ example: ['работа', 'презентация'] })
  @IsOptional()
  @IsArray()
  tags?: string[];

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isPomodoroTask?: boolean;

  @ApiPropertyOptional({ example: 4 })
  @IsOptional()
  @IsNumber()
  pomodoroCount?: number;

  @ApiPropertyOptional({ example: 25 })
  @IsOptional()
  @IsNumber()
  pomodoroDuration?: number;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsNumber()
  shortBreak?: number;

  @ApiPropertyOptional({ example: 15 })
  @IsOptional()
  @IsNumber()
  longBreak?: number;

  @ApiPropertyOptional({ example: 4 })
  @IsOptional()
  @IsNumber()
  longBreakInterval?: number;
}
