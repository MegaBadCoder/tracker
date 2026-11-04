import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import type { StoryWorkflowCategory } from '../domain/story-workflow';

export class StoryWorkflowStatusDto {
  @ApiProperty()
  @IsString()
  @Matches(/^[a-zA-Z0-9_-]+$/)
  @MaxLength(64)
  id: string;

  @ApiProperty()
  @IsString()
  @Matches(/\S/)
  @MaxLength(120)
  name: string;

  @ApiProperty({ enum: ['open', 'ready', 'in_progress', 'review', 'done'] })
  @IsIn(['open', 'ready', 'in_progress', 'review', 'done'])
  category: StoryWorkflowCategory;

  @ApiProperty()
  @Matches(/^#[0-9a-fA-F]{6}$/)
  color: string;
}

export class ReplaceStoryWorkflowDto {
  @ApiProperty({ type: [StoryWorkflowStatusDto] })
  @IsArray()
  @ArrayMinSize(2)
  @ArrayUnique((status: StoryWorkflowStatusDto) => status.id)
  @ValidateNested({ each: true })
  @Type(() => StoryWorkflowStatusDto)
  statuses: StoryWorkflowStatusDto[];
}
