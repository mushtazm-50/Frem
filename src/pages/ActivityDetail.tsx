import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Clock, TrendingUp, Heart, Flame, Mountain, Gauge, Zap } from 'lucide-react'
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
        <Link to="/" className="text-accent text-sm mt-2 inline-block hover:underline">
          Back to dashboard
        </Link>
      </div>
    )
  }

  const stats = [
    activity.distance > 0 && { label: 'Distance', value: formatDistance(activity.distance), icon: TrendingUp },
    { label: 'Duration', value: formatDuration(activity.moving_time), icon: Clock },
    activity.distance > 0 && { label: 'Pace', value: formatPace(activity.average_speed, activity.type), icon: Gauge },
    activity.average_heartrate && { label: 'Avg HR', value: `${activity.average_heartrate} bpm`, icon: Heart },
    activity.max_heartrate && { label: 'Max HR', value: `${activity.max_heartrate} bpm`, icon: Heart },
    activity.calories && { label: 'Calories', value: activity.calories.toLocaleString(), icon: Flame },
    activity.total_elevation_gain > 0 && { label: 'Elevation', value: `${Math.round(activity.total_elevation_gain)} m`, icon: Mountain },
    activity.average_watts && { label: 'Avg Power', value: `${activity.average_watts} W`, icon: Zap },
    activity.average_cadence && { label: 'Cadence', value: `${activity.average_cadence} spm`, icon: TrendingUp },
    activity.suffer_score && { label: 'Suffer Score', value: activity.suffer_score.toString(), icon: Flame },
  ].filter(Boolean) as { label: string; value: string; icon: typeof TrendingUp }[]

  return (
    <div className="space-y-8">
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-sm text-text-tertiary hover:text-text-primary transition-colors"
      >
        <ArrowLeft size={16} />
        Back
      </Link>

      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-accent-muted flex items-center justify-center shrink-0">
          <ActivityTypeIcon type={activity.type} size={24} className="text-accent" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{activity.name}</h1>
          <p className="text-text-secondary text-sm mt-1">
            {format(new Date(activity.start_date), 'EEEE, MMMM d, yyyy · h:mm a')}
          </p>
        </div>
      </div>

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
