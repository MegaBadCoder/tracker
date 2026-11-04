import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsIn,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TaskDestinationDto {
  @IsUUID('4')
  taskId: string;

  @ValidateIf((o: TaskDestinationDto) => o.sprintId !== null)
  @IsUUID('4')
  sprintId: string | null;
}

export class StoryDestinationDto {
  @IsUUID('4')
  storyId: string;

  @ValidateIf((o: StoryDestinationDto) => o.sprintId !== null)
  @IsUUID('4')
  sprintId: string | null;
}

export class CompleteSprintDto {
  @ApiProperty({
    description: 'backlog либо UUID запланированного спринта проекта',
  })
  @ValidateIf((dto: CompleteSprintDto) => dto.moveTo !== 'backlog')
  @IsUUID('4')
  moveTo: string;

  @ValidateIf((o: CompleteSprintDto) => o.goalOutcome !== undefined)
  @IsIn(['achieved', 'partial', 'missed'])
  goalOutcome?: 'achieved' | 'partial' | 'missed';

  @ValidateIf((o: CompleteSprintDto) => o.retrospective !== undefined)
  @IsString()
  @MaxLength(10000)
  retrospective?: string;

  @ValidateIf((o: CompleteSprintDto) => o.improvement !== undefined)
  @IsString()
  @MaxLength(10000)
  improvement?: string;

  @ValidateIf((o: CompleteSprintDto) => o.carryoverReason !== undefined)
  @IsString()
  @MaxLength(10000)
  carryoverReason?: string;

  @ValidateIf((o: CompleteSprintDto) => o.taskDestinations !== undefined)
  @IsArray()
  @ArrayUnique((value: TaskDestinationDto) => value.taskId)
  @ValidateNested({ each: true })
  @Type(() => TaskDestinationDto)
  taskDestinations?: TaskDestinationDto[];

  @ValidateIf((o: CompleteSprintDto) => o.storyDestinations !== undefined)
  @IsArray()
  @ArrayUnique((value: StoryDestinationDto) => value.storyId)
  @ValidateNested({ each: true })
  @Type(() => StoryDestinationDto)
  storyDestinations?: StoryDestinationDto[];
}
