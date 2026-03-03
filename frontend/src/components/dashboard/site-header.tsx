"use client"

import { useEffect, useState } from "react"
import { Search, Building2 } from "lucide-react"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { Input } from "@/components/ui/input"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export function SiteHeader() {
    const [user, setUser] = useState<any>(null)
    const [locations, setLocations] = useState<{ id: number; name: string }[]>([])
    const [activeLocation, setActiveLocation] = useState<string>("")

    useEffect(() => {
        fetch('/api/me').then(res => res.json()).then(data => {
            if (data.authenticated) {
                setUser(data.user)
                if (data.user.active_location_id) {
                    setActiveLocation(String(data.user.active_location_id))
                } else if (data.user.is_global_admin) {
                    setActiveLocation("all")
                }
                if (data.user.role === 'admin' || data.user.is_global_admin) {
                    fetch('/api/locations').then(r => r.json()).then(setLocations)
                }
            }
        })
    }, [])

    const handleLocationChange = async (val: string) => {
        setActiveLocation(val)
        await fetch('/api/me/active-location', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ location_id: val === 'all' ? null : parseInt(val) })
        })
        window.location.reload()
    }

    return (
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4 sticky top-0 bg-background z-10">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <Breadcrumb className="hidden md:flex">
                <BreadcrumbList>
                    <BreadcrumbItem>
                        <BreadcrumbLink href="/">Yamazumi</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbPage>Дашборд</BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>
            <div className="ml-auto flex items-center gap-4">
                {user?.role === 'admin' && locations.length > 0 && (
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
                <div className="relative hidden lg:block">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder="Поиск..."
                        className="w-[200px] pl-8 h-8 rounded-lg bg-muted border-none"
                    />
                </div>
            </div>
        </header>
    )
}
