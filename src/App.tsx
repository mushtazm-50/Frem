import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Dashboard } from './pages/Dashboard'
import { ActivityDetail } from './pages/ActivityDetail'
import { Goals } from './pages/Goals'
import { Settings } from './pages/Settings'
import { StravaCallback } from './pages/StravaCallback'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/strava/callback" element={<StravaCallback />} />
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<Dashboard />} />
          <Route path="/activity/:id" element={<ActivityDetail />} />
          <Route path="/goals" element={<Goals />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
