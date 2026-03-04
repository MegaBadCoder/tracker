import { QUESTION_TYPES, QuestionType } from '../types/question-types';

interface QuestionButton {
  text: string;
  callback_data: string;
}

export function generateQuestionButtons(
  questionType: QuestionType,
): QuestionButton[][] | null {
  const typeConfig = QUESTION_TYPES[questionType];

  if (!typeConfig?.options) {
    return null;
  }

  const buttons: QuestionButton[][] = [];

  switch (questionType) {
    case 'rating':
      buttons.push(
        (typeConfig.options as number[]).map((num) => ({
          text: num.toString(),
          callback_data: `answer_${num}`,
        })),
      );
      break;

    case 'emoji_rating':
      buttons.push(
        (typeConfig.options as string[]).map((emoji, index) => ({
          text: emoji,
          callback_data: `answer_${index + 1}`,
        })),
      );
      break;

    case 'yes_no':
      buttons.push([
        { text: 'Да', callback_data: 'answer_yes' },
        { text: 'Нет', callback_data: 'answer_no' },
      ]);
      break;

    case 'time_spent': {
      const options = typeConfig.options as string[];
      for (let i = 0; i < options.length; i += 2) {
        buttons.push(
          options.slice(i, i + 2).map((option) => ({
            text: option,
            callback_data: `answer_${option}`,
          })),
        );
      }
      break;
    }

    default:
      return null;
  }

  return buttons;
}
