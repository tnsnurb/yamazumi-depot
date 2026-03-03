import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface TrackOccupancyProps {
    trackOccupancy: Record<string, number> | undefined
}

export function TrackOccupancy({ trackOccupancy }: TrackOccupancyProps) {
    if (!trackOccupancy) return null

    return (
        <Card className="border-none shadow-none bg-transparent">
            <CardHeader className="px-0">
                <CardTitle className="text-lg">Загруженность путей</CardTitle>
            </CardHeader>
            <CardContent className="px-0">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
                    {[1, 2, 3, 4, 5, 6].map(track => {
                        const count = trackOccupancy[track] || 0
                        const maxSlots = 6
                        const percent = Math.round((count / maxSlots) * 100)
                        return (
                            <div key={track} className="text-center space-y-2 p-4 rounded-xl bg-muted/40 border-none">
                                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Путь {track}</div>
                                <div className={`text-2xl font-bold ${percent === 100 ? 'text-destructive' : percent > 50 ? 'text-warning' : 'text-primary'}`}>{count}/{maxSlots}</div>
                                <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden">
                                    <div
                                        className={`h-full transition-all ${percent === 100 ? 'bg-destructive' : percent > 50 ? 'bg-warning' : 'bg-primary'} transition-all`}
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
