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
import { Question } from './question.entity';

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

  @OneToMany(() => Question, (question) => question.goal)
  questions: Question[];

  @CreateDateColumn()
  createdAt: Date;
}
