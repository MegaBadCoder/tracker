import { ReportAnswer } from '../../../shared/entities';

export interface AnswerData {
  answer_text: string;
  answer_number: number | null;
  answer_bool: boolean | null;
  photo_key?: string | null;
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

  abstract findByQuestionsAndDateRange(
    questionIds: number[],
    startDate: string,
    endDate: string,
  ): Promise<ReportAnswer[]>;

  abstract countByQuestion(questionId: number): Promise<number>;

  abstract findByQuestionAndDate(
    questionId: number,
    scheduledDate: string,
  ): Promise<ReportAnswer | null>;

  abstract findPhotosByQuestion(
    questionId: number,
    limit: number,
    offset: number,
  ): Promise<ReportAnswer[]>;
}
