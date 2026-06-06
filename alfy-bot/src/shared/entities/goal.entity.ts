import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Question } from './question.entity';

@Entity('goals')
export class Goal {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text' })
  goal_name: string;

  @Column({ type: 'text', nullable: true })
  goal_start: string | null;

  @Column({ type: 'text', nullable: true })
  goal_end: string | null;

  @Column({ default: 'active' })
  status: string;

  @Column({ default: false })
  is_global: boolean;

  @Column({ type: 'integer', nullable: true })
  parent_goal_id: number | null;

  @Column()
  user_id: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Goal, (g) => g.children, { nullable: true })
  @JoinColumn({ name: 'parent_goal_id' })
  parent?: Goal | null;

  @OneToMany(() => Goal, (g) => g.parent)
  children: Goal[];

  /**
   * Кол-во непустых (не deleted) подцелей. Не колонка — заполняется
   * репозиторием для global-целей в списочных выборках, чтобы карточка
   * могла показать «N подцелей» без загрузки самих детей.
   */
  children_count?: number;

  @OneToMany(() => Question, (question) => question.goal)
  questions: Question[];

  @CreateDateColumn()
  createdAt: Date;
}
