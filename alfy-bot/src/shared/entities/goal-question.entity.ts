import {
  AfterLoad,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { GoalSchedule } from './goal-schedule.entity';
import { Goal } from './goal.entity';

@Entity('goal_questions')
@Index(['goal_id', 'is_active'])
@Index(['goal_id', 'order_index'])
export class GoalQuestion {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  goal_id: number;

  @Column({ type: 'text' })
  question: string;

  @Column({ type: 'text' })
  type: string;

  @Column({ type: 'boolean', default: false })
  can_skip: boolean;

  @Column({ type: 'integer', default: 0 })
  order_index: number;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Goal, (goal) => goal.questions)
  @JoinColumn({ name: 'goal_id' })
  goal: Goal;

  @OneToMany(() => GoalSchedule, (s) => s.question, {
    cascade: true,
    eager: true,
  })
  schedules: GoalSchedule[];

  /** Backward-compat: latest schedule by effective_from */
  schedule: GoalSchedule | null;

  @AfterLoad()
  setCurrentSchedule() {
    if (!this.schedules || this.schedules.length === 0) {
      this.schedule = null;
      return;
    }
    this.schedule = this.schedules.reduce(
      (latest, s) => {
        if (!latest) return s;
        if (!s.effective_from) return latest;
        if (!latest.effective_from) return s;
        return s.effective_from > latest.effective_from ? s : latest;
      },
      null as GoalSchedule | null,
    );
  }
}
