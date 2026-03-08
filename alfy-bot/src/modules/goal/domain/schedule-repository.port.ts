import { Schedule } from '../../../shared/entities';

export interface ScheduleData {
  frequency_type: string;
  days_of_week?: number[];
  interval_days?: number;
  effective_from?: string;
}

export abstract class ScheduleRepositoryPort {
  abstract create(
    questionId: number,
    data: ScheduleData,
  ): Promise<Schedule>;
  abstract createNewVersion(
    questionId: number,
    data: ScheduleData,
  ): Promise<Schedule>;
}
