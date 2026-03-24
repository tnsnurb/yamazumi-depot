import { useEffect, useState } from "react"
import { Search, ChevronRight, Train, MessageSquare } from "lucide-react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import {
    Item,
    ItemGroup,
    ItemMedia,
    ItemContent,
    ItemTitle,
    ItemDescription,
    ItemActions
} from "@/components/ui/item"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Progress } from "@/components/ui/progress"

interface ActiveRemarkStat {
    total_remarks: number;
    completed_remarks: number;
    locomotive: {
        id: number;
        number: string;
        series: string;
    };
}

export default function ActiveRemarks() {
    const [stats, setStats] = useState<ActiveRemarkStat[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState("")

    useEffect(() => {
        fetchActiveRemarks()
    }, [])

    const fetchActiveRemarks = async () => {
        try {
            setIsLoading(true)
            const res = await fetch('/api/remarks/active')
            if (res.ok) {
                const data = await res.json()
                setStats(data)
            }
        } catch (e) {
            toast.error("Ошибка загрузки замечаний")
        } finally {
            setIsLoading(false)
        }
    }

    const filtered = stats.filter(s =>
        s.locomotive.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.locomotive.series.toLowerCase().includes(searchQuery.toLowerCase())
    )

    return (
        <div className="flex-1 flex flex-col items-center overflow-auto bg-slate-50/50">
            <main className="flex-1 w-full p-4 md:p-6 flex flex-col">
                <div className="max-w-7xl w-full mx-auto">
                    <div className="mb-6 md:mb-10 flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-8">
                        <div>
                            <h1 className="text-xl md:text-2xl font-semibold text-slate-900 tracking-tight">
                                Активные замечания
                            </h1>
                            <p className="text-slate-500 text-[11px] md:text-sm mt-1 font-medium">Прогресс устранения неисправностей</p>
                        </div>

                        <div className="relative w-full md:max-w-md">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-slate-400" />
                            <input
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Поиск по номеру или серии..."
                                className="w-full pl-11 pr-4 h-12 md:h-11 bg-white rounded-xl border border-slate-200 shadow-sm text-sm md:text-base focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all focus:shadow-md"
                            />
                        </div>
                    </div>

                    {isLoading ? (
                        <ItemGroup className="space-y-4">
                            {Array(3).fill(0).map((_, i) => (
                                <Item key={i} variant="outline" size="default" className="bg-white border-slate-200 shadow-sm px-4 py-4">
                                    <Skeleton className="size-14 rounded-2xl shrink-0 bg-slate-200" />
                                    <ItemContent className="space-y-3">
                                        <Skeleton className="h-5 w-48 bg-slate-200" />
                                        <Skeleton className="h-4 w-64 bg-slate-100" />
                                        <Skeleton className="h-2 w-full bg-slate-100" />
                                    </ItemContent>
                                    <ItemActions>
                                        <Skeleton className="w-10 h-10 rounded-full bg-slate-100" />
                                    </ItemActions>
                                </Item>
                            ))}
                        </ItemGroup>
                    ) : filtered.length === 0 ? (
                        <div className="text-center py-24 bg-white rounded-[2rem] border border-dashed border-slate-300 max-w-2xl mx-auto shadow-sm">
                            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                                <MessageSquare className="w-10 h-10 text-slate-300" />
                            </div>
                            <h3 className="text-xl font-semibold text-slate-900 mb-2">Активных замечаний нет</h3>
                            <p className="text-slate-500 font-medium">Для выбранного депо не зафиксировано активных неисправностей.</p>
                        </div>
                    ) : (
                        <ItemGroup className="space-y-4">
                            {filtered.map(s => {
                                const progress = s.total_remarks > 0 ? (s.completed_remarks / s.total_remarks) * 100 : 0;
                                return (
                                    <Item key={s.locomotive.id} variant="outline" size="default" asChild className="bg-white border-slate-200 shadow-sm hover:border-blue-400 hover:bg-slate-50/50 transition-all cursor-pointer group px-4 py-4 rounded-2xl">
                                        <Link to={`/locomotive/${s.locomotive.id}/remarks`}>
                                            <ItemMedia variant="icon" className="size-14 bg-slate-900 text-white rounded-2xl text-xl font-semibold group-hover:bg-blue-600 transition-colors shrink-0 shadow-lg shadow-slate-200">
                                                <Train className="w-7 h-7" />
                                            </ItemMedia>
                                            <ItemContent className="gap-0">
                                                <div className="flex items-center gap-3 mb-1">
                                                    <ItemTitle className="text-lg text-slate-900 font-semibold tracking-tight">
                                                        {s.locomotive.series} {s.locomotive.number}
                                                    </ItemTitle>
                                                    <Badge className={`${progress === 100 ? 'bg-emerald-500' : 'bg-blue-500'} text-white border-none text-[10px] font-semibold uppercase py-0 px-2 h-5 tracking-wider`}>
                                                        В ремонте
                                                    </Badge>
                                                </div>
                                                <ItemDescription className="text-slate-500 font-semibold text-xs uppercase tracking-wide mb-3">
                                                    Ремонтная позиция
                                                </ItemDescription>

                                                <div className="space-y-1.5">
                                                    <div className="flex justify-between text-[11px] font-semibold uppercase tracking-wider">
                                                        <span className="text-slate-400">Прогресс устранения</span>
                                                        <span className="text-blue-600">{s.completed_remarks} / {s.total_remarks} ({Math.round(progress)}%)</span>
                                                    </div>
                                                    <Progress value={progress} className="h-2 bg-slate-100" indicatorClassName={progress === 100 ? "bg-emerald-500" : "bg-blue-600"} />
                                                </div>
                                            </ItemContent>
                                            <ItemActions>
                                                <div className="w-11 h-11 flex items-center justify-center rounded-full bg-slate-100 text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">
                                                    <ChevronRight className="w-6 h-6" />
                                                </div>
                                            </ItemActions>
                                        </Link>
                                    </Item>
                                );
                            })}
                        </ItemGroup>
                    )}
                </div>
            </main>
        </div>
    )
}
