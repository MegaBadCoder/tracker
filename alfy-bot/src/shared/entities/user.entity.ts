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

  @Column({ nullable: true })
  username: string;

  @Column({ nullable: true })
  firstName: string;

  @Column({ nullable: true })
  lastName: string;

  @Column({ unique: true, nullable: true })
  email: string;

  @Column({ nullable: true })
  photoUrl: string;

  @Column({ nullable: true })
  phone: string;

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
