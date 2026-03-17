import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';
import { PomodoroConfig } from './pomodoro-config.entity';
import type { ChecklistData } from '../../modules/task/domain/task-repository.port';

@Entity('tasks')
export class Task {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: number;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ default: false })
  completed: boolean;

  @Column({ type: 'text', nullable: true })
  priority: string | null;

  @Column({ type: 'datetime', nullable: true })
  dueDate: Date | null;

  @Column({ type: 'datetime', nullable: true })
  deadline: Date | null;

  @Column({ type: 'text', nullable: true })
  location: string | null;

  @Column('simple-json', { nullable: true })
  tags: string[] | null;

  @Column('simple-json', { nullable: true })
  checklist: ChecklistData | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @OneToOne(() => PomodoroConfig, (config) => config.task, {
    cascade: true,
    eager: true,
  })
  pomodoroConfig: PomodoroConfig | null;
}
