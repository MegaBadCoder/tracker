import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { GoalQuestion } from './goal-question.entity';

@Entity('goal_schedules')
export class GoalSchedule {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  question_id: number;

  @Column({ type: 'text' })
  frequency_type: string;

  @Column({
    type: 'text',
    nullable: true,
    transformer: {
      to: (value: number[] | null): string | null =>
        value ? JSON.stringify(value) : null,
      from: (value: string | null): number[] | null => {
        if (!value) return null;
        try {
          return JSON.parse(value);
        } catch {
          return null;
        }
      },
    },
  })
  days_of_week: number[] | null;

  @Column({ type: 'integer', nullable: true })
  interval_days: number | null;

  @Column({ type: 'text', nullable: true })
  effective_from: string | null;

  @ManyToOne(() => GoalQuestion, (question) => question.schedules)
  @JoinColumn({ name: 'question_id' })
  question: GoalQuestion;

  @CreateDateColumn()
  createdAt: Date;
}
