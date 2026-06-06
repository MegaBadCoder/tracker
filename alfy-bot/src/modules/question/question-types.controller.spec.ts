import { QUESTION_TYPES } from '../../shared/types/question-types';
import { QuestionTypesController } from './question-types.controller';

describe('QuestionTypesController', () => {
  let controller: QuestionTypesController;

  beforeEach(() => {
    controller = new QuestionTypesController();
  });

  it('инстанцируется', () => {
    expect(controller).toBeDefined();
  });

  it('отдаёт все 7 типов вопросов', () => {
    const result = controller.findAll();
    expect(result).toHaveLength(7);
  });

  it('сохраняет порядок объявления QUESTION_TYPES', () => {
    const result = controller.findAll();
    expect(result.map((c) => c.type)).toEqual([
      'text',
      'rating',
      'emoji_rating',
      'yes_no',
      'number',
      'time_spent',
      'photo',
    ]);
  });

  it('возвращает только type, label, example, options (без description/ui_component)', () => {
    const result = controller.findAll();
    for (const item of result) {
      expect(Object.keys(item).sort()).toEqual(
        ['example', 'label', 'options', 'type'].sort(),
      );
    }
  });

  it('переносит значения из QUESTION_TYPES без потери', () => {
    const result = controller.findAll();
    const text = result.find((c) => c.type === 'text');
    expect(text).toEqual({
      type: 'text',
      label: QUESTION_TYPES.text.label,
      example: QUESTION_TYPES.text.example,
      options: QUESTION_TYPES.text.options,
    });
  });

  it('options присутствует у rating/emoji_rating/yes_no/time_spent', () => {
    const result = controller.findAll();
    const byType = Object.fromEntries(result.map((c) => [c.type, c]));
    expect(byType.rating.options).toEqual([1, 2, 3, 4, 5]);
    expect(byType.emoji_rating.options).toEqual(['😕', '😐', '🙂', '😊', '🔥']);
    expect(byType.yes_no.options).toEqual(['Да', 'Нет']);
    expect(byType.time_spent.options).toEqual([
      '<30 мин',
      '30-60',
      '1-2ч',
      '2+ч',
    ]);
  });

  it('options отсутствует (undefined) у text/number/photo', () => {
    const result = controller.findAll();
    const byType = Object.fromEntries(result.map((c) => [c.type, c]));
    expect(byType.text.options).toBeUndefined();
    expect(byType.number.options).toBeUndefined();
    expect(byType.photo.options).toBeUndefined();
  });
});
