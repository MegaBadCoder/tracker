import { IsUUID, ValidateIf } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CompleteSprintDto {
  @ApiProperty({
    description: 'backlog либо UUID запланированного спринта проекта',
    example: 'backlog',
  })
  @ValidateIf((dto: CompleteSprintDto) => dto.moveTo !== 'backlog')
  @IsUUID('4')
  moveTo: string;
}
