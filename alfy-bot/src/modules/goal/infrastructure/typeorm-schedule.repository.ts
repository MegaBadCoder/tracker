import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Schedule } from '../../../shared/entities';
import {
  ScheduleData,
  ScheduleRepositoryPort,
} from '../domain/schedule-repository.port';

@Injectable()
export class TypeOrmScheduleRepository extends ScheduleRepositoryPort {
  constructor(
    @InjectRepository(Schedule)
    private repo: Repository<Schedule>,
  ) {
    super();
  }

  async create(questionId: number, data: ScheduleData): Promise<Schedule> {
    const schedule = this.repo.create({
      question_id: questionId,
      frequency_type: data.frequency_type,
      days_of_week: data.days_of_week ?? null,
      interval_days: data.interval_days ?? null,
      effective_from: data.effective_from ?? null,
    });
    return this.repo.save(schedule);
  }

  async createNewVersion(
    questionId: number,
    data: ScheduleData,
  ): Promise<Schedule> {
    const schedule = this.repo.create({
      question_id: questionId,
      frequency_type: data.frequency_type,
      days_of_week: data.days_of_week ?? null,
      interval_days: data.interval_days ?? null,
      effective_from: data.effective_from ?? null,
    });
    return this.repo.save(schedule);
  }
}
