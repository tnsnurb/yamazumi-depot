"use client"

import { useEffect, useState, useMemo } from "react"
import { useLocation } from "react-router-dom"
import { useQueryClient } from "@tanstack/react-query"
import { Building2 } from "lucide-react"
import { NotificationBell } from "@/components/dashboard/notification-bell"
import { useAuth } from "@/hooks/useAuth"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const ROUTE_LABELS: Record<string, string> = {
    "/dashboard": "Дашборд",
    "/map": "Карта",
    "/journal": "Журнал",
    "/admin": "Администрирование",
    "/profile": "Профиль",
    "/remarks": "Замечания",
    "/checklists": "Чек-листы",
    "/active-locomotives": "Локомотивы",
    "/gauges": "Метрология",
    "/gauges/terminal": "Терминал метрологии",
    "/global-history": "История",
}

function getPageLabel(pathname: string): string {
    // Exact match first
    if (ROUTE_LABELS[pathname]) return ROUTE_LABELS[pathname]
    // Dynamic routes
    if (pathname.match(/^\/locomotive\/\d+\/checklist$/)) return "Чек-лист"
    if (pathname.match(/^\/locomotive\/\d+\/remarks$/)) return "Замечания"
    if (pathname.match(/^\/history\/session\/\d+\/checklists$/)) return "История чек-листов"
    if (pathname.match(/^\/history\/session\/\d+\/remarks$/)) return "История замечаний"
    if (pathname.match(/^\/history\/.+$/)) return "История"
    return "Дашборд"
}

export function SiteHeader() {
    const { user: authUser } = useAuth()
    const queryClient = useQueryClient()
    const location = useLocation()
    const [user, setUser] = useState<any>(null)
    const [locations, setLocations] = useState<{ id: number; name: string }[]>([])
    const [activeLocation, setActiveLocation] = useState<string>("")

    const pageLabel = useMemo(() => getPageLabel(location.pathname), [location.pathname])

    useEffect(() => {
        if (authUser) {
            setUser(authUser)
            if (authUser.active_location_id) {
                setActiveLocation(String(authUser.active_location_id))
            } else if (authUser.is_global_admin) {
                setActiveLocation("all")
            }
            if (authUser.role === 'admin' || authUser.is_global_admin) {
                fetch('/api/locations')
                    .then(r => r.json())
                    .then(data => {
                        console.log("[DEBUG] Locations loaded:", data);
                        if (Array.isArray(data)) {
                            setLocations(data);
                        } else {
                            console.error("[DEBUG] Locations data is not an array:", data);
                        }
                    })
                    .catch(err => console.error("[DEBUG] Locations fetch error:", err));
            }
        }
    }, [authUser])

    const handleLocationChange = async (val: string) => {
        setActiveLocation(val)
        await fetch('/api/me/active-location', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ location_id: val === 'all' ? null : parseInt(val) })
        })

        // Use queryClient to update the session state without a full page reload
        await queryClient.invalidateQueries({ queryKey: ['authUser'] })

        // Specifically invalidate locomotives, dashboard and reports that depend on the active location
        queryClient.invalidateQueries({ queryKey: ['locomotives'] })
        queryClient.invalidateQueries({ queryKey: ['dashboard'] })
        queryClient.invalidateQueries({ queryKey: ['reports'] })
        queryClient.invalidateQueries({ queryKey: ['global-history'] })
        queryClient.invalidateQueries({ queryKey: ['movements-locomotives'] })
    }

    return (
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4 sticky top-0 bg-background z-10">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <Breadcrumb className="hidden md:flex font-medium">
                <BreadcrumbList>
                    <BreadcrumbItem>
                        <BreadcrumbLink href="/" className="text-slate-400 hover:text-slate-900 transition-colors">Yamazumi</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbPage className="text-slate-400">{pageLabel}</BreadcrumbPage>
                    </BreadcrumbItem>
                    <div id="breadcrumb-portal" className="flex items-center"></div>
                </BreadcrumbList>
            </Breadcrumb>
            <div className="ml-auto flex items-center gap-2">
                <NotificationBell />
                {(user?.role === 'admin' || user?.is_global_admin) && (
                    <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-muted-foreground" />
                        <Select value={activeLocation} onValueChange={handleLocationChange}>
                            <SelectTrigger className="h-8 w-[150px] lg:w-[200px] border-none shadow-none focus:ring-0">
                                <SelectValue placeholder="Депо" />
                            </SelectTrigger>
                            <SelectContent>
                                {user?.is_global_admin && (
                                    <SelectItem value="all" className="font-bold text-primary">Вся сеть</SelectItem>
                                )}
                                {locations.map(loc => (
                                    <SelectItem key={loc.id} value={String(loc.id)}>{loc.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}
            </div>
        </header>
    )
}
