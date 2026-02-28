import { useEffect, useState } from "react"
import { Header } from "@/components/common/Header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { TrainFront, MapPin, Activity, Wrench, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"

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

const statusLabels: Record<string, string> = {
    active: 'Активный',
    repair: 'Ремонт',
    waiting: 'Ожидание',
    completed: 'Завершён',
}

const statusColors: Record<string, string> = {
    active: 'bg-green-500',
    repair: 'bg-red-500',
    waiting: 'bg-yellow-500',
    completed: 'bg-blue-500',
}

export default function Dashboard() {
    const [data, setData] = useState<DashboardData | null>(null)
    const [chartData, setChartData] = useState<ChartData | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        loadAllData()
    }, [])

    const loadAllData = async () => {
        setIsLoading(true)
        await Promise.all([fetchData(), fetchChart()])
        setIsLoading(false)
    }

    const fetchData = async () => {
        try {
            const res = await fetch("/api/dashboard")
            if (res.ok) setData(await res.json())
        } catch (e) {
            toast.error("Ошибка загрузки статистики")
        }
    }

    const fetchChart = async () => {
        try {
            const res = await fetch("/api/dashboard/chart")
            if (res.ok) setChartData(await res.json())
        } catch (e) { /* silent */ }
    }

    const occupancyPercent = data && data.totalSlots > 0 ? Math.round((data.onTracks / data.totalSlots) * 100) : 0

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            <Header />

            <main className="flex-1 p-4 md:p-6 flex flex-col items-center">
                <div className="w-full max-w-6xl">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                        <h2 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900">Дашборд</h2>
                        <Button variant="outline" onClick={loadAllData} className="gap-2 w-full sm:w-auto justify-center" disabled={isLoading}>
                            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} /> Обновить
                        </Button>
                    </div>

                    {isLoading ? (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                {Array.from({ length: 4 }).map((_, i) => (
                                    <Card key={i}>
                                        <CardHeader className="pb-2"><Skeleton className="h-4 w-24" /></CardHeader>
                                        <CardContent>
                                            <Skeleton className="h-8 w-16 mb-2" />
                                            <Skeleton className="h-3 w-32" />
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                <Card className="lg:col-span-2">
                                    <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
                                    <CardContent><Skeleton className="h-48 w-full" /></CardContent>
                                </Card>
                                <Card>
                                    <CardHeader><Skeleton className="h-6 w-32" /></CardHeader>
                                    <CardContent className="space-y-4">
                                        {Array.from({ length: 4 }).map((_, i) => (
                                            <div key={i} className="space-y-1.5">
                                                <div className="flex justify-between"><Skeleton className="h-4 w-20" /><Skeleton className="h-4 w-6" /></div>
                                                <Skeleton className="h-2 w-full rounded-full" />
                                            </div>
                                        ))}
                                    </CardContent>
                                </Card>
                            </div>
                            <Card>
                                <CardHeader><Skeleton className="h-6 w-40" /></CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                                        {Array.from({ length: 6 }).map((_, i) => (
                                            <div key={i} className="p-4 rounded-lg bg-slate-50 border space-y-2">
                                                <Skeleton className="h-4 w-12 mx-auto" />
                                                <Skeleton className="h-8 w-16 mx-auto" />
                                                <Skeleton className="h-2.5 w-full rounded-full" />
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    ) : data ? (
                        <div className="space-y-6">
                            {/* Top Cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                <Card className="shadow-sm">
                                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                                        <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">Всего локомотивов</CardTitle>
                                        <TrainFront className="h-4 w-4 text-slate-400" />
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-3xl font-bold text-slate-900 tracking-tight">{data.totalLocomotives}</div>
                                        <p className="text-xs text-slate-500 mt-1">{data.onTracks} на путях</p>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                                        <CardTitle className="text-sm font-medium text-slate-500">Загруженность</CardTitle>
                                        <MapPin className="h-4 w-4 text-slate-400" />
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-3xl font-bold text-slate-900">{occupancyPercent}%</div>
                                        <div className="mt-2 w-full bg-slate-100 rounded-full h-2.5">
                                            <div
                                                className={`h-2.5 rounded-full transition-all ${occupancyPercent > 80 ? 'bg-red-500' : occupancyPercent > 50 ? 'bg-amber-500' : 'bg-green-500'}`}
                                                style={{ width: `${occupancyPercent}%` }}
                                            />
                                        </div>
                                        <p className="text-xs text-slate-500 mt-1">{data.onTracks}/{data.totalSlots} слотов занято</p>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                                        <CardTitle className="text-sm font-medium text-slate-500">Перемещения сегодня</CardTitle>
                                        <Activity className="h-4 w-4 text-slate-400" />
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-3xl font-bold text-slate-900">{data.movementsToday}</div>
                                        <p className="text-xs text-slate-500 mt-1">{data.movementsWeek} за неделю</p>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                                        <CardTitle className="text-sm font-medium text-slate-500">Ср. время ремонта</CardTitle>
                                        <Wrench className="h-4 w-4 text-slate-400" />
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-3xl font-bold text-slate-900">
                                            {chartData?.avgRepairDays !== null && chartData?.avgRepairDays !== undefined ? `${chartData.avgRepairDays} дн.` : '—'}
                                        </div>
                                        <p className="text-xs text-slate-500 mt-1">
                                            {chartData?.totalRepairs ? `${chartData.totalRepairs} завершённых ремонтов` : 'Нет данных'}
                                        </p>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Chart + Status */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {/* Movements Chart */}
                                <Card className="lg:col-span-2">
                                    <CardHeader>
                                        <CardTitle className="text-lg">Динамика перемещений (30 дней)</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        {chartData && (
                                            <div className="h-48 w-full mt-4 text-xs">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <BarChart data={chartData.chart} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                                                        <XAxis dataKey="label" tickLine={false} axisLine={false} tickFormatter={(value, index) => index % 5 === 0 ? value : ''} />
                                                        <YAxis tickLine={false} axisLine={false} />
                                                        <Tooltip
                                                            cursor={{ fill: 'rgba(241, 245, 249, 0.4)' }}
                                                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                                            labelStyle={{ fontWeight: 'bold', color: '#0f172a', marginBottom: '4px' }}
                                                        />
                                                        <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} name="Перемещений" />
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>

                                {/* Status Distribution */}
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-lg">По статусам</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-4">
                                            {Object.entries(statusLabels).map(([key, label]) => {
                                                const count = data.statusCounts[key as keyof typeof data.statusCounts] || 0
                                                const percent = data.onTracks > 0 ? Math.round((count / data.onTracks) * 100) : 0
                                                return (
                                                    <div key={key} className="space-y-1.5">
                                                        <div className="flex justify-between text-sm">
                                                            <div className="flex items-center gap-2">
                                                                <div className={`w-3 h-3 rounded-full ${statusColors[key]}`} />
                                                                <span className="text-slate-700 font-medium">{label}</span>
                                                            </div>
                                                            <span className="text-slate-500 font-mono">{count}</span>
                                                        </div>
                                                        <div className="w-full bg-slate-100 rounded-full h-2">
                                                            <div
                                                                className={`h-2 rounded-full ${statusColors[key]} transition-all`}
                                                                style={{ width: `${percent}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Track Occupancy */}
                            <Card className="shadow-sm">
                                <CardHeader>
                                    <CardTitle className="text-lg">Загруженность путей</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
                                        {[1, 2, 3, 4, 5, 6].map(track => {
                                            const count = data.trackOccupancy[track] || 0
                                            const maxSlots = 6
                                            const percent = Math.round((count / maxSlots) * 100)
                                            return (
                                                <div key={track} className="text-center space-y-2 p-4 rounded-lg bg-slate-50 border">
                                                    <div className="text-sm font-medium text-slate-600">Путь {track}</div>
                                                    <div className={`text-2xl font-bold ${percent === 100 ? 'text-red-600' : percent > 50 ? 'text-amber-600' : 'text-green-600'}`}>{count}/{maxSlots}</div>
                                                    <div className="w-full bg-slate-200 rounded-full h-2.5">
                                                        <div
                                                            className={`h-2.5 rounded-full transition-all ${percent === 100 ? 'bg-red-500' : percent > 50 ? 'bg-indigo-500' : 'bg-indigo-400'}`}
                                                            style={{ width: `${percent}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    ) : null}
                </div>
            </main>
        </div>
    )
}
