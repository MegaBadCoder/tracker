import { IsArray, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReorderDto {
  @ApiProperty({ example: ['id-1', 'id-2', 'id-3'] })
  @IsArray()
  @IsUUID('4', { each: true })
  orderedIds: string[];
}
