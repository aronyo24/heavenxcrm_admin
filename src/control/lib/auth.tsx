/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react"
import { fetchMe, login as apiLogin, logout as apiLogout } from "./api"
import type { Developer } from "./types"

interface ControlAuth {
  developer: Developer | null
  loading: boolean
  login: (email: string, password: string, otp?: string) => Promise<Developer>
  logout: () => Promise<void>
  refresh: () => Promise<void>
  setDeveloper: (dev: Developer) => void
  can: (permission: string) => boolean
}

const Ctx = createContext<ControlAuth | null>(null)

export function ControlAuthProvider({ children }: { children: ReactNode }) {
  const [developer, setDeveloper] = useState<Developer | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      setDeveloper((await fetchMe()).developer)
    } catch {
      setDeveloper(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMe()
      .then((r) => setDeveloper(r.developer))
      .catch(() => setDeveloper(null))
      .finally(() => setLoading(false))
    const onUnauthorized = () => setDeveloper(null)
    window.addEventListener("control:unauthorized", onUnauthorized)
    return () => window.removeEventListener("control:unauthorized", onUnauthorized)
  }, [refresh])

  const login = async (email: string, password: string, otp?: string) => {
    const { developer: dev } = await apiLogin(email, password, otp)
    setDeveloper(dev)
    return dev
  }

  const logout = async () => {
    try {
      await apiLogout()
    } finally {
      setDeveloper(null)
    }
  }

  const can = (permission: string) => !!developer?.permissions.includes(permission)

  return (
    <Ctx.Provider value={{ developer, loading, login, logout, refresh, setDeveloper, can }}>{children}</Ctx.Provider>
  )
}

export function useControlAuth() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error("useControlAuth must be used inside ControlAuthProvider")
  return ctx
}
