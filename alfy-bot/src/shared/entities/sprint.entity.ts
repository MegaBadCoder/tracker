import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Project } from './project.entity';

export type SprintStatus = 'planned' | 'active' | 'closed';

/**
 * Спринт agile-проекта. В проекте не больше одного спринта в статусе `active`
 * (частичный уникальный индекс). Даты хранятся строкой `YYYY-MM-DD`.
 */
@Entity('sprints')
@Check('CHK_sprint_status', "status IN ('planned','active','closed')")
@Check(
  'CHK_sprint_date_order',
  'startDate IS NULL OR endDate IS NULL OR startDate <= endDate',
)
@Index('IDX_sprint_one_active', ['projectId'], {
  unique: true,
  where: "status = 'active'",
})
export class Sprint {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: number;

  @Column()
  projectId: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  goal: string | null;

  @Column({ type: 'text', nullable: true })
  startDate: string | null;

  @Column({ type: 'text', nullable: true })
  endDate: string | null;

  @Column({ type: 'text', default: 'planned' })
  status: SprintStatus;

  @Column({ type: 'datetime', nullable: true })
  completedAt: Date | null;

  @Column({ type: 'integer', default: 0 })
  order: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Project, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'projectId' })
  project: Project;
}
