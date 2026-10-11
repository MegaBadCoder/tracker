import { IsUUID, ValidateIf } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReleaseReleaseDto {
  @ApiProperty({
    description: 'none либо UUID запланированного релиза проекта',
    example: 'none',
  })
  @ValidateIf((dto: ReleaseReleaseDto) => dto.moveTo !== 'none')
  @IsUUID('4')
  moveTo: string;
}
