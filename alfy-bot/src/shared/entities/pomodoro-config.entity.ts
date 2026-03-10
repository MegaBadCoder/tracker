import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Task } from './task.entity';

@Entity('pomodoro_configs')
export class PomodoroConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  taskId: string;

  @Column({ default: 4 })
  pomodoroCount: number;

  @Column({ default: 25 })
  pomodoroDuration: number;

  @Column({ default: 5 })
  shortBreak: number;

  @Column({ default: 15 })
  longBreak: number;

  @Column({ default: 4 })
  longBreakInterval: number;

  @Column({ type: 'real', default: 0 })
  pomodoroCompleted: number;

  @OneToOne(() => Task, (task) => task.pomodoroConfig, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'taskId' })
  task: Task;
}
