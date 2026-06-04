import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('api_tokens')
export class ApiToken {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  user_id: number;

  @Column()
  name: string;

  @Index()
  @Column({ length: 10 })
  prefix: string;

  @Column()
  token_hash: string;

  @CreateDateColumn()
  created_at: Date;

  @Column({ type: 'datetime', nullable: true, default: null })
  last_used_at: Date | null;

  @Column({ type: 'datetime', nullable: true, default: null })
  revoked_at: Date | null;
}
