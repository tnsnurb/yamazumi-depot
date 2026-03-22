import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { formatDistanceToNow } from "date-fns"
import { ru } from "date-fns/locale"
import { Activity, ArrowRight, Plus, CheckCircle2, AlertCircle } from "lucide-react"

interface ActivityItem {
    id: string | number
    locomotive_number: string
    action: string
    moved_at: string
    moved_by: string
}

interface RecentActivityProps {
    activities: ActivityItem[]
}

export function RecentActivity({ activities }: RecentActivityProps) {
    const getActionIcon = (action: string) => {
        if (action.includes("add")) return <Plus className="h-4 w-4 text-emerald-500" />
        if (action.includes("remove")) return <ArrowRight className="h-4 w-4 text-blue-500" />
        if (action.includes("remark_added")) return <AlertCircle className="h-4 w-4 text-amber-500" />
        if (action.includes("verified") || action.includes("complete")) return <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        return <Activity className="h-4 w-4 text-slate-400" />
    }

    return (
        <Card className="h-full border-none bg-white/50 backdrop-blur-sm rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <CardTitle className="text-xl font-bold text-slate-800">Живая лента</CardTitle>
                <Activity className="h-5 w-5 text-indigo-500 animate-pulse" />
            </CardHeader>
            <CardContent>
                <ScrollArea className="h-[400px] pr-4">
                    <div className="space-y-6">
                        {activities.length === 0 ? (
                            <div className="text-center py-12 text-slate-400">
                                <p>Нет недавней активности</p>
                            </div>
                        ) : (
                            activities.map((item) => (
                                <div key={item.id} className="relative flex gap-4 pb-2 group">
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 group-hover:bg-indigo-50 transition-colors duration-300">
                                        {getActionIcon(item.action)}
                                    </div>
                                    <div className="flex flex-col gap-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="rounded-lg bg-indigo-50/50 text-indigo-700 border-indigo-100 shrink-0">
                                                {item.locomotive_number}
                                            </Badge>
                                            <span className="text-xs text-slate-400 whitespace-nowrap">
                                                {formatDistanceToNow(new Date(item.moved_at), { addSuffix: true, locale: ru })}
                                            </span>
                                        </div>
                                        <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed">
                                            <span className="font-semibold text-slate-800">{item.moved_by}</span>: {item.action}
                                        </p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    )
}
