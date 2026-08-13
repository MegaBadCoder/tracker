import { PartialType } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CreateTaskDto } from './create-task.dto';

export class UpdateTaskDto extends PartialType(CreateTaskDto) {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  completed?: boolean;

  @ApiPropertyOptional({ enum: ['this', 'subsequent'] })
  @IsOptional()
  @IsIn(['this', 'subsequent'])
  rescheduleScope?: 'this' | 'subsequent';

  // Explicitly exclude checklist — use PUT /tasks/:id/checklist instead
  checklist?: never;

  // Use PUT/DELETE /tasks/:id/pomodoro-config instead
  isPomodoroTask?: never;
  pomodoroCount?: never;
  pomodoroDuration?: never;
  shortBreak?: never;
  longBreak?: never;
  longBreakInterval?: never;
  pomodoroCompleted?: never;
  isOverdue?: never;
}
