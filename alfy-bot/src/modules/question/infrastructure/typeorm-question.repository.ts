import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Question } from '../../../shared/entities';
import { QuestionRepositoryPort } from '../domain/question-repository.port';

@Injectable()
export class TypeOrmQuestionRepository extends QuestionRepositoryPort {
  constructor(
    @InjectRepository(Question)
    private repo: Repository<Question>,
  ) {
    super();
  }

  async findById(id: number): Promise<Question | null> {
    return this.repo.findOne({
      where: { id },
      relations: ['goal'],
    });
  }

  async findHabitsByUser(userId: number): Promise<Question[]> {
    return this.repo.find({
      where: { user_id: userId, is_habit: true, is_active: true },
      order: { createdAt: 'DESC' },
    });
  }

  async create(userId: number, data: Partial<Question>): Promise<Question> {
    const entity = this.repo.create({
      ...data,
      user_id: userId,
    });
    return this.repo.save(entity);
  }

  async update(id: number, data: Partial<Question>): Promise<Question> {
    await this.repo.update(id, data);
    const question = await this.findById(id);
    if (!question) throw new Error(`Question #${id} not found`);
    return question;
  }

  async deactivate(id: number): Promise<void> {
    await this.repo.update(id, { is_active: false });
  }
}
