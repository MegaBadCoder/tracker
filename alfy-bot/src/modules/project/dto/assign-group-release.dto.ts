import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignGroupReleaseDto {
  @ApiProperty({ description: 'UUID эпика или истории проекта' })
  @IsUUID('4')
  groupId: string;
}
