import { PartialType, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { CreateGroupDto } from './create-group.dto';

export class UpdateGroupDto extends PartialType(CreateGroupDto) {
  @ApiPropertyOptional({ enum: ['open', 'done'] })
  @ValidateIf((_object, value) => value !== undefined)
  @IsIn(['open', 'done'])
  status?: 'open' | 'done';

  @ApiPropertyOptional()
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Matches(/^[a-zA-Z0-9_-]+$/)
  @MaxLength(64)
  workflowStatusId?: string;

  @ApiPropertyOptional({ nullable: true })
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsString()
  @Matches(/\S/)
  @MaxLength(2000)
  blockedReason?: string | null;

  @ApiPropertyOptional({ nullable: true, example: '2026-11-15' })
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  deferredUntil?: string | null;

  @ApiPropertyOptional()
  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  archived?: boolean;

  @ApiPropertyOptional({ type: [String] })
  @ValidateIf((_object, value) => value !== undefined)
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  dependencyIds?: string[];
}
