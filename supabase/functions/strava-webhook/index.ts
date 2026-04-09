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
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || ''
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

  if (body.action === 'generate_plan') {
    return handleGeneratePlan(body.goal_id)
  }

  if (body.action === 'adjust_plan') {
    return handleAdjustPlan(body.goal_id)
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
    let apiCalls = 0
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
        apiCalls++

        // Handle rate limiting — if 429, wait and retry
        if (detailRes.status === 429) {
          console.log('Rate limited, waiting 60 seconds...')
          await supabase.from('sync_status').update({
            status: 'rate_limited',
            updated_at: new Date().toISOString(),
          }).eq('strava_athlete_id', stravaAthleteId)
          await new Promise(r => setTimeout(r, 60000))
          // Retry
          const retryRes = await fetch(
            `https://www.strava.com/api/v3/activities/${summary.id}`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          )
          if (!retryRes.ok) {
            console.error(`Retry failed for ${summary.id}: ${retryRes.status}`)
            totalImported++
            continue
          }
          const activity = await retryRes.json()
          const record = buildActivityRecord(activity, stravaAthleteId)
          await supabase.from('activities').insert(record)
          await supabase.from('sync_status').update({
            status: 'syncing',
            updated_at: new Date().toISOString(),
          }).eq('strava_athlete_id', stravaAthleteId)
        } else if (!detailRes.ok) {
          console.error(`Failed to fetch activity ${summary.id}: ${detailRes.status}`)
        } else {
          const activity = await detailRes.json()
          const record = buildActivityRecord(activity, stravaAthleteId)
          const { error } = await supabase.from('activities').insert(record)
          if (error) {
            console.error(`Failed to insert activity ${summary.id}:`, error)
          }
        }

        totalImported++
        await supabase.from('sync_status').update({
          imported: totalImported,
          updated_at: new Date().toISOString(),
        }).eq('strava_athlete_id', stravaAthleteId)

        // Throttle: 1 request per second to stay well under 100/15min limit
        await new Promise(r => setTimeout(r, 1000))

        // Extra pause every 80 requests to be safe
        if (apiCalls % 80 === 0) {
          console.log(`Pausing after ${apiCalls} API calls (15s cooldown)...`)
          await new Promise(r => setTimeout(r, 15000))
        }
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

// --- AI via Gemini ---
async function callGemini(prompt: string): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
      }),
    }
  )
  const result = await res.json()
  if (!res.ok) {
    console.error('Gemini API error:', JSON.stringify(result))
    throw new Error('Gemini API call failed')
  }
  return result.candidates?.[0]?.content?.parts?.[0]?.text || ''
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

  return callGemini(prompt)
}

// --- Plan Generation ---
async function handleGeneratePlan(goalId: string) {
  try {
    // Fetch the goal
    const { data: goal, error: goalErr } = await supabase
      .from('goals')
      .select('*')
      .eq('id', goalId)
      .single()
    if (goalErr || !goal) return jsonResponse({ error: 'Goal not found' }, 404)

    // Fetch recent activities (last 60 days) for context
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()
    const { data: recentActivities } = await supabase
      .from('activities')
      .select('name, type, sport_type, start_date, distance, moving_time, average_speed, average_heartrate, total_elevation_gain')
      .eq('user_id', goal.user_id)
      .gte('start_date', sixtyDaysAgo)
      .order('start_date', { ascending: false })
      .limit(30)

    const activitySummary = (recentActivities || []).map(a => {
      const distKm = ((a.distance || 0) / 1000).toFixed(1)
      const durMin = Math.round((a.moving_time || 0) / 60)
      const paceSecPerKm = a.average_speed > 0 ? Math.round(1000 / a.average_speed) : 0
      const paceMin = Math.floor(paceSecPerKm / 60)
      const paceSec = paceSecPerKm % 60
      return `- ${a.type}: ${distKm}km in ${durMin}min (${paceMin}:${String(paceSec).padStart(2, '0')}/km) HR:${a.average_heartrate || 'N/A'} on ${a.start_date?.slice(0, 10)}`
    }).join('\n')

    const weeksUntil = Math.max(1, Math.ceil((new Date(goal.target_date).getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000)))
    const targetDurH = Math.floor(goal.target_time / 3600)
    const targetDurM = Math.round((goal.target_time % 3600) / 60)
    const targetTimeStr = targetDurH > 0 ? `${targetDurH}h ${targetDurM}min` : `${targetDurM}min`
    const distKm = goal.target_distance ? (goal.target_distance / 1000).toFixed(1) : 'N/A'
    const targetPaceStr = goal.target_pace ? `${Math.floor(goal.target_pace / 60)}:${String(Math.round(goal.target_pace % 60)).padStart(2, '0')}/km` : 'N/A'

    const prompt = `You are an expert running and endurance coach. Generate a training plan for the following goal.

GOAL:
- Event: ${goal.event_name}
- Type: ${goal.event_type}
- Distance: ${distKm} km
- Target date: ${goal.target_date} (${weeksUntil} weeks away)
- Target time: ${targetTimeStr}
- Target pace: ${targetPaceStr}

ATHLETE'S RECENT ACTIVITY (last 60 days):
${activitySummary || 'No recent activities recorded.'}

Generate a ${Math.min(weeksUntil, 12)}-week training plan. For each week provide:
- A focus/theme for the week
- Daily sessions (Mon-Sun) with: day, session type, description, duration in minutes, intensity (easy/moderate/hard/recovery)

Be specific with paces, distances, and intensities. Taper in the final 1-2 weeks before the event.
Base the plan on the athlete's current fitness level shown in recent activities.

IMPORTANT: Respond ONLY with valid JSON in this exact format, no other text:
{
  "weeks": [
    {
      "week": 1,
      "focus": "Base Building",
      "sessions": [
        {"day": "Monday", "type": "Easy Run", "description": "Easy aerobic run at 5:30-6:00/km", "duration_minutes": 45, "intensity": "easy"},
        {"day": "Tuesday", "type": "Rest", "description": "Complete rest or light stretching", "duration_minutes": 0, "intensity": "recovery"}
      ]
    }
  ]
}`

    console.log('Generating training plan for goal:', goal.event_name)
    const response = await callGemini(prompt)

    // Parse the JSON from the response
    let plan
    try {
      // Extract JSON from potential markdown code blocks
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        plan = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('No JSON found in response')
      }
    } catch (parseErr) {
      console.error('Failed to parse plan JSON:', parseErr, 'Response:', response.slice(0, 500))
      return jsonResponse({ error: 'Failed to parse training plan' }, 500)
    }

    // Store the plan in the goal
    const { error: updateErr } = await supabase
      .from('goals')
      .update({ training_plan: plan.weeks })
      .eq('id', goalId)

    if (updateErr) {
      console.error('Failed to update goal with plan:', updateErr)
      return jsonResponse({ error: 'Failed to save plan' }, 500)
    }

    console.log(`Plan generated: ${plan.weeks.length} weeks for ${goal.event_name}`)
    return jsonResponse({ success: true, weeks: plan.weeks.length })
  } catch (err) {
    console.error('Plan generation error:', err)
    return jsonResponse({ error: (err as Error).message }, 500)
  }
}

// --- Plan Adjustment ---
async function handleAdjustPlan(goalId: string) {
  try {
    const { data: goal, error: goalErr } = await supabase
      .from('goals')
      .select('*')
      .eq('id', goalId)
      .single()
    if (goalErr || !goal || !goal.training_plan) return jsonResponse({ error: 'Goal or plan not found' }, 404)

    // Fetch activities since goal creation
    const { data: activities } = await supabase
      .from('activities')
      .select('name, type, sport_type, start_date, distance, moving_time, average_speed, average_heartrate')
      .eq('user_id', goal.user_id)
      .gte('start_date', goal.created_at)
      .order('start_date', { ascending: false })

    const completedSummary = (activities || []).map(a => {
      const distKm = ((a.distance || 0) / 1000).toFixed(1)
      const durMin = Math.round((a.moving_time || 0) / 60)
      return `- ${a.type}: ${distKm}km in ${durMin}min on ${a.start_date?.slice(0, 10)}`
    }).join('\n')

    const weeksUntil = Math.max(1, Math.ceil((new Date(goal.target_date).getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000)))
    const targetDurH = Math.floor(goal.target_time / 3600)
    const targetDurM = Math.round((goal.target_time % 3600) / 60)
    const targetTimeStr = targetDurH > 0 ? `${targetDurH}h ${targetDurM}min` : `${targetDurM}min`

    const prompt = `You are an expert endurance coach. The athlete has a training plan that needs adjusting based on what they've actually done.

GOAL:
- Event: ${goal.event_name} (${goal.event_type})
- Target date: ${goal.target_date} (${weeksUntil} weeks away)
- Target time: ${targetTimeStr}

ORIGINAL PLAN:
${JSON.stringify(goal.training_plan, null, 2)}

ACTIVITIES ACTUALLY COMPLETED SINCE PLAN STARTED:
${completedSummary || 'No activities recorded yet.'}

Based on the gap between planned and actual training, generate an ADJUSTED plan for the remaining ${weeksUntil} weeks.
- If the athlete missed sessions, gradually reintroduce load — don't try to make up for lost time
- If the athlete exceeded the plan, consider advancing them
- Keep the taper period before the event

IMPORTANT: Respond ONLY with valid JSON in this exact format, no other text:
{
  "weeks": [
    {
      "week": 1,
      "focus": "Week theme",
      "sessions": [
        {"day": "Monday", "type": "Session Type", "description": "Details", "duration_minutes": 45, "intensity": "easy"}
      ]
    }
  ]
}`

    console.log('Adjusting plan for goal:', goal.event_name)
    const response = await callGemini(prompt)

    let plan
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        plan = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('No JSON found in response')
      }
    } catch (parseErr) {
      console.error('Failed to parse adjusted plan:', parseErr)
      return jsonResponse({ error: 'Failed to parse adjusted plan' }, 500)
    }

    await supabase
      .from('goals')
      .update({ training_plan: plan.weeks })
      .eq('id', goalId)

    console.log(`Plan adjusted: ${plan.weeks.length} weeks for ${goal.event_name}`)
    return jsonResponse({ success: true, weeks: plan.weeks.length })
  } catch (err) {
    console.error('Plan adjustment error:', err)
    return jsonResponse({ error: (err as Error).message }, 500)
  }
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
