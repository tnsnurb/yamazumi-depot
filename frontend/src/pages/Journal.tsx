import { useEffect, useState } from "react"
import { useDebounce } from "@/hooks/useDebounce"
import { Link } from "react-router-dom"
import { Search, ChevronRight, Train, History, MapPin, RefreshCw } from "lucide-react"
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
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { useAuth } from "@/hooks/useAuth"

const statusColors = {
    active: 'bg-green-500',
    repair: 'bg-red-500',
    waiting: 'bg-amber-500',
    completed: 'bg-blue-500',
};

const statusLabels: Record<string, string> = {
    active: 'Активный',
    repair: 'Ремонт',
    waiting: 'Ожидание',
    completed: 'Завершён',
};

interface LocomotiveDirectoryItem {
    id: number;
    number: string;
    series: string | null;
    status: string | null;
    track: number | null;
    position: number | null;
    is_on_map: boolean;
}

export default function Journal() {
    const { user } = useAuth()
    const [filterQuery, setFilterQuery] = useState("")
    const [locos, setLocos] = useState<LocomotiveDirectoryItem[]>([])
    const [isLoading, setIsLoading] = useState(false)

    useEffect(() => {
        fetchLocomotives()
    }, [user?.active_location_id])

    const fetchLocomotives = async () => {
        try {
            setIsLoading(true)
            const res = await fetch('/api/movements/locomotives')
            if (res.ok) {
                const data = await res.json()
                setLocos(data)
            }
        } catch (e) {
            toast.error("Ошибка загрузки локомотивов")
        } finally {
            setIsLoading(false)
        }
    }

    const debouncedFilterQuery = useDebounce(filterQuery, 300)

    const filtered = locos.filter(l =>
        l.number.toLowerCase().includes(debouncedFilterQuery.toLowerCase()) ||
        (l.series?.toLowerCase() || "").includes(debouncedFilterQuery.toLowerCase())
    )

    return (
        <div className="flex-1 flex flex-col items-center overflow-auto bg-slate-50/50">
            <main className="flex-1 w-full p-4 md:p-6 flex flex-col">
                <div className="max-w-7xl w-full mx-auto">
                    <div className="mb-6 md:mb-10 flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-8">
                        <div>
                            <h1 className="text-xl md:text-2xl font-black text-slate-900 border-l-4 border-indigo-600 pl-4 tracking-tight uppercase flex items-center gap-2">
                                <History className="w-5 h-5 md:w-6 md:h-6 text-indigo-600" />
                                Журнал локомотивов
                            </h1>
                            <p className="text-slate-500 text-[11px] md:text-sm mt-1 font-medium">Список всех локомотивов и их текущее состояние</p>
                        </div>

                        <div className="flex items-center gap-2 w-full md:max-w-md">
                            <div className="relative flex-1">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-slate-400" />
                                <input
                                    value={filterQuery}
                                    onChange={(e) => setFilterQuery(e.target.value)}
                                    placeholder="Поиск по номеру или серии..."
                                    className="w-full pl-11 pr-4 h-12 md:h-11 bg-white rounded-xl border border-slate-200 shadow-sm text-sm md:text-base focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all focus:shadow-md"
                                />
                            </div>
                            <button
                                onClick={fetchLocomotives}
                                className="h-12 md:h-11 px-3 md:px-4 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 transition-colors shadow-sm"
                                title="Обновить"
                            >
                                <RefreshCw className={cn("w-5 h-5", isLoading && "animate-spin")} />
                            </button>
                        </div>
                    </div>

                    {isLoading && filtered.length === 0 ? (
                        <div className="space-y-4">
                            {/* Mobile Skeleton */}
                            <div className="md:hidden space-y-4">
                                {Array(4).fill(0).map((_, i) => (
                                    <Item key={i} variant="outline" size="default" className="bg-white border-slate-200 shadow-sm px-4 py-4 rounded-2xl">
                                        <Skeleton className="size-14 rounded-2xl shrink-0 bg-slate-200" />
                                        <ItemContent className="space-y-3">
                                            <Skeleton className="h-5 w-48 bg-slate-200" />
                                            <Skeleton className="h-4 w-64 bg-slate-100" />
                                        </ItemContent>
                                    </Item>
                                ))}
                            </div>
                            {/* Desktop Skeleton */}
                            <div className="hidden md:block bg-white rounded-2xl border border-slate-200 overflow-hidden">
                                <div className="p-4 border-b border-slate-100 flex gap-4">
                                    {Array(5).fill(0).map((_, i) => (
                                        <Skeleton key={i} className="h-6 flex-1 bg-slate-100" />
                                    ))}
                                </div>
                                {Array(5).fill(0).map((_, i) => (
                                    <div key={i} className="p-4 flex gap-4 border-b border-slate-50 last:border-0">
                                        {Array(5).fill(0).map((_, j) => (
                                            <Skeleton key={j} className="h-8 flex-1 bg-slate-50" />
                                        ))}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="text-center py-24 bg-white rounded-[2rem] border border-dashed border-slate-300 max-w-2xl mx-auto shadow-sm">
                            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                                <Train className="w-10 h-10 text-slate-300" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-2">Локомотивы не найдены</h3>
                            <p className="text-slate-500 font-medium">Попробуйте изменить параметры поиска или обновить страницу.</p>
                        </div>
                    ) : (
                        <>
                            {/* Mobile View: Cards */}
                            <ItemGroup className="space-y-4 md:hidden">
                                {filtered.map(loco => (
                                    <Item key={loco.id} variant="outline" size="default" asChild className="bg-white border-slate-200 shadow-sm hover:border-indigo-400 hover:bg-slate-50/50 transition-all cursor-pointer group px-4 py-4 rounded-2xl">
                                        <Link to={`/history/${encodeURIComponent(loco.number)}`}>
                                            <ItemMedia variant="icon" className="size-14 bg-slate-900 text-white rounded-2xl text-xl font-bold group-hover:bg-indigo-600 transition-colors shrink-0 shadow-lg shadow-slate-200">
                                                <Train className="w-7 h-7" />
                                            </ItemMedia>
                                            <ItemContent className="gap-0">
                                                <div className="flex items-center gap-3 mb-1">
                                                    <ItemTitle className="text-lg text-slate-900 font-bold tracking-tight">
                                                        {loco.series} {loco.number}
                                                    </ItemTitle>
                                                    {loco.status && (
                                                        <Badge className={cn("text-white border-none text-[10px] font-black uppercase py-0 px-2 h-5 tracking-wider", statusColors[loco.status as keyof typeof statusColors] || 'bg-slate-500')}>
                                                            {statusLabels[loco.status] || loco.status}
                                                        </Badge>
                                                    )}
                                                </div>
                                                <ItemDescription className="text-slate-500 font-bold text-xs uppercase tracking-wide flex items-center gap-2">
                                                    {loco.is_on_map ? (
                                                        <span className="flex items-center gap-1.5 text-emerald-600">
                                                            <MapPin className="w-3.5 h-3.5" /> Путь {loco.track}, Слот {loco.position}
                                                        </span>
                                                    ) : (
                                                        <span className="flex items-center gap-1.5 opacity-60 italic">
                                                            <MapPin className="w-3.5 h-3.5" /> Нет на карте
                                                        </span>
                                                    )}
                                                </ItemDescription>
                                            </ItemContent>
                                            <ItemActions>
                                                <div className="w-11 h-11 flex items-center justify-center rounded-full bg-slate-100 text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm">
                                                    <ChevronRight className="w-6 h-6" />
                                                </div>
                                            </ItemActions>
                                        </Link>
                                    </Item>
                                ))}
                            </ItemGroup>

                            {/* Desktop View: Table */}
                            <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                <Table>
                                    <TableHeader className="bg-slate-50/50">
                                        <TableRow className="hover:bg-transparent border-slate-100">
                                            <TableHead className="w-[100px] font-bold text-slate-900 uppercase text-[11px] tracking-wider pl-6">ID</TableHead>
                                            <TableHead className="font-bold text-slate-900 uppercase text-[11px] tracking-wider">Локомотив</TableHead>
                                            <TableHead className="font-bold text-slate-900 uppercase text-[11px] tracking-wider">Статус</TableHead>
                                            <TableHead className="font-bold text-slate-900 uppercase text-[11px] tracking-wider">Местоположение</TableHead>
                                            <TableHead className="text-right pr-6 font-bold text-slate-900 uppercase text-[11px] tracking-wider">Действия</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filtered.map((loco) => (
                                            <TableRow key={loco.id} className="group hover:bg-slate-50/50 transition-colors border-slate-100 last:border-0">
                                                <TableCell className="font-mono text-slate-400 text-xs pl-6">#{loco.id}</TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-900 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                                            <Train className="w-5 h-5" />
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-slate-900 tracking-tight">{loco.series} {loco.number}</div>
                                                            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Серийный номер</div>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {loco.status && (
                                                        <Badge className={cn("text-white border-none text-[10px] font-black uppercase py-0 px-2 h-5 tracking-wider", statusColors[loco.status as keyof typeof statusColors] || 'bg-slate-500')}>
                                                            {statusLabels[loco.status] || loco.status}
                                                        </Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {loco.is_on_map ? (
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                                                                <MapPin className="w-3.5 h-3.5" />
                                                            </div>
                                                            <span className="font-bold text-slate-700 text-sm">Путь {loco.track}, Слот {loco.position}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-400 italic text-sm font-medium">Нет на карте</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right pr-6">
                                                    <Link
                                                        to={`/history/${encodeURIComponent(loco.number)}`}
                                                        className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-indigo-600 hover:text-white text-slate-700 rounded-xl font-bold text-xs transition-all tracking-wide uppercase group/btn"
                                                    >
                                                        История
                                                        <ChevronRight className="w-4 h-4 group-hover/btn:translate-x-0.5 transition-transform" />
                                                    </Link>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </>
                    )}
                </div>
            </main>
        </div>
    )
}
