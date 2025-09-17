import React, { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import LoginWithGoogle from './LoginWithGoogle'
import logo from '../assets/KGS-Logo.png'

export default function Landing() {
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

  if (!loading && session) {
    // already signed in → send them to your main page
    return <Navigate to="/relocation" replace />
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm mx-auto rounded-2xl border border-gray-200 bg-white p-6 shadow-sm text-center">
        <img
          src={logo}
          alt="King's Academy Brune Park"
          className="mx-auto h-14 w-auto mb-3"
          onError={(e) => { e.currentTarget.style.display = 'none' }}
        />
        <h1 className="text-lg font-bold mb-1">Room Logger</h1>
        <p className="text-sm text-gray-500 mb-5">Sign in to continue</p>
        <LoginWithGoogle className="w-full justify-center" />
      </div>
    </div>
  )
}
