import { useEffect, useRef, Suspense, lazy } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Routes, Route, useNavigate, useLocation } from "react-router-dom"
import { Toaster } from "@/components/ui/sonner"
import { toast } from "sonner"

const Login = lazy(() => import("./pages/Login"))
const Map = lazy(() => import("./pages/Map"))
const Journal = lazy(() => import("./pages/Journal"))
const Admin = lazy(() => import("./pages/Admin"))
const Dashboard = lazy(() => import("./pages/Dashboard"))
const Profile = lazy(() => import("./pages/Profile"))
const LocomotiveRemarks = lazy(() => import("./pages/LocomotiveRemarks"))
const History = lazy(() => import("./pages/History"))

const ActiveRemarks = lazy(() => import("./pages/ActiveRemarks"))

import { ProtectedRoute } from "./components/common/ProtectedRoute"
import { MobileNav } from "./components/common/MobileNav"
import { supabase } from "@/lib/supabase"

import DashboardLayout from "./components/layout/DashboardLayout"

function App() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auth state listener for Supabase
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("🔔 Supabase Auth Event:", event);

      if (event === 'PASSWORD_RECOVERY') {
        // When user clicks "Reset Password" link in email,
        // Supabase triggers this event. Redirect them to profile
        // where our updated logic will let them set a new password.
        toast.info("Пожалуйста, установите новый пароль");
        navigate('/profile#type=recovery');
      }

      if (event === 'SIGNED_IN' && session) {
        // Sync session to backend to enable Express session-based features
        try {
          const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              token: session.access_token,
              user: session.user
            })
          });
          const data = await res.json();
          console.log("✅ Backend session synchronized");
          // Immediately set the auth user data in cache
          if (data.success && data.user) {
            queryClient.setQueryData(['authUser'], data.user);
            // If on login page (e.g. after Google OAuth redirect), navigate to map
            if (window.location.pathname === '/') {
              navigate('/map');
            }
          }
        } catch (err) {
          console.error("❌ Backend sync failed:", err);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    const logout = async () => {
      try {
        await supabase.auth.signOut();
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

    // Throttle the reset to at most once per second to save CPU
    let throttleTimer: ReturnType<typeof setTimeout> | null = null;
    const throttledResetTimer = () => {
      if (throttleTimer) return;
      throttleTimer = setTimeout(() => {
        resetTimer();
        throttleTimer = null;
      }, 1000);
    };

    // Only set up listeners if we are logged in (not on login page)
    if (location.pathname === '/') {
      if (timerRef.current) clearTimeout(timerRef.current)
      return
    }

    // Removed high-frequency events: 'mousemove', 'scroll'
    const events = ['mousedown', 'keydown', 'touchstart']
    events.forEach(e => document.addEventListener(e, throttledResetTimer))
    resetTimer()

    return () => {
      events.forEach(e => document.removeEventListener(e, throttledResetTimer))
      if (timerRef.current) clearTimeout(timerRef.current)
      if (throttleTimer) clearTimeout(throttleTimer)
    }
  }, [location.pathname, navigate])

  return (
    <>
      <Suspense fallback={<div className="flex h-screen w-screen items-center justify-center text-slate-500 font-medium">Загрузка приложения...</div>}>
        <Routes>
          <Route path="/" element={<Login />} />

          {/* Protected Routes wrapped in DashboardLayout */}
          <Route element={<ProtectedRoute />}>
            <Route element={<DashboardLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/map" element={<Map />} />
              <Route path="/journal" element={<Journal />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/remarks" element={<ActiveRemarks />} />
              <Route path="/locomotive/:id/remarks" element={<LocomotiveRemarks />} />
              <Route path="/history/:number" element={<History />} />
            </Route>
          </Route>


        </Routes>
      </Suspense>
      {location.pathname !== '/' && <MobileNav />}
      <Toaster />
    </>
  )
}

export default App
