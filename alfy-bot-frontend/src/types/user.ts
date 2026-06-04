export interface UserProfile {
  firstName: string
  lastName?: string
  email?: string
  photoUrl?: string
  phone?: string
  timezone?: string
  language?: string
  firstDayOfWeek?: number
  hasEmailAuth?: boolean
}
