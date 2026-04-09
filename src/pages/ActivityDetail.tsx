import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Clock, TrendingUp, Heart, Flame, Mountain, Gauge, Zap, Award, Timer, Activity } from 'lucide-react'
import { useActivity } from '../hooks/useActivities'
import { ActivityTypeIcon } from '../components/ActivityTypeIcon'
import { formatDuration, formatDistance, formatPace } from '../lib/strava'
import { format } from 'date-fns'

export function ActivityDetail() {
  const { id } = useParams<{ id: string }>()
  const { activity, loading } = useActivity(id!)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!activity) {
    return (
      <div className="text-center py-20">
        <p className="text-text-secondary">Activity not found</p>
        <Link to="/activities" className="text-accent text-sm mt-2 inline-block hover:underline">
          Back to activities
        </Link>
      </div>
    )
  }

  // Extract extra data from raw_data
  const raw = (activity.raw_data || {}) as Record<string, unknown>
  const gearRaw = raw.gear as Record<string, unknown> | null
  const gearName: string | undefined = gearRaw?.name ? String(gearRaw.name) : undefined
  const kudos = raw.kudos_count as number | undefined
  const achievements = raw.achievement_count as number | undefined
  const maxWatts = raw.max_watts as number | undefined
  const weightedWatts = raw.weighted_average_watts as number | undefined
  const description: string | undefined = raw.description ? String(raw.description) : undefined
  const workoutType: number | undefined = typeof raw.workout_type === 'number' ? raw.workout_type : undefined
  const elapsedTime = activity.elapsed_time
  const splits = raw.splits_metric as Array<Record<string, unknown>> | undefined

  const workoutLabels: Record<number, string> = {
    0: 'Default', 1: 'Race', 2: 'Long Run', 3: 'Workout',
    10: 'Default', 11: 'Race', 12: 'Workout',
  }

  const stats = [
    activity.distance > 0 && { label: 'Distance', value: formatDistance(activity.distance), icon: TrendingUp },
    { label: 'Moving Time', value: formatDuration(activity.moving_time), icon: Clock },
    elapsedTime !== activity.moving_time && { label: 'Elapsed Time', value: formatDuration(elapsedTime), icon: Timer },
    activity.distance > 0 && { label: 'Pace', value: formatPace(activity.average_speed, activity.type), icon: Gauge },
    activity.average_heartrate && { label: 'Avg HR', value: `${Math.round(activity.average_heartrate)} bpm`, icon: Heart },
    activity.max_heartrate && { label: 'Max HR', value: `${Math.round(activity.max_heartrate)} bpm`, icon: Heart },
    activity.calories && { label: 'Calories', value: Math.round(activity.calories).toLocaleString(), icon: Flame },
    activity.total_elevation_gain > 0 && { label: 'Elevation', value: `${Math.round(activity.total_elevation_gain)} m`, icon: Mountain },
    activity.average_watts && { label: 'Avg Power', value: `${Math.round(activity.average_watts)} W`, icon: Zap },
    weightedWatts && { label: 'Normalized Power', value: `${Math.round(weightedWatts)} W`, icon: Zap },
    maxWatts && { label: 'Max Power', value: `${Math.round(maxWatts)} W`, icon: Zap },
    activity.average_cadence && { label: 'Cadence', value: `${Math.round(activity.average_cadence)} ${activity.type === 'Ride' ? 'rpm' : 'spm'}`, icon: Activity },
    activity.suffer_score && { label: 'Suffer Score', value: activity.suffer_score.toString(), icon: Flame },
    achievements && achievements > 0 && { label: 'Achievements', value: achievements.toString(), icon: Award },
  ].filter(Boolean) as { label: string; value: string; icon: typeof TrendingUp }[]

  return (
    <div className="space-y-8">
      <Link
        to="/activities"
        className="inline-flex items-center gap-2 text-sm text-text-tertiary hover:text-text-primary transition-colors"
      >
        <ArrowLeft size={16} />
        Activities
      </Link>

      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-accent-muted flex items-center justify-center shrink-0">
          <ActivityTypeIcon type={activity.type} size={24} className="text-accent" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{activity.name}</h1>
          <div className="flex items-center gap-3 mt-1.5">
            <p className="text-text-secondary text-sm">
              {format(new Date(activity.start_date), 'EEEE, MMMM d, yyyy · h:mm a')}
            </p>
            {workoutType !== undefined && workoutType > 0 && workoutType in workoutLabels && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-accent-muted text-accent">
                {String(workoutLabels[workoutType])}
              </span>
            )}
          </div>
          {typeof description === 'string' && description.length > 0 && (
            <p className="text-text-secondary text-sm mt-2">{description}</p>
          )}
        </div>
      </div>

      {/* Gear */}
      {gearName && (
        <div className="flex items-center gap-2 text-xs text-text-tertiary">
          <span>Gear:</span>
          <span className="text-text-secondary">{gearName}</span>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {stats.map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-bg-surface rounded-xl p-4 border border-border-subtle">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Icon size={14} className="text-accent" />
              <span className="text-xs text-text-tertiary uppercase tracking-wider">{label}</span>
            </div>
            <p className="text-lg font-semibold font-mono tracking-tight">{value}</p>
          </div>
        ))}
      </div>

      {/* Kudos */}
      {kudos !== undefined && kudos > 0 && (
        <p className="text-xs text-text-tertiary">{String(kudos)} kudos</p>
      )}

      {/* Splits */}
      {splits && splits.length > 1 && (
        <div className="bg-bg-surface rounded-xl p-6 border border-border-subtle">
          <h2 className="text-base font-semibold mb-4">Splits</h2>
          <div className="space-y-1">
            <div className="flex items-center text-xs text-text-tertiary font-medium pb-2 border-b border-border-subtle">
              <span className="w-12">KM</span>
              <span className="flex-1">Pace</span>
              <span className="w-16 text-right">Elev</span>
              {!!splits[0]?.average_heartrate && <span className="w-16 text-right">HR</span>}
            </div>
            {splits.map((split, i) => {
              const splitPace = split.average_speed as number
              const splitElev = split.elevation_difference as number
              const splitHr = split.average_heartrate as number | undefined
              return (
                <div key={i} className="flex items-center text-sm py-1.5">
                  <span className="w-12 text-text-tertiary font-mono text-xs">{i + 1}</span>
                  <span className="flex-1 font-mono font-medium">
                    {splitPace > 0 ? formatPace(splitPace, activity.type) : '--'}
                  </span>
                  <span className="w-16 text-right text-text-secondary font-mono text-xs">
                    {splitElev !== undefined ? `${splitElev > 0 ? '+' : ''}${Math.round(splitElev)}m` : '--'}
                  </span>
                  {!!splits[0]?.average_heartrate && (
                    <span className="w-16 text-right text-text-secondary font-mono text-xs">
                      {splitHr ? `${Math.round(splitHr)}` : '--'}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* AI Analysis */}
      {activity.ai_analysis && (
        <div className="bg-bg-surface rounded-xl p-6 border border-border-subtle">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 rounded-md bg-accent-muted flex items-center justify-center">
              <Zap size={14} className="text-accent" />
            </div>
            <h2 className="text-base font-semibold">AI Analysis</h2>
          </div>
          <div className="prose-invert max-w-none text-sm text-text-secondary leading-relaxed space-y-3">
            {activity.ai_analysis.split('\n').map((line, i) => {
              if (line.startsWith('## ')) {
                return <h3 key={i} className="text-text-primary font-semibold text-sm mt-5 mb-2">{line.replace('## ', '')}</h3>
              }
              if (line.startsWith('- **')) {
                const match = line.match(/- \*\*(.+?)\*\*(.*)/)
                if (match) {
                  return (
                    <p key={i} className="pl-3 border-l-2 border-border-subtle">
                      <span className="text-text-primary font-medium">{match[1]}</span>
                      {match[2]}
                    </p>
                  )
                }
              }
              if (line.startsWith('- ')) {
                return <p key={i} className="pl-3 border-l-2 border-accent/20">{line.replace('- ', '')}</p>
              }
              if (line.trim() === '') return null
              return <p key={i}>{line}</p>
            })}
          </div>
        </div>
      )}
    </div>
  )
}
