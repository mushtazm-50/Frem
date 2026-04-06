# Frem — Claude Code Project Instructions

Always read DESIGN.md before making any UI or frontend changes.

## Project Overview
- **Name:** Frem
- **Purpose:** Personal fitness tracking app (single user)
- **Stack:** React + TypeScript + Vite (frontend), Supabase (auth, database, edge functions), Vercel (deployment)
- **Auth:** Google OAuth via Supabase Auth (single-user lockdown)
- **Design:** Dark mode only, warm orange accent (#E8642A), Claude.ai-inspired minimal aesthetic

## Folder Structure
```
src/
├── components/     # Shared UI components
│   ├── Layout.tsx
│   ├── Sidebar.tsx
│   ├── ProtectedRoute.tsx
│   └── ActivityTypeIcon.tsx
├── pages/          # Route-level page components
│   ├── Dashboard.tsx
│   ├── ActivityDetail.tsx
│   ├── Goals.tsx
│   ├── Settings.tsx
│   ├── Login.tsx
│   └── StravaCallback.tsx
├── hooks/          # Custom React hooks
│   ├── useAuth.ts
│   ├── useActivities.ts
│   └── useGoals.ts
├── lib/            # Utilities and clients
│   ├── supabase.ts
│   ├── strava.ts
│   └── mock-data.ts
├── types/          # TypeScript type definitions
│   └── index.ts
├── App.tsx
├── main.tsx
└── index.css
supabase/
└── functions/
    └── strava-webhook/
        └── index.ts
```

## Supabase Table Schemas

### activities
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK, auto-generated |
| strava_id | bigint | Strava activity ID |
| user_id | text | Owner identifier |
| name | text | Activity name |
| type | text | Run, Ride, Swim, WeightTraining, etc. |
| sport_type | text | Strava sport_type |
| start_date | timestamptz | Activity start time |
| elapsed_time | int4 | Total elapsed seconds |
| moving_time | int4 | Moving time in seconds |
| distance | float8 | Distance in meters |
| total_elevation_gain | float8 | Meters |
| average_speed | float8 | m/s |
| max_speed | float8 | m/s |
| average_heartrate | float8 | nullable |
| max_heartrate | float8 | nullable |
| calories | float8 | nullable |
| suffer_score | int4 | nullable |
| average_cadence | float8 | nullable |
| average_watts | float8 | nullable |
| map_polyline | text | nullable, encoded polyline |
| ai_analysis | text | nullable, markdown AI analysis |
| raw_data | jsonb | Full Strava API response |
| created_at | timestamptz | auto |

### goals
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK, auto-generated |
| user_id | text | Owner identifier |
| event_type | text | Activity type (Run, Ride, etc.) |
| event_name | text | e.g., "Copenhagen Half Marathon" |
| target_date | date | Race/goal date |
| target_time | int4 | Target time in seconds |
| status | text | active, completed, cancelled |
| training_plan | jsonb | nullable, AI-generated 4-week plan |
| created_at | timestamptz | auto |

### strava_tokens
| Column | Type | Notes |
|--------|------|-------|
| strava_athlete_id | bigint | PK |
| access_token | text | |
| refresh_token | text | |
| expires_at | int8 | Unix timestamp |

## Environment Variables

### Frontend (Vite — prefixed with VITE_)
- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — Supabase anon/public key
- `VITE_STRAVA_CLIENT_ID` — Strava app client ID
- `VITE_STRAVA_REDIRECT_URI` — OAuth callback URL

### Supabase Edge Function
- `STRAVA_CLIENT_ID`
- `STRAVA_CLIENT_SECRET`
- `STRAVA_VERIFY_TOKEN` — Random string for webhook verification
- `CLAUDE_API_KEY` — Anthropic API key
- `TELEGRAM_BOT_TOKEN` — Telegram bot token
- `TELEGRAM_CHAT_ID` — Your Telegram chat ID
- `FREM_BASE_URL` — Production URL (for activity links in notifications)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Coding Conventions
- TypeScript — strict, no `any`
- Functional components only, no class components
- Tailwind CSS for all styling (v4 with `@theme` directive)
- Named exports for components and hooks
- Default export only for App.tsx
- Hooks prefixed with `use` in `src/hooks/`
- Keep pages thin — extract complex logic into hooks
- Mock data mirrors exact Supabase schema shapes
- `USE_MOCK` flag auto-detected from env vars — no manual toggling

## Data Flow
1. Strava activity recorded → Strava webhook fires
2. Supabase Edge Function receives webhook → fetches full activity from Strava API
3. Edge Function calls Claude API for AI analysis
4. Edge Function stores activity + analysis in `activities` table
5. Edge Function sends Telegram notification with summary + Frem link
6. Frontend reads from Supabase `activities` and `goals` tables via hooks
