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
import { Schedule } from './schedule.entity';
import { Goal } from './goal.entity';
import { User } from './user.entity';

@Entity('questions')
@Index(['goal_id', 'is_active'])
@Index(['goal_id', 'order_index'])
@Index(['user_id', 'is_habit', 'is_active'])
export class Question {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  goal_id: number | null;

  @Column({ nullable: true })
  user_id: number | null;

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

  @Column({ type: 'boolean', default: false })
  is_habit: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Goal, (goal) => goal.questions)
  @JoinColumn({ name: 'goal_id' })
  goal: Goal | null;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @OneToMany(() => Schedule, (s) => s.question, {
    cascade: true,
    eager: true,
  })
  schedules: Schedule[];

  /** Backward-compat: latest schedule by effective_from */
  schedule: Schedule | null;

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
      null as Schedule | null,
    );
  }
}
