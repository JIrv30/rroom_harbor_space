import React, { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

export default function ProtectedRoute() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (mounted) {
        setSession(session)
        setLoading(false)
      }
    })()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_evt, s) => setSession(s))
    return () => subscription?.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Loading…
      </div>
    )
  }

  return session ? <Outlet /> : <Navigate to="/" replace />
}
