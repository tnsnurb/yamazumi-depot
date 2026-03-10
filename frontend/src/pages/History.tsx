import { useEffect, useState, useRef } from "react"
import { useParams, Link } from "react-router-dom"
import { useVirtualizer } from "@tanstack/react-virtual"
import { ArrowLeft, Plus, MapPin, Trash2, ArrowLeftFromLine, ArrowRight, Activity, MessageSquarePlus, CheckCircle2, Edit3, Train, History as HistoryIcon, Clock, User } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"

interface Movement {
    id: number
    locomotive_number: string
    action: string
    from_track: number | null
    from_position: number | null
    to_track: number | null
    to_position: number | null
    moved_at: string
    moved_by: string
}

export default function History() {
    const { number } = useParams<{ number: string }>()
    const [movements, setMovements] = useState<Movement[]>([])
    const [isLoading, setIsLoading] = useState(true)

    const parentRef = useRef<HTMLDivElement>(null)

    const rowVirtualizer = useVirtualizer({
        count: movements.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 160, // Much larger for the timeline cards
        overscan: 5,
    })

    const virtualItems = rowVirtualizer.getVirtualItems()

    useEffect(() => {
        if (number) fetchHistory()
    }, [number])

    const fetchHistory = async () => {
        setIsLoading(true)
        try {
            const res = await fetch(`/api/movements/by-locomotive/${encodeURIComponent(number!)}`)
            if (res.ok) setMovements(await res.json())
        } catch (e) {
            toast.error("Ошибка загрузки истории")
        } finally {
            setIsLoading(false)
        }
    }

    const getActionDetails = (action: string) => {
        if (action.startsWith('status_change')) {
            const parts = action.split('→')
            if (parts.length === 2) {
                const was = parts[0].replace('status_change:', '').trim()
                const became = parts[1].trim()
                return {
                    label: 'Смена статуса',
                    icon: <Activity className="w-4 h-4" />,
                    color: 'text-purple-600 bg-purple-50 border-purple-100',
                    content: (
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-slate-400 line-through decoration-slate-300">{was}</span>
                            <ArrowRight className="w-3 h-3 text-slate-300" />
                            <span className="font-semibold text-purple-700">{became}</span>
                        </div>
                    )
                }
            }
            return {
                label: 'Смена статуса',
                icon: <Activity className="w-4 h-4" />,
                color: 'text-purple-600 bg-purple-50 border-purple-100',
                content: <div className="mt-1 font-medium">{action.split(': ').slice(1).join(': ')}</div>
            }
        }
        if (action.startsWith('remove_from_track')) {
            return {
                label: 'Убран с пути',
                icon: <ArrowLeftFromLine className="w-4 h-4" />,
                color: 'text-amber-600 bg-amber-50 border-amber-100',
                content: <div className="mt-1 italic text-slate-500">{action.includes(': ') ? action.split(': ').slice(1).join(': ') : ''}</div>
            }
        }
        if (action.startsWith('remark_added')) {
            return {
                label: 'Добавлены замечания',
                icon: <MessageSquarePlus className="w-4 h-4" />,
                color: 'text-indigo-600 bg-indigo-50 border-indigo-100',
                content: <div className="mt-1 font-medium">{action.split(': ').slice(1).join(': ')}</div>
            }
        }
        if (action.startsWith('remark_completed')) {
            return {
                label: 'Замечание закрыто',
                icon: <CheckCircle2 className="w-4 h-4" />,
                color: 'text-green-600 bg-green-50 border-green-100',
                content: <div className="mt-1 font-medium text-slate-700">{action.split(': ').slice(1).join(': ')}</div>
            }
        }
        if (action.startsWith('remark_reopened')) {
            return {
                label: 'Замечание переоткрыто',
                icon: <Edit3 className="w-4 h-4" />,
                color: 'text-amber-600 bg-amber-50 border-amber-100',
                content: <div className="mt-1 font-medium text-slate-700">{action.split(': ').slice(1).join(': ')}</div>
            }
        }
        switch (action) {
            case 'add': return {
                label: 'Добавлен в систему',
                icon: <Plus className="w-4 h-4" />,
                color: 'text-emerald-600 bg-emerald-50 border-emerald-100',
                content: null
            }
            case 'move': return {
                label: 'Перемещён',
                icon: <MapPin className="w-4 h-4" />,
                color: 'text-blue-600 bg-blue-50 border-blue-100',
                content: null
            }
            case 'remove': return {
                label: 'Удалён',
                icon: <Trash2 className="w-4 h-4" />,
                color: 'text-rose-600 bg-rose-50 border-rose-100',
                content: null
            }
            default: return {
                label: action,
                icon: <Activity className="w-4 h-4" />,
                color: 'text-slate-600 bg-slate-50 border-slate-100',
                content: null
            }
        }
    }

    return (
        <div className="flex-1 flex flex-col items-center overflow-auto bg-slate-50/30">
            <main className="flex-1 w-full p-4 md:p-6 flex flex-col items-center">
                <div className="w-full max-w-4xl">
                    <div className="flex items-center gap-4 mb-8">
                        <Button variant="outline" size="icon" asChild className="rounded-full bg-white shadow-sm h-10 w-10">
                            <Link to="/journal"><ArrowLeft className="w-5 h-5" /></Link>
                        </Button>
                        <div>
                            <div className="flex items-center gap-2">
                                <Train className="w-6 h-6 text-slate-400" />
                                <h2 className="text-2xl font-black tracking-tight text-slate-900">
                                    История локомотива #{number}
                                </h2>
                            </div>
                            <p className="text-sm text-slate-500 mt-0.5">Всего {movements.length} событий в хронологическом порядке</p>
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="space-y-8 p-6">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="flex gap-6">
                                    <div className="flex flex-col items-center gap-2">
                                        <Skeleton className="h-10 w-10 rounded-full" />
                                        <Skeleton className="h-20 w-1 rounded" />
                                    </div>
                                    <div className="flex-1 space-y-4 pt-2">
                                        <Skeleton className="h-6 w-1/4" />
                                        <Skeleton className="h-24 w-full rounded-xl" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : movements.length === 0 ? (
                        <Card className="border-dashed border-2 py-12 flex flex-col items-center justify-center text-slate-400">
                            <HistoryIcon className="w-12 h-12 mb-3 opacity-20" />
                            <p>История пуста</p>
                        </Card>
                    ) : (
                        <div ref={parentRef} className="max-h-[85vh] overflow-auto relative pr-4 scrollbar-thin scrollbar-thumb-slate-200">
                            <div className="absolute left-[20px] top-6 bottom-6 w-px bg-slate-200" />

                            <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}>
                                {virtualItems.map((virtualRow) => {
                                    const m = movements[virtualRow.index]
                                    const details = getActionDetails(m.action)

                                    return (
                                        <div
                                            key={m.id}
                                            ref={rowVirtualizer.measureElement}
                                            data-index={virtualRow.index}
                                            style={{
                                                position: 'absolute',
                                                top: 0,
                                                transform: `translateY(${virtualRow.start}px)`,
                                                width: '100%',
                                                paddingBottom: '2rem'
                                            }}
                                            className="flex gap-6 group"
                                        >
                                            {/* Timeline Node */}
                                            <div className="relative flex flex-col items-center flex-shrink-0 pt-1">
                                                <div className={cn(
                                                    "w-10 h-10 rounded-full flex items-center justify-center z-10 border-2 bg-white transition-all duration-300 group-hover:scale-110 shadow-sm",
                                                    details.color.split(' ')[0], // Text color
                                                    details.color.split(' ')[2]  // Border color
                                                )}>
                                                    {details.icon}
                                                </div>
                                            </div>

                                            {/* Label & Content */}
                                            <div className="flex-1 bg-white border border-slate-200 rounded-2xl p-4 md:p-5 shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-300 relative">
                                                {/* Arrow */}
                                                <div className="absolute -left-[7px] top-4 w-3 h-3 bg-white border-l border-b border-slate-200 rotate-45" />

                                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-3">
                                                    <div>
                                                        <Badge variant="outline" className={cn("rounded-full font-bold px-3 py-0.5 text-[10px] uppercase tracking-wider", details.color)}>
                                                            {details.label}
                                                        </Badge>
                                                        <div className="text-[11px] text-slate-400 font-mono mt-1 flex items-center gap-1.5">
                                                            <Clock className="w-3 h-3" />
                                                            {new Date(m.moved_at).toLocaleString('ru-RU', {
                                                                day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
                                                            })}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100 self-start md:self-center">
                                                        <User className="w-3.5 h-3.5" />
                                                        <span className="font-medium">{m.moved_by}</span>
                                                    </div>
                                                </div>

                                                <div className="text-slate-700 text-sm">
                                                    {details.content}

                                                    {(m.from_track || m.to_track) && (
                                                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t border-slate-100">
                                                            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                                                                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tight mb-1">Откуда</div>
                                                                <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
                                                                    {m.from_track ? (
                                                                        <>
                                                                            <span className="w-5 h-5 rounded bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-[10px]">{m.from_track}</span>
                                                                            <span>Слот {m.from_position}</span>
                                                                        </>
                                                                    ) : "Вне путей"}
                                                                </div>
                                                            </div>
                                                            <div className="p-2.5 bg-indigo-50/50 rounded-xl border border-indigo-100">
                                                                <div className="text-[10px] text-indigo-400 font-bold uppercase tracking-tight mb-1">Куда</div>
                                                                <div className="flex items-center gap-2 text-xs font-medium text-indigo-700">
                                                                    {m.to_track ? (
                                                                        <>
                                                                            <span className="w-5 h-5 rounded bg-indigo-200 text-indigo-700 flex items-center justify-center font-bold text-[10px]">{m.to_track}</span>
                                                                            <span>Слот {m.to_position}</span>
                                                                        </>
                                                                    ) : "Убран"}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    )
}
