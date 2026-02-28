import { useEffect, useState } from "react"
import { Navigate, Outlet, useLocation } from "react-router-dom"

interface ProtectedRouteProps {
    reqPerm?: string
}

export function ProtectedRoute({ reqPerm }: ProtectedRouteProps) {
    const [status, setStatus] = useState<'loading' | 'authorized' | 'unauthorized' | 'unauthenticated'>('loading')
    const location = useLocation()

    useEffect(() => {
        fetch('/api/me')
            .then(res => res.json())
            .then(data => {
                if (!data.authenticated) {
                    setStatus('unauthenticated')
                    return
                }

                const user = data.user
                if (user.role === 'admin') {
                    setStatus('authorized')
                    return
                }

                if (reqPerm && user.permissions) {
                    if (user.permissions[reqPerm] !== false) {
                        setStatus('authorized')
                    } else {
                        setStatus('unauthorized')
                    }
                } else if (!reqPerm) {
                    setStatus('authorized')
                } else {
                    setStatus('authorized') // Fallback if no specific perms stored yet
                }
            })
            .catch(() => setStatus('unauthenticated'))
    }, [reqPerm, location.pathname])

    if (status === 'loading') {
        return <div className="h-screen w-full flex items-center justify-center bg-slate-50"><div className="text-slate-400 animate-pulse">Загрузка...</div></div>
    }

    if (status === 'unauthenticated') {
        return <Navigate to="/" replace />
    }

    if (status === 'unauthorized') {
        return (
            <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-50">
                <div className="text-center p-8 bg-white rounded-xl shadow-sm border border-slate-200">
                    <h2 className="text-2xl font-bold text-slate-800">Доступ запрещен</h2>
                    <p className="text-slate-500 mt-2">У вас нет прав для просмотра этой страницы</p>
                    <div className="mt-6">
                        <Navigate to="/" replace={true} />
                        {/* the navigate above would just send to login, which could cause a loop. Let's just render the prompt. */}
                    </div>
                </div>
            </div>
        )
    }

    return <Outlet />
}
