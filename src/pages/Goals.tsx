import { useState } from 'react'
import { Target, Plus, Calendar, Clock, ChevronDown, ChevronRight, X } from 'lucide-react'
import { useGoals } from '../hooks/useGoals'
import { ActivityTypeIcon } from '../components/ActivityTypeIcon'
import { formatDuration } from '../lib/strava'
import { format, differenceInDays } from 'date-fns'
import type { ActivityType, TrainingWeek } from '../types'

const activityTypes: ActivityType[] = ['Run', 'Ride', 'Swim', 'WeightTraining', 'Hike']

export function Goals() {
  const { goals, loading, addGoal } = useGoals()
  const [showForm, setShowForm] = useState(false)
  const [expandedWeek, setExpandedWeek] = useState<string | null>(null)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Goals</h1>
          <p className="text-text-secondary text-sm mt-1">Set targets and track your training</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          New Goal
        </button>
      </div>

      {showForm && (
        <NewGoalForm
          onSubmit={async (goal) => {
            await addGoal(goal)
            setShowForm(false)
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {goals.length === 0 && !showForm && (
        <div className="text-center py-20">
          <Target size={40} className="text-text-tertiary mx-auto mb-3" />
          <p className="text-text-secondary">No goals yet</p>
          <p className="text-text-tertiary text-sm mt-1">Create your first goal to get started</p>
        </div>
      )}

      <div className="space-y-6">
        {goals.map(goal => (
          <div key={goal.id} className="bg-bg-surface rounded-xl border border-border-subtle overflow-hidden">
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-accent-muted flex items-center justify-center shrink-0">
                  <ActivityTypeIcon type={goal.event_type} size={20} className="text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold">{goal.event_name}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      goal.status === 'active' ? 'bg-accent-muted text-accent' :
                      goal.status === 'completed' ? 'bg-success/15 text-success' :
                      'bg-bg-primary text-text-tertiary'
                    }`}>
                      {goal.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-sm text-text-secondary">
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar size={14} />
                      {format(new Date(goal.target_date), 'MMM d, yyyy')}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Clock size={14} />
                      Target: {formatDuration(goal.target_time)}
                    </span>
                    {goal.status === 'active' && (
                      <span className="text-text-tertiary">
                        {differenceInDays(new Date(goal.target_date), new Date())} days to go
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              {goal.status === 'active' && (
                <div className="mt-4">
                  <div className="w-full bg-bg-primary rounded-full h-1.5">
                    <div
                      className="bg-accent rounded-full h-1.5 transition-all"
                      style={{
                        width: `${Math.min(100, Math.max(3, ((differenceInDays(new Date(), new Date(goal.created_at))) / differenceInDays(new Date(goal.target_date), new Date(goal.created_at))) * 100))}%`
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Training Plan */}
            {goal.training_plan && goal.training_plan.length > 0 && (
              <div className="border-t border-border-subtle">
                <div className="px-6 py-3">
                  <p className="text-xs text-text-tertiary uppercase tracking-wider font-medium">4-Week Training Plan</p>
                </div>
                {goal.training_plan.map((week) => {
                  const weekKey = `${goal.id}-${week.week}`
                  const isExpanded = expandedWeek === weekKey
                  return (
                    <div key={weekKey} className="border-t border-border-subtle">
                      <button
                        onClick={() => setExpandedWeek(isExpanded ? null : weekKey)}
                        className="w-full flex items-center justify-between px-6 py-3.5 hover:bg-bg-surface-hover transition-colors text-left"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-mono font-semibold text-accent bg-accent-muted w-7 h-7 rounded-md flex items-center justify-center">
                            W{week.week}
                          </span>
                          <span className="text-sm font-medium">{week.focus}</span>
                        </div>
                        {isExpanded ? <ChevronDown size={16} className="text-text-tertiary" /> : <ChevronRight size={16} className="text-text-tertiary" />}
                      </button>
                      {isExpanded && (
                        <WeekSchedule week={week} />
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {goal.training_plan === null && goal.status === 'active' && (
              <div className="border-t border-border-subtle px-6 py-4">
                <p className="text-sm text-text-tertiary">
                  Training plan will be generated when connected to the backend.
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function WeekSchedule({ week }: { week: TrainingWeek }) {
  const intensityColors = {
    easy: 'text-success',
    moderate: 'text-warning',
    hard: 'text-accent',
    recovery: 'text-text-tertiary',
  }

  return (
    <div className="px-6 pb-4 space-y-2">
      {week.sessions.map((session, i) => (
        <div key={i} className="flex items-start gap-3 py-2">
          <span className="text-xs text-text-tertiary font-mono w-10 shrink-0 pt-0.5">{session.day.slice(0, 3)}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{session.type}</span>
              <span className={`text-xs font-medium ${intensityColors[session.intensity]}`}>
                {session.intensity}
              </span>
              {session.duration_minutes > 0 && (
                <span className="text-xs text-text-tertiary font-mono">{session.duration_minutes}min</span>
              )}
            </div>
            <p className="text-xs text-text-secondary mt-0.5">{session.description}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

function NewGoalForm({ onSubmit, onCancel }: {
  onSubmit: (goal: { event_type: ActivityType; event_name: string; target_date: string; target_time: number; status: 'active' }) => Promise<void>
  onCancel: () => void
}) {
  const [eventType, setEventType] = useState<ActivityType>('Run')
  const [eventName, setEventName] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [targetHours, setTargetHours] = useState('')
  const [targetMinutes, setTargetMinutes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    const targetTime = (parseInt(targetHours || '0') * 3600) + (parseInt(targetMinutes || '0') * 60)
    await onSubmit({
      event_type: eventType,
      event_name: eventName,
      target_date: targetDate,
      target_time: targetTime,
      status: 'active',
    })
    setSubmitting(false)
  }

  return (
    <form onSubmit={handleSubmit} className="bg-bg-surface rounded-xl p-6 border border-border-subtle space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">New Goal</h3>
        <button type="button" onClick={onCancel} className="text-text-tertiary hover:text-text-primary transition-colors">
          <X size={18} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-text-tertiary uppercase tracking-wider font-medium mb-2">Event Type</label>
          <div className="flex gap-2">
            {activityTypes.map(type => (
              <button
                key={type}
                type="button"
                onClick={() => setEventType(type)}
                className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                  eventType === type ? 'bg-accent-muted border border-accent/30' : 'bg-bg-primary border border-border-subtle hover:bg-bg-surface-hover'
                }`}
              >
                <ActivityTypeIcon type={type} size={18} className={eventType === type ? 'text-accent' : 'text-text-tertiary'} />
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs text-text-tertiary uppercase tracking-wider font-medium mb-2">Event Name</label>
          <input
            type="text"
            value={eventName}
            onChange={e => setEventName(e.target.value)}
            placeholder="Copenhagen Half Marathon"
            required
            className="w-full bg-bg-primary border border-border-subtle rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent/40 transition-colors"
          />
        </div>

        <div>
          <label className="block text-xs text-text-tertiary uppercase tracking-wider font-medium mb-2">Target Date</label>
          <input
            type="date"
            value={targetDate}
            onChange={e => setTargetDate(e.target.value)}
            required
            className="w-full bg-bg-primary border border-border-subtle rounded-lg px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent/40 transition-colors"
          />
        </div>

        <div>
          <label className="block text-xs text-text-tertiary uppercase tracking-wider font-medium mb-2">Target Time</label>
          <div className="flex gap-2">
            <input
              type="number"
              value={targetHours}
              onChange={e => setTargetHours(e.target.value)}
              placeholder="1"
              min="0"
              className="w-full bg-bg-primary border border-border-subtle rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent/40 transition-colors"
            />
            <span className="text-text-tertiary self-center text-sm">h</span>
            <input
              type="number"
              value={targetMinutes}
              onChange={e => setTargetMinutes(e.target.value)}
              placeholder="30"
              min="0"
              max="59"
              className="w-full bg-bg-primary border border-border-subtle rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent/40 transition-colors"
            />
            <span className="text-text-tertiary self-center text-sm">m</span>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting || !eventName || !targetDate}
          className="px-4 py-2.5 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {submitting ? 'Creating...' : 'Create Goal'}
        </button>
      </div>
    </form>
  )
}
