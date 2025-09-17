import React from 'react'
import { Outlet } from 'react-router-dom'
import Header from './Header'

export default function AuthLayout() {
  return (
    <>
      <Header />
      <div className="max-w-5xl mx-auto p-6">
        <Outlet />
      </div>
    </>
  )
}
