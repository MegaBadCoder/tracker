import { IsArray, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReorderTasksDto {
  @ApiProperty({ example: ['task-1', 'task-2', 'task-3'] })
  @IsArray()
  @IsUUID('4', { each: true })
  orderedIds: string[];

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsOptional()
  @IsUUID()
  columnId?: string;
}
