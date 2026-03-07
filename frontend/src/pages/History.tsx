import { useEffect, useState, useRef } from "react"
import { useParams, Link } from "react-router-dom"
import { useVirtualizer } from "@tanstack/react-virtual"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { toast } from "sonner"
import { ArrowLeft, Plus, MapPin, Trash2, ArrowLeftFromLine } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"

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
        estimateSize: () => 61, // Roughly the height of a table row
        overscan: 10,
    })

    const virtualItems = rowVirtualizer.getVirtualItems()
    const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0
    const paddingBottom = virtualItems.length > 0
        ? rowVirtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end
        : 0

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

    const renderActionBadge = (action: string) => {
        if (action.startsWith('status_change')) {
            const detail = action.includes(': ') ? action.split(': ').slice(1).join(': ') : null
            return (
                <div className="flex flex-col gap-0.5">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                        🔄 Смена статуса
                    </span>
                    {detail && <span className="text-xs text-slate-500 pl-1">{detail}</span>}
                </div>
            )
        }
        if (action.startsWith('remove_from_track')) {
            const reason = action.includes(': ') ? action.split(': ').slice(1).join(': ') : null
            return (
                <div className="flex flex-col gap-0.5">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                        <ArrowLeftFromLine className="w-3 h-3" /> Убран с пути
                    </span>
                    {reason && <span className="text-xs text-slate-500 pl-1">Причина: {reason}</span>}
                </div>
            )
        }
        if (action.startsWith('remark_added')) {
            const detail = action.includes(': ') ? action.split(': ').slice(1).join(': ') : null
            return (
                <div className="flex flex-col gap-0.5">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                        ✍️ Добавлено замечание
                    </span>
                    {detail && <span className="text-xs text-slate-500 pl-1">{detail}</span>}
                </div>
            )
        }
        if (action.startsWith('remark_completed')) {
            const detail = action.includes(': ') ? action.split(': ').slice(1).join(': ') : null
            return (
                <div className="flex flex-col gap-0.5">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        ✅ Замечание закрыто
                    </span>
                    {detail && <span className="text-xs text-slate-500 pl-1">{detail}</span>}
                </div>
            )
        }
        if (action.startsWith('remark_reopened')) {
            const detail = action.includes(': ') ? action.split(': ').slice(1).join(': ') : null
            return (
                <div className="flex flex-col gap-0.5">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                        🔓 Замечание переоткрыто
                    </span>
                    {detail && <span className="text-xs text-slate-500 pl-1">{detail}</span>}
                </div>
            )
        }
        switch (action) {
            case 'add': return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800"><Plus className="w-3 h-3" /> Добавлен</span>
            case 'move': return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"><MapPin className="w-3 h-3" /> Перемещён</span>
            case 'remove': return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-100 text-rose-800"><Trash2 className="w-3 h-3" /> Удалён</span>
            default: return <span className="text-sm text-slate-600">{action}</span>
        }
    }

    const formatLocation = (track: number | null, pos: number | null) => {
        if (track && pos) return `Путь ${track}, Слот ${pos}`
        return "—"
    }

    return (
        <div className="flex-1 flex flex-col items-center overflow-auto bg-slate-50/50">
            <main className="flex-1 w-full p-6 flex flex-col items-center">
                <div className="w-full max-w-5xl">
                    <div className="flex items-center gap-4 mb-6">
                        <Button variant="ghost" size="icon" asChild>
                            <Link to="/journal"><ArrowLeft className="w-5 h-5" /></Link>
                        </Button>
                        <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                            История локомотива #{number}
                        </h2>
                        <span className="text-sm text-slate-500">{movements.length} записей</span>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Хронология перемещений</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            {isLoading ? (
                                <div className="space-y-4 animate-pulse p-6">
                                    {[1, 2, 3, 4, 5].map(i => (
                                        <div key={i} className="flex items-center gap-4">
                                            <Skeleton className="h-4 w-6 bg-slate-200" />
                                            <Skeleton className="h-4 w-36 bg-slate-200" />
                                            <Skeleton className="h-6 w-28 rounded-full bg-slate-100" />
                                            <Skeleton className="h-4 w-28 bg-slate-200" />
                                            <Skeleton className="h-4 w-28 bg-slate-200" />
                                            <Skeleton className="h-4 w-20 bg-slate-100" />
                                        </div>
                                    ))}
                                </div>
                            ) : movements.length === 0 ? (
                                <div className="text-center text-slate-400 py-8">Нет записей</div>
                            ) : (
                                <div ref={parentRef} className="max-h-[800px] overflow-auto relative rounded-b-xl border-t md:border-t-0 mt-4 md:mt-0">
                                    {/* Table View (Desktop) */}
                                    <div className="hidden md:block">
                                        <Table>
                                            <TableHeader className="sticky top-0 bg-white z-10 shadow-sm">
                                                <TableRow>
                                                    <TableHead className="w-12">№</TableHead>
                                                    <TableHead>Дата</TableHead>
                                                    <TableHead>Действие</TableHead>
                                                    <TableHead>Откуда</TableHead>
                                                    <TableHead>Куда</TableHead>
                                                    <TableHead>Пользователь</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {paddingTop > 0 && (
                                                    <TableRow>
                                                        <TableCell style={{ height: `${paddingTop}px`, padding: 0 }} colSpan={6} />
                                                    </TableRow>
                                                )}
                                                {virtualItems.map((virtualRow) => {
                                                    const m = movements[virtualRow.index]
                                                    return (
                                                        <TableRow key={m.id} ref={rowVirtualizer.measureElement} data-index={virtualRow.index}>
                                                            <TableCell className="text-slate-400 text-xs py-3">{movements.length - virtualRow.index}</TableCell>
                                                            <TableCell className="text-sm py-3">{new Date(m.moved_at).toLocaleString('ru-RU')}</TableCell>
                                                            <TableCell className="py-3">{renderActionBadge(m.action)}</TableCell>
                                                            <TableCell className="text-sm py-3">{formatLocation(m.from_track, m.from_position)}</TableCell>
                                                            <TableCell className="text-sm py-3">{formatLocation(m.to_track, m.to_position)}</TableCell>
                                                            <TableCell className="text-sm text-slate-500 py-3">{m.moved_by}</TableCell>
                                                        </TableRow>
                                                    )
                                                })}
                                                {paddingBottom > 0 && (
                                                    <TableRow>
                                                        <TableCell style={{ height: `${paddingBottom}px`, padding: 0 }} colSpan={6} />
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>

                                    {/* Card View (Mobile) */}
                                    <div className="md:hidden space-y-3 p-4">
                                        {virtualItems.map((virtualRow) => {
                                            const m = movements[virtualRow.index]
                                            return (
                                                <div
                                                    key={m.id}
                                                    ref={rowVirtualizer.measureElement}
                                                    data-index={virtualRow.index}
                                                    className="bg-slate-50 border rounded-xl p-3 shadow-sm"
                                                >
                                                    <div className="flex justify-between items-start mb-2">
                                                        <span className="text-[10px] text-slate-400 font-mono">#{movements.length - virtualRow.index}</span>
                                                        <span className="text-[10px] font-medium text-slate-500">
                                                            {new Date(m.moved_at).toLocaleString('ru-RU', {
                                                                day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                                                            })}
                                                        </span>
                                                    </div>
                                                    <div className="mb-3">
                                                        {renderActionBadge(m.action)}
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                                        <div>
                                                            <div className="text-slate-400 mb-0.5">Откуда:</div>
                                                            <div className="font-medium text-slate-700 truncate">
                                                                {formatLocation(m.from_track, m.from_position)}
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <div className="text-slate-400 mb-0.5">Куда:</div>
                                                            <div className="font-medium text-slate-700 truncate">
                                                                {formatLocation(m.to_track, m.to_position)}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="mt-3 pt-2 border-t border-slate-200 flex items-center justify-between">
                                                        <span className="text-[10px] text-slate-400 text-right w-full">Исполнитель: {m.moved_by}</span>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </main>
        </div>
    )
}
