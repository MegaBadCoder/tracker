import { api } from './client'
import type { HabitWithHistory } from '../types'

export async function fetchHabits(days?: 7 | 14 | 30): Promise<HabitWithHistory[]> {
  const { data } = await api.get<HabitWithHistory[]>('/questions/habits', {
    params: days ? { days } : undefined,
  })
  return data
}
