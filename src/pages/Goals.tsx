import { useState } from 'react'
import { Target, Plus, Calendar, Clock, ChevronDown, ChevronRight, X, Trophy, RefreshCw, Award } from 'lucide-react'
import { useGoals } from '../hooks/useGoals'
import { useActivities } from '../hooks/useActivities'
import { ActivityTypeIcon } from '../components/ActivityTypeIcon'
import { formatDuration, formatPace } from '../lib/strava'
import { format, differenceInDays, differenceInWeeks } from 'date-fns'
import { supabase } from '../lib/supabase'
import type { ActivityType, TrainingWeek } from '../types'

const activityTypes: ActivityType[] = ['Run', 'Ride', 'Swim', 'WeightTraining', 'Hike']

export function Goals() {
  const { goals, loading, addGoal, updateGoalStatus, refreshGoal } = useGoals()
  const { activities } = useActivities()
  const [showForm, setShowForm] = useState(false)
  const [expandedWeek, setExpandedWeek] = useState<string | null>(null)
  const [generatingPlan, setGeneratingPlan] = useState<string | null>(null)
  const [adjustingPlan, setAdjustingPlan] = useState<string | null>(null)
  const [tab, setTab] = useState<'active' | 'completed'>('active')

  const activeGoals = goals.filter(g => g.status === 'active')
  const completedGoals = goals.filter(g => g.status === 'completed')

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  async function handleGeneratePlan(goalId: string) {
    setGeneratingPlan(goalId)
    try {
      const { error } = await supabase.functions.invoke('strava-webhook', {
        body: { action: 'generate_plan', goal_id: goalId },
      })
      if (error) throw error
      await refreshGoal(goalId)
    } catch (err) {
      console.error('Failed to generate plan:', err)
    }
    setGeneratingPlan(null)
  }

  async function handleAdjustPlan(goalId: string) {
    setAdjustingPlan(goalId)
    try {
      const { error } = await supabase.functions.invoke('strava-webhook', {
        body: { action: 'adjust_plan', goal_id: goalId },
      })
      if (error) throw error
      await refreshGoal(goalId)
    } catch (err) {
      console.error('Failed to adjust plan:', err)
    }
    setAdjustingPlan(null)
  }

  async function handleCreateGoal(goal: { event_type: ActivityType; event_name: string; target_date: string; target_time: number; status: 'active' }) {
    const goalId = await addGoal(goal)
    setShowForm(false)
    if (goalId) {
      await handleGeneratePlan(goalId)
    }
  }

  function getProgressForGoal(goal: typeof goals[0]) {
    // Get recent activities matching the goal type
    const relevant = activities
      .filter(a => a.type === goal.event_type)
      .sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime())
      .slice(0, 10)

    if (relevant.length === 0) return null

    const avgSpeed = relevant.reduce((s, a) => s + a.average_speed, 0) / relevant.length
    const avgHr = relevant.filter(a => a.average_heartrate).reduce((s, a) => s + (a.average_heartrate || 0), 0) / (relevant.filter(a => a.average_heartrate).length || 1)

    // Calculate target pace from goal
    const goalDistance = relevant[0]?.distance || 0 // approximate from recent
    const targetSpeed = goalDistance > 0 ? goalDistance / goal.target_time : 0

    return {
      currentPace: avgSpeed,
      targetPace: targetSpeed,
      avgHr: Math.round(avgHr),
      recentCount: relevant.length,
      type: goal.event_type,
    }
  }

  function getWeeklyCompliance(goal: typeof goals[0]) {
    if (!goal.training_plan) return null
    const now = new Date()
    const weeksSinceCreation = differenceInWeeks(now, new Date(goal.created_at))
    const currentWeekIndex = Math.min(weeksSinceCreation, (goal.training_plan as TrainingWeek[]).length - 1)
    const currentWeek = (goal.training_plan as TrainingWeek[])[currentWeekIndex]
    if (!currentWeek) return null

    const plannedSessions = currentWeek.sessions.filter(s => s.duration_minutes > 0).length
    // Count actual activities this week matching the goal type
    const weekStart = new Date(now)
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1)
    const thisWeekActivities = activities.filter(a =>
      a.type === goal.event_type &&
      new Date(a.start_date) >= weekStart &&
      new Date(a.start_date) <= now
    ).length

    return { planned: plannedSessions, completed: thisWeekActivities }
  }

  const displayGoals = tab === 'active' ? activeGoals : completedGoals

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

      {/* Tabs */}
      <div className="flex gap-1 bg-bg-surface rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab('active')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === 'active' ? 'bg-bg-primary text-text-primary' : 'text-text-tertiary hover:text-text-secondary'
          }`}
        >
          <Target size={15} />
          Active
          {activeGoals.length > 0 && (
            <span className="text-xs bg-accent-muted text-accent px-1.5 py-0.5 rounded-full">{activeGoals.length}</span>
          )}
        </button>
        <button
          onClick={() => setTab('completed')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === 'completed' ? 'bg-bg-primary text-text-primary' : 'text-text-tertiary hover:text-text-secondary'
          }`}
        >
          <Trophy size={15} />
          Completed
          {completedGoals.length > 0 && (
            <span className="text-xs bg-success/15 text-success px-1.5 py-0.5 rounded-full">{completedGoals.length}</span>
          )}
        </button>
      </div>

      {showForm && (
        <NewGoalForm
          onSubmit={handleCreateGoal}
          onCancel={() => setShowForm(false)}
        />
      )}

      {displayGoals.length === 0 && !showForm && (
        <div className="text-center py-20">
          {tab === 'active' ? (
            <>
              <Target size={40} className="text-text-tertiary mx-auto mb-3" />
              <p className="text-text-secondary">No active goals</p>
              <p className="text-text-tertiary text-sm mt-1">Create a goal to get a personalized training plan</p>
            </>
          ) : (
            <>
              <Trophy size={40} className="text-text-tertiary mx-auto mb-3" />
              <p className="text-text-secondary">No completed goals yet</p>
              <p className="text-text-tertiary text-sm mt-1">Completed goals will appear here</p>
            </>
          )}
        </div>
      )}

      <div className="space-y-6">
        {displayGoals.map(goal => {
          const progress = getProgressForGoal(goal)
          const compliance = getWeeklyCompliance(goal)
          const daysLeft = differenceInDays(new Date(goal.target_date), new Date())
          const isGenerating = generatingPlan === goal.id
          const isAdjusting = adjustingPlan === goal.id

          return (
            <div key={goal.id} className="bg-bg-surface rounded-xl border border-border-subtle overflow-hidden">
              <div className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-accent-muted flex items-center justify-center shrink-0">
                    <ActivityTypeIcon type={goal.event_type} size={20} className="text-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold">{goal.event_name}</h3>
                      {goal.status === 'completed' && (
                        <Award size={18} className="text-success" />
                      )}
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
                      {goal.status === 'active' && daysLeft > 0 && (
                        <span className="text-text-tertiary">{daysLeft} days to go</span>
                      )}
                    </div>
                  </div>
                  {goal.status === 'active' && (
                    <button
                      onClick={() => updateGoalStatus(goal.id, 'completed')}
                      className="text-xs text-text-tertiary hover:text-success transition-colors px-2 py-1 rounded hover:bg-success/5"
                    >
                      Mark complete
                    </button>
                  )}
                </div>

                {/* Progress from real data */}
                {goal.status === 'active' && progress && (
                  <div className="mt-5 pt-5 border-t border-border-subtle grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-text-tertiary uppercase tracking-wider font-medium mb-1">Current Avg Pace</p>
                      <p className="text-lg font-mono font-semibold">
                        {formatPace(progress.currentPace, progress.type)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-text-tertiary uppercase tracking-wider font-medium mb-1">Target Pace</p>
                      <p className="text-lg font-mono font-semibold text-accent">
                        {progress.targetPace > 0 ? formatPace(progress.targetPace, progress.type) : formatDuration(goal.target_time)}
                      </p>
                    </div>
                    {compliance && (
                      <div className="col-span-2">
                        <p className="text-xs text-text-tertiary uppercase tracking-wider font-medium mb-1">This Week</p>
                        <p className="text-sm text-text-secondary">
                          <span className="text-text-primary font-medium">{compliance.completed}</span> of {compliance.planned} planned sessions completed
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Progress bar */}
                {goal.status === 'active' && daysLeft > 0 && (
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
              {goal.training_plan && (goal.training_plan as TrainingWeek[]).length > 0 && (
                <div className="border-t border-border-subtle">
                  <div className="px-6 py-3 flex items-center justify-between">
                    <p className="text-xs text-text-tertiary uppercase tracking-wider font-medium">
                      Training Plan — {(goal.training_plan as TrainingWeek[]).length} weeks
                    </p>
                    {goal.status === 'active' && (
                      <button
                        onClick={() => handleAdjustPlan(goal.id)}
                        disabled={isAdjusting}
                        className="inline-flex items-center gap-1.5 text-xs text-accent hover:text-accent-hover transition-colors disabled:opacity-50"
                      >
                        <RefreshCw size={12} className={isAdjusting ? 'animate-spin' : ''} />
                        {isAdjusting ? 'Adjusting...' : 'Adjust Plan'}
                      </button>
                    )}
                  </div>
                  {(goal.training_plan as TrainingWeek[]).map((week) => {
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
                        {isExpanded && <WeekSchedule week={week} />}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Generate plan button */}
              {!goal.training_plan && goal.status === 'active' && (
                <div className="border-t border-border-subtle px-6 py-4">
                  <button
                    onClick={() => handleGeneratePlan(goal.id)}
                    disabled={isGenerating}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    {isGenerating ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Generating plan...
                      </>
                    ) : (
                      'Generate Training Plan'
                    )}
                  </button>
                </div>
              )}

              {isGenerating && goal.training_plan === null && (
                <div className="border-t border-border-subtle px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-text-secondary">Analyzing your recent training and generating a personalized plan...</p>
                  </div>
                </div>
              )}
            </div>
          )
        })}
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
              <span className={`text-xs font-medium ${intensityColors[session.intensity] || 'text-text-tertiary'}`}>
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
