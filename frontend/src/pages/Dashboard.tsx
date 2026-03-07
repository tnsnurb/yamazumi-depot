"use client"

import { useQuery } from "@tanstack/react-query"
import { SectionCards } from "@/components/dashboard/section-cards"
import { ChartAreaInteractive } from "@/components/dashboard/chart-area-interactive"
import { StatusDistribution } from "@/components/dashboard/status-distribution"
import { TrackOccupancy } from "@/components/dashboard/track-occupancy"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { useAuth } from "@/hooks/useAuth"

interface DashboardData {
    totalLocomotives: number
    onTracks: number
    totalSlots: number
    statusCounts: { active: number; repair: number; waiting: number; completed: number }
    trackOccupancy: Record<string, number>
    movementsToday: number
    movementsWeek: number
}

interface ChartData {
    chart: { date: string; label: string; count: number }[]
    avgRepairDays: number | null
    totalRepairs: number
}

export default function Dashboard() {
    const { user } = useAuth()
    const { data: dashboardData, isLoading } = useQuery({
        queryKey: ['dashboard', user?.active_location_id],
        queryFn: async () => {
            const [dataRes, chartRes] = await Promise.all([
                fetch("/api/dashboard"),
                fetch("/api/dashboard/chart")
            ])

            if (!dataRes.ok || !chartRes.ok) throw new Error("Ошибка загрузки данных")

            const data: DashboardData = await dataRes.json()
            const chartData: ChartData = await chartRes.json()

            return { data, chartData }
        }
    })

    const data = dashboardData?.data || null
    const chartData = dashboardData?.chartData || null

    return (
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0 md:gap-8 md:p-8 lg:p-12 overflow-y-auto bg-slate-50/50">
            <div className="flex flex-col gap-6">

                {isLoading ? (
                    <div className="space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 px-4 lg:px-6">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <Card key={i} className="border-none bg-white">
                                    <CardHeader className="pb-2"><Skeleton className="h-4 w-24" /></CardHeader>
                                    <CardContent><Skeleton className="h-8 w-16" /></CardContent>
                                </Card>
                            ))}
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            <div className="lg:col-span-2"><Skeleton className="h-[400px] w-full rounded-xl" /></div>
                            <div><Skeleton className="h-[400px] w-full rounded-xl" /></div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-12 pb-12">
                        <SectionCards data={data} chartData={chartData} />

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 px-4 lg:px-6">
                            <div className="lg:col-span-2">
                                <Card className="border-none bg-white/50 backdrop-blur-sm rounded-3xl overflow-hidden p-2">
                                    <ChartAreaInteractive data={chartData?.chart} />
                                </Card>
                            </div>
                            <div className="flex flex-col gap-8">
                                <Card className="border-none bg-white/50 backdrop-blur-sm rounded-3xl p-6">
                                    <StatusDistribution
                                        statusCounts={data?.statusCounts}
                                        onTracks={data?.onTracks || 0}
                                    />
                                </Card>
                            </div>
                        </div>

                        <div className="px-4 lg:px-6">
                            <Card className="border-none bg-white/50 backdrop-blur-sm rounded-3xl p-6">
                                <TrackOccupancy trackOccupancy={data?.trackOccupancy} />
                            </Card>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
