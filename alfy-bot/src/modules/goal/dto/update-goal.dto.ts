import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, ValidateIf } from 'class-validator';
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

  @ApiPropertyOptional({
    example: 'success',
    enum: ['success', 'failure'],
    nullable: true,
    description: 'Флаг завершения. Шлётся вместе со status=completed',
  })
  @IsOptional()
  @IsIn(['success', 'failure'])
  outcome?: 'success' | 'failure' | null;

  @ApiPropertyOptional({
    example: 1,
    description:
      'ID родительской global-цели. null — отвязать цель от родителя',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((o: UpdateGoalDto) => o.parent_goal_id !== null)
  @IsInt()
  parent_goal_id?: number | null;
}
