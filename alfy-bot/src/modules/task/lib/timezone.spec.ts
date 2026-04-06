import { shiftToUserWallClock, shiftBackToUtc } from './timezone';

describe('shiftToUserWallClock', () => {
  it('UTC 21:00 → MSK wall clock = next day 00:00 (UTC fields)', () => {
    // 2026-04-07T21:00:00Z = 2026-04-08T00:00:00 MSK
    const utc = new Date('2026-04-07T21:00:00.000Z');
    const shifted = shiftToUserWallClock(utc, 'Europe/Moscow');

    expect(shifted.getUTCFullYear()).toBe(2026);
    expect(shifted.getUTCMonth()).toBe(3); // April
    expect(shifted.getUTCDate()).toBe(8);
    expect(shifted.getUTCHours()).toBe(0);
    expect(shifted.getUTCDay()).toBe(3); // Wednesday
  });

  it('UTC midnight → MSK 03:00 same day', () => {
    const utc = new Date('2026-04-08T00:00:00.000Z');
    const shifted = shiftToUserWallClock(utc, 'Europe/Moscow');

    expect(shifted.getUTCDate()).toBe(8);
    expect(shifted.getUTCHours()).toBe(3);
  });

  it('handles UTC+5:30 (Asia/Kolkata)', () => {
    // 2026-04-07T18:30:00Z = 2026-04-08T00:00:00 IST
    const utc = new Date('2026-04-07T18:30:00.000Z');
    const shifted = shiftToUserWallClock(utc, 'Asia/Kolkata');

    expect(shifted.getUTCDate()).toBe(8);
    expect(shifted.getUTCHours()).toBe(0);
    expect(shifted.getUTCMinutes()).toBe(0);
  });

  it('handles negative offset (America/New_York UTC-4)', () => {
    // 2026-04-08T04:00:00Z = 2026-04-08T00:00:00 EDT
    const utc = new Date('2026-04-08T04:00:00.000Z');
    const shifted = shiftToUserWallClock(utc, 'America/New_York');

    expect(shifted.getUTCDate()).toBe(8);
    expect(shifted.getUTCHours()).toBe(0);
  });
});

describe('shiftBackToUtc', () => {
  it('MSK wall clock midnight → UTC 21:00 previous day', () => {
    // "fake UTC" Date representing midnight MSK
    const wallClock = new Date(Date.UTC(2026, 3, 8, 0, 0, 0));
    const utc = shiftBackToUtc(wallClock, 'Europe/Moscow');

    expect(utc.toISOString()).toBe('2026-04-07T21:00:00.000Z');
  });

  it('roundtrip preserves the original UTC timestamp', () => {
    const original = new Date('2026-04-07T21:00:00.000Z');
    const shifted = shiftToUserWallClock(original, 'Europe/Moscow');
    const restored = shiftBackToUtc(shifted, 'Europe/Moscow');

    expect(restored.getTime()).toBe(original.getTime());
  });

  it('roundtrip works for Asia/Kolkata', () => {
    const original = new Date('2026-04-07T18:30:00.000Z');
    const shifted = shiftToUserWallClock(original, 'Asia/Kolkata');
    const restored = shiftBackToUtc(shifted, 'Asia/Kolkata');

    expect(restored.getTime()).toBe(original.getTime());
  });
});
