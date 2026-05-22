import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, IsNull, Not, Repository } from 'typeorm';
import { ReportAnswer } from '../../../shared/entities';
import {
  ReportAnswerRepositoryPort,
  AnswerData,
} from '../domain/report-answer-repository.port';

@Injectable()
export class TypeOrmReportAnswerRepository extends ReportAnswerRepositoryPort {
  constructor(
    @InjectRepository(ReportAnswer)
    private repo: Repository<ReportAnswer>,
  ) {
    super();
  }

  async save(
    userId: number,
    questionId: number,
    scheduledDate: string,
    data: AnswerData,
  ): Promise<ReportAnswer> {
    const answer = this.repo.create({
      user_id: userId,
      question_id: questionId,
      scheduled_date: scheduledDate,
      answer_text: data.answer_text,
      answer_number: data.answer_number,
      answer_bool: data.answer_bool,
      photo_key: data.photo_key ?? null,
    });
    return this.repo.save(answer);
  }

  async findByQuestionAndDateRange(
    questionId: number,
    startDate: string,
    endDate: string,
  ): Promise<ReportAnswer[]> {
    return this.repo.find({
      where: {
        question_id: questionId,
        scheduled_date: Between(startDate, endDate),
      },
      order: { scheduled_date: 'ASC' },
    });
  }

  async findByQuestionsAndDate(
    questionIds: number[],
    scheduledDate: string,
  ): Promise<ReportAnswer[]> {
    if (questionIds.length === 0) return [];
    return this.repo.find({
      where: {
        question_id: In(questionIds),
        scheduled_date: scheduledDate,
      },
    });
  }

  async countByQuestionsAndDate(
    questionIds: number[],
    scheduledDate: string,
  ): Promise<number> {
    if (questionIds.length === 0) return 0;
    return this.repo.count({
      where: {
        question_id: In(questionIds),
        scheduled_date: scheduledDate,
      },
    });
  }

  async findByQuestionsAndDateRange(
    questionIds: number[],
    startDate: string,
    endDate: string,
  ): Promise<ReportAnswer[]> {
    if (questionIds.length === 0) return [];
    return this.repo.find({
      where: {
        question_id: In(questionIds),
        scheduled_date: Between(startDate, endDate),
      },
      order: { scheduled_date: 'ASC' },
    });
  }

  async countByQuestion(questionId: number): Promise<number> {
    return this.repo.count({ where: { question_id: questionId } });
  }

  async findByQuestionAndDate(
    questionId: number,
    scheduledDate: string,
  ): Promise<ReportAnswer | null> {
    return this.repo.findOne({
      where: { question_id: questionId, scheduled_date: scheduledDate },
    });
  }

  async findPhotosByQuestion(
    questionId: number,
    limit: number,
    offset: number,
  ): Promise<ReportAnswer[]> {
    return this.repo.find({
      where: { question_id: questionId, photo_key: Not(IsNull()) },
      order: { scheduled_date: 'DESC' },
      take: limit,
      skip: offset,
    });
  }
}
