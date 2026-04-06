const STRAVA_CLIENT_ID = import.meta.env.VITE_STRAVA_CLIENT_ID || ''
const STRAVA_REDIRECT_URI = import.meta.env.VITE_STRAVA_REDIRECT_URI || `${window.location.origin}/strava/callback`

export function getStravaAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: STRAVA_CLIENT_ID,
    redirect_uri: STRAVA_REDIRECT_URI,
    response_type: 'code',
    scope: 'read,activity:read_all',
    approval_prompt: 'auto',
  })
  return `https://www.strava.com/oauth/authorize?${params.toString()}`
}

export function formatPace(speedMs: number, type: string): string {
  if (type === 'Ride') {
    return `${(speedMs * 3.6).toFixed(1)} km/h`
  }
  if (type === 'Swim') {
    if (speedMs <= 0) return '--'
    const secsPer100m = 100 / speedMs
    const mins = Math.floor(secsPer100m / 60)
    const secs = Math.round(secsPer100m % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}/100m`
  }
  if (speedMs <= 0) return '--'
  const secsPerKm = 1000 / speedMs
  const mins = Math.floor(secsPerKm / 60)
  const secs = Math.round(secsPerKm % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}/km`
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function formatDistance(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`
  return `${Math.round(meters)} m`
}

export function formatDistanceShort(meters: number): string {
  return `${(meters / 1000).toFixed(1)}`
}
