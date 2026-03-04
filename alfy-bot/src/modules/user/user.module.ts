import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../shared/entities';
import { UserRepositoryPort } from './domain/user-repository.port';
import { TypeOrmUserRepository } from './infrastructure/typeorm-user.repository';
import { UserService } from './application/user.service';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [
    { provide: UserRepositoryPort, useClass: TypeOrmUserRepository },
    UserService,
  ],
  exports: [UserService],
})
export class UserModule {}
