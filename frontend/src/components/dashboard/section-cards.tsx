import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrainFront, MapPin, Activity, Wrench } from "lucide-react"

interface SectionCardsProps {
    data: {
        totalLocomotives: number
        onTracks: number
        totalSlots: number
        movementsToday: number
        movementsWeek: number
    } | null
    chartData: {
        avgRepairDays: number | null
        totalRepairs: number
    } | null
}

export function SectionCards({ data, chartData }: SectionCardsProps) {
    if (!data) return null

    const occupancyPercent = data.totalSlots > 0 ? Math.round((data.onTracks / data.totalSlots) * 100) : 0

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 px-4 lg:px-6">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Всего локомотивов</CardTitle>
                    <TrainFront className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{data.totalLocomotives}</div>
                    <p className="text-xs text-muted-foreground">
                        {data.onTracks} сейчас на путях
                    </p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Загруженность</CardTitle>
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{occupancyPercent}%</div>
                    <p className="text-xs text-muted-foreground">
                        {data.onTracks} из {data.totalSlots} мест занято
                    </p>
                    <div className="mt-2 h-1 w-full bg-secondary rounded-full overflow-hidden">
                        <div
                            className={`h-full transition-all ${occupancyPercent > 80 ? 'bg-destructive' : 'bg-primary'}`}
                            style={{ width: `${occupancyPercent}%` }}
                        />
                    </div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Перемещения сегодня</CardTitle>
                    <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{data.movementsToday}</div>
                    <p className="text-xs text-muted-foreground">
                        {data.movementsWeek} за последнюю неделю
                    </p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Ср. время ремонта</CardTitle>
                    <Wrench className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">
                        {chartData?.avgRepairDays !== null ? `${chartData?.avgRepairDays} дн.` : "—"}
                    </div>
                    <p className="text-xs text-muted-foreground">
                        {chartData?.totalRepairs || 0} завершенных ремонтов
                    </p>
                </CardContent>
            </Card>
        </div>
    )
}
