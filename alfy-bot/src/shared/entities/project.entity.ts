import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';
import { ProjectColumn } from './project-column.entity';

@Entity('projects')
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
