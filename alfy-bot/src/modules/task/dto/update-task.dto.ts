import { PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CreateTaskDto } from './create-task.dto';

export class UpdateTaskDto extends PartialType(CreateTaskDto) {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  completed?: boolean;

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
}
