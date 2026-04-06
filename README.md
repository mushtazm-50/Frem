# Frem

Personal fitness tracking app. Syncs with Strava, provides AI-powered activity analysis, and sends Telegram notifications.

Built with React + TypeScript + Vite, Supabase backend, deployed on Vercel.

## Features

- **Dashboard** — weekly stats, recent activities, active goal progress
- **Activity detail** — full stats + AI analysis for each activity
- **Goals** — set race goals with AI-generated 4-week training plans
- **Strava sync** — automatic activity import via webhook
- **AI analysis** — Claude-powered analysis of every activity (effort, pacing, HR zones, coaching feedback)
- **Telegram notifications** — instant summary + link when a new activity is recorded

## Setup

### 1. Supabase Project

1. Create a project at [supabase.com](https://supabase.com)
2. Run the following SQL to create tables:

```sql
-- Activities table
create table activities (
  id uuid primary key default gen_random_uuid(),
  strava_id bigint unique,
  user_id text not null,
  name text not null,
  type text not null,
  sport_type text,
  start_date timestamptz not null,
  elapsed_time int not null,
  moving_time int not null,
  distance float8 default 0,
  total_elevation_gain float8 default 0,
  average_speed float8 default 0,
  max_speed float8 default 0,
  average_heartrate float8,
  max_heartrate float8,
  calories float8,
  suffer_score int,
  average_cadence float8,
  average_watts float8,
  map_polyline text,
  ai_analysis text,
  raw_data jsonb default '{}',
  created_at timestamptz default now()
);

-- Goals table
create table goals (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  event_type text not null,
  event_name text not null,
  target_date date not null,
  target_time int not null,
  status text default 'active',
  training_plan jsonb,
  created_at timestamptz default now()
);

-- Strava tokens
create table strava_tokens (
  strava_athlete_id bigint primary key,
  access_token text not null,
  refresh_token text not null,
  expires_at bigint not null
);

-- RLS policies (single-user app, keep simple)
alter table activities enable row level security;
alter table goals enable row level security;

create policy "Authenticated users can read activities"
  on activities for select to authenticated using (true);

create policy "Authenticated users can read goals"
  on goals for select to authenticated using (true);

create policy "Authenticated users can insert goals"
  on goals for insert to authenticated with check (true);
```

### 2. Google OAuth

1. In Supabase Dashboard → Authentication → Providers → Google
2. Create OAuth credentials in [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
3. Add your Supabase auth callback URL as an authorized redirect URI
4. Enter Client ID and Secret in Supabase Google provider settings
5. To restrict to your account only, add a check in RLS or use Supabase Auth hooks

### 3. Strava API

1. Create an app at [strava.com/settings/api](https://www.strava.com/settings/api)
2. Set Authorization Callback Domain to your Vercel domain
3. Note your Client ID and Client Secret

### 4. Strava Webhook Registration

After deploying the Edge Function, register the webhook:

```bash
curl -X POST https://www.strava.com/api/v3/push_subscriptions \
  -d client_id=YOUR_CLIENT_ID \
  -d client_secret=YOUR_CLIENT_SECRET \
  -d callback_url=https://YOUR_PROJECT.supabase.co/functions/v1/strava-webhook \
  -d verify_token=YOUR_VERIFY_TOKEN
```

### 5. Telegram Bot

1. Message [@BotFather](https://t.me/BotFather) on Telegram to create a bot
2. Save the bot token
3. Message your bot, then get your chat ID via: `https://api.telegram.org/bot<TOKEN>/getUpdates`

### 6. Deploy Supabase Edge Function

```bash
supabase functions deploy strava-webhook
```

Set secrets:
```bash
supabase secrets set STRAVA_CLIENT_ID=...
supabase secrets set STRAVA_CLIENT_SECRET=...
supabase secrets set STRAVA_VERIFY_TOKEN=...
supabase secrets set CLAUDE_API_KEY=...
supabase secrets set TELEGRAM_BOT_TOKEN=...
supabase secrets set TELEGRAM_CHAT_ID=...
supabase secrets set FREM_BASE_URL=https://your-app.vercel.app
```

### 7. Vercel Deployment

1. Connect this repo to Vercel
2. Set environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_STRAVA_CLIENT_ID`
   - `VITE_STRAVA_REDIRECT_URI`
3. Deploy

### 8. Local Development

```bash
npm install
npm run dev
```

The app runs with mock data by default when Supabase env vars aren't set.

## Environment Variables

See `.env.example` for the full list.

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4
- **Backend:** Supabase (Auth, Database, Edge Functions)
- **AI:** Claude API (claude-sonnet-4-20250514) for activity analysis
- **Notifications:** Telegram Bot API
- **Activity data:** Strava API v3
- **Deployment:** Vercel
