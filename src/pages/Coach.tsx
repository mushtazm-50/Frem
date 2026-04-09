import { useState } from 'react'
import { Brain, ChevronDown, ChevronRight, CheckCircle2, Circle, Calendar, Clock, Zap } from 'lucide-react'
import { useGoals } from '../hooks/useGoals'
import { useActivities } from '../hooks/useActivities'
import { format, startOfWeek, endOfWeek, isWithinInterval, differenceInWeeks, addWeeks } from 'date-fns'
import type { TrainingWeek, TrainingSession } from '../types'
import { Link } from 'react-router-dom'

const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export function Coach() {
  const { goals } = useGoals()
  const { activities } = useActivities()
  const [expandedWeek, setExpandedWeek] = useState<number | null>(null)

  // Get the active goal with a training plan
  const activeGoal = goals.find(g => g.status === 'active' && g.training_plan)
  const plan = activeGoal?.training_plan as TrainingWeek[] | undefined

  if (!activeGoal || !plan) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">AI Coach</h1>
          <p className="text-text-secondary text-sm mt-1">Your personalized training programme</p>
        </div>
        <div className="text-center py-20">
          <Brain size={40} className="text-text-tertiary mx-auto mb-3" />
          <p className="text-text-secondary">No active training plan</p>
          <p className="text-text-tertiary text-sm mt-1 mb-4">Create a goal to generate your personalized programme</p>
          <Link
            to="/goals"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition-colors"
          >
            Go to Goals
          </Link>
        </div>
      </div>
    )
  }

  // Figure out which week we're in
  const goalStart = new Date(activeGoal.created_at)
  const weeksSinceStart = differenceInWeeks(new Date(), goalStart)
  const currentWeekIndex = Math.min(Math.max(0, weeksSinceStart), plan.length - 1)
  const currentWeek = plan[currentWeekIndex]

  // Get this week's date range
  const thisWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
  const thisWeekEnd = endOfWeek(new Date(), { weekStartsOn: 1 })

  // Match activities to sessions this week
  const thisWeekActivities = activities.filter(a =>
    isWithinInterval(new Date(a.start_date), { start: thisWeekStart, end: thisWeekEnd })
  )

  // Get today's day name
  const today = format(new Date(), 'EEEE')

  // Sort sessions by day order
  const sortedSessions = currentWeek ? [...currentWeek.sessions].sort(
    (a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day)
  ) : []

  // Simple matching: count completed sessions this week
  const completedCount = thisWeekActivities.length
  const totalSessions = sortedSessions.filter(s => s.duration_minutes > 0).length

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">AI Coach</h1>
        <div className="flex items-center gap-3 mt-1">
          <p className="text-text-secondary text-sm">{activeGoal.event_name}</p>
          <span className="text-text-tertiary text-sm">·</span>
          <p className="text-text-tertiary text-sm">{format(new Date(activeGoal.target_date), 'MMM d, yyyy')}</p>
        </div>
      </div>

      {/* This Week */}
      <div className="bg-bg-surface rounded-xl border border-border-subtle overflow-hidden">
        <div className="px-6 py-4 flex items-center justify-between border-b border-border-subtle">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-accent-muted flex items-center justify-center">
              <Calendar size={16} className="text-accent" />
            </div>
            <div>
              <h2 className="text-base font-semibold">This Week</h2>
              <p className="text-xs text-text-tertiary">
                Week {currentWeekIndex + 1} of {plan.length} — {currentWeek?.focus}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-mono font-medium text-text-primary">{completedCount}/{totalSessions}</span>
            <span className="text-xs text-text-tertiary">sessions</span>
            <div className="flex gap-0.5 ml-2">
              {Array.from({ length: totalSessions }).map((_, i) => (
                <div
                  key={i}
                  className={`w-2.5 h-2.5 rounded-full ${i < completedCount ? 'bg-accent' : 'bg-bg-primary'}`}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="divide-y divide-border-subtle">
          {sortedSessions.map((session, i) => {
            const isToday = session.day === today
            const dayIndex = DAY_ORDER.indexOf(session.day)
            const todayIndex = DAY_ORDER.indexOf(today)
            const isPast = dayIndex < todayIndex
            const isRest = session.duration_minutes === 0

            return (
              <SessionRow
                key={i}
                session={session}
                isToday={isToday}
                isPast={isPast}
                isRest={isRest}
                hasMatchingActivity={isPast && !isRest && dayIndex < completedCount + (todayIndex - totalSessions + completedCount)}
              />
            )
          })}
        </div>
      </div>

      {/* Full Programme */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Full Programme</h2>
        <div className="space-y-1">
          {plan.map((week, i) => {
            const isCurrentWeek = i === currentWeekIndex
            const isPastWeek = i < currentWeekIndex
            const isExpanded = expandedWeek === i
            const weekStart = addWeeks(goalStart, i)

            return (
              <div key={i} className={`rounded-xl border overflow-hidden ${isCurrentWeek ? 'border-accent/30 bg-bg-surface' : 'border-border-subtle bg-bg-surface'}`}>
                <button
                  onClick={() => setExpandedWeek(isExpanded ? null : i)}
                  className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-bg-surface-hover transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-mono font-semibold w-8 h-8 rounded-lg flex items-center justify-center ${
                      isCurrentWeek ? 'bg-accent text-white' : isPastWeek ? 'bg-bg-primary text-text-tertiary' : 'bg-accent-muted text-accent'
                    }`}>
                      W{week.week}
                    </span>
                    <div>
                      <span className="text-sm font-medium">{week.focus}</span>
                      <p className="text-xs text-text-tertiary">{format(weekStart, 'MMM d')} — {format(addWeeks(weekStart, 1), 'MMM d')}</p>
                    </div>
                    {isCurrentWeek && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-accent/15 text-accent uppercase tracking-wider">Current</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-text-tertiary font-mono">
                      {week.sessions.filter(s => s.duration_minutes > 0).length} sessions
                    </span>
                    {isExpanded ? <ChevronDown size={16} className="text-text-tertiary" /> : <ChevronRight size={16} className="text-text-tertiary" />}
                  </div>
                </button>
                {isExpanded && (
                  <div className="border-t border-border-subtle px-5 py-3 space-y-1">
                    {[...week.sessions].sort((a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day)).map((session, j) => (
                      <div key={j} className="flex items-start gap-3 py-2">
                        <span className="text-xs text-text-tertiary font-mono w-10 shrink-0 pt-0.5">{session.day.slice(0, 3)}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{session.type}</span>
                            <IntensityBadge intensity={session.intensity} />
                            {session.duration_minutes > 0 && (
                              <span className="text-xs text-text-tertiary font-mono">{session.duration_minutes}min</span>
                            )}
                          </div>
                          <p className="text-xs text-text-secondary mt-0.5">{session.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function SessionRow({ session, isToday, isPast, isRest }: {
  session: TrainingSession
  isToday: boolean
  isPast: boolean
  isRest: boolean
  hasMatchingActivity: boolean
}) {
  return (
    <div className={`px-6 py-4 flex items-start gap-4 ${isToday ? 'bg-accent/[0.03]' : ''}`}>
      <div className="flex flex-col items-center gap-1 w-10 shrink-0">
        <span className={`text-xs font-mono font-medium ${isToday ? 'text-accent' : 'text-text-tertiary'}`}>
          {session.day.slice(0, 3)}
        </span>
        {isRest ? (
          <div className="w-5 h-5" />
        ) : isPast ? (
          <CheckCircle2 size={18} className="text-accent/50" />
        ) : isToday ? (
          <Zap size={18} className="text-accent" />
        ) : (
          <Circle size={18} className="text-border-subtle" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium ${isRest ? 'text-text-tertiary' : isToday ? 'text-text-primary' : isPast ? 'text-text-secondary' : 'text-text-primary'}`}>
            {session.type}
          </span>
          {!isRest && <IntensityBadge intensity={session.intensity} />}
          {isToday && !isRest && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-accent text-white uppercase tracking-wider">Today</span>
          )}
        </div>
        <p className={`text-xs mt-0.5 ${isRest ? 'text-text-tertiary' : 'text-text-secondary'}`}>{session.description}</p>
      </div>
      {session.duration_minutes > 0 && (
        <div className="flex items-center gap-1.5 text-xs text-text-tertiary shrink-0">
          <Clock size={12} />
          <span className="font-mono">{session.duration_minutes}min</span>
        </div>
      )}
    </div>
  )
}

function IntensityBadge({ intensity }: { intensity: string }) {
  const colors: Record<string, string> = {
    easy: 'bg-success/10 text-success',
    moderate: 'bg-warning/10 text-warning',
    hard: 'bg-accent/10 text-accent',
    recovery: 'bg-bg-primary text-text-tertiary',
  }
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider ${colors[intensity] || colors.recovery}`}>
      {intensity}
    </span>
  )
}
