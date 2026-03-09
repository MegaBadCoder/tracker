import { ApiProperty } from '@nestjs/swagger';

export type HabitDayStatus = 'filled' | 'not_filled' | 'not_due';

export class HabitHistoryEntryDto {
  @ApiProperty({ example: '2026-03-01' })
  date: string;

  @ApiProperty({
    enum: ['filled', 'not_filled', 'not_due'],
    description:
      'filled — запланировано и ответ есть; ' +
      'not_filled — запланировано, но ответа нет; ' +
      'not_due — не запланировано на этот день',
  })
  status: HabitDayStatus;
}

export class HabitWithHistoryDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  question: string;

  @ApiProperty()
  type: string;

  @ApiProperty()
  can_skip: boolean;

  @ApiProperty()
  is_active: boolean;

  @ApiProperty({ nullable: true })
  target_value: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ type: [HabitHistoryEntryDto] })
  history: HabitHistoryEntryDto[];
}
