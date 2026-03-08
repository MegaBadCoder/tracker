import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Question, Schedule } from '../../shared/entities';
import { AuthModule } from '../auth/auth.module';
import { GoalModule } from '../goal/goal.module';
import { QuestionService } from './application/question.service';
import { QuestionRepositoryPort } from './domain/question-repository.port';
import { TypeOrmQuestionRepository } from './infrastructure/typeorm-question.repository';
import { QuestionController } from './question.controller';
import { ScheduleRepositoryPort } from '../goal/domain/schedule-repository.port';
import { TypeOrmScheduleRepository } from '../goal/infrastructure/typeorm-schedule.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([Question, Schedule]),
    AuthModule,
    GoalModule,
  ],
  controllers: [QuestionController],
  providers: [
    { provide: QuestionRepositoryPort, useClass: TypeOrmQuestionRepository },
    { provide: ScheduleRepositoryPort, useClass: TypeOrmScheduleRepository },
    QuestionService,
  ],
  exports: [QuestionService],
})
export class QuestionModule {}
