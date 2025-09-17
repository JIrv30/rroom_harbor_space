import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Landing from './components/Landing'
import ProtectedRoute from './components/ProtectedRoute'
import AuthLayout from './components/AuthLayout'
import RelocationPage from './components/RelocationPage'
import HarborPage from './components/HarborPage'
import { RelocationDashboard, HarborDashboard } from './components/Dashboards'
import './App.css'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public landing (login only) */}
        <Route path="/" element={<Landing />} />

        {/* Everything below requires auth and shows the Header */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AuthLayout />}>
            <Route path="/relocation" element={<RelocationPage />} />
            <Route path="/harbor" element={<HarborPage />} />
            <Route path="/relocation-dashboard" element={<RelocationDashboard />} />
            <Route path="/harbor-dashboard" element={<HarborDashboard />} />
          </Route>
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Landing />} />
      </Routes>
    </BrowserRouter>
  )
}
