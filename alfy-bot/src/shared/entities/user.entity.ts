import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  telegramId: number;

  @Column({ nullable: true })
  username: string;

  @Column({ nullable: true })
  firstName: string;

  @Column('simple-json', { nullable: true })
  settings: {
    notifications: boolean;
    language: string;
  };

  @Column({ nullable: true, default: 'UTC' })
  timezone: string;

  @CreateDateColumn()
  createdAt: Date;
}
