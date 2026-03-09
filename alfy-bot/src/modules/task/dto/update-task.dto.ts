import { PartialType } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CreateTaskDto } from './create-task.dto';

export class UpdateTaskDto extends PartialType(CreateTaskDto) {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  completed?: boolean;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsNumber()
  pomodoroCompleted?: number;
}
