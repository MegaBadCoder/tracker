import { Injectable } from '@nestjs/common';
import {
  addDays,
  addWeeks,
  addMonths,
  startOfDay,
  isAfter,
  isBefore,
  differenceInYears,
} from 'date-fns';
import { DATE_PATTERNS } from '../constants/regex-patterns';
import { MESSAGES } from '../constants/messages';
import { DATE_VALIDATION } from '../constants/date-formats';

export interface ParseResult {
  success: boolean;
  date?: Date;
  error?: string;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

@Injectable()
export class DateParserService {
  parse(input: string): ParseResult {
    const lower = input.toLowerCase().trim();
    const today = startOfDay(new Date());

    if (lower === 'сегодня') {
      return { success: true, date: today };
    }

    if (lower === 'завтра') {
      return { success: true, date: addDays(today, 1) };
    }

    const daysMatch = lower.match(DATE_PATTERNS.DAYS);
    if (daysMatch) {
      return { success: true, date: addDays(today, parseInt(daysMatch[1])) };
    }

    const weeksMatch = lower.match(DATE_PATTERNS.WEEKS);
    if (weeksMatch) {
      return { success: true, date: addWeeks(today, parseInt(weeksMatch[1])) };
    }

    const monthsMatch = lower.match(DATE_PATTERNS.MONTHS);
    if (monthsMatch) {
      return {
        success: true,
        date: addMonths(today, parseInt(monthsMatch[1])),
      };
    }

    const dateMatch = input.match(DATE_PATTERNS.DMY);
    if (dateMatch) {
      const day = parseInt(dateMatch[1]);
      const month = parseInt(dateMatch[2]) - 1;
      const year = parseInt(dateMatch[3]);

      if (month < 0 || month > 11 || day < 1 || day > 31) {
        return { success: false, error: MESSAGES.ERRORS.INVALID_FORMAT };
      }

      const date = new Date(year, month, day);

      if (date.getDate() !== day || date.getMonth() !== month) {
        return { success: false, error: MESSAGES.ERRORS.INVALID_FORMAT };
      }

      return { success: true, date: startOfDay(date) };
    }

    return { success: false, error: MESSAGES.ERRORS.INVALID_FORMAT };
  }

  validateStartDate(date: Date): ValidationResult {
    const today = startOfDay(new Date());

    if (isBefore(date, today)) {
      return { valid: false, error: MESSAGES.ERRORS.DATE_IN_PAST };
    }

    if (differenceInYears(date, today) > DATE_VALIDATION.MAX_YEARS) {
      return {
        valid: false,
        error: MESSAGES.ERRORS.DATE_TOO_FAR(DATE_VALIDATION.MAX_YEARS),
      };
    }

    return { valid: true };
  }

  validateEndDate(end: Date, start: Date): ValidationResult {
    if (!isAfter(end, start)) {
      return { valid: false, error: MESSAGES.ERRORS.END_BEFORE_START };
    }

    if (differenceInYears(end, start) > DATE_VALIDATION.MAX_YEARS) {
      return {
        valid: false,
        error: MESSAGES.ERRORS.DATE_TOO_FAR(DATE_VALIDATION.MAX_YEARS),
      };
    }

    return { valid: true };
  }
}
