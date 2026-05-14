import { IsArray, IsString, ArrayMinSize } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReorderInboxTasksDto {
  @ApiProperty({ example: ['task-1', 'task-2', 'task-3'] })
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  orderedIds: string[];
}
