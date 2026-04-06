import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export function StravaCallback() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const code = searchParams.get('code')
    if (!code) {
      setError('No authorization code received from Strava')
      return
    }

    async function exchangeCode() {
      try {
        const { error } = await supabase.functions.invoke('strava-webhook', {
          body: { action: 'exchange_token', code },
        })
        if (error) throw error
        navigate('/settings', { replace: true })
      } catch (err) {
        setError('Failed to connect Strava. Please try again.')
        console.error(err)
      }
    }

    exchangeCode()
  }, [searchParams, navigate])

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-primary">
      {error ? (
        <div className="text-center space-y-3">
          <p className="text-error text-sm">{error}</p>
          <button
            onClick={() => navigate('/settings')}
            className="text-accent text-sm hover:underline"
          >
            Back to settings
          </button>
        </div>
      ) : (
        <div className="text-center space-y-3">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-text-secondary text-sm">Connecting Strava...</p>
        </div>
      )}
    </div>
  )
}
