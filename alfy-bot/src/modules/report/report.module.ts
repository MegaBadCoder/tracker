import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportAnswer } from '../../shared/entities';
import { AuthModule } from '../auth/auth.module';
import { GoalModule } from '../goal/goal.module';
import { ReportService } from './application/report.service';
import { ReportAnswerRepositoryPort } from './domain/report-answer-repository.port';
import { TypeOrmReportAnswerRepository } from './infrastructure/typeorm-report-answer.repository';
import { ReportController } from './report.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ReportAnswer]), GoalModule, AuthModule],
  controllers: [ReportController],
  providers: [
    {
      provide: ReportAnswerRepositoryPort,
      useClass: TypeOrmReportAnswerRepository,
    },
    ReportService,
  ],
  exports: [ReportService, ReportAnswerRepositoryPort],
})
export class ReportModule {}
