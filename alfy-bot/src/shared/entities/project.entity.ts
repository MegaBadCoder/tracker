import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';
import { ProjectColumn } from './project-column.entity';

@Entity('projects')
@Index('IDX_project_task_key_prefix', ['userId', 'taskKeyPrefix'], {
  unique: true,
  where: 'taskKeyPrefix IS NOT NULL',
})
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: number;

  @Column({ type: 'text', nullable: true })
  parentId: string | null;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'text', default: 'list' })
  viewMode: 'list' | 'board';

  @Column({ type: 'text', default: 'simple' })
  type: 'simple' | 'agile';

  @Column({ type: 'text', nullable: true })
  taskKeyPrefix: string | null;

  @Column({ type: 'integer', default: 1 })
  nextTaskNumber: number;

  @Column({ type: 'text', nullable: true })
  icon: string | null;

  @Column({ type: 'text', nullable: true })
  color: string | null;

  @Column({ type: 'integer', default: 0 })
  order: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => Project, (project) => project.children, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'parentId' })
  parent: Project | null;

  @OneToMany(() => Project, (project) => project.parent)
  children: Project[];

  @OneToMany(() => ProjectColumn, (column) => column.project, {
    cascade: true,
  })
  columns: ProjectColumn[];
}
