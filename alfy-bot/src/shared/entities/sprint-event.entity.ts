import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Sprint } from './sprint.entity';

@Entity('sprint_events')
@Index(['sprintId', 'occurredAt'])
export class SprintEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  sprintId: string;

  @Column({ type: 'text', nullable: true })
  taskId: string | null;

  @Column()
  kind: string;

  @Column()
  occurredAt: string;

  @Column()
  title: string;

  @ManyToOne(() => Sprint, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sprintId' })
  sprint: Sprint;
}
