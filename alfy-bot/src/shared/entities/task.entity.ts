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
import { Project } from './project.entity';
import { ProjectColumn } from './project-column.entity';
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

  @Column({ type: 'text', nullable: true })
  projectId: string | null;

  @Column({ type: 'text', nullable: true })
  columnId: string | null;

  @Column({ type: 'integer', default: 0 })
  order: number;

  @Column('simple-json', { nullable: true })
  checklist: ChecklistData | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => Project, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'projectId' })
  project: Project | null;

  @ManyToOne(() => ProjectColumn, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'columnId' })
  column: ProjectColumn | null;

  @OneToOne(() => PomodoroConfig, (config) => config.task, {
    cascade: true,
    eager: true,
  })
  pomodoroConfig: PomodoroConfig | null;
}
