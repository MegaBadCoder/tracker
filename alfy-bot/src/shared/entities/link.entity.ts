import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Task } from './task.entity';

@Entity('links')
@Unique(['taskId', 'kind', 'targetId'])
@Index(['userId', 'kind', 'taskId'])
@Index(['userId', 'kind', 'targetId'])
export class Link {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @Column()
  taskId: string;

  @Column({ type: 'text' })
  kind: string;

  @Column({ type: 'integer' })
  targetId: number;

  @ManyToOne(() => Task, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'taskId' })
  task: Task;
}
