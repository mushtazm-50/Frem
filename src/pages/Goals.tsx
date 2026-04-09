import { useState, useMemo } from 'react'
import { Target, Plus, Calendar, ChevronDown, ChevronRight, X, Trophy, RefreshCw, Award, TrendingUp, TrendingDown, Minus, Ruler } from 'lucide-react'
import { useGoals } from '../hooks/useGoals'
import { useActivities } from '../hooks/useActivities'
import { ActivityTypeIcon } from '../components/ActivityTypeIcon'
import { formatDuration } from '../lib/strava'
import { format, differenceInDays, differenceInWeeks } from 'date-fns'
import { supabase } from '../lib/supabase'
import type { ActivityType, TrainingWeek, Goal } from '../types'

const activityTypes: ActivityType[] = ['Run', 'Ride', 'Swim', 'WeightTraining', 'Hike']

const RACE_PRESETS = [
  { label: '5K', distance: 5000 },
  { label: '10K', distance: 10000 },
  { label: 'Half Marathon', distance: 21097.5 },
  { label: 'Marathon', distance: 42195 },
  { label: 'Custom', distance: 0 },
]

function paceToString(secsPerKm: number): string {
  if (!secsPerKm || secsPerKm <= 0) return '--:--'
  const m = Math.floor(secsPerKm / 60)
  const s = Math.round(secsPerKm % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function speedToPace(speedMs: number): number {
  if (speedMs <= 0) return 0
  return 1000 / speedMs
}

function distanceLabel(meters: number): string {
  if (meters === 5000) return '5K'
  if (meters === 10000) return '10K'
  if (Math.abs(meters - 21097.5) < 10) return 'Half Marathon'
  if (Math.abs(meters - 42195) < 10) return 'Marathon'
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`
  return `${Math.round(meters)} m`
}

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

  async function handleCreateGoal(goal: { event_type: ActivityType; event_name: string; target_date: string; target_distance: number; target_time: number; target_pace: number; status: 'active' }) {
    const goalId = await addGoal(goal)
    setShowForm(false)
    if (goalId) {
      await handleGeneratePlan(goalId)
    }
  }

  function getPaceTrend(goal: Goal) {
    const relevant = activities
      .filter(a => a.type === goal.event_type && a.distance > 0 && a.average_speed > 0)
      .sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime())

    if (relevant.length < 2) return null

    const recent5 = relevant.slice(0, 5)
    const older5 = relevant.slice(5, 10)
    if (older5.length === 0) return null

    const recentAvgPace = recent5.reduce((s, a) => s + speedToPace(a.average_speed), 0) / recent5.length
    const olderAvgPace = older5.reduce((s, a) => s + speedToPace(a.average_speed), 0) / older5.length

    const diff = olderAvgPace - recentAvgPace // positive = getting faster
    return { recentPace: recentAvgPace, olderPace: olderAvgPace, diff, improving: diff > 3 }
  }

  function getCurrentPace(goal: Goal) {
    const relevant = activities
      .filter(a => a.type === goal.event_type && a.distance > 0 && a.average_speed > 0)
      .sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime())
      .slice(0, 8)

    if (relevant.length === 0) return null
    const avgSpeed = relevant.reduce((s, a) => s + a.average_speed, 0) / relevant.length
    return speedToPace(avgSpeed)
  }

  function getWeeklyCompliance(goal: Goal) {
    if (!goal.training_plan) return null
    const plan = goal.training_plan as TrainingWeek[]
    const now = new Date()
    const weeksSinceCreation = differenceInWeeks(now, new Date(goal.created_at))
    const currentWeekIndex = Math.min(weeksSinceCreation, plan.length - 1)
    const currentWeek = plan[currentWeekIndex]
    if (!currentWeek) return null

    const plannedSessions = currentWeek.sessions.filter(s => s.duration_minutes > 0).length
    const weekStart = new Date(now)
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1)
    weekStart.setHours(0, 0, 0, 0)
    const thisWeekActivities = activities.filter(a =>
      new Date(a.start_date) >= weekStart && new Date(a.start_date) <= now
    ).length

    return { planned: plannedSessions, completed: thisWeekActivities, weekNumber: currentWeekIndex + 1 }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
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
          recentActivities={activities}
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
          const currentPace = getCurrentPace(goal)
          const targetPace = goal.target_pace || (goal.target_distance > 0 && goal.target_time > 0 ? (goal.target_time / (goal.target_distance / 1000)) : 0)
          const trend = getPaceTrend(goal)
          const compliance = getWeeklyCompliance(goal)
          const daysLeft = differenceInDays(new Date(goal.target_date), new Date())
          const isGenerating = generatingPlan === goal.id
          const isAdjusting = adjustingPlan === goal.id

          return (
            <div key={goal.id} className="bg-bg-surface rounded-xl border border-border-subtle overflow-hidden">
              <div className="p-6">
                {/* Header */}
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-xl bg-accent-muted flex items-center justify-center shrink-0">
                    <ActivityTypeIcon type={goal.event_type} size={22} className="text-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold">{goal.event_name}</h3>
                      {goal.status === 'completed' && <Award size={18} className="text-success" />}
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-sm text-text-secondary flex-wrap">
                      {goal.target_distance > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <Ruler size={13} />
                          {distanceLabel(goal.target_distance)}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <Calendar size={13} />
                        {format(new Date(goal.target_date), 'MMM d, yyyy')}
                      </span>
                      {goal.status === 'active' && daysLeft > 0 && (
                        <span className="text-text-tertiary">{daysLeft}d to go</span>
                      )}
                    </div>
                  </div>
                  {goal.status === 'active' && (
                    <button
                      onClick={() => updateGoalStatus(goal.id, 'completed')}
                      className="text-xs text-text-tertiary hover:text-success transition-colors px-2 py-1 rounded hover:bg-success/5 whitespace-nowrap"
                    >
                      Mark complete
                    </button>
                  )}
                </div>

                {/* Target stats row */}
                <div className="mt-5 grid grid-cols-3 gap-4">
                  <div className="bg-bg-primary rounded-lg p-3.5">
                    <p className="text-[10px] text-text-tertiary uppercase tracking-wider font-medium mb-1">Target Time</p>
                    <p className="text-xl font-mono font-semibold tracking-tight">{formatDuration(goal.target_time)}</p>
                  </div>
                  {targetPace > 0 && (
                    <div className="bg-bg-primary rounded-lg p-3.5">
                      <p className="text-[10px] text-text-tertiary uppercase tracking-wider font-medium mb-1">Target Pace</p>
                      <p className="text-xl font-mono font-semibold tracking-tight text-accent">{paceToString(targetPace)}<span className="text-sm text-text-tertiary font-normal">/km</span></p>
                    </div>
                  )}
                  {currentPace ? (
                    <div className="bg-bg-primary rounded-lg p-3.5">
                      <p className="text-[10px] text-text-tertiary uppercase tracking-wider font-medium mb-1">Current Pace</p>
                      <div className="flex items-center gap-2">
                        <p className="text-xl font-mono font-semibold tracking-tight">{paceToString(currentPace)}<span className="text-sm text-text-tertiary font-normal">/km</span></p>
                        {trend && (
                          trend.diff > 3 ? <TrendingUp size={16} className="text-success" /> :
                          trend.diff < -3 ? <TrendingDown size={16} className="text-error" /> :
                          <Minus size={16} className="text-text-tertiary" />
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-bg-primary rounded-lg p-3.5">
                      <p className="text-[10px] text-text-tertiary uppercase tracking-wider font-medium mb-1">Current Pace</p>
                      <p className="text-sm text-text-tertiary mt-1">No recent data</p>
                    </div>
                  )}
                </div>

                {/* Pace gap indicator */}
                {currentPace && targetPace > 0 && goal.status === 'active' && (
                  <div className="mt-4 p-3 rounded-lg bg-bg-primary">
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="text-text-tertiary">Pace gap</span>
                      <span className={`font-mono font-medium ${currentPace <= targetPace ? 'text-success' : 'text-text-secondary'}`}>
                        {currentPace <= targetPace
                          ? `On target`
                          : `${paceToString(currentPace - targetPace)} to close`
                        }
                      </span>
                    </div>
                    <div className="w-full bg-bg-surface rounded-full h-2 relative">
                      <div
                        className={`rounded-full h-2 transition-all ${currentPace <= targetPace ? 'bg-success' : 'bg-accent'}`}
                        style={{ width: `${Math.min(100, Math.max(5, (targetPace / currentPace) * 100))}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Weekly compliance */}
                {compliance && goal.status === 'active' && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-text-secondary">
                    <span className="text-text-tertiary">Week {compliance.weekNumber}:</span>
                    <span className="font-medium text-text-primary">{compliance.completed}</span>
                    <span>of {compliance.planned} sessions</span>
                    <div className="flex gap-0.5 ml-1">
                      {Array.from({ length: compliance.planned }).map((_, i) => (
                        <div
                          key={i}
                          className={`w-2 h-2 rounded-full ${i < compliance.completed ? 'bg-accent' : 'bg-bg-primary'}`}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Timeline progress */}
                {goal.status === 'active' && daysLeft > 0 && (
                  <div className="mt-4">
                    <div className="w-full bg-bg-primary rounded-full h-1">
                      <div
                        className="bg-accent/60 rounded-full h-1 transition-all"
                        style={{
                          width: `${Math.min(100, Math.max(2, ((differenceInDays(new Date(), new Date(goal.created_at))) / differenceInDays(new Date(goal.target_date), new Date(goal.created_at))) * 100))}%`
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
              {!goal.training_plan && goal.status === 'active' && !isGenerating && (
                <div className="border-t border-border-subtle px-6 py-4">
                  <button
                    onClick={() => handleGeneratePlan(goal.id)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    Generate Training Plan
                  </button>
                </div>
              )}

              {isGenerating && (
                <div className="border-t border-border-subtle px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-text-secondary">Analyzing your training history and building a personalized plan...</p>
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
  const intensityColors: Record<string, string> = {
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

// --- New Goal Form ---

function NewGoalForm({ onSubmit, onCancel, recentActivities }: {
  onSubmit: (goal: { event_type: ActivityType; event_name: string; target_date: string; target_distance: number; target_time: number; target_pace: number; status: 'active' }) => Promise<void>
  onCancel: () => void
  recentActivities: { type: string; average_speed: number; distance: number }[]
}) {
  const [eventType, setEventType] = useState<ActivityType>('Run')
  const [eventName, setEventName] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [selectedPreset, setSelectedPreset] = useState<string>('Half Marathon')
  const [customDistanceKm, setCustomDistanceKm] = useState('')
  const [targetHours, setTargetHours] = useState('')
  const [targetMinutes, setTargetMinutes] = useState('')
  const [targetSeconds, setTargetSeconds] = useState('')
  const [paceMinutes, setPaceMinutes] = useState('')
  const [paceSeconds, setPaceSeconds] = useState('')
  const [lastEdited, setLastEdited] = useState<'time' | 'pace'>('time')
  const [submitting, setSubmitting] = useState(false)

  const distanceMeters = useMemo(() => {
    if (selectedPreset === 'Custom') return parseFloat(customDistanceKm || '0') * 1000
    return RACE_PRESETS.find(p => p.label === selectedPreset)?.distance || 0
  }, [selectedPreset, customDistanceKm])

  const distanceKm = distanceMeters / 1000

  // Auto-calculate pace from time
  const totalSeconds = (parseInt(targetHours || '0') * 3600) + (parseInt(targetMinutes || '0') * 60) + parseInt(targetSeconds || '0')
  const calculatedPace = distanceKm > 0 && totalSeconds > 0 ? totalSeconds / distanceKm : 0
  const calculatedTime = (() => {
    const pSec = (parseInt(paceMinutes || '0') * 60) + parseInt(paceSeconds || '0')
    return distanceKm > 0 && pSec > 0 ? pSec * distanceKm : 0
  })()

  // Sync: when time changes, update pace display
  const displayPace = lastEdited === 'time' ? calculatedPace : (parseInt(paceMinutes || '0') * 60) + parseInt(paceSeconds || '0')

  // Current fitness for this type
  const currentAvgPace = useMemo(() => {
    const relevant = recentActivities
      .filter(a => a.type === eventType && a.average_speed > 0 && a.distance > 0)
      .slice(0, 10)
    if (relevant.length === 0) return null
    const avgSpeed = relevant.reduce((s, a) => s + a.average_speed, 0) / relevant.length
    return speedToPace(avgSpeed)
  }, [recentActivities, eventType])

  function handleTimeChange(h: string, m: string, s: string) {
    setTargetHours(h)
    setTargetMinutes(m)
    setTargetSeconds(s)
    setLastEdited('time')
    // Auto-update pace fields
    const total = (parseInt(h || '0') * 3600) + (parseInt(m || '0') * 60) + parseInt(s || '0')
    if (distanceKm > 0 && total > 0) {
      const pace = total / distanceKm
      setPaceMinutes(Math.floor(pace / 60).toString())
      setPaceSeconds(Math.round(pace % 60).toString().padStart(2, '0'))
    }
  }

  function handlePaceChange(m: string, s: string) {
    setPaceMinutes(m)
    setPaceSeconds(s)
    setLastEdited('pace')
    // Auto-update time fields
    const pSec = (parseInt(m || '0') * 60) + parseInt(s || '0')
    if (distanceKm > 0 && pSec > 0) {
      const total = Math.round(pSec * distanceKm)
      setTargetHours(Math.floor(total / 3600).toString())
      setTargetMinutes(Math.floor((total % 3600) / 60).toString())
      setTargetSeconds((total % 60).toString().padStart(2, '0'))
    }
  }

  // When distance changes, recalculate whichever was last edited
  function handlePresetChange(preset: string) {
    setSelectedPreset(preset)
    const dist = RACE_PRESETS.find(p => p.label === preset)?.distance || 0
    const km = dist / 1000
    if (km > 0) {
      if (lastEdited === 'pace') {
        const pSec = (parseInt(paceMinutes || '0') * 60) + parseInt(paceSeconds || '0')
        if (pSec > 0) {
          const total = Math.round(pSec * km)
          setTargetHours(Math.floor(total / 3600).toString())
          setTargetMinutes(Math.floor((total % 3600) / 60).toString())
          setTargetSeconds((total % 60).toString().padStart(2, '0'))
        }
      } else {
        const total = (parseInt(targetHours || '0') * 3600) + (parseInt(targetMinutes || '0') * 60) + parseInt(targetSeconds || '0')
        if (total > 0) {
          const pace = total / km
          setPaceMinutes(Math.floor(pace / 60).toString())
          setPaceSeconds(Math.round(pace % 60).toString().padStart(2, '0'))
        }
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    const finalTime = lastEdited === 'pace' ? Math.round(calculatedTime) : totalSeconds
    const finalPace = lastEdited === 'time' ? calculatedPace : displayPace
    await onSubmit({
      event_type: eventType,
      event_name: eventName,
      target_date: targetDate,
      target_distance: distanceMeters,
      target_time: finalTime,
      target_pace: finalPace,
      status: 'active',
    })
    setSubmitting(false)
  }

  return (
    <form onSubmit={handleSubmit} className="bg-bg-surface rounded-xl p-6 border border-border-subtle space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">New Goal</h3>
        <button type="button" onClick={onCancel} className="text-text-tertiary hover:text-text-primary transition-colors">
          <X size={18} />
        </button>
      </div>

      {/* Event Type */}
      <div>
        <label className="block text-xs text-text-tertiary uppercase tracking-wider font-medium mb-2">Activity Type</label>
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

      {/* Event Name + Date */}
      <div className="grid grid-cols-2 gap-4">
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
      </div>

      {/* Distance */}
      <div>
        <label className="block text-xs text-text-tertiary uppercase tracking-wider font-medium mb-2">Distance</label>
        <div className="flex gap-2">
          {RACE_PRESETS.map(p => (
            <button
              key={p.label}
              type="button"
              onClick={() => handlePresetChange(p.label)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedPreset === p.label
                  ? 'bg-accent-muted text-accent border border-accent/30'
                  : 'bg-bg-primary text-text-secondary border border-border-subtle hover:bg-bg-surface-hover'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {selectedPreset === 'Custom' && (
          <div className="mt-3 flex items-center gap-2">
            <input
              type="number"
              value={customDistanceKm}
              onChange={e => { setCustomDistanceKm(e.target.value); handlePresetChange('Custom') }}
              placeholder="15"
              step="0.1"
              min="0"
              className="w-32 bg-bg-primary border border-border-subtle rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent/40 transition-colors"
            />
            <span className="text-sm text-text-tertiary">km</span>
          </div>
        )}
      </div>

      {/* Time & Pace — bidirectional */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-text-tertiary uppercase tracking-wider font-medium mb-2">Target Time</label>
          <div className="flex items-center gap-1.5">
            <input type="number" value={targetHours} onChange={e => handleTimeChange(e.target.value, targetMinutes, targetSeconds)} placeholder="1" min="0" className="w-16 bg-bg-primary border border-border-subtle rounded-lg px-2.5 py-2.5 text-sm text-text-primary text-center placeholder:text-text-tertiary focus:outline-none focus:border-accent/40 transition-colors" />
            <span className="text-text-tertiary text-xs">h</span>
            <input type="number" value={targetMinutes} onChange={e => handleTimeChange(targetHours, e.target.value, targetSeconds)} placeholder="30" min="0" max="59" className="w-16 bg-bg-primary border border-border-subtle rounded-lg px-2.5 py-2.5 text-sm text-text-primary text-center placeholder:text-text-tertiary focus:outline-none focus:border-accent/40 transition-colors" />
            <span className="text-text-tertiary text-xs">m</span>
            <input type="number" value={targetSeconds} onChange={e => handleTimeChange(targetHours, targetMinutes, e.target.value)} placeholder="00" min="0" max="59" className="w-16 bg-bg-primary border border-border-subtle rounded-lg px-2.5 py-2.5 text-sm text-text-primary text-center placeholder:text-text-tertiary focus:outline-none focus:border-accent/40 transition-colors" />
            <span className="text-text-tertiary text-xs">s</span>
          </div>
        </div>
        <div>
          <label className="block text-xs text-text-tertiary uppercase tracking-wider font-medium mb-2">Target Pace</label>
          <div className="flex items-center gap-1.5">
            <input type="number" value={paceMinutes} onChange={e => handlePaceChange(e.target.value, paceSeconds)} placeholder="4" min="0" className="w-16 bg-bg-primary border border-border-subtle rounded-lg px-2.5 py-2.5 text-sm text-text-primary text-center placeholder:text-text-tertiary focus:outline-none focus:border-accent/40 transition-colors" />
            <span className="text-text-tertiary text-xs">:</span>
            <input type="number" value={paceSeconds} onChange={e => handlePaceChange(paceMinutes, e.target.value)} placeholder="16" min="0" max="59" className="w-16 bg-bg-primary border border-border-subtle rounded-lg px-2.5 py-2.5 text-sm text-text-primary text-center placeholder:text-text-tertiary focus:outline-none focus:border-accent/40 transition-colors" />
            <span className="text-text-tertiary text-xs">/km</span>
          </div>
        </div>
      </div>

      {/* Current fitness hint */}
      {currentAvgPace && (
        <div className="bg-bg-primary rounded-lg px-4 py-3 flex items-center gap-3">
          <TrendingUp size={14} className="text-accent shrink-0" />
          <p className="text-xs text-text-secondary">
            Your recent average {eventType.toLowerCase()} pace: <span className="text-text-primary font-mono font-medium">{paceToString(currentAvgPace)}/km</span>
          </p>
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors">
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting || !eventName || !targetDate || distanceMeters <= 0 || (totalSeconds <= 0 && calculatedTime <= 0)}
          className="px-5 py-2.5 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {submitting ? 'Creating & generating plan...' : 'Create Goal'}
        </button>
      </div>
    </form>
  )
}
