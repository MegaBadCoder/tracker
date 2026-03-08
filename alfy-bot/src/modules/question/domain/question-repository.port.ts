import { Question } from '../../../shared/entities';

export abstract class QuestionRepositoryPort {
  abstract findById(id: number): Promise<Question | null>;
  abstract findHabitsByUser(userId: number): Promise<Question[]>;
  abstract create(userId: number, data: Partial<Question>): Promise<Question>;
  abstract update(id: number, data: Partial<Question>): Promise<Question>;
  abstract deactivate(id: number): Promise<void>;
}
