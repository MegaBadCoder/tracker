import { ApiProperty } from '@nestjs/swagger';
import { ArrayUnique, IsArray, IsUUID } from 'class-validator';

export class SetTaskDependenciesDto {
  @ApiProperty({
    type: [String],
    description: 'UUID предшественников; пустой массив удаляет все связи',
  })
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  dependencyIds: string[];
}
