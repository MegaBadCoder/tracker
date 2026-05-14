import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Goal, Question, Schedule } from '../../shared/entities';
import { AuthModule } from '../auth/auth.module';
import { GoalService } from './application/goal.service';
import { ScheduleService } from './application/schedule.service';
import { GoalRepositoryPort } from './domain/goal-repository.port';
import { ScheduleRepositoryPort } from './domain/schedule-repository.port';
import { GoalController } from './goal.controller';
import { TypeOrmGoalRepository } from './infrastructure/typeorm-goal.repository';
import { TypeOrmScheduleRepository } from './infrastructure/typeorm-schedule.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Goal, Question, Schedule]), AuthModule],
  controllers: [GoalController],
  providers: [
    { provide: GoalRepositoryPort, useClass: TypeOrmGoalRepository },
    { provide: ScheduleRepositoryPort, useClass: TypeOrmScheduleRepository },
    GoalService,
    ScheduleService,
  ],
  exports: [GoalService, ScheduleService],
})
export class GoalModule {}
