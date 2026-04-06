import { useState } from 'react'
import { Link2, CheckCircle } from 'lucide-react'
import { getStravaAuthUrl } from '../lib/strava'
import { useAuth } from '../hooks/useAuth'

export function Settings() {
  const { user } = useAuth()
  const [stravaConnected] = useState(false) // Will be read from DB when live

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-text-secondary text-sm mt-1">Manage your connections and preferences</p>
      </div>

      {/* Account */}
      <div className="bg-bg-surface rounded-xl p-6 border border-border-subtle">
        <h2 className="text-base font-semibold mb-4">Account</h2>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-accent-muted flex items-center justify-center text-accent font-semibold text-sm">
            {user?.user_metadata?.full_name?.[0] || user?.email?.[0]?.toUpperCase() || 'U'}
          </div>
          <div>
            <p className="text-sm font-medium">{user?.user_metadata?.full_name || 'User'}</p>
            <p className="text-xs text-text-tertiary">{user?.email}</p>
          </div>
        </div>
      </div>

      {/* Strava Connection */}
      <div className="bg-bg-surface rounded-xl p-6 border border-border-subtle">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#FC4C02]/15 flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#FC4C02">
                <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold">Strava</h3>
              <p className="text-xs text-text-tertiary mt-0.5">
                {stravaConnected ? 'Connected — activities sync automatically' : 'Connect to sync your activities'}
              </p>
            </div>
          </div>
          {stravaConnected ? (
            <div className="flex items-center gap-1.5 text-success text-sm">
              <CheckCircle size={16} />
              Connected
            </div>
          ) : (
            <a
              href={getStravaAuthUrl()}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#FC4C02] hover:bg-[#E8430A] text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Link2 size={16} />
              Connect Strava
            </a>
          )}
        </div>
      </div>

      {/* Strava Callback Handler Info */}
      <div className="bg-bg-surface rounded-xl p-6 border border-border-subtle">
        <h2 className="text-base font-semibold mb-3">Setup Guide</h2>
        <div className="space-y-3 text-sm text-text-secondary">
          <p>To complete the Strava integration:</p>
          <ol className="list-decimal pl-5 space-y-2">
            <li>Create a Strava API Application at <span className="text-accent">strava.com/settings/api</span></li>
            <li>Set the callback domain to your deployment URL</li>
            <li>Add your Client ID and Secret to the Supabase Edge Function environment</li>
            <li>Register the webhook subscription with Strava</li>
          </ol>
          <p className="text-text-tertiary text-xs mt-3">
            See README.md for full setup instructions.
          </p>
        </div>
      </div>

      <div className="text-center py-4">
        <p className="text-xs text-text-tertiary">
          Frem — Personal fitness tracking
        </p>
      </div>
    </div>
  )
}
