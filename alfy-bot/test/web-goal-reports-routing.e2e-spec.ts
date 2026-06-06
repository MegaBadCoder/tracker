import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { GoalController } from '../src/modules/goal/goal.controller';
import { GoalService } from '../src/modules/goal/application/goal.service';
import { GoalReportController } from '../src/modules/report/goal-report.controller';
import { ReportService } from '../src/modules/report/application/report.service';
import { JwtOrApiTokenGuard } from '../src/modules/auth/guards/jwt-or-api-token.guard';

// Routing regression: GoalController and GoalReportController share the `goals`
// prefix. GoalController is registered FIRST here (mirrors AppModule, which imports
// GoalModule before ReportModule) — the worst case. This proves the queue endpoint
// `goals/reports/queue` (two-segment) is NOT shadowed by `goals/:id`.
//
// History: a single-segment `goals/report-queue` WAS shadowed by `@Get(':id')`
// (ParseIntPipe → 400), and Express 5 / path-to-regexp v8 reject the `:id(\\d+)`
// regex workaround. The two-segment path is the order-independent fix.
describe('Web goal reports routing (e2e)', () => {
  let app: INestApplication;

  const goalService = {
    findById: jest.fn(),
    findByStatus: jest.fn(),
    findAllByUser: jest.fn(),
  };
  const reportService = {
    getGoalReportStatus: jest.fn(),
    getReportQueue: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [GoalController, GoalReportController], // GoalController first = worst case
      providers: [
        { provide: GoalService, useValue: goalService },
        { provide: ReportService, useValue: reportService },
      ],
    })
      .overrideGuard(JwtOrApiTokenGuard)
      .useValue({
        canActivate: (ctx: { switchToHttp: () => { getRequest: () => { user?: unknown } } }) => {
          ctx.switchToHttp().getRequest().user = { sub: 42 };
          return true;
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => jest.clearAllMocks());

  it('GET /api/goals/reports/queue dispatches to getReportQueue (not shadowed by :id)', async () => {
    reportService.getReportQueue.mockResolvedValue([
      { goalId: 7, goalName: 'G', pendingCount: 2 },
    ]);

    const res = await request(app.getHttpServer())
      .get('/api/goals/reports/queue?date=2026-06-01')
      .expect(200);

    expect(reportService.getReportQueue).toHaveBeenCalledWith(42, '2026-06-01');
    expect(goalService.findById).not.toHaveBeenCalled(); // :id route did not intercept
    expect(res.body).toEqual([{ goalId: 7, goalName: 'G', pendingCount: 2 }]);
  });

  it('GET /api/goals/reports/queue without date defaults to today (YYYY-MM-DD)', async () => {
    reportService.getReportQueue.mockResolvedValue([]);
    await request(app.getHttpServer()).get('/api/goals/reports/queue').expect(200);

    const arg = reportService.getReportQueue.mock.calls[0][1] as string;
    expect(arg).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('GET /api/goals/:id/report-status dispatches to getGoalReportStatus', async () => {
    reportService.getGoalReportStatus.mockResolvedValue({
      goalId: 9,
      date: '2026-06-01',
      lastUnfilledDate: null,
      questions: [],
      allDone: true,
    });

    const res = await request(app.getHttpServer())
      .get('/api/goals/9/report-status?date=2026-06-01')
      .expect(200);

    expect(reportService.getGoalReportStatus).toHaveBeenCalledWith(42, 9, '2026-06-01');
    expect(res.body.goalId).toBe(9);
  });

  it('GET /api/goals/:id (existing route) still works alongside the new controller', async () => {
    goalService.findById.mockResolvedValue({ id: 5, user_id: 42, goal_name: 'X' });
    const res = await request(app.getHttpServer()).get('/api/goals/5').expect(200);
    expect(res.body.id).toBe(5);
    expect(reportService.getGoalReportStatus).not.toHaveBeenCalled();
  });
});
