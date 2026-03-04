import type { Report, ReportAnswer } from '../types'

export function getReportAnswerValue(a: ReportAnswer): number | string | boolean | null {
  if (a.answer_text != null && a.answer_text !== '') return a.answer_text
  if (a.answer_number != null) return a.answer_number
  if (a.answer_bool != null) return a.answer_bool
  return null
}

export type DataPoint = { date: string, value: string | number | boolean | null }

export function getDataPointsForQuestion(
  reports: Report[],
  questionId: number,
): DataPoint[] {
  const sorted = [...reports].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  )
  return sorted.map(r => {
    const ans = r.answers.find(a => a.questionId === questionId)
    return {
      date: r.date,
      value: ans ? getReportAnswerValue(ans) : null,
    }
  })
}

export function analyticsToDataPoints(
  entries: { date: string, answer_text: string | null, answer_number: number | null, answer_bool: boolean | null }[],
): DataPoint[] {
  return entries.map(e => ({
    date: e.date,
    value: e.answer_text ?? e.answer_number ?? e.answer_bool ?? null,
  }))
}
