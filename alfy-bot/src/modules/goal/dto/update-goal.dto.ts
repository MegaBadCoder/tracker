import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import type { GoalStatus } from '../../../shared/constants/goal-statuses';

export class UpdateGoalDto {
  @ApiPropertyOptional({
    example: 'completed',
    enum: ['active', 'completed', 'archived', 'deleted'],
  })
  @IsOptional()
  @IsIn(['active', 'completed', 'archived', 'deleted'])
  status?: GoalStatus;

  @ApiPropertyOptional({ example: 'Новое имя цели' })
  @IsOptional()
  @IsString()
  goal_name?: string;
}
