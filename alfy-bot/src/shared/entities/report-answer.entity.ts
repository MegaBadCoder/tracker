import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { GoalQuestion } from './goal-question.entity';

@Entity('report_answers')
@Index(['question_id', 'scheduled_date'])
@Index(['user_id', 'scheduled_date'])
@Index(['answer_number'])
export class ReportAnswer {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  user_id: number;

  @Column()
  question_id: number;

  @Column({ type: 'text' })
  scheduled_date: string;

  @Column({ type: 'text' })
  answer_text: string;

  @Column({ type: 'real', nullable: true })
  answer_number: number | null;

  @Column({ type: 'boolean', nullable: true })
  answer_bool: boolean | null;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => GoalQuestion)
  @JoinColumn({ name: 'question_id' })
  question: GoalQuestion;
}
