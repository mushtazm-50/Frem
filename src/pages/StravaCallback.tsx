import { useEffect, useState, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export function StravaCallback() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState('Connecting Strava...')
  const [progress, setProgress] = useState<{ total: number; imported: number } | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const code = searchParams.get('code')
    if (!code) {
      setError('No authorization code received from Strava')
      return
    }

    async function exchangeAndSync() {
      try {
        const { data, error } = await supabase.functions.invoke('strava-webhook', {
          body: { action: 'exchange_token', code },
        })
        if (error) throw error

        if (data?.strava_athlete_id) {
          setStatus('Importing your activity history...')
          const athleteId = data.strava_athlete_id

          // Start polling progress
          pollRef.current = setInterval(async () => {
            const { data: syncData } = await supabase
              .from('sync_status')
              .select('*')
              .eq('strava_athlete_id', athleteId)
              .maybeSingle()

            if (syncData) {
              setProgress({ total: syncData.total, imported: syncData.imported })
              if (syncData.status === 'done') {
                if (pollRef.current) clearInterval(pollRef.current)
                navigate('/', { replace: true })
              }
            }
          }, 1500)

          // Fire off sync (don't await — let polling track it)
          supabase.functions.invoke('strava-webhook', {
            body: { action: 'sync_history', strava_athlete_id: athleteId },
          }).then(() => {
            // Sync completed — navigate if poll hasn't already
            if (pollRef.current) clearInterval(pollRef.current)
            navigate('/', { replace: true })
          }).catch(err => {
            console.error('Sync error:', err)
            if (pollRef.current) clearInterval(pollRef.current)
            navigate('/settings', { replace: true })
          })
        } else {
          navigate('/settings', { replace: true })
        }
      } catch (err) {
        setError('Failed to connect Strava. Please try again.')
        console.error(err)
      }
    }

    exchangeAndSync()

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
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
        <div className="text-center space-y-4">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-text-secondary text-sm">{status}</p>
          {progress && progress.total > 0 && (
            <div className="space-y-2">
              <p className="text-text-primary text-lg font-mono font-semibold">
                {progress.imported} / {progress.total}
              </p>
              <div className="w-64 mx-auto bg-bg-surface rounded-full h-2">
                <div
                  className="bg-accent rounded-full h-2 transition-all duration-500"
                  style={{ width: `${Math.round((progress.imported / progress.total) * 100)}%` }}
                />
              </div>
              <p className="text-text-tertiary text-xs">activities imported</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
