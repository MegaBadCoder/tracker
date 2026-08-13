import { IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class MaterializeOccurrenceDto {
  @ApiProperty({ example: '2026-04-13T10:00:00.000Z' })
  @IsDateString()
  occurrenceDate: string;
}
