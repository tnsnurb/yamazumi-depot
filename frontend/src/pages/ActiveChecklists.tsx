import { useEffect, useState } from "react"
import { Search, ClipboardCheck, ChevronRight, Train, FilterX, CheckCircle2 } from "lucide-react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"

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
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false)
    const [isCompleting, setIsCompleting] = useState(false)

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

    const toggleSelection = (id: string) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    };

    const toggleAll = () => {
        if (selectedIds.size === filtered.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filtered.map(cl => cl.id)));
        }
    };

    const handleBulkComplete = async () => {
        try {
            setIsCompleting(true);
            const res = await fetch('/api/checklists/instances/bulk-complete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ instanceIds: Array.from(selectedIds) })
            });

            if (res.ok) {
                toast.success("Чек-листы успешно выполнены");
                setSelectedIds(new Set());
                fetchActiveChecklists();
            } else {
                toast.error("Ошибка при массовом выполнении");
            }
        } catch (e) {
            toast.error("Ошибка соединения");
        } finally {
            setIsCompleting(false);
            setIsBulkDialogOpen(false);
        }
    };

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
        <div className="flex-1 flex flex-col items-center overflow-auto bg-slate-50/30">
            <main className="flex-1 w-full p-4 md:p-6 flex flex-col">
                <div className="max-w-5xl w-full mx-auto">
                    <div className="mb-6 md:mb-10 flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-8">
                        <div>
                            <h1 className="text-xl md:text-2xl font-semibold text-slate-900 tracking-tight">
                                Активные чек-листы
                            </h1>
                            <p className="text-slate-500 text-[11px] md:text-sm mt-1 font-medium">Прогресс выполнения технического обслуживания</p>
                        </div>

                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
                            {selectedIds.size > 0 && (
                                <Button
                                    onClick={() => setIsBulkDialogOpen(true)}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11 px-6 rounded-xl shadow-lg shadow-emerald-100 flex items-center gap-2 transition-all transform hover:scale-105 active:scale-95"
                                >
                                    <CheckCircle2 className="w-5 h-5" />
                                    Выполнить ({selectedIds.size})
                                </Button>
                            )}

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

                            <div className="relative w-full sm:w-[200px] lg:w-[250px]">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-slate-400" />
                                <input
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Поиск по номеру..."
                                    className="w-full pl-11 pr-4 h-11 bg-white rounded-xl border border-slate-200 shadow-sm text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all focus:shadow-md"
                                />
                            </div>
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="space-y-4">
                            {Array(3).fill(0).map((_, i) => (
                                <div key={i} className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                                    <div className="flex items-center gap-4">
                                        <Skeleton className="size-12 rounded-xl bg-slate-100" />
                                        <div className="space-y-2">
                                            <Skeleton className="h-5 w-32 bg-slate-100" />
                                            <Skeleton className="h-4 w-48 bg-slate-50" />
                                        </div>
                                    </div>
                                    <Skeleton className="h-2 w-full bg-slate-50" />
                                </div>
                            ))}
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="text-center py-24 bg-white rounded-[2rem] border border-dashed border-slate-300 max-w-2xl mx-auto shadow-sm">
                            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                                <ClipboardCheck className="w-10 h-10 text-slate-300" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-2">Активных чек-листов нет</h3>
                            <p className="text-slate-500 font-medium">Все работы по техобслуживанию завершены или еще не начаты.</p>
                        </div>
                    ) : (
                        <div className="space-y-4 w-full">
                            <div className="flex items-center justify-between px-2 mb-2">
                                <div className="flex items-center gap-3 group cursor-pointer" onClick={toggleAll}>
                                    <Checkbox
                                        checked={selectedIds.size === filtered.length && filtered.length > 0}
                                        onCheckedChange={toggleAll}
                                        className="h-5 w-5 rounded-md border-slate-300"
                                    />
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest group-hover:text-slate-600 transition-colors">
                                        {selectedIds.size === filtered.length ? 'Снять выделение' : 'Выделить всё'}
                                    </span>
                                </div>
                                <span className="text-[10px] font-black text-slate-300 uppercase tracking-tighter">Найдено: {filtered.length}</span>
                            </div>

                            {filtered.map(cl => {
                                const progress = cl.total_items > 0 ? (cl.completed_items / cl.total_items) * 100 : 0;
                                const isSelected = selectedIds.has(cl.id);
                                return (
                                    <div key={cl.id} className={`border rounded-2xl bg-white p-5 md:p-6 shadow-sm transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-6 group relative ${isSelected ? 'border-blue-500 bg-blue-50/10 ring-1 ring-blue-500/20' : 'hover:shadow-md hover:border-blue-300'}`}>
                                        <div className="flex items-center gap-5 flex-1">
                                            <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                                                <Checkbox
                                                    checked={isSelected}
                                                    onCheckedChange={() => toggleSelection(cl.id)}
                                                    className="h-6 w-6 rounded-lg border-slate-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 shadow-sm"
                                                />
                                            </div>

                                            <Link to={`/locomotive/${cl.locomotive.id}/checklist`} className="flex-1 flex items-start gap-4 min-w-0">
                                                <div className="size-12 md:size-14 bg-slate-900 text-white rounded-xl md:rounded-2xl flex items-center justify-center text-xl font-bold group-hover:bg-blue-600 transition-colors shrink-0 shadow-lg shadow-slate-100">
                                                    <Train className="w-6 h-6 md:w-7 md:h-7" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                                                            {cl.locomotive.series} {cl.locomotive.number}
                                                        </h3>
                                                        <Badge className={`${progress === 100 ? 'bg-emerald-500' : 'bg-amber-500'} text-white border-none text-[10px] font-black uppercase py-0 px-2 h-5 tracking-wider`}>
                                                            {cl.status === 'in_progress' ? 'В работе' : cl.status}
                                                        </Badge>
                                                    </div>
                                                    <div className="text-slate-500 font-semibold text-xs tracking-wide truncate mb-4">
                                                        {cl.template.name}
                                                    </div>

                                                    <div className="space-y-1.5 max-w-md">
                                                        <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider">
                                                            <span className="text-slate-400">Прогресс выполнения</span>
                                                            <span className="text-blue-600 font-black">{cl.completed_items} / {cl.total_items} ({Math.round(progress)}%)</span>
                                                        </div>
                                                        <Progress value={progress} className="h-1.5 bg-slate-100/50 overflow-hidden" indicatorClassName={progress === 100 ? "bg-emerald-500" : "bg-blue-600"} />
                                                    </div>
                                                </div>
                                            </Link>
                                        </div>

                                        <div className="flex items-center ml-auto">
                                            <Link to={`/locomotive/${cl.locomotive.id}/checklist`} className="w-11 h-11 flex items-center justify-center rounded-full bg-slate-100 text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">
                                                <ChevronRight className="w-6 h-6" />
                                            </Link>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </main>

            <Dialog open={isBulkDialogOpen} onOpenChange={setIsBulkDialogOpen}>
                <DialogContent className="max-w-md rounded-[2rem] border-none shadow-2xl">
                    <DialogHeader className="pt-4 px-2">
                        <div className="size-16 bg-emerald-100 rounded-[1.5rem] flex items-center justify-center mb-6 mx-auto">
                            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                        </div>
                        <DialogTitle className="text-2xl font-black text-slate-900 text-center tracking-tight">
                            Выполнить все сразу?
                        </DialogTitle>
                        <DialogDescription className="text-center text-slate-500 font-medium px-4 mt-2">
                            Вы собираетесь отметить <span className="text-emerald-600 font-bold">{selectedIds.size} чек-листов</span> как полностью выполненные. Все пункты в них будут автоматически закрыты, и вам будут начислены баллы.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="flex-col sm:flex-row gap-3 px-2 pb-4 mt-4">
                        <Button
                            variant="ghost"
                            onClick={() => setIsBulkDialogOpen(false)}
                            className="w-full sm:flex-1 h-12 rounded-xl font-bold text-slate-400 hover:text-slate-900"
                        >
                            Отмена
                        </Button>
                        <Button
                            onClick={handleBulkComplete}
                            disabled={isCompleting}
                            className="w-full sm:flex-1 h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black shadow-lg shadow-emerald-100 active:scale-95 transition-all"
                        >
                            {isCompleting ? 'Выполнение...' : 'Да, подтверждаю'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
