import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  // `sessionLoading` covers the initial getSession() round trip; `profileLoading`
  // covers the profile fetch that follows it. Routing waits on both so a client
  // is never bounced off an admin route before their role is known.
  const [sessionLoading, setSessionLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profile, setProfile] = useState(null)
  const [profileError, setProfileError] = useState(null)

  useEffect(() => {
    let active = true

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return
        setSession(data.session ?? null)
      })
      .catch(() => {
        if (active) setSession(null)
      })
      .finally(() => {
        if (active) setSessionLoading(false)
      })

    // Never call other supabase methods synchronously inside this callback —
    // supabase-js holds an internal lock while it runs and awaiting a query
    // from here can deadlock. Only local state is touched.
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return
      setSession(nextSession ?? null)
      setSessionLoading(false)
    })

    return () => {
      active = false
      listener?.subscription?.unsubscribe()
    }
  }, [])

  const userId = session?.user?.id ?? null

  const loadProfile = useCallback(async (id) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, company_id, role, full_name, email, created_at, companies (id, name, slug)')
      .eq('id', id)
      .maybeSingle()

    if (error) throw error
    return data
  }, [])

  useEffect(() => {
    let active = true

    if (!userId) {
      setProfile(null)
      setProfileError(null)
      setProfileLoading(false)
      return () => {
        active = false
      }
    }

    setProfileLoading(true)
    loadProfile(userId)
      .then((data) => {
        if (!active) return
        setProfile(data)
        setProfileError(null)
      })
      .catch((err) => {
        if (!active) return
        setProfile(null)
        setProfileError(err.message || 'Could not load your profile.')
      })
      .finally(() => {
        if (active) setProfileLoading(false)
      })

    return () => {
      active = false
    }
  }, [userId, loadProfile])

  const signIn = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }, [])

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    setProfile(null)
  }, [])

  const refreshProfile = useCallback(async () => {
    if (!userId) return null
    const data = await loadProfile(userId)
    setProfile(data)
    return data
  }, [userId, loadProfile])

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      company: profile?.companies ?? null,
      companyId: profile?.company_id ?? null,
      role: profile?.role ?? null,
      isAdmin: profile?.role === 'admin',
      loading: sessionLoading || profileLoading,
      profileError,
      isConfigured: isSupabaseConfigured,
      signIn,
      signOut,
      refreshProfile,
    }),
    [
      session,
      profile,
      sessionLoading,
      profileLoading,
      profileError,
      signIn,
      signOut,
      refreshProfile,
    ]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuthContext() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuthContext must be used inside an AuthProvider')
  return ctx
}
