import { Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Task } from './task.entity';

@Entity('task_dependencies')
@Index('IDX_task_dependencies_predecessor', ['dependencyId'])
export class TaskDependency {
  @PrimaryColumn('varchar')
  taskId: string;

  @PrimaryColumn('varchar')
  dependencyId: string;

  @ManyToOne(() => Task, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'taskId' })
  task: Task;

  @ManyToOne(() => Task, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'dependencyId' })
  dependency: Task;
}
