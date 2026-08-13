import { hasCrossedPomodoroTarget } from './pomodoro.utils';

describe('hasCrossedPomodoroTarget', () => {
  it('полный переход через порог', () => {
    expect(hasCrossedPomodoroTarget(3.0, 4.0, 4)).toBe(true);
  });

  it('дробный переход через порог', () => {
    expect(hasCrossedPomodoroTarget(3.6, 4.1, 4)).toBe(true);
  });

  it('не дошёл до порога', () => {
    expect(hasCrossedPomodoroTarget(3.0, 3.6, 4)).toBe(false);
  });

  it('уже был ровно на пороге — не перезакрывает', () => {
    expect(hasCrossedPomodoroTarget(4.0, 5.0, 4)).toBe(false);
  });

  it('уже был выше порога — не перезакрывает', () => {
    expect(hasCrossedPomodoroTarget(5.0, 6.0, 4)).toBe(false);
  });

  it('target = 0 — правило не применяется', () => {
    expect(hasCrossedPomodoroTarget(0, 1, 0)).toBe(false);
  });

  it('float-дребезг снизу: after чуть меньше порога считается достижением', () => {
    expect(hasCrossedPomodoroTarget(3.9, 3.9999999, 4)).toBe(true);
  });

  it('float-дребезг на пороге: before чуть меньше порога считается уже пройденным', () => {
    expect(hasCrossedPomodoroTarget(3.9999999, 4.5, 4)).toBe(false);
  });
});
