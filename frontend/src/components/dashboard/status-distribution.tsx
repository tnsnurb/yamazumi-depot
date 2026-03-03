import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface StatusDistributionProps {
    statusCounts: { active: number; repair: number; waiting: number; completed: number } | undefined
    onTracks: number
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

export function StatusDistribution({ statusCounts, onTracks }: StatusDistributionProps) {
    if (!statusCounts) return null

    return (
        <Card className="border-none shadow-none bg-transparent">
            <CardHeader className="px-0">
                <CardTitle className="text-lg">Распределение по статусам</CardTitle>
            </CardHeader>
            <CardContent className="px-0">
                <div className="space-y-4">
                    {Object.entries(statusLabels).map(([key, label]) => {
                        const count = (statusCounts as any)[key] || 0
                        const percent = onTracks > 0 ? Math.round((count / onTracks) * 100) : 0
                        return (
                            <div key={key} className="space-y-1.5">
                                <div className="flex justify-between text-sm">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-3 h-3 rounded-full ${statusColors[key]}`} />
                                        <span className="text-muted-foreground font-medium">{label}</span>
                                    </div>
                                    <span className="font-mono font-medium">{count}</span>
                                </div>
                                <div className="w-full bg-secondary rounded-full h-1.5">
                                    <div
                                        className={`h-1.5 rounded-full ${statusColors[key]} transition-all`}
                                        style={{ width: `${percent}%` }}
                                    />
                                </div>
                            </div>
                        )
                    })}
                </div>
            </CardContent>
        </Card>
    )
}
