import { useContext } from 'react'
import { AppDataContext } from './context'

export function useAppData() {
  const ctx = useContext(AppDataContext)
  if (!ctx) throw new Error('useAppData must be used inside AppDataProvider')
  return ctx
}

export function useAuth() {
  const { token, login, logout } = useAppData()
  return { token, login, logout }
}
