import { ApiProperty } from '@nestjs/swagger';
import { IsDateString } from 'class-validator';

export class UploadPhotoAnswerDto {
  @ApiProperty({ example: '2026-05-22' })
  @IsDateString()
  scheduled_date: string;
}
