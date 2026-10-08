import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Project } from './project.entity';

export type ReleaseStatus = 'planned' | 'released';

/**
 * Релиз agile-проекта. Статус `released` необратим. Даты хранятся строкой
 * `YYYY-MM-DD`.
 */
@Entity('releases')
@Check('CHK_release_status', "status IN ('planned','released')")
@Check(
  'CHK_release_date_order',
  'startDate IS NULL OR releaseDate IS NULL OR startDate <= releaseDate',
)
export class Release {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: number;

  @Column()
  projectId: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'text', nullable: true })
  startDate: string | null;

  @Column({ type: 'text', nullable: true })
  releaseDate: string | null;

  @Column({ type: 'text', default: 'planned' })
  status: ReleaseStatus;

  @Column({ type: 'datetime', nullable: true })
  releasedAt: Date | null;

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
