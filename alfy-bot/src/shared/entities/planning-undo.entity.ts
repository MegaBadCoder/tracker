import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export interface PlanningUndoState {
  tasks: Record<string, unknown>[];
  stories: Record<string, unknown>[];
  storyTaskIds: string[];
}

@Entity('planning_undos')
export class PlanningUndo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: number;

  @Column()
  projectId: string;

  @Column('simple-json')
  before: PlanningUndoState;

  @Column('simple-json')
  after: PlanningUndoState;

  @Column({ default: false })
  used: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
