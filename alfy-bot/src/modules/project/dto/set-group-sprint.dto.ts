import { ApiProperty } from '@nestjs/swagger';
import { IsDefined, IsUUID, ValidateIf } from 'class-validator';

export class SetGroupSprintDto {
  /** UUID незакрытого спринта проекта; null снимает назначение. Поле обязательно. */
  @ApiProperty({
    nullable: true,
    description: 'UUID незакрытого спринта или null',
  })
  @ValidateIf((_object, value) => value !== null)
  @IsDefined()
  @IsUUID('4')
  sprintId: string | null;
}
