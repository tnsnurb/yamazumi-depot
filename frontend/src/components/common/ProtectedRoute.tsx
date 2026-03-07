import { Navigate, Outlet } from "react-router-dom"
import { useAuth } from "@/hooks/useAuth"

interface ProtectedRouteProps {
    reqPerm?: string
}

export function ProtectedRoute({ reqPerm }: ProtectedRouteProps) {
    const { user, isLoading } = useAuth()

    if (isLoading) {
        return <div className="h-screen w-full flex items-center justify-center bg-slate-50"><div className="text-slate-400 animate-pulse">Загрузка...</div></div>
    }

    if (!user) {
        return <Navigate to="/" replace />
    }

    if (user.role === 'admin') {
        return <Outlet />
    }

    if (reqPerm) {
        if (user.permissions && user.permissions[reqPerm] === false) {
            return (
                <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-50">
                    <div className="text-center p-8 bg-white rounded-xl shadow-sm border border-slate-200">
                        <h2 className="text-2xl font-bold text-slate-800">Доступ запрещен</h2>
                        <p className="text-slate-500 mt-2">У вас нет прав для просмотра этой страницы</p>
                    </div>
                </div>
            )
        }
    }

    return <Outlet />
}
