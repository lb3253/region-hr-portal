import { useAuthContext } from '../context/AuthContext'

/**
 * Thin alias over the auth context so components can `useAuth()` without
 * reaching into the context module directly.
 */
export function useAuth() {
  return useAuthContext()
}

export default useAuth
