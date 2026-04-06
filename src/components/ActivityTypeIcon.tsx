import { Activity, Bike, Waves, Dumbbell, Mountain, Footprints, Sparkles, Zap } from 'lucide-react'
import type { ActivityType } from '../types'

const iconMap: Record<ActivityType, typeof Activity> = {
  Run: Activity,
  Ride: Bike,
  Swim: Waves,
  WeightTraining: Dumbbell,
  Hike: Mountain,
  Walk: Footprints,
  Yoga: Sparkles,
  Workout: Zap,
}

interface Props {
  type: ActivityType
  size?: number
  className?: string
}

export function ActivityTypeIcon({ type, size = 20, className = '' }: Props) {
  const Icon = iconMap[type] || Zap
  return <Icon size={size} className={className} />
}
