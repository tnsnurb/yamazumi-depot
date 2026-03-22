import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"

/**
 * Custom hook to synchronize locomotives data in real-time using Supabase.
 * Automatically invalidates the 'locomotives' query when changes occur in the database.
 * 
 * @param activeLocationId - The ID of the currently active location to filter sync events if needed (optional but recommended for scoping).
 */
export function useLocomotivesSync(activeLocationId?: number | string | null) {
    const queryClient = useQueryClient()

    useEffect(() => {
        if (!activeLocationId) return

        const channel = supabase
            .channel('public:locomotives')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'locomotives' },
                () => {
                    // Robust real-time sync: invalidate the list to fetch fresh data
                    queryClient.invalidateQueries({ queryKey: ['locomotives'] })
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [activeLocationId, queryClient])
}
