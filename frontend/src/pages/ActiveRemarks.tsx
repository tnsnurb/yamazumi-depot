import { useEffect, useState } from "react"
import { Search, CheckCircle2, ChevronRight, MessageSquare, Train } from "lucide-react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { useAuth } from "@/hooks/useAuth"
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

interface Remark {
    id: string;
    text: string;
    priority: 'low' | 'medium' | 'high';
    category: string;
    is_completed: boolean;
    locomotive_id: string;
    locomotive: {
        number: string;
    };
    assigned_to: number | null;
}

interface GroupedRemarks {
    [locoNumber: string]: Remark[];
}

export default function ActiveRemarks() {
    const [remarks, setRemarks] = useState<Remark[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState("")
    const [filter, setFilter] = useState<"all" | "me" | "spec" | "pending">("all")
    const { user } = useAuth()

    useEffect(() => {
        fetchActiveRemarks()
    }, [filter])

    const fetchActiveRemarks = async () => {
        try {
            setIsLoading(true)
            const url = filter === 'pending'
                ? '/api/remarks?is_completed=true&is_verified=false'
                : filter === 'me'
                    ? '/api/remarks?is_completed=false&assigned_to=me'
                    : filter === 'spec'
                        ? '/api/remarks?is_completed=false&specialization=me'
                        : '/api/remarks?is_completed=false'
            const res = await fetch(url)
            if (res.ok) {
                const data = await res.json()
                setRemarks(data)
            }
        } catch (e) {
            toast.error("Ошибка загрузки замечаний")
        } finally {
            setIsLoading(false)
        }
    }

    const grouped = remarks.reduce((acc, remark) => {
        const num = remark.locomotive?.number || '?'
        if (!acc[num]) acc[num] = []
        acc[num].push(remark)
        return acc
    }, {} as GroupedRemarks)

    const filteredLocos = Object.keys(grouped).filter(num =>
        num.toLowerCase().includes(searchQuery.toLowerCase())
    ).sort()

    return (
        <div className="flex-1 flex flex-col items-center overflow-auto bg-slate-50/50">
            <main className="flex-1 w-full p-4 md:p-6 flex flex-col">
                <div className="max-w-7xl w-full mx-auto">
                    <div className="mb-6 md:mb-10 flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-8">
                        <div>
                            <h1 className="text-xl md:text-2xl font-black text-slate-900 border-l-4 border-indigo-600 pl-4 tracking-tight uppercase">
                                Активные замечания
                            </h1>
                            <p className="text-slate-500 text-[11px] md:text-sm mt-1 font-medium">Выберите локомотив для просмотра задач</p>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 w-full md:max-w-2xl items-center">
                            {user && (
                                <div className="flex p-1 bg-slate-100 rounded-xl w-full sm:w-auto self-stretch">
                                    <button
                                        onClick={() => setFilter('all')}
                                        className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs md:text-sm font-bold transition-all ${filter === 'all' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        Все задачи
                                    </button>
                                    {user.specialization && (
                                        <button
                                            onClick={() => setFilter('spec')}
                                            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs md:text-sm font-bold transition-all ${filter === 'spec' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
                                        >
                                            {user.specialization}
                                        </button>
                                    )}
                                    {user.permissions?.can_verify_remarks && (
                                        <button
                                            onClick={() => setFilter('pending')}
                                            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs md:text-sm font-bold transition-all ${filter === 'pending' ? 'bg-amber-500 text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
                                        >
                                            На проверку
                                        </button>
                                    )}
                                </div>
                            )}

                            <div className="relative flex-1 w-full">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-slate-400" />
                                <input
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Поиск по номеру..."
                                    className="w-full pl-11 pr-4 h-12 md:h-11 bg-white rounded-xl border border-slate-200 shadow-sm text-sm md:text-base focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all focus:shadow-md"
                                />
                            </div>
                        </div>
                    </div>

                    {isLoading ? (
                        <ItemGroup className="space-y-3">
                            {Array(3).fill(0).map((_, i) => (
                                <Item key={i} variant="outline" size="default" className="bg-white border-slate-200 shadow-sm px-4 py-2">
                                    <Skeleton className="w-12 h-12 rounded-xl shrink-0 bg-slate-200" />
                                    <ItemContent className="space-y-2">
                                        <Skeleton className="h-5 w-48 bg-slate-200" />
                                        <Skeleton className="h-4 w-32 bg-slate-100" />
                                    </ItemContent>
                                    <ItemActions>
                                        <Skeleton className="w-10 h-10 rounded-full bg-slate-100" />
                                    </ItemActions>
                                </Item>
                            ))}
                        </ItemGroup>
                    ) : filteredLocos.length === 0 ? (
                        <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-300 max-w-xl mx-auto">
                            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4 opacity-20" />
                            <p className="text-slate-500 text-lg font-medium">Активных замечаний не найдено</p>
                        </div>
                    ) : (
                        <ItemGroup className="space-y-3">
                            {filteredLocos.map(locoNum => {
                                const locoId = grouped[locoNum][0].locomotive_id;
                                return (
                                    <Item key={locoNum} variant="outline" size="default" asChild className="bg-white border-slate-200 shadow-sm hover:border-indigo-400 hover:bg-slate-50 transition-all cursor-pointer group px-4 py-2">
                                        <Link to={`/locomotive/${locoId}/remarks`}>
                                            <ItemMedia variant="icon" className="w-12 h-12 bg-slate-900 text-white rounded-xl text-lg font-bold group-hover:bg-indigo-600 transition-colors shrink-0">
                                                <Train className="w-6 h-6" />
                                            </ItemMedia>
                                            <ItemContent>
                                                <div className="flex items-center gap-2">
                                                    <ItemTitle className="text-base text-slate-900 font-bold tracking-tight">
                                                        Тепловоз {locoNum}
                                                    </ItemTitle>
                                                    <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 hover:bg-indigo-50 border-indigo-100 text-[10px] font-bold uppercase py-0 px-2 h-5">
                                                        В ремонте
                                                    </Badge>
                                                </div>
                                                <ItemDescription className="text-slate-500 font-medium flex items-center gap-1.5 mt-0.5">
                                                    <MessageSquare className="w-3.5 h-3.5" />
                                                    {grouped[locoNum].length} {filter === 'pending' ? 'замечаний на проверку' : 'активных замечаний'}
                                                </ItemDescription>
                                            </ItemContent>
                                            <ItemActions>
                                                <div className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 text-slate-400 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-all">
                                                    <ChevronRight className="w-5 h-5" />
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
