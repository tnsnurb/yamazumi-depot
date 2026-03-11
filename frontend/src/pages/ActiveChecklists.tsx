import { useEffect, useState } from "react"
import { Search, ClipboardCheck, ChevronRight, Train, FilterX } from "lucide-react"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"

interface ActiveChecklist {
    id: string;
    status: string;
    created_at: string;
    total_items: number;
    completed_items: number;
    locomotive: {
        id: number;
        number: string;
        series: string;
    };
    template: {
        name: string;
    };
}

export default function ActiveChecklists() {
    const [checklists, setChecklists] = useState<ActiveChecklist[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState("")
    const [selectedSeries, setSelectedSeries] = useState("all")
    const [selectedTemplate, setSelectedTemplate] = useState("all")

    useEffect(() => {
        fetchActiveChecklists()
    }, [])

    const fetchActiveChecklists = async () => {
        try {
            setIsLoading(true)
            const res = await fetch('/api/checklists/active')
            if (res.ok) {
                const data = await res.json()
                setChecklists(data)
            }
        } catch (e) {
            toast.error("Ошибка загрузки чек-листов")
        } finally {
            setIsLoading(false)
        }
    }

    const uniqueSeries = Array.from(new Set(checklists.map(c => c.locomotive.series))).sort()
    const uniqueTemplates = Array.from(new Set(checklists.map(c => c.template.name))).sort()

    const filtered = checklists.filter(cl => {
        const matchesSearch = cl.locomotive.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
            cl.locomotive.series.toLowerCase().includes(searchQuery.toLowerCase()) ||
            cl.template.name.toLowerCase().includes(searchQuery.toLowerCase())

        const matchesSeries = selectedSeries === "all" || cl.locomotive.series === selectedSeries;
        const matchesTemplate = selectedTemplate === "all" || cl.template.name === selectedTemplate;

        return matchesSearch && matchesSeries && matchesTemplate;
    })

    return (
        <div className="flex-1 flex flex-col items-center overflow-auto bg-slate-50/50">
            <main className="flex-1 w-full p-4 md:p-6 flex flex-col">
                <div className="max-w-7xl w-full mx-auto">
                    <div className="mb-6 md:mb-10 flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-8">
                        <div>
                            <h1 className="text-xl md:text-2xl font-black text-slate-900 border-l-4 border-indigo-600 pl-4 tracking-tight uppercase">
                                Активные чек-листы
                            </h1>
                            <p className="text-slate-500 text-[11px] md:text-sm mt-1 font-medium">Прогресс выполнения технического обслуживания</p>
                        </div>

                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
                            <div className="flex gap-2 w-full sm:w-auto">
                                <Select value={selectedSeries} onValueChange={setSelectedSeries}>
                                    <SelectTrigger className="w-full sm:w-[140px] h-11 bg-white border-slate-200">
                                        <SelectValue placeholder="Серия" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Все серии</SelectItem>
                                        {uniqueSeries.map(s => (
                                            <SelectItem key={s} value={s}>{s}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                                    <SelectTrigger className="w-full sm:w-[160px] h-11 bg-white border-slate-200">
                                        <SelectValue placeholder="Вид ремонта" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Все виды</SelectItem>
                                        {uniqueTemplates.map(t => (
                                            <SelectItem key={t} value={t}>{t}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                {(selectedSeries !== "all" || selectedTemplate !== "all") && (
                                    <Button
                                        variant="outline"
                                        className="h-11 px-3 text-slate-400 border-slate-200 hover:text-red-500 hover:bg-red-50 shrink-0"
                                        onClick={() => {
                                            setSelectedSeries("all");
                                            setSelectedTemplate("all");
                                        }}
                                    >
                                        <FilterX className="w-4 h-4" />
                                    </Button>
                                )}
                            </div>

                            <div className="relative w-full sm:w-[250px]">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-slate-400" />
                                <input
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Поиск по номеру..."
                                    className="w-full pl-11 pr-4 h-11 bg-white rounded-xl border border-slate-200 shadow-sm text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all focus:shadow-md"
                                />
                            </div>
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
                                <ClipboardCheck className="w-10 h-10 text-slate-300" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-2">Активных чек-листов нет</h3>
                            <p className="text-slate-500 font-medium">Все работы по техобслуживанию завершены или еще не начаты.</p>
                        </div>
                    ) : (
                        <ItemGroup className="space-y-4">
                            {filtered.map(cl => {
                                const progress = cl.total_items > 0 ? (cl.completed_items / cl.total_items) * 100 : 0;
                                return (
                                    <Item key={cl.id} variant="outline" size="default" asChild className="bg-white border-slate-200 shadow-sm hover:border-indigo-400 hover:bg-slate-50/50 transition-all cursor-pointer group px-4 py-4 rounded-2xl">
                                        <Link to={`/locomotive/${cl.locomotive.id}/checklist`}>
                                            <ItemMedia variant="icon" className="size-14 bg-slate-900 text-white rounded-2xl text-xl font-bold group-hover:bg-indigo-600 transition-colors shrink-0 shadow-lg shadow-slate-200">
                                                <Train className="w-7 h-7" />
                                            </ItemMedia>
                                            <ItemContent className="gap-0">
                                                <div className="flex items-center gap-3 mb-1">
                                                    <ItemTitle className="text-lg text-slate-900 font-bold tracking-tight">
                                                        {cl.locomotive.series} {cl.locomotive.number}
                                                    </ItemTitle>
                                                    <Badge className={`${progress === 100 ? 'bg-emerald-500' : 'bg-amber-500'} text-white border-none text-[10px] font-black uppercase py-0 px-2 h-5 tracking-wider`}>
                                                        {cl.status === 'in_progress' ? 'В работе' : cl.status}
                                                    </Badge>
                                                </div>
                                                <ItemDescription className="text-slate-500 font-bold text-xs uppercase tracking-wide mb-3">
                                                    {cl.template.name}
                                                </ItemDescription>

                                                <div className="space-y-1.5">
                                                    <div className="flex justify-between text-[11px] font-bold uppercase tracking-wider">
                                                        <span className="text-slate-400">Прогресс выполнения</span>
                                                        <span className="text-indigo-600">{cl.completed_items} / {cl.total_items} ({Math.round(progress)}%)</span>
                                                    </div>
                                                    <Progress value={progress} className="h-2 bg-slate-100" indicatorClassName={progress === 100 ? "bg-emerald-500" : "bg-indigo-600"} />
                                                </div>
                                            </ItemContent>
                                            <ItemActions>
                                                <div className="w-11 h-11 flex items-center justify-center rounded-full bg-slate-100 text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm">
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
