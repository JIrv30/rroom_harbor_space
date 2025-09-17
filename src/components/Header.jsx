// File: src/components/Header.jsx
import React, { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import LoginWithGoogle from './LoginWithGoogle'

// ⚠️ Put your logo at: src/assets/kgabrunepark-logo.png
//    Or change the import below to match your file name/path.
import logo from '../assets/kgs-logo.png'

export default function Header() {
  const [session, setSession] = useState(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (mounted) setSession(session)
    })()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_evt, s) => setSession(s))
    return () => {
      mounted = false
      subscription?.unsubscribe()
    }
  }, [])

  async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error(error)
      alert(error.message)
    }
  }

  const user = session?.user
  const displayName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email ||
    'Signed in'
  const avatarUrl = user?.user_metadata?.avatar_url

  return (
    <div className="w-full border-b border-gray-200 bg-white">
      <header className="mx-auto flex max-w-5xl items-center justify-between gap-4 p-3">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <img
            src={logo}
            alt="King's Academy Brune Park logo"
            className="h-10 w-auto"
            onError={(e) => { e.currentTarget.style.display = 'none' }}
          />
          <div className="leading-tight">
            <h1 className="text-base font-bold">Room Logger</h1>
            <p className="text-xs text-gray-500">Relocation & Harbor</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex items-center gap-2">
          <NavLink
            to="/relocation"
            className={({ isActive }) =>
              `px-3 py-1.5 rounded-xl text-sm font-medium ${
                isActive ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
              }`
            }
          >
            Relocation
          </NavLink>
          <NavLink
            to="/harbor"
            className={({ isActive }) =>
              `px-3 py-1.5 rounded-xl text-sm font-medium ${
                isActive ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
              }`
            }
          >
            Harbor
          </NavLink>

          <NavLink to="/relocation-dashboard" className="px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-sm">R-Room Dashboard</NavLink>
          <NavLink to="/harbor-dashboard" className="px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-sm">Harbor Dashboard</NavLink>

        </nav>

        {/* Auth */}
        <div className="flex items-center gap-3">
          {!session ? (
            <LoginWithGoogle />
          ) : (
            <>
              <div className="flex items-center gap-2">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt=""
                    className="h-8 w-8 rounded-full border border-gray-200"
                  />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-gray-200" />
                )}
                <span className="text-sm">{displayName}</span>
              </div>
              <button
                type="button"
                onClick={signOut}
                className="px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-sm font-medium"
              >
                Sign out
              </button>
            </>
          )}
        </div>
      </header>
    </div>
  )
}
