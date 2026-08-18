import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsInt } from 'class-validator';

export class SetTaskGoalsDto {
  @ApiProperty({ type: [Number], example: [1, 2] })
  @IsArray()
  @IsInt({ each: true })
  goalIds: number[];
}
