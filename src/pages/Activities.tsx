import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Filter } from 'lucide-react'
import { useActivities } from '../hooks/useActivities'
import { ActivityTypeIcon } from '../components/ActivityTypeIcon'
import { formatDuration, formatDistanceShort, formatPace } from '../lib/strava'
import { format, formatDistanceToNow } from 'date-fns'
import type { ActivityType } from '../types'

const typeFilters: { label: string; value: ActivityType | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Runs', value: 'Run' },
  { label: 'Rides', value: 'Ride' },
  { label: 'Swims', value: 'Swim' },
  { label: 'Strength', value: 'WeightTraining' },
  { label: 'Walks', value: 'Walk' },
  { label: 'Hikes', value: 'Hike' },
]

export function Activities() {
  const { activities, loading } = useActivities()
  const [filter, setFilter] = useState<ActivityType | 'all'>('all')

  const filtered = filter === 'all'
    ? activities
    : activities.filter(a => a.type === filter)

  // Get unique types that exist in data
  const existingTypes = new Set(activities.map(a => a.type))
  const visibleFilters = typeFilters.filter(
    f => f.value === 'all' || existingTypes.has(f.value as ActivityType)
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Activities</h1>
          <p className="text-text-secondary text-sm mt-1">
            {activities.length} total activities
          </p>
        </div>
      </div>

      {/* Type Filters */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <Filter size={14} className="text-text-tertiary shrink-0" />
        {visibleFilters.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              filter === value
                ? 'bg-accent-muted text-accent'
                : 'bg-bg-surface text-text-secondary hover:text-text-primary hover:bg-bg-surface-hover'
            }`}
          >
            {label}
            {value !== 'all' && (
              <span className="ml-1.5 text-text-tertiary">
                {activities.filter(a => a.type === value).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Activity List */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="text-center py-16">
            <p className="text-text-secondary text-sm">No activities found</p>
          </div>
        )}
        {filtered.map(activity => (
          <Link
            key={activity.id}
            to={`/activity/${activity.id}`}
            className="flex items-center gap-4 bg-bg-surface rounded-xl px-5 py-4 border border-border-subtle hover:bg-bg-surface-hover transition-colors group"
          >
            <div className="w-10 h-10 rounded-lg bg-accent-muted flex items-center justify-center shrink-0">
              <ActivityTypeIcon type={activity.type} size={20} className="text-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{activity.name}</p>
              <p className="text-xs text-text-tertiary mt-0.5">
                {format(new Date(activity.start_date), 'MMM d, yyyy · h:mm a')}
                <span className="mx-1.5">·</span>
                {formatDistanceToNow(new Date(activity.start_date), { addSuffix: true })}
              </p>
            </div>
            <div className="flex items-center gap-6 text-right shrink-0">
              {activity.distance > 0 && (
                <div>
                  <p className="text-sm font-mono font-medium">{formatDistanceShort(activity.distance)} km</p>
                  <p className="text-xs text-text-tertiary">{formatPace(activity.average_speed, activity.type)}</p>
                </div>
              )}
              <div>
                <p className="text-sm font-mono font-medium">{formatDuration(activity.moving_time)}</p>
                {activity.average_heartrate && (
                  <p className="text-xs text-text-tertiary">{activity.average_heartrate} bpm</p>
                )}
              </div>
              {activity.total_elevation_gain > 0 && (
                <div className="hidden lg:block">
                  <p className="text-sm font-mono font-medium">{Math.round(activity.total_elevation_gain)} m</p>
                  <p className="text-xs text-text-tertiary">elev</p>
                </div>
              )}
              <ChevronRight size={16} className="text-text-tertiary group-hover:text-text-secondary transition-colors" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
