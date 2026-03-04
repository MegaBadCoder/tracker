import { ReportAnswer } from '../../../shared/entities';

export interface AnswerData {
  answer_text: string;
  answer_number: number | null;
  answer_bool: boolean | null;
}

export abstract class ReportAnswerRepositoryPort {
  abstract save(
    userId: number,
    questionId: number,
    scheduledDate: string,
    data: AnswerData,
  ): Promise<ReportAnswer>;

  abstract findByQuestionAndDateRange(
    questionId: number,
    startDate: string,
    endDate: string,
  ): Promise<ReportAnswer[]>;

  abstract findByQuestionsAndDate(
    questionIds: number[],
    scheduledDate: string,
  ): Promise<ReportAnswer[]>;

  abstract countByQuestionsAndDate(
    questionIds: number[],
    scheduledDate: string,
  ): Promise<number>;
}
