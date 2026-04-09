export type ActivityType = 'Run' | 'Ride' | 'Swim' | 'WeightTraining' | 'Hike' | 'Walk' | 'Yoga' | 'Workout'

export interface Activity {
  id: string
  strava_id: number
  user_id: string
  name: string
  type: ActivityType
  sport_type: string
  start_date: string
  elapsed_time: number // seconds
  moving_time: number // seconds
  distance: number // meters
  total_elevation_gain: number // meters
  average_speed: number // m/s
  max_speed: number // m/s
  average_heartrate: number | null
  max_heartrate: number | null
  calories: number | null
  suffer_score: number | null
  average_cadence: number | null
  average_watts: number | null
  map_polyline: string | null
  ai_analysis: string | null
  raw_data: Record<string, unknown>
  created_at: string
}

export interface TrainingPreferences {
  sessions_per_week: number
  preferred_days: string[]
  experience_level: 'beginner' | 'intermediate' | 'advanced'
  max_session_minutes: number
  cross_training: boolean
}

export interface Goal {
  id: string
  user_id: string
  event_type: ActivityType
  event_name: string
  target_date: string
  target_distance: number // meters
  target_time: number // seconds
  target_pace: number // seconds per km
  status: 'active' | 'completed' | 'cancelled'
  training_preferences: TrainingPreferences | null
  training_plan: TrainingWeek[] | null
  created_at: string
}

export interface TrainingWeek {
  week: number
  focus: string
  sessions: TrainingSession[]
}

export interface TrainingSession {
  day: string
  type: string
  description: string
  duration_minutes: number
  intensity: 'easy' | 'moderate' | 'hard' | 'recovery'
}

export interface WeeklyStats {
  totalDistance: number // meters
  totalTime: number // seconds
  totalCalories: number
  activityCount: number
}

export interface StravaTokens {
  access_token: string
  refresh_token: string
  expires_at: number
}
