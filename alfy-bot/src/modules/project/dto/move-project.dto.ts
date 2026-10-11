import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, ValidateIf } from 'class-validator';

export class MoveProjectDto {
  @ApiProperty({ nullable: true, description: 'Родитель проекта; null — корневой уровень' })
  @ValidateIf((_object, value) => value !== null)
  @IsUUID('4')
  parentId: string | null;

  @ApiProperty({ nullable: true, description: 'Сосед, перед которым вставляется проект; null — конец уровня' })
  @ValidateIf((_object, value) => value !== null)
  @IsUUID('4')
  beforeId: string | null;
}
