import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export function StravaCallback() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState('Connecting Strava...')

  useEffect(() => {
    const code = searchParams.get('code')
    if (!code) {
      setError('No authorization code received from Strava')
      return
    }

    async function exchangeAndSync() {
      try {
        // Exchange token
        const { data, error } = await supabase.functions.invoke('strava-webhook', {
          body: { action: 'exchange_token', code },
        })
        if (error) throw error

        // Trigger historical sync
        if (data?.strava_athlete_id) {
          setStatus('Importing your activity history (1 year)...')
          const { data: syncData, error: syncError } = await supabase.functions.invoke('strava-webhook', {
            body: { action: 'sync_history', strava_athlete_id: data.strava_athlete_id },
          })
          if (syncError) console.error('Sync error:', syncError)
          else console.log(`Imported ${syncData?.imported} activities`)
        }

        navigate('/settings', { replace: true })
      } catch (err) {
        setError('Failed to connect Strava. Please try again.')
        console.error(err)
      }
    }

    exchangeAndSync()
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
          <p className="text-text-secondary text-sm">{status}</p>
        </div>
      )}
    </div>
  )
}
