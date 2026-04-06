// Supabase Edge Function: strava-webhook
// Handles:
// 1. Strava webhook verification (GET)
// 2. Strava webhook events (POST) — new activity created
// 3. Strava OAuth token exchange (POST with action: 'exchange_token')

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const STRAVA_CLIENT_ID = Deno.env.get('STRAVA_CLIENT_ID')!
const STRAVA_CLIENT_SECRET = Deno.env.get('STRAVA_CLIENT_SECRET')!
const STRAVA_VERIFY_TOKEN = Deno.env.get('STRAVA_VERIFY_TOKEN')!
const CLAUDE_API_KEY = Deno.env.get('CLAUDE_API_KEY')!
const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!
const TELEGRAM_CHAT_ID = Deno.env.get('TELEGRAM_CHAT_ID')!
const FREM_BASE_URL = Deno.env.get('FREM_BASE_URL')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

Deno.serve(async (req: Request) => {
  // Strava webhook verification (GET)
  if (req.method === 'GET') {
    const url = new URL(req.url)
    const mode = url.searchParams.get('hub.mode')
    const token = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')

    if (mode === 'subscribe' && token === STRAVA_VERIFY_TOKEN) {
      return new Response(JSON.stringify({ 'hub.challenge': challenge }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }
    return new Response('Forbidden', { status: 403 })
  }

  // POST requests
  const body = await req.json()

  // Token exchange from frontend
  if (body.action === 'exchange_token') {
    return handleTokenExchange(body.code)
  }

  // Strava webhook event
  if (body.object_type === 'activity' && body.aspect_type === 'create') {
    return handleNewActivity(body.object_id, body.owner_id)
  }

  return new Response('OK', { status: 200 })
})

async function handleTokenExchange(code: string) {
  try {
    const res = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: STRAVA_CLIENT_ID,
        client_secret: STRAVA_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
      }),
    })
    const tokens = await res.json()

    // Store tokens in Supabase (you'd associate with the authenticated user)
    await supabase.from('strava_tokens').upsert({
      strava_athlete_id: tokens.athlete.id,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: tokens.expires_at,
    })

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

async function handleNewActivity(activityId: number, ownerId: number) {
  try {
    // Get fresh access token
    const accessToken = await getAccessToken(ownerId)

    // Fetch full activity data from Strava
    const activityRes = await fetch(
      `https://www.strava.com/api/v3/activities/${activityId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    const activity = await activityRes.json()

    // Generate AI analysis
    const analysis = await generateAnalysis(activity)

    // Store in database
    const record = {
      strava_id: activity.id,
      user_id: ownerId.toString(),
      name: activity.name,
      type: activity.type,
      sport_type: activity.sport_type,
      start_date: activity.start_date,
      elapsed_time: activity.elapsed_time,
      moving_time: activity.moving_time,
      distance: activity.distance,
      total_elevation_gain: activity.total_elevation_gain,
      average_speed: activity.average_speed,
      max_speed: activity.max_speed,
      average_heartrate: activity.average_heartrate || null,
      max_heartrate: activity.max_heartrate || null,
      calories: activity.calories || null,
      suffer_score: activity.suffer_score || null,
      average_cadence: activity.average_cadence || null,
      average_watts: activity.average_watts || null,
      map_polyline: activity.map?.summary_polyline || null,
      ai_analysis: analysis,
      raw_data: activity,
    }

    const { data: inserted } = await supabase
      .from('activities')
      .insert(record)
      .select('id')
      .single()

    // Send Telegram notification
    if (inserted) {
      await sendTelegramNotification(activity, analysis, inserted.id)
    }

    return new Response('OK', { status: 200 })
  } catch (err) {
    console.error('Error processing activity:', err)
    return new Response('Error', { status: 500 })
  }
}

async function getAccessToken(stravaAthleteId: number): Promise<string> {
  const { data: tokens } = await supabase
    .from('strava_tokens')
    .select('*')
    .eq('strava_athlete_id', stravaAthleteId)
    .single()

  if (!tokens) throw new Error('No tokens found for athlete')

  // Refresh if expired
  if (tokens.expires_at < Math.floor(Date.now() / 1000)) {
    const res = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: STRAVA_CLIENT_ID,
        client_secret: STRAVA_CLIENT_SECRET,
        refresh_token: tokens.refresh_token,
        grant_type: 'refresh_token',
      }),
    })
    const refreshed = await res.json()

    await supabase.from('strava_tokens').update({
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token,
      expires_at: refreshed.expires_at,
    }).eq('strava_athlete_id', stravaAthleteId)

    return refreshed.access_token
  }

  return tokens.access_token
}

async function generateAnalysis(activity: Record<string, unknown>): Promise<string> {
  const prompt = `Analyze this ${activity.type} activity and provide a concise training analysis.

Activity data:
- Name: ${activity.name}
- Type: ${activity.type}
- Distance: ${activity.distance}m
- Duration: ${activity.moving_time}s
- Elevation: ${activity.total_elevation_gain}m
- Avg Speed: ${activity.average_speed} m/s
- Avg HR: ${activity.average_heartrate || 'N/A'} bpm
- Max HR: ${activity.max_heartrate || 'N/A'} bpm
- Calories: ${activity.calories || 'N/A'}
- Avg Cadence: ${activity.average_cadence || 'N/A'}
- Avg Power: ${activity.average_watts || 'N/A'}W

Provide analysis with these sections (use ## headers):
## Effort Summary — overall effort level and what kind of session this was
## Pacing — pace/power analysis
## Heart Rate Zones — estimated zone distribution if HR data available
## What Went Well — 2-3 positive observations
## What to Improve — 1-2 actionable suggestions

Keep it concise and coaching-oriented. Use markdown formatting.`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  const result = await res.json()
  return result.content[0].text
}

async function sendTelegramNotification(
  activity: Record<string, unknown>,
  analysis: string,
  fremActivityId: string
) {
  const distanceKm = ((activity.distance as number) / 1000).toFixed(2)
  const durationMin = Math.round((activity.moving_time as number) / 60)
  const activityUrl = `${FREM_BASE_URL}/activity/${fremActivityId}`

  // Truncate analysis for Telegram (keep first ~500 chars)
  const shortAnalysis = analysis.length > 500 ? analysis.slice(0, 500) + '...' : analysis

  const text = `🏃 *${activity.name}*
${activity.type} · ${distanceKm} km · ${durationMin} min

${shortAnalysis}

[View on Frem](${activityUrl})`

  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text,
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
    }),
  })
}
