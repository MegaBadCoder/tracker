import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ScheduleDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'daily', enum: ['daily', 'weekly_days', 'interval'] })
  frequency_type: string;

  @ApiPropertyOptional({
    example: [1, 3, 5],
    description:
      'Массив дней недели (0=Вс, 1=Пн, ..., 6=Сб). Только для weekly_days',
    nullable: true,
    type: [Number],
  })
  days_of_week: number[] | null;

  @ApiPropertyOptional({
    example: 3,
    description: 'Интервал в днях. Только для interval',
    nullable: true,
  })
  interval_days: number | null;

  @ApiPropertyOptional({
    example: '2026-02-01',
    description: 'Дата начала действия этого расписания (YYYY-MM-DD)',
    nullable: true,
  })
  effective_from: string | null;
}

export class QuestionDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Сколько страниц прочитал?' })
  question: string;

  @ApiProperty({
    example: 'number',
    enum: ['text', 'rating', 'emoji_rating', 'yes_no', 'number', 'time_spent'],
  })
  type: string;

  @ApiProperty({ example: false })
  can_skip: boolean;

  @ApiProperty({ example: 0 })
  order_index: number;

  @ApiProperty({ example: true })
  is_active: boolean;

  @ApiProperty({ example: false })
  is_habit: boolean;

  @ApiPropertyOptional({ example: null, nullable: true })
  user_id: number | null;

  @ApiProperty({ example: '2026-02-01T10:00:00.000Z' })
  createdAt: Date;

  @ApiPropertyOptional({ type: () => ScheduleDto })
  schedule: ScheduleDto;
}

export class GoalDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Читать 30 минут в день' })
  goal_name: string;

  @ApiProperty({ example: '2026-02-01' })
  goal_start: string;

  @ApiProperty({ example: '2026-05-01' })
  goal_end: string;

  @ApiProperty({ example: 'active', enum: ['active', 'completed', 'deleted'] })
  status: string;

  @ApiProperty({ example: '2026-02-01T10:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ type: () => [QuestionDto] })
  questions: QuestionDto[];
}
