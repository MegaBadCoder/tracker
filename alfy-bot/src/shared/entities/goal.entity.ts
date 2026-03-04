import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from './user.entity';
import { GoalQuestion } from './goal-question.entity';

@Entity('goals')
export class Goal {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text' })
  goal_name: string;

  @Column({ type: 'text' })
  goal_start: string;

  @Column({ type: 'text' })
  goal_end: string;

  @Column({ default: 'active' })
  status: string;

  @Column()
  user_id: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @OneToMany(() => GoalQuestion, (question) => question.goal)
  questions: GoalQuestion[];

  @CreateDateColumn()
  createdAt: Date;
}
