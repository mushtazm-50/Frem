import { useState, useEffect } from 'react'
import type { Goal } from '../types'
import { mockGoals } from '../lib/mock-data'
import { supabase } from '../lib/supabase'

const USE_MOCK = !import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL === 'https://placeholder.supabase.co'

export function useGoals() {
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (USE_MOCK) {
      setGoals(mockGoals)
      setLoading(false)
      return
    }

    async function fetch() {
      const { data, error } = await supabase
        .from('goals')
        .select('*')
        .order('target_date', { ascending: true })

      if (!error && data) setGoals(data)
      setLoading(false)
    }
    fetch()
  }, [])

  const addGoal = async (goal: Omit<Goal, 'id' | 'user_id' | 'created_at' | 'training_plan'>) => {
    if (USE_MOCK) {
      const newGoal: Goal = {
        ...goal,
        id: crypto.randomUUID(),
        user_id: 'user-1',
        training_plan: null,
        created_at: new Date().toISOString(),
      }
      setGoals(prev => [...prev, newGoal])
      return
    }

    const { data, error } = await supabase
      .from('goals')
      .insert(goal)
      .select()
      .single()

    if (!error && data) setGoals(prev => [...prev, data])
  }

  return { goals, loading, addGoal }
}
