import { ApiProperty } from '@nestjs/swagger';
import { IsDefined, IsUUID, ValidateIf } from 'class-validator';

export class SetGroupReleaseDto {
  /** UUID планового релиза проекта; null снимает назначение. Поле обязательно. */
  @ApiProperty({
    nullable: true,
    description: 'UUID планового релиза или null',
  })
  @ValidateIf((_object, value) => value !== null)
  @IsDefined()
  @IsUUID('4')
  releaseId: string | null;
}
