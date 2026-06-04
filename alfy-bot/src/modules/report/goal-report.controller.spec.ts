import { Test, TestingModule } from '@nestjs/testing';
import { JwtOrApiTokenGuard } from '../auth/guards/jwt-or-api-token.guard';
import { ReportService } from './application/report.service';
import { GoalReportController } from './goal-report.controller';

type AuthRequestLike = { user: { sub: number } };

describe('GoalReportController', () => {
  let controller: GoalReportController;
  let reportService: {
    getGoalReportStatus: jest.Mock;
    getReportQueue: jest.Mock;
  };

  beforeEach(async () => {
    reportService = {
      getGoalReportStatus: jest.fn(),
      getReportQueue: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [GoalReportController],
      providers: [{ provide: ReportService, useValue: reportService }],
    })
      .overrideGuard(JwtOrApiTokenGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(GoalReportController);
  });

  it('инстанцируется', () => {
    expect(controller).toBeDefined();
  });

  describe('GET /goals/report-queue', () => {
    it('форвардит в getReportQueue с userId и переданной датой', async () => {
      reportService.getReportQueue.mockResolvedValue([]);
      const req = { user: { sub: 42 } } as AuthRequestLike;

      await controller.getReportQueue(req as never, '2026-02-20');

      expect(reportService.getReportQueue).toHaveBeenCalledWith(
        42,
        '2026-02-20',
      );
    });

    it('подставляет сегодняшнюю локальную дату когда date не задан', async () => {
      reportService.getReportQueue.mockResolvedValue([]);
      const req = { user: { sub: 42 } } as AuthRequestLike;

      await controller.getReportQueue(req as never, undefined);

      const [userId, date] = reportService.getReportQueue.mock.calls[0] as [
        number,
        string,
      ];
      expect(userId).toBe(42);
      expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('GET /goals/:id/report-status', () => {
    it('форвардит в getGoalReportStatus с userId, id и датой', async () => {
      reportService.getGoalReportStatus.mockResolvedValue({});
      const req = { user: { sub: 42 } } as AuthRequestLike;

      await controller.getGoalReportStatus(req as never, 10, '2026-02-20');

      expect(reportService.getGoalReportStatus).toHaveBeenCalledWith(
        42,
        10,
        '2026-02-20',
      );
    });

    it('подставляет сегодняшнюю локальную дату когда date не задан', async () => {
      reportService.getGoalReportStatus.mockResolvedValue({});
      const req = { user: { sub: 42 } } as AuthRequestLike;

      await controller.getGoalReportStatus(req as never, 10, undefined);

      const [userId, id, date] = reportService.getGoalReportStatus.mock
        .calls[0] as [number, number, string];
      expect(userId).toBe(42);
      expect(id).toBe(10);
      expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });
});
