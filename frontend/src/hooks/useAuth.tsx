import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"

export interface User {
    id: number
    username: string
    full_name: string
    role: string
    avatar_url?: string
    is_global_admin?: boolean
    active_location_id?: number | null
    specialization?: string
    permissions?: Record<string, boolean>
}

export function useAuth() {
    const navigate = useNavigate()
    const queryClient = useQueryClient()

    const { data: user, isLoading } = useQuery({
        queryKey: ['authUser'],
        queryFn: async () => {
            const res = await fetch('/api/me')
            const data = await res.json()
            if (!data.authenticated) {
                return null
            }
            return data.user as User
        },
        staleTime: 5 * 60 * 1000, // 5 minutes cache
    })

    const signOut = async () => {
        try {
            const { supabase } = await import("@/lib/supabase")
            await supabase.auth.signOut()
        } catch (e) {
            console.error("Supabase signOut error", e)
        }
        await fetch('/api/logout', { method: 'POST' })
        queryClient.setQueryData(['authUser'], null)
        navigate('/')
    }

    // If query returns undefined (still loading or unauthenticated) we return null for user
    return { user: user || null, isLoading, signOut }
}
