import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrainFront, MapPin, Activity, Wrench } from "lucide-react"

interface SectionCardsProps {
    data: {
        totalLocomotives: number
        onTracks: number
        totalSlots: number
        movementsToday: number
        movementsWeek: number
        overdueRepairs: number
        overdueGauges: number // Added
    } | null
}

export function SectionCards({ data }: SectionCardsProps) {
    if (!data) return null

    const occupancyPercent = data.totalSlots > 0 ? Math.round((data.onTracks / data.totalSlots) * 100) : 0

    const cardClass = "border-none bg-white/50 backdrop-blur-sm rounded-3xl shadow-sm hover:shadow-md transition-all duration-300 hover:scale-[1.02]"

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5 px-4 lg:px-6">
            <Card className={cardClass}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-semibold text-slate-600">Всего локомотивов</CardTitle>
                    <TrainFront className="h-4 w-4 text-indigo-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-3xl font-bold text-slate-900">{data.totalLocomotives}</div>
                    <p className="text-xs text-slate-400 mt-1">
                        <span className="font-bold text-slate-600">{data.onTracks}</span> сейчас на путях
                    </p>
                </CardContent>
            </Card>

            <Card className={cardClass}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-semibold text-slate-600">Загруженность</CardTitle>
                    <MapPin className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-3xl font-bold text-slate-900">{occupancyPercent}%</div>
                    <p className="text-xs text-slate-400 mt-1">
                        {data.onTracks} из {data.totalSlots} мест занято
                    </p>
                    <div className="mt-3 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                            className={`h-full transition-all duration-500 ${occupancyPercent > 80 ? 'bg-rose-500' : 'bg-blue-500'}`}
                            style={{ width: `${occupancyPercent}%` }}
                        />
                    </div>
                </CardContent>
            </Card>

            <Card className={cardClass}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-semibold text-slate-600">Перемещения сегодня</CardTitle>
                    <Activity className="h-4 w-4 text-emerald-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-3xl font-bold text-slate-900">{data.movementsToday}</div>
                    <p className="text-xs text-slate-400 mt-1">
                        <span className="font-bold text-emerald-600">{data.movementsWeek}</span> за неделю
                    </p>
                </CardContent>
            </Card>

            <Card className={cardClass}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-semibold text-slate-600">Просрочено ремонта</CardTitle>
                    <Activity className="h-4 w-4 text-rose-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-3xl font-bold text-slate-900">
                        {data.overdueRepairs || 0}
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                        Более 3 дней в депо
                    </p>
                </CardContent>
            </Card>

            <Card className={cardClass}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-semibold text-slate-600">Метрология</CardTitle>
                    <Wrench className={`h-4 w-4 ${data.overdueGauges > 0 ? 'text-amber-500 animate-pulse' : 'text-slate-400'}`} />
                </CardHeader>
                <CardContent>
                    <div className="text-3xl font-bold text-slate-900">
                        {data.overdueGauges || 0}
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                        Требуют поверки (&lt;14 дн.)
                    </p>
                </CardContent>
            </Card>
        </div>
    )
}
