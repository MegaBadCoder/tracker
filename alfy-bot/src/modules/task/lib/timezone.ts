/**
 * Convert a UTC Date to a Date whose UTC fields equal the wall-clock
 * components in the given IANA timezone. This allows domain functions
 * using getUTCDay(), setUTCDate() etc. to operate on the user's calendar date.
 *
 * Uses Intl.DateTimeFormat — no external dependencies, works in Node 16+.
 */
export function shiftToUserWallClock(utcDate: Date, tz: string): Date {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(utcDate);

  const p = (type: string) => {
    const val = parts.find((part) => part.type === type)?.value ?? '0';
    return parseInt(val, 10);
  };

  const hour = p('hour') === 24 ? 0 : p('hour');

  return new Date(
    Date.UTC(p('year'), p('month') - 1, p('day'), hour, p('minute'), p('second')),
  );
}

/**
 * Reverse of shiftToUserWallClock: takes a Date whose UTC fields represent
 * wall-clock in the given timezone and returns the real UTC Date.
 */
export function shiftBackToUtc(wallClockDate: Date, tz: string): Date {
  // Compute the tz offset by shifting a known UTC point and measuring the delta
  const shifted = shiftToUserWallClock(wallClockDate, tz);
  const offsetMs = shifted.getTime() - wallClockDate.getTime();
  return new Date(wallClockDate.getTime() - offsetMs);
}
