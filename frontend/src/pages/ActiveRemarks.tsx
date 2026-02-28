import { useEffect, useState } from "react"
import { Header } from "@/components/common/Header"
import { Search, Loader2, CheckCircle2, ChevronRight, ChevronDown } from "lucide-react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"

interface Remark {
    id: string;
    text: string;
    priority: 'low' | 'medium' | 'high';
    category: string;
    is_completed: boolean;
    locomotive_id: string;
    locomotive: {
        number: string;
    }
}

interface GroupedRemarks {
    [locoNumber: string]: Remark[];
}

export default function ActiveRemarks() {
    const [remarks, setRemarks] = useState<Remark[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState("")
    const [expandedLocos, setExpandedLocos] = useState<Set<string>>(new Set())

    useEffect(() => {
        fetchActiveRemarks()
    }, [])

    const fetchActiveRemarks = async () => {
        try {
            setIsLoading(true)
            const res = await fetch('/api/remarks?is_completed=false')
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

    const toggleLoco = (locoNumber: string) => {
        const next = new Set(expandedLocos)
        if (next.has(locoNumber)) next.delete(locoNumber)
        else next.add(locoNumber)
        setExpandedLocos(next)
    }

    const toggleCompletion = async (remark: Remark) => {
        try {
            const res = await fetch(`/api/remarks/${remark.id}/complete`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_completed: !remark.is_completed })
            });

            if (res.ok) {
                toast.success(remark.is_completed ? "Замечание возвращено" : "Замечание выполнено");
                fetchActiveRemarks();
            } else {
                toast.error("Ошибка обновления статуса");
            }
        } catch (e) {
            toast.error("Ошибка сети");
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
        <div className="min-h-screen bg-slate-50 flex flex-col pb-20">
            <Header />

            <main className="flex-1 p-4">
                <div className="max-w-xl mx-auto">
                    <div className="mb-6">
                        <h1 className="text-2xl font-bold text-slate-900 border-l-4 border-indigo-500 pl-3">
                            АКТИВНЫЕ ЗАМЕЧАНИЯ
                        </h1>
                        <p className="text-slate-500 text-sm mt-1">Все открытые задачи по депо</p>
                    </div>

                    <div className="relative mb-6">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <Input
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Поиск по номеру тепловоза..."
                            className="pl-10 h-12 bg-white rounded-2xl border-slate-200 shadow-sm text-lg focus:ring-indigo-500"
                        />
                    </div>

                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-3">
                            <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
                            <span className="text-slate-500 font-medium">Загрузка задач...</span>
                        </div>
                    ) : filteredLocos.length === 0 ? (
                        <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-300">
                            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4 opacity-20" />
                            <p className="text-slate-500 text-lg font-medium">Активных замечаний не найдено</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {filteredLocos.map(locoNum => (
                                <div key={locoNum} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                                    <button
                                        onClick={() => toggleLoco(locoNum)}
                                        className="w-full p-5 flex items-center justify-between hover:bg-slate-50 transition-colors"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-14 h-14 bg-slate-900 text-white rounded-2xl flex items-center justify-center text-xl font-black">
                                                {locoNum}
                                            </div>
                                            <div className="text-left">
                                                <div className="font-bold text-slate-900">Тепловоз {locoNum}</div>
                                                <div className="text-indigo-600 font-bold text-sm">
                                                    {grouped[locoNum].length} задач
                                                </div>
                                            </div>
                                        </div>
                                        {expandedLocos.has(locoNum) ? <ChevronDown /> : <ChevronRight />}
                                    </button>

                                    {expandedLocos.has(locoNum) && (
                                        <div className="p-2 bg-slate-50 divide-y divide-slate-100">
                                            {grouped[locoNum].map(remark => (
                                                <div key={remark.id} className="p-4 bg-white rounded-xl mb-2 last:mb-0 shadow-sm border border-slate-100">
                                                    <div className="flex items-start gap-3">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${remark.priority === 'high' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'
                                                                    }`}>
                                                                    {remark.category || 'Ремонт'}
                                                                </span>
                                                            </div>
                                                            <p className="text-slate-900 font-medium leading-tight">
                                                                {remark.text}
                                                            </p>

                                                            <div className="flex gap-2 mt-4">
                                                                <button className="flex-1 py-2 bg-slate-50 text-slate-600 rounded-lg text-xs font-bold border border-slate-200">
                                                                    Чат
                                                                </button>
                                                                <button className="flex-1 py-2 bg-slate-50 text-slate-600 rounded-lg text-xs font-bold border border-slate-200">
                                                                    Фото
                                                                </button>
                                                            </div>
                                                        </div>

                                                        <button
                                                            onClick={() => toggleCompletion(remark)}
                                                            className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white border border-slate-200 text-slate-300 shadow-sm active:scale-95 transition-all"
                                                        >
                                                            <CheckCircle2 className="w-6 h-6" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>
        </div>
    )
}
