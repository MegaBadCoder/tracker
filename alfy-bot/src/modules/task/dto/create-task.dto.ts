import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { ChecklistData } from '../domain/task-repository.port';
import type { RecurrenceFrequency } from '../../../shared/types/recurrence.types';

export class RecurrenceRuleDto {
  @IsIn(['daily', 'weekly', 'monthly', 'yearly'])
  frequency: RecurrenceFrequency;

  @IsInt()
  @Min(1)
  interval: number;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  daysOfWeek?: number[];

  @IsOptional()
  @IsInt()
  @Min(1)
  dayOfMonth?: number;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  endCount?: number;
}

export class CreateTaskDto {
  @ApiProperty({ example: 'Подготовить презентацию' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ example: 'Слайды для встречи в понедельник' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'high', enum: ['high', 'medium', 'low'], nullable: true })
  @IsOptional()
  @IsString()
  priority?: 'high' | 'medium' | 'low' | null;

  @ApiPropertyOptional({ example: '2026-03-15T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({ example: '2026-03-20T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  deadline?: string;

  @ApiPropertyOptional({ example: 90 })
  @IsOptional()
  @IsInt()
  @Min(1)
  durationMinutes?: number;

  @ApiPropertyOptional({ example: 'Офис' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ example: ['работа', 'презентация'] })
  @IsOptional()
  @IsArray()
  tags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  checklist?: ChecklistData;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440001' })
  @IsOptional()
  @IsUUID()
  columnId?: string;

  @ApiPropertyOptional({ description: 'Recurrence rule for repeating tasks' })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => RecurrenceRuleDto)
  recurrence?: RecurrenceRuleDto;

  @ApiPropertyOptional({ enum: ['shift', 'freeze'] })
  @IsOptional()
  @IsIn(['shift', 'freeze'])
  onMissed?: 'shift' | 'freeze';

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

  @ApiPropertyOptional({ type: [Number], example: [1, 2] })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  goalIds?: number[];
}
