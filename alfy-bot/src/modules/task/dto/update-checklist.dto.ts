import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsString,
  ValidateNested,
} from 'class-validator';

class ChecklistItemDto {
  @IsString()
  id: string;

  @IsString()
  text: string;

  @IsBoolean()
  completed: boolean;

  @IsNumber()
  order: number;
}

export class UpdateChecklistDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChecklistItemDto)
  items: ChecklistItemDto[];
}
