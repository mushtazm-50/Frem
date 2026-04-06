import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { User, Session } from '@supabase/supabase-js'

const USE_MOCK = !import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL === 'https://placeholder.supabase.co'

const mockUser: User = {
  id: 'user-1',
  email: 'user@frem.app',
  app_metadata: {},
  user_metadata: { full_name: 'Leone', avatar_url: '' },
  aud: 'authenticated',
  created_at: '2026-01-01T00:00:00Z',
} as User

export function useAuth() {
  const [user, setUser] = useState<User | null>(USE_MOCK ? mockUser : null)
  const [loading, setLoading] = useState(!USE_MOCK)

  useEffect(() => {
    if (USE_MOCK) return

    supabase.auth.getSession().then(({ data: { session } }: { data: { session: Session | null } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: string, session: Session | null) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signInWithGoogle = async () => {
    if (USE_MOCK) {
      setUser(mockUser)
      return
    }
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/` },
    })
  }

  const signOut = async () => {
    if (USE_MOCK) {
      setUser(null)
      return
    }
    await supabase.auth.signOut()
  }

  return { user, loading, signInWithGoogle, signOut }
}
