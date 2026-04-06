import { useState, useEffect } from 'react'
import type { Activity, WeeklyStats } from '../types'
import { mockActivities } from '../lib/mock-data'
import { supabase } from '../lib/supabase'
import { startOfWeek, endOfWeek, isWithinInterval } from 'date-fns'

const USE_MOCK = !import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL === 'https://placeholder.supabase.co'

export function useActivities() {
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (USE_MOCK) {
      setActivities(mockActivities)
      setLoading(false)
      return
    }

    async function fetch() {
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .order('start_date', { ascending: false })

      if (!error && data) setActivities(data)
      setLoading(false)
    }
    fetch()
  }, [])

  const weeklyStats: WeeklyStats = (() => {
    const now = new Date()
    const weekStart = startOfWeek(now, { weekStartsOn: 1 })
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 })
    const thisWeek = activities.filter(a =>
      isWithinInterval(new Date(a.start_date), { start: weekStart, end: weekEnd })
    )
    return {
      totalDistance: thisWeek.reduce((s, a) => s + a.distance, 0),
      totalTime: thisWeek.reduce((s, a) => s + a.moving_time, 0),
      totalCalories: thisWeek.reduce((s, a) => s + (a.calories ?? 0), 0),
      activityCount: thisWeek.length,
    }
  })()

  return { activities, loading, weeklyStats }
}

export function useActivity(id: string) {
  const [activity, setActivity] = useState<Activity | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (USE_MOCK) {
      setActivity(mockActivities.find(a => a.id === id) ?? null)
      setLoading(false)
      return
    }

    async function fetch() {
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .eq('id', id)
        .single()

      if (!error && data) setActivity(data)
      setLoading(false)
    }
    fetch()
  }, [id])

  return { activity, loading }
}
