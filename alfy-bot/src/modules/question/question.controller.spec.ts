import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtOrApiTokenGuard } from '../auth/guards/jwt-or-api-token.guard';
import { ReportService } from '../report/application/report.service';
import { QuestionService } from './application/question.service';
import { AnswerQuestionDto } from './dto/answer-question.dto';
import { QuestionController } from './question.controller';

type AuthRequestLike = { user: { sub: number } };

describe('QuestionController — POST /:id/answers', () => {
  let controller: QuestionController;
  let reportService: { addAnswer: jest.Mock };

  beforeEach(async () => {
    reportService = { addAnswer: jest.fn() };

    const questionServiceMock = {
      getHabitsWithHistory: jest.fn(),
      findById: jest.fn(),
      createHabit: jest.fn(),
      updateSchedule: jest.fn(),
      updateQuestion: jest.fn(),
      deactivate: jest.fn(),
      countAnswers: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [QuestionController],
      providers: [
        { provide: QuestionService, useValue: questionServiceMock },
        { provide: ReportService, useValue: reportService },
      ],
    })
      .overrideGuard(JwtOrApiTokenGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(QuestionController);
  });

  it('should record answer via POST /:id/answers', async () => {
    reportService.addAnswer.mockResolvedValue(undefined);

    const req = { user: { sub: 42 } } as AuthRequestLike;
    const dto: AnswerQuestionDto = {
      scheduled_date: '2026-05-19',
      answer: 'yes',
    };

    const result = await controller.answerQuestion(req as never, 1, dto);

    expect(reportService.addAnswer).toHaveBeenCalledWith(
      42,
      1,
      '2026-05-19',
      'yes',
    );
    expect(result).toEqual({ ok: true });
  });

  it('should 400 on invalid date format via ValidationPipe', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });

    const badDto = { scheduled_date: 'not-a-date', answer: 'yes' };

    await expect(
      pipe.transform(badDto, { type: 'body', metatype: AnswerQuestionDto }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('should 400 when answer exceeds 200 chars via ValidationPipe', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });

    const badDto = { scheduled_date: '2026-05-19', answer: 'x'.repeat(201) };

    await expect(
      pipe.transform(badDto, { type: 'body', metatype: AnswerQuestionDto }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
