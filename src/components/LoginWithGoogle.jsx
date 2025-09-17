// File: src/components/LoginWithGoogle.jsx
import React, { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function LoginWithGoogle({ className = '' }) {
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    try {
      setLoading(true)
      const redirectTo = `${window.location.origin}`
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo }
      })
      if (error) throw error
    } catch (err) {
      console.error('Google sign-in error:', err)
      alert(err.message ?? 'Sign-in failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogin}
      disabled={loading}
      className={`inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-1.5 text-sm font-medium disabled:opacity-60 ${className}`}
      aria-label="Sign in with Google"
    >
      {loading ? (
        // tiny spinner
        <svg
          className="animate-spin"
          viewBox="0 0 24 24"
          width="16"
          height="16"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" fill="none" opacity="0.25" />
          <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" fill="none" />
        </svg>
      ) : (
        // subtle 'G' glyph in currentColor (matches text color)
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <path
            fill="currentColor"
            d="M12 2a10 10 0 1 0 10 10v-.8h-9.2v3.2H18a6 6 0 1 1-2.1-6.3l2-2A9.96 9.96 0 0 0 12 2Z"
          />
        </svg>
      )}
      {loading ? 'Signing in…' : 'Sign in with Google'}
    </button>
  )
}
