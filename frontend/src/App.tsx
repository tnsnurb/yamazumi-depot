import { useEffect, useRef, Suspense, lazy } from "react"
import { Routes, Route, useNavigate, useLocation } from "react-router-dom"
import { Toaster } from "@/components/ui/sonner"

const Login = lazy(() => import("./pages/Login"))
const Map = lazy(() => import("./pages/Map"))
const Journal = lazy(() => import("./pages/Journal"))
const Admin = lazy(() => import("./pages/Admin"))
const Dashboard = lazy(() => import("./pages/Dashboard"))
const Profile = lazy(() => import("./pages/Profile"))
const LocomotiveRemarks = lazy(() => import("./pages/LocomotiveRemarks"))
const History = lazy(() => import("./pages/History"))
const Kiosk = lazy(() => import("./pages/Kiosk"))
const ActiveRemarks = lazy(() => import("./pages/ActiveRemarks"))

import { ProtectedRoute } from "./components/common/ProtectedRoute"
import { MobileNav } from "./components/common/MobileNav"

function App() {
  const navigate = useNavigate()
  const location = useLocation()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const logout = async () => {
      try {
        await fetch('/api/logout', { method: 'POST' });
        navigate('/');
      } catch (e) {
        console.error(e);
      }
    }

    const resetTimer = () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (location.pathname !== '/') {
        timerRef.current = setTimeout(logout, 5 * 60 * 1000) // 5 minutes
      }
    }

    // Only set up listeners if we are logged in (not on login page)
    if (location.pathname === '/') {
      if (timerRef.current) clearTimeout(timerRef.current)
      return
    }

    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart']
    events.forEach(e => document.addEventListener(e, resetTimer))
    resetTimer()

    return () => {
      events.forEach(e => document.removeEventListener(e, resetTimer))
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [location.pathname, navigate])

  return (
    <>
      <Suspense fallback={<div className="flex h-screen w-screen items-center justify-center text-slate-500 font-medium">Загрузка приложения...</div>}>
        <Routes>
          <Route path="/" element={<Login />} />

          <Route element={<ProtectedRoute reqPerm="can_view_map" />}>
            <Route path="/map" element={<Map />} />
          </Route>

          <Route element={<ProtectedRoute reqPerm="can_view_journal" />}>
            <Route path="/journal" element={<Journal />} />
          </Route>

          <Route element={<ProtectedRoute reqPerm="can_view_dashboard" />}>
            <Route path="/dashboard" element={<Dashboard />} />
          </Route>

          <Route element={<ProtectedRoute reqPerm="can_manage_users" />}>
            <Route path="/admin" element={<Admin />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route path="/profile" element={<Profile />} />
            <Route path="/remarks" element={<ActiveRemarks />} />
            <Route path="/locomotive/:id/remarks" element={<LocomotiveRemarks />} />
            <Route path="/history/:number" element={<History />} />
          </Route>

          <Route path="/kiosk" element={<Kiosk />} />
        </Routes>
      </Suspense>
      {location.pathname !== '/' && location.pathname !== '/kiosk' && <MobileNav />}
      <Toaster />
    </>
  )
}

export default App
