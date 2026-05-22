import { DataSource, Repository } from 'typeorm';
import {
  ApiToken,
  AuthMethod,
  Goal,
  Project,
  ProjectColumn,
  PomodoroConfig,
  PushSubscription,
  Question,
  ReportAnswer,
  Schedule,
  Task,
  TimerSession,
  User,
} from '../../../shared/entities';
import { TypeOrmReportAnswerRepository } from './typeorm-report-answer.repository';

const ALL_ENTITIES = [
  ApiToken,
  AuthMethod,
  Goal,
  Project,
  ProjectColumn,
  PomodoroConfig,
  PushSubscription,
  Question,
  ReportAnswer,
  Schedule,
  Task,
  TimerSession,
  User,
];

async function buildDataSource(): Promise<DataSource> {
  const ds = new DataSource({
    type: 'sqlite',
    database: ':memory:',
    entities: ALL_ENTITIES,
    synchronize: true,
    // Disable FK enforcement so tests don't need to seed user/question rows
    extra: { pragma: 'PRAGMA foreign_keys = OFF;' },
  });
  await ds.initialize();
  // SQLite pragma must also be applied after connection opens
  await ds.query('PRAGMA foreign_keys = OFF;');
  return ds;
}

describe('TypeOrmReportAnswerRepository', () => {
  let ds: DataSource;
  let repo: Repository<ReportAnswer>;
  let sut: TypeOrmReportAnswerRepository;

  beforeEach(async () => {
    ds = await buildDataSource();
    repo = ds.getRepository(ReportAnswer);
    sut = new TypeOrmReportAnswerRepository(repo);
  });

  afterEach(async () => {
    await ds.destroy();
  });

  describe('save', () => {
    it('writes photo_key when provided in AnswerData', async () => {
      const result = await sut.save(1, 10, '2024-01-01', {
        answer_text: 'photo answer',
        answer_number: null,
        answer_bool: null,
        photo_key: 'uploads/photo123.jpg',
      });

      expect(result.photo_key).toBe('uploads/photo123.jpg');

      const row = await repo.findOne({ where: { id: result.id } });
      expect(row!.photo_key).toBe('uploads/photo123.jpg');
    });

    it('writes photo_key = null when not provided in AnswerData', async () => {
      const result = await sut.save(1, 10, '2024-01-02', {
        answer_text: 'text answer',
        answer_number: null,
        answer_bool: null,
      });

      expect(result.photo_key).toBeNull();

      const row = await repo.findOne({ where: { id: result.id } });
      expect(row!.photo_key).toBeNull();
    });
  });

  describe('findByQuestionAndDate', () => {
    it('returns the row if exists', async () => {
      await sut.save(1, 20, '2024-02-01', {
        answer_text: 'hello',
        answer_number: null,
        answer_bool: null,
      });

      const found = await sut.findByQuestionAndDate(20, '2024-02-01');
      expect(found).not.toBeNull();
      expect(found!.question_id).toBe(20);
      expect(found!.scheduled_date).toBe('2024-02-01');
    });

    it('returns null when no row exists', async () => {
      const found = await sut.findByQuestionAndDate(999, '2024-02-01');
      expect(found).toBeNull();
    });
  });

  describe('findPhotosByQuestion', () => {
    beforeEach(async () => {
      // row with photo_key
      await sut.save(1, 30, '2024-03-01', {
        answer_text: 'p1',
        answer_number: null,
        answer_bool: null,
        photo_key: 'key/a.jpg',
      });
      // row without photo_key
      await sut.save(1, 30, '2024-03-02', {
        answer_text: 'no photo',
        answer_number: null,
        answer_bool: null,
      });
      // another row with photo_key (later date)
      await sut.save(1, 30, '2024-03-03', {
        answer_text: 'p2',
        answer_number: null,
        answer_bool: null,
        photo_key: 'key/b.jpg',
      });
      // third row with photo_key (even later)
      await sut.save(1, 30, '2024-03-04', {
        answer_text: 'p3',
        answer_number: null,
        answer_bool: null,
        photo_key: 'key/c.jpg',
      });
    });

    it('returns only rows with photo_key IS NOT NULL, ordered DESC by scheduled_date', async () => {
      const rows = await sut.findPhotosByQuestion(30, 10, 0);
      expect(rows.length).toBe(3);
      expect(rows[0].scheduled_date).toBe('2024-03-04');
      expect(rows[1].scheduled_date).toBe('2024-03-03');
      expect(rows[2].scheduled_date).toBe('2024-03-01');
    });

    it('ignores rows where photo_key IS NULL', async () => {
      const rows = await sut.findPhotosByQuestion(30, 10, 0);
      expect(rows.every((r) => r.photo_key !== null)).toBe(true);
    });

    it('respects limit', async () => {
      const rows = await sut.findPhotosByQuestion(30, 2, 0);
      expect(rows.length).toBe(2);
    });

    it('respects offset', async () => {
      const rows = await sut.findPhotosByQuestion(30, 10, 2);
      expect(rows.length).toBe(1);
      expect(rows[0].scheduled_date).toBe('2024-03-01');
    });
  });
});
