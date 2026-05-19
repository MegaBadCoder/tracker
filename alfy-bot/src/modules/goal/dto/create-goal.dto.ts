import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';

export class CreateGoalDto {
  @ApiProperty({
    example: 'Читать 30 минут в день',
    minLength: 1,
    maxLength: 200,
  })
  @IsString()
  @Length(1, 200)
  goal_name: string;

  @ApiProperty({
    example: '2026-02-01',
    description: 'Дата начала цели в формате YYYY-MM-DD',
  })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'goal_start должен быть в формате YYYY-MM-DD',
  })
  goal_start: string;

  @ApiProperty({
    example: '2026-05-01',
    description: 'Дата окончания цели в формате YYYY-MM-DD',
  })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'goal_end должен быть в формате YYYY-MM-DD',
  })
  goal_end: string;
}
