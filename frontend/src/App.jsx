import { Navigate, Route, Routes } from 'react-router-dom'
import { AppDataProvider } from './state/AppDataContext'
import { useAuth } from './state/useAppData'
import AppShell from './components/layout/AppShell'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import SpendingPage from './pages/SpendingPage'
import OptimizePage from './pages/OptimizePage'
import ReportsPage from './pages/ReportsPage'
import BrowsePage from './pages/BrowsePage'
import SettingsPage from './pages/SettingsPage'
import './App.css'

function RequireAuth({ children }) {
  const { token } = useAuth()
  if (!token) return <Navigate to="/login" replace />
  return children
}

function RedirectIfAuthed({ children }) {
  const { token } = useAuth()
  if (token) return <Navigate to="/dashboard" replace />
  return children
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<RedirectIfAuthed><LoginPage /></RedirectIfAuthed>} />
      <Route path="/register" element={<RedirectIfAuthed><RegisterPage /></RedirectIfAuthed>} />

      <Route element={<RequireAuth><AppShell /></RequireAuth>}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/spending" element={<SpendingPage />} />
        <Route path="/spending/:accountId" element={<SpendingPage />} />
        <Route path="/optimize" element={<OptimizePage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/browse" element={<BrowsePage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AppDataProvider>
      <AppRoutes />
    </AppDataProvider>
  )
}
