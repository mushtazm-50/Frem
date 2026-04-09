import { Link } from 'react-router-dom'
import { Clock, Flame, TrendingUp, ChevronRight } from 'lucide-react'
import { useActivities } from '../hooks/useActivities'
import { useGoals } from '../hooks/useGoals'
import { ActivityTypeIcon } from '../components/ActivityTypeIcon'
import { formatDuration, formatDistanceShort, formatPace } from '../lib/strava'
import { format, differenceInDays, formatDistanceToNow } from 'date-fns'

export function Dashboard() {
  const { activities, weeklyStats, loading: activitiesLoading } = useActivities()
  const { goals, loading: goalsLoading } = useGoals()
  const activeGoal = goals.find(g => g.status === 'active')

  if (activitiesLoading || goalsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-text-secondary text-sm mt-1">Your week at a glance</p>
      </div>

      {/* Weekly Stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="Distance"
          value={`${formatDistanceShort(weeklyStats.totalDistance)} km`}
          icon={<TrendingUp size={16} className="text-accent" />}
        />
        <StatCard
          label="Time"
          value={formatDuration(weeklyStats.totalTime)}
          icon={<Clock size={16} className="text-accent" />}
        />
        <StatCard
          label="Calories"
          value={weeklyStats.totalCalories.toLocaleString()}
          icon={<Flame size={16} className="text-accent" />}
        />
        <StatCard
          label="Activities"
          value={weeklyStats.activityCount.toString()}
          icon={<TrendingUp size={16} className="text-accent" />}
        />
      </div>

      {/* Active Goal Progress */}
      {activeGoal && (
        <Link to="/goals" className="block">
          <div className="bg-bg-surface rounded-xl p-6 border border-border-subtle hover:bg-bg-surface-hover transition-colors">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs text-text-tertiary uppercase tracking-wider font-medium">Active Goal</p>
                <h3 className="text-lg font-semibold mt-1">{activeGoal.event_name}</h3>
              </div>
              <div className="text-right">
                <p className="text-sm text-text-secondary">
                  Target: {formatDuration(activeGoal.target_time)}
                </p>
                <p className="text-xs text-text-tertiary mt-0.5">
                  {differenceInDays(new Date(activeGoal.target_date), new Date())} days to go
                </p>
              </div>
            </div>
            <div className="w-full bg-bg-primary rounded-full h-2">
              <div
                className="bg-accent rounded-full h-2 transition-all"
                style={{
                  width: `${Math.min(100, Math.max(5, ((differenceInDays(new Date(), new Date(activeGoal.created_at))) / differenceInDays(new Date(activeGoal.target_date), new Date(activeGoal.created_at))) * 100))}%`
                }}
              />
            </div>
            <p className="text-xs text-text-tertiary mt-2">
              {format(new Date(activeGoal.target_date), 'MMMM d, yyyy')}
            </p>
          </div>
        </Link>
      )}

      {/* Recent Activities */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Recent Activities</h2>
          <Link to="/activities" className="text-sm text-accent hover:underline">
            View all
          </Link>
        </div>
        <div className="space-y-2">
          {activities.slice(0, 8).map(activity => (
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
                  {formatDistanceToNow(new Date(activity.start_date), { addSuffix: true })}
                </p>
              </div>
              <div className="flex items-center gap-6 text-right">
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
                <ChevronRight size={16} className="text-text-tertiary group-hover:text-text-secondary transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="bg-bg-surface rounded-xl p-5 border border-border-subtle">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs text-text-tertiary uppercase tracking-wider font-medium">{label}</span>
      </div>
      <p className="text-2xl font-semibold font-mono tracking-tight">{value}</p>
    </div>
  )
}
