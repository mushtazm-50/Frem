// Supabase Edge Function: strava-webhook
// Handles:
// 1. Strava webhook verification (GET)
// 2. Strava webhook events (POST) — new activity created
// 3. Strava OAuth token exchange (POST with action: 'exchange_token')
// 4. Historical import (POST with action: 'sync_history')
// 5. Disconnect Strava (POST with action: 'disconnect')

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const STRAVA_CLIENT_ID = Deno.env.get('STRAVA_CLIENT_ID') || ''
const STRAVA_CLIENT_SECRET = Deno.env.get('STRAVA_CLIENT_SECRET') || ''
const STRAVA_VERIFY_TOKEN = Deno.env.get('STRAVA_VERIFY_TOKEN') || ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

const CLAUDE_API_KEY = Deno.env.get('CLAUDE_API_KEY') || ''
const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') || ''
const TELEGRAM_CHAT_ID = Deno.env.get('TELEGRAM_CHAT_ID') || ''
const FREM_BASE_URL = Deno.env.get('FREM_BASE_URL') || ''

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Strava webhook verification (GET)
  if (req.method === 'GET') {
    const url = new URL(req.url)
    const mode = url.searchParams.get('hub.mode')
    const token = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')

    if (mode === 'subscribe' && token === STRAVA_VERIFY_TOKEN) {
      return jsonResponse({ 'hub.challenge': challenge })
    }
    return new Response('Forbidden', { status: 403, headers: corsHeaders })
  }

  // POST requests
  const body = await req.json()

  if (body.action === 'exchange_token') {
    return handleTokenExchange(body.code)
  }

  if (body.action === 'sync_history') {
    return handleSyncHistory(body.strava_athlete_id)
  }

  if (body.action === 'disconnect') {
    return handleDisconnect(body.strava_athlete_id)
  }

  // Strava webhook event — new activity
  if (body.object_type === 'activity' && body.aspect_type === 'create') {
    return handleNewActivity(body.object_id, body.owner_id)
  }

  return new Response('OK', { status: 200, headers: corsHeaders })
})

// --- Token Exchange ---
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

    if (!res.ok || !tokens.athlete) {
      console.error('Strava token error:', JSON.stringify(tokens))
      return jsonResponse({ error: 'Strava token exchange failed', details: tokens }, 400)
    }

    const { error: dbError } = await supabase.from('strava_tokens').upsert({
      strava_athlete_id: tokens.athlete.id,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: tokens.expires_at,
    })
    if (dbError) console.error('DB upsert error:', dbError)

    return jsonResponse({ success: true, strava_athlete_id: tokens.athlete.id })
  } catch (err) {
    console.error('Token exchange error:', err)
    return jsonResponse({ error: (err as Error).message }, 500)
  }
}

// --- Disconnect Strava ---
async function handleDisconnect(stravaAthleteId: number) {
  try {
    // Revoke Strava access
    const accessToken = await getAccessToken(stravaAthleteId)
    await fetch(`https://www.strava.com/oauth/deauthorize?access_token=${accessToken}`, {
      method: 'POST',
    })

    // Delete tokens
    await supabase.from('strava_tokens').delete().eq('strava_athlete_id', stravaAthleteId)

    // Delete all activities for this user
    await supabase.from('activities').delete().eq('user_id', stravaAthleteId.toString())

    return jsonResponse({ success: true })
  } catch (err) {
    console.error('Disconnect error:', err)
    // Still try to clean up locally even if revoke fails
    await supabase.from('strava_tokens').delete().eq('strava_athlete_id', stravaAthleteId)
    await supabase.from('activities').delete().eq('user_id', stravaAthleteId.toString())
    return jsonResponse({ success: true })
  }
}

// --- Historical Sync (1 year) ---
async function handleSyncHistory(stravaAthleteId: number) {
  try {
    const accessToken = await getAccessToken(stravaAthleteId)
    const oneYearAgo = Math.floor(Date.now() / 1000) - (365 * 24 * 60 * 60)
    let page = 1
    let totalImported = 0
    const perPage = 100

    // First pass: count total activities
    const allSummaries: Record<string, unknown>[] = []
    while (true) {
      console.log(`Fetching activity list page ${page}...`)
      const res = await fetch(
        `https://www.strava.com/api/v3/athlete/activities?after=${oneYearAgo}&page=${page}&per_page=${perPage}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      if (!res.ok) {
        const errText = await res.text()
        console.error(`Strava API error on list page ${page}: ${res.status} ${errText}`)
        // If unauthorized, try refreshing token once
        if (res.status === 401) {
          console.log('Token expired during sync, attempting refresh...')
          const newToken = await forceTokenRefresh(stravaAthleteId)
          if (newToken) {
            const retryRes = await fetch(
              `https://www.strava.com/api/v3/athlete/activities?after=${oneYearAgo}&page=${page}&per_page=${perPage}`,
              { headers: { Authorization: `Bearer ${newToken}` } }
            )
            if (retryRes.ok) {
              const batch = await retryRes.json()
              if (batch && batch.length > 0) {
                allSummaries.push(...batch)
                if (batch.length < perPage) break
                page++
                continue
              }
            }
          }
        }
        break
      }
      const batch = await res.json()
      if (!batch || batch.length === 0) break
      allSummaries.push(...batch)
      if (batch.length < perPage) break
      page++
    }
    console.log(`Found ${allSummaries.length} activities from Strava API`)

    // Initialize progress
    await supabase.from('sync_status').upsert({
      strava_athlete_id: stravaAthleteId,
      status: 'syncing',
      total: allSummaries.length,
      imported: 0,
      updated_at: new Date().toISOString(),
    })

    // Second pass: fetch details and store
    for (const summary of allSummaries) {
      try {
        const { data: existing } = await supabase
          .from('activities')
          .select('id')
          .eq('strava_id', summary.id as number)
          .maybeSingle()

        if (existing) {
          totalImported++
          await supabase.from('sync_status').update({
            imported: totalImported,
            updated_at: new Date().toISOString(),
          }).eq('strava_athlete_id', stravaAthleteId)
          continue
        }

        const detailRes = await fetch(
          `https://www.strava.com/api/v3/activities/${summary.id}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        )
        const activity = await detailRes.json()

        const record = buildActivityRecord(activity, stravaAthleteId)
        const { error } = await supabase.from('activities').insert(record)
        if (error) {
          console.error(`Failed to insert activity ${summary.id}:`, error)
        }

        totalImported++
        await supabase.from('sync_status').update({
          imported: totalImported,
          updated_at: new Date().toISOString(),
        }).eq('strava_athlete_id', stravaAthleteId)

        await new Promise(r => setTimeout(r, 200))
      } catch (err) {
        console.error(`Error processing activity ${summary.id}:`, err)
        totalImported++
      }
    }

    // Mark complete
    await supabase.from('sync_status').update({
      status: 'done',
      imported: totalImported,
      updated_at: new Date().toISOString(),
    }).eq('strava_athlete_id', stravaAthleteId)

    console.log(`Historical sync complete: ${totalImported} activities imported`)
    return jsonResponse({ success: true, imported: totalImported })
  } catch (err) {
    console.error('Sync history error:', err)
    return jsonResponse({ error: (err as Error).message }, 500)
  }
}

// --- New Activity (webhook) ---
async function handleNewActivity(activityId: number, ownerId: number) {
  try {
    const accessToken = await getAccessToken(ownerId)

    const activityRes = await fetch(
      `https://www.strava.com/api/v3/activities/${activityId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    const activity = await activityRes.json()

    // Skip if already exists
    const { data: existing } = await supabase
      .from('activities')
      .select('id')
      .eq('strava_id', activityId)
      .maybeSingle()
    if (existing) return new Response('OK', { status: 200, headers: corsHeaders })

    const record = buildActivityRecord(activity, ownerId)

    // Generate AI analysis if API key is set
    if (CLAUDE_API_KEY) {
      record.ai_analysis = await generateAnalysis(activity)
    }

    const { data: inserted } = await supabase
      .from('activities')
      .insert(record)
      .select('id')
      .single()

    // Send Telegram notification if configured
    if (inserted && TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
      await sendTelegramNotification(activity, record.ai_analysis || '', inserted.id)
    }

    return new Response('OK', { status: 200, headers: corsHeaders })
  } catch (err) {
    console.error('Error processing activity:', err)
    return new Response('Error', { status: 500, headers: corsHeaders })
  }
}

// --- Helpers ---

function buildActivityRecord(activity: Record<string, unknown>, ownerId: number) {
  return {
    strava_id: activity.id as number,
    user_id: ownerId.toString(),
    name: (activity.name as string) || 'Untitled',
    type: (activity.type as string) || 'Workout',
    sport_type: (activity.sport_type as string) || '',
    start_date: activity.start_date as string,
    elapsed_time: (activity.elapsed_time as number) || 0,
    moving_time: (activity.moving_time as number) || 0,
    distance: (activity.distance as number) || 0,
    total_elevation_gain: (activity.total_elevation_gain as number) || 0,
    average_speed: (activity.average_speed as number) || 0,
    max_speed: (activity.max_speed as number) || 0,
    average_heartrate: (activity.average_heartrate as number) || null,
    max_heartrate: (activity.max_heartrate as number) || null,
    calories: (activity.calories as number) || null,
    suffer_score: (activity.suffer_score as number) || null,
    average_cadence: (activity.average_cadence as number) || null,
    average_watts: (activity.average_watts as number) || null,
    map_polyline: (activity.map as Record<string, unknown>)?.summary_polyline as string || null,
    ai_analysis: null as string | null,
    raw_data: activity,
  }
}

async function getAccessToken(stravaAthleteId: number): Promise<string> {
  const { data: tokens } = await supabase
    .from('strava_tokens')
    .select('*')
    .eq('strava_athlete_id', stravaAthleteId)
    .single()

  if (!tokens) throw new Error('No tokens found for athlete')

  // Always refresh if expired or about to expire (within 5 min)
  if (tokens.expires_at < Math.floor(Date.now() / 1000) + 300) {
    console.log('Refreshing Strava token...')
    const refreshed = await refreshStravaToken(tokens.refresh_token, stravaAthleteId)
    if (refreshed) return refreshed
    // If refresh failed, try existing token anyway
    console.warn('Token refresh failed, trying existing token')
  }

  return tokens.access_token
}

async function refreshStravaToken(refreshToken: string, stravaAthleteId: number): Promise<string | null> {
  try {
    const res = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: STRAVA_CLIENT_ID,
        client_secret: STRAVA_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    })

    if (!res.ok) {
      console.error('Token refresh failed:', res.status, await res.text())
      return null
    }

    const refreshed = await res.json()
    if (!refreshed.access_token) {
      console.error('Token refresh returned no access_token:', JSON.stringify(refreshed))
      return null
    }

    await supabase.from('strava_tokens').update({
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token,
      expires_at: refreshed.expires_at,
    }).eq('strava_athlete_id', stravaAthleteId)

    console.log('Token refreshed successfully')
    return refreshed.access_token
  } catch (err) {
    console.error('Token refresh error:', err)
    return null
  }
}

async function forceTokenRefresh(stravaAthleteId: number): Promise<string | null> {
  const { data: tokens } = await supabase
    .from('strava_tokens')
    .select('*')
    .eq('strava_athlete_id', stravaAthleteId)
    .single()
  if (!tokens) return null
  return refreshStravaToken(tokens.refresh_token, stravaAthleteId)
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
