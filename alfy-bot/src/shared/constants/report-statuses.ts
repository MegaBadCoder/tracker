export const REPORT_STATUSES = {
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
  SKIPPED: 'skipped',
} as const;

export type ReportStatus =
  (typeof REPORT_STATUSES)[keyof typeof REPORT_STATUSES];
