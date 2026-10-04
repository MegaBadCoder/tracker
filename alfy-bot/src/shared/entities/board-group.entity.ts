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
import { Release } from './release.entity';

@Entity('board_groups')
@Check('CHK_board_group_type', "type IN ('epic','story')")
@Check('CHK_board_group_status', "status IN ('open','done')")
@Check('CHK_board_group_release_story', "type = 'story' OR releaseId IS NULL")
@Check('CHK_board_group_not_self', 'parentId <> id')
@Check(
  'CHK_board_group_depth',
  "(parentId IS NULL AND type = 'epic') OR (parentId IS NOT NULL AND type = 'story')",
)
@Check(
  'CHK_board_group_dates_epic_only',
  "type = 'epic' OR (startDate IS NULL AND dueDate IS NULL)",
)
@Check(
  'CHK_board_group_date_order',
  'startDate IS NULL OR dueDate IS NULL OR startDate <= dueDate',
)
export class BoardGroup {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: number;

  @Column()
  projectId: string;

  @Column({ type: 'text', nullable: true })
  releaseId: string | null;

  @ManyToOne(() => Release, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'releaseId' })
  release: Release | null;

  @Column({ type: 'text', nullable: true })
  parentId: string | null;

  @Column({ type: 'text' })
  type: 'epic' | 'story';

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'text', default: 'open' })
  status: 'open' | 'done';

  @Column({ type: 'datetime', nullable: true })
  completedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  color: string | null;

  @Column({ type: 'integer', default: 0 })
  order: number;

  @Column({ type: 'text', nullable: true })
  startDate: string | null;

  @Column({ type: 'text', nullable: true })
  dueDate: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Project, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'projectId' })
  project: Project;

  @ManyToOne(() => BoardGroup, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'parentId' })
  parent: BoardGroup | null;
}
