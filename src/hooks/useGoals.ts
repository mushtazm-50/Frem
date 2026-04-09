import { useState, useEffect, useCallback } from 'react'
import type { Goal } from '../types'
import { supabase } from '../lib/supabase'

export function useGoals() {
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)

  const fetchGoals = useCallback(async () => {
    const { data, error } = await supabase
      .from('goals')
      .select('*')
      .order('target_date', { ascending: true })

    if (!error && data) setGoals(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchGoals()
  }, [fetchGoals])

  const addGoal = async (goal: Omit<Goal, 'id' | 'user_id' | 'created_at' | 'training_plan'>): Promise<string | null> => {
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData?.user?.id || 'unknown'

    const { data, error } = await supabase
      .from('goals')
      .insert({ ...goal, user_id: userId })
      .select()
      .single()

    if (!error && data) {
      setGoals(prev => [...prev, data])
      return data.id
    }
    return null
  }

  const updateGoalStatus = async (goalId: string, status: 'active' | 'completed' | 'cancelled') => {
    const { error } = await supabase
      .from('goals')
      .update({ status })
      .eq('id', goalId)

    if (!error) {
      setGoals(prev => prev.map(g => g.id === goalId ? { ...g, status } : g))
    }
  }

  const refreshGoal = async (goalId: string) => {
    const { data } = await supabase
      .from('goals')
      .select('*')
      .eq('id', goalId)
      .single()

    if (data) {
      setGoals(prev => prev.map(g => g.id === goalId ? data : g))
    }
  }

  return { goals, loading, addGoal, updateGoalStatus, refreshGoal }
}
