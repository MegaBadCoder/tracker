import {
  ArrayUnique,
  IsArray,
  IsInt,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class PlanningMoveDto {
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  taskIds: string[];

  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  storyIds: string[];

  @ValidateIf((o: PlanningMoveDto) => o.sprintId !== null)
  @IsUUID('4')
  sprintId: string | null;
}

export class PlanningOrderDto {
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  taskIds: string[];

  @ValidateIf((o: PlanningOrderDto) => o.sprintId !== null)
  @IsUUID('4')
  sprintId: string | null;
}

export class PlanningUndoDto {
  @IsUUID('4')
  undoToken: string;
}

export class PlanningProposalDto {
  @IsUUID('4')
  sprintId: string;

  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  budgetMinutes: number;

  @IsString()
  @MaxLength(5000)
  goal: string;
}
