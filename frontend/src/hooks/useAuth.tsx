import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"

interface User {
    id: number
    username: string
    full_name: string
    role: string
    avatar_url?: string
    is_global_admin?: boolean
    active_location_id?: number | null
}

export function useAuth() {
    const [user, setUser] = useState<User | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const navigate = useNavigate()

    useEffect(() => {
        fetch('/api/me')
            .then(res => res.json())
            .then(data => {
                if (data.authenticated) {
                    setUser(data.user)
                } else {
                    setUser(null)
                    navigate('/')
                }
            })
            .catch(() => setUser(null))
            .finally(() => setIsLoading(false))
    }, [navigate])

    const signOut = async () => {
        await fetch('/api/logout', { method: 'POST' })
        setUser(null)
        navigate('/')
    }

    return { user, isLoading, signOut }
}
