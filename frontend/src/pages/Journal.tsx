import React, { useEffect, useState, useRef } from "react"
import { useDebounce } from "@/hooks/useDebounce"
import { Link } from "react-router-dom"
import { useVirtualizer } from "@tanstack/react-virtual"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FloatingInput } from "@/components/ui/FloatingInput"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { RefreshCw, ArrowRight, Plus, MapPin, Trash2, ArrowLeftFromLine, Download, CalendarDays, User, Activity, CheckCircle2, MessageSquarePlus, Edit3, Loader2 } from "lucide-react"
import { useAuth } from "@/hooks/useAuth"

interface Movement {
    id: number;
    locomotive_id: number;
    locomotive_number: string;
    action: string;
    from_track: number | null;
    from_position: number | null;
    to_track: number | null;
    to_position: number | null;
    moved_at: string;
    moved_by: string;
}



const ITEMS_PER_PAGE = 50;

export default function Journal() {
    const { user } = useAuth()
    const [movements, setMovements] = useState<Movement[]>([])
    const [total, setTotal] = useState(0)
    const [hasMore, setHasMore] = useState(true)
    const [isFetchingNextPage, setIsFetchingNextPage] = useState(false)
    const [isLoading, setIsLoading] = useState(true)

    const parentRef = useRef<HTMLDivElement>(null)
    const offsetRef = useRef(0)

    const [filterQuery, setFilterQuery] = useState("")
    const [filterAction, setFilterAction] = useState("all")
    const [startDate, setStartDate] = useState("")
    const [endDate, setEndDate] = useState("")
    const [filterUser, setFilterUser] = useState("all")

    const [users, setUsers] = useState<string[]>([])


    useEffect(() => {
        fetchUsers()
    }, [])

    const debouncedFilterQuery = useDebounce(filterQuery, 500)

    useEffect(() => {
        fetchMovements(true)
    }, [startDate, endDate, filterUser, debouncedFilterQuery, filterAction, user?.active_location_id])

    const fetchUsers = async () => {
        try {
            const res = await fetch('/api/movements/users')
            if (res.ok) {
                const data = await res.json()
                setUsers(data)
            }
        } catch (e) {
            console.error("Failed to load users", e)
        }
    }



    const fetchMovements = async (reset: boolean = false) => {
        if (reset) {
            setIsLoading(true)
            offsetRef.current = 0
            setMovements([])
        } else {
            setIsFetchingNextPage(true)
        }
        try {
            const params = new URLSearchParams()
            params.append('limit', ITEMS_PER_PAGE.toString())
            params.append('offset', offsetRef.current.toString())
            if (startDate) params.append('startDate', startDate)
            if (endDate) params.append('endDate', endDate)
            if (filterUser && filterUser !== 'all') params.append('user', filterUser)
            if (filterQuery) params.append('loco', filterQuery)
            if (filterAction && filterAction !== 'all') params.append('action', filterAction)

            const res = await fetch(`/api/movements?${params.toString()}`)
            if (res.ok) {
                const data = await res.json()
                setMovements(prev => reset ? data.movements : [...prev, ...data.movements])
                offsetRef.current += data.movements.length
                setTotal(data.total)
                setHasMore(offsetRef.current < data.total)
            }
        } catch (e) {
            toast.error("Ошибка загрузки журнала")
        } finally {
            setIsLoading(false)
            setIsFetchingNextPage(false)
        }
    }

    const flatItems: (Movement | string)[] = React.useMemo(() => {
        const items: (Movement | string)[] = []
        let currentDate = ""
        movements.forEach(m => {
            const dateStr = new Date(m.moved_at).toLocaleDateString('ru-RU', {
                day: 'numeric', month: 'long', year: 'numeric'
            })
            if (dateStr !== currentDate) {
                items.push(dateStr)
                currentDate = dateStr
            }
            items.push(m)
        })
        return items
    }, [movements])

    const rowVirtualizer = useVirtualizer({
        count: hasMore ? flatItems.length + 1 : flatItems.length,
        getScrollElement: () => parentRef.current,
        estimateSize: (index) => typeof flatItems[index] === 'string' ? 40 : 61,
        overscan: 10,
    })

    const virtualItems = rowVirtualizer.getVirtualItems()
    const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0
    const paddingBottom = virtualItems.length > 0
        ? rowVirtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end
        : 0

    useEffect(() => {
        const lastItem = virtualItems[virtualItems.length - 1]
        if (!lastItem) return

        if (lastItem.index >= flatItems.length - 1 && hasMore && !isFetchingNextPage && !isLoading) {
            fetchMovements()
        }
    }, [virtualItems, hasMore, isFetchingNextPage, isLoading])

    const formatLocation = (track: number | null, pos: number | null) => {
        if (track && pos) return `Путь ${track}, Слот ${pos}`
        return "—"
    }

    const renderActionBadge = (action: string) => {
        if (action.startsWith('status_change')) {
            const parts = action.split('→')
            if (parts.length === 2) {
                const was = parts[0].replace('status_change:', '').trim()
                const became = parts[1].trim()
                return (
                    <div className="flex flex-col gap-1">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 self-start">
                            <Activity className="w-3 h-3" /> Смена статуса
                        </span>
                        <div className="flex items-center gap-2 text-xs text-slate-600 pl-1 mt-0.5 font-medium">
                            <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">{was}</span>
                            <ArrowRight className="w-3 h-3 text-slate-400" />
                            <span className="bg-slate-100 px-1.5 py-0.5 rounded text-purple-700">{became}</span>
                        </div>
                    </div>
                )
            }

            const detail = action.includes(': ') ? action.split(': ').slice(1).join(': ') : null
            return (
                <div className="flex flex-col gap-0.5">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 self-start">
                        <Activity className="w-3 h-3" /> Смена статуса
                    </span>
                    {detail && <span className="text-xs text-slate-500 pl-1 mt-0.5">{detail}</span>}
                </div>
            )
        }
        if (action.startsWith('remove_from_track')) {
            const reason = action.includes(': ') ? action.split(': ').slice(1).join(': ') : null
            return (
                <div className="flex flex-col gap-0.5">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 self-start">
                        <ArrowLeftFromLine className="w-3 h-3" /> Убран с пути
                    </span>
                    {reason && <span className="text-xs text-slate-500 pl-1 mt-0.5">Причина: {reason}</span>}
                </div>
            )
        }
        if (action.startsWith('remark_added')) {
            const numAddedMatch = action.match(/(\d+) замечаний/)
            const countLabel = numAddedMatch ? `${numAddedMatch[1]} шт.` : action.includes(': ') ? action.split(': ').slice(1).join(': ') : ''
            return (
                <div className="flex flex-col gap-0.5">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 self-start">
                        <MessageSquarePlus className="w-3 h-3" /> Добавлены замечания
                    </span>
                    {countLabel && <span className="text-xs text-slate-500 pl-1 mt-0.5 font-medium truncate max-w-[200px]" title={countLabel}>{countLabel}</span>}
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
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 self-start">
                        <CheckCircle2 className="w-3 h-3" /> Замечание закрыто
                    </span>
                    {detail && <span className="text-xs text-slate-500 pl-1 mt-0.5 truncate max-w-[200px]" title={detail}>{detail}</span>}
                </div>
            )
        }
        if (action.startsWith('remark_reopened')) {
            const detail = action.includes(': ') ? action.split(': ').slice(1).join(': ') : null
            return (
                <div className="flex flex-col gap-0.5">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 self-start">
                        <Edit3 className="w-3 h-3" /> Замечание переоткрыто
                    </span>
                    {detail && <span className="text-xs text-slate-500 pl-1 mt-0.5 truncate max-w-[200px]" title={detail}>{detail}</span>}
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

    return (
        <div className="flex-1 flex flex-col items-center overflow-auto bg-slate-50/50">
            <main className="flex-1 w-full p-4 md:p-6 flex flex-col">
                <div className="w-full max-w-6xl">

                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-6">
                        <div>
                            <h2 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                                <Activity className="w-5 h-5 md:w-6 md:h-6 text-slate-700" />
                                Журнал перемещений
                            </h2>
                            <p className="text-slate-500 text-xs md:text-sm mt-1">Отслеживайте историю действий в депо</p>
                        </div>

                        <div className="flex gap-2 w-full sm:w-auto">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    const params = new URLSearchParams()
                                    if (startDate) params.append('startDate', startDate)
                                    if (endDate) params.append('endDate', endDate)
                                    if (filterUser !== 'all') params.append('user', filterUser)
                                    if (debouncedFilterQuery) params.append('loco', debouncedFilterQuery)
                                    if (filterAction !== 'all') params.append('action', filterAction)
                                    window.open(`/api/movements/export?${params.toString()}`, '_blank')
                                }}
                                className="bg-white gap-2 flex-1 sm:flex-none py-1.5 h-9 text-sm"
                            >
                                <Download className="w-4 h-4" /> <span className="hidden xs:inline">Экспорт</span>
                            </Button>
                            <Button variant="outline" onClick={() => fetchMovements(true)} className="bg-white gap-2 flex-1 sm:flex-none py-1.5 h-9 text-sm">
                                <RefreshCw className="w-4 h-4" /> <span className="hidden xs:inline">Обновить</span>
                            </Button>
                        </div>
                    </div>



                    {/* Filters Toolbar */}
                    <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3 mb-4 bg-slate-100/50 p-2.5 rounded-lg border border-slate-200">
                        <div className="flex flex-col sm:flex-row gap-3 flex-1">
                            <div className="flex-1 w-full group relative sm:w-[180px]">
                                <FloatingInput
                                    label="Поиск локомотива..."
                                    value={filterQuery}
                                    onChange={(e) => setFilterQuery(e.target.value)}
                                    placeholder="Введите номер..."
                                    className="h-10"
                                />
                            </div>

                            <Select value={filterAction} onValueChange={setFilterAction}>
                                <SelectTrigger className="w-full sm:w-[180px] bg-white h-10 border-slate-200">
                                    <SelectValue placeholder="Все действия" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Все действия</SelectItem>
                                    <SelectItem value="add">Добавление</SelectItem>
                                    <SelectItem value="move">Перемещение</SelectItem>
                                    <SelectItem value="remove">Удаление</SelectItem>
                                    <SelectItem value="remove_from_track">Убран с пути</SelectItem>
                                    <SelectItem value="status_change">Смена статуса</SelectItem>
                                    <SelectItem value="remark">Замечания</SelectItem>
                                </SelectContent>
                            </Select>

                            <div className="flex items-center gap-2 bg-white rounded-md border px-2.5 h-10 border-slate-200 flex-1 sm:flex-none">
                                <User className="w-4 h-4 text-slate-400" />
                                <Select value={filterUser} onValueChange={setFilterUser}>
                                    <SelectTrigger className="w-full sm:w-[160px] border-0 h-8 shadow-none focus:ring-0 px-2 line-clamp-1">
                                        <SelectValue placeholder="Сотрудник" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Все сотрудники</SelectItem>
                                        {users.map(u => (
                                            <SelectItem key={u} value={u}>{u}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 bg-white rounded-md border px-2.5 h-10 border-slate-200 lg:ml-auto">
                            <CalendarDays className="w-4 h-4 text-slate-400" />
                            <Input
                                type="date"
                                className="border-0 h-8 flex-1 sm:w-[130px] p-0 shadow-none focus-visible:ring-0 text-sm"
                                value={startDate}
                                onChange={e => setStartDate(e.target.value)}
                            />
                            <span className="text-slate-300">-</span>
                            <Input
                                type="date"
                                className="border-0 h-8 flex-1 sm:w-[130px] p-0 shadow-none focus-visible:ring-0 text-sm"
                                value={endDate}
                                onChange={e => setEndDate(e.target.value)}
                            />
                        </div>
                    </div>

                    <div ref={parentRef} className="bg-white rounded-xl shadow-sm border overflow-auto max-h-[700px] relative">
                        <Table>
                            <TableHeader className="sticky top-0 bg-white z-10 shadow-sm">
                                <TableRow className="bg-slate-50 hover:bg-slate-50">
                                    <TableHead className="w-16">№</TableHead>
                                    <TableHead>Дата / Время</TableHead>
                                    <TableHead>Локомотив</TableHead>
                                    <TableHead>Действие</TableHead>
                                    <TableHead>Откуда</TableHead>
                                    <TableHead>Куда</TableHead>
                                    <TableHead>Пользователь</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading && movements.length === 0 ? (
                                    Array.from({ length: 15 }).map((_, i) => (
                                        <TableRow key={`skeleton-${i}`}>
                                            <TableCell><Skeleton className="h-4 w-6" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                            <TableCell><Skeleton className="h-6 w-28 rounded-full" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                        </TableRow>
                                    ))
                                ) : movements.length > 0 ? (
                                    <>
                                        {paddingTop > 0 && (
                                            <TableRow>
                                                <TableCell style={{ height: `${paddingTop}px`, padding: 0 }} colSpan={7} />
                                            </TableRow>
                                        )}
                                        {virtualItems.map((virtualRow) => {
                                            const isLoaderRow = virtualRow.index > flatItems.length - 1
                                            if (isLoaderRow) {
                                                return (
                                                    <TableRow key="loader-row" ref={rowVirtualizer.measureElement} data-index={virtualRow.index}>
                                                        <TableCell colSpan={7} className="py-4 text-center text-slate-500">
                                                            <Loader2 className="w-5 h-5 animate-spin mx-auto text-blue-500" />
                                                        </TableCell>
                                                    </TableRow>
                                                )
                                            }
                                            const item = flatItems[virtualRow.index]
                                            if (typeof item === 'string') {
                                                return (
                                                    <TableRow key={item} ref={rowVirtualizer.measureElement} data-index={virtualRow.index} className="bg-slate-50/80 hover:bg-slate-50/80">
                                                        <TableCell colSpan={7} className="font-semibold text-slate-800 py-2 border-y">
                                                            {item}
                                                        </TableCell>
                                                    </TableRow>
                                                )
                                            }
                                            const m = item as Movement
                                            return (
                                                <TableRow key={m.id} ref={rowVirtualizer.measureElement} data-index={virtualRow.index}>
                                                    <TableCell className="text-slate-400 font-mono text-xs w-16 px-4">#{m.id}</TableCell>
                                                    <TableCell className="text-sm font-medium text-slate-700">
                                                        {new Date(m.moved_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Link to={`/history/${encodeURIComponent(m.locomotive_number)}`} className="font-bold text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1 transition-colors">
                                                            {m.locomotive_number}
                                                        </Link>
                                                    </TableCell>
                                                    <TableCell className="max-w-[300px]">{renderActionBadge(m.action)}</TableCell>
                                                    <TableCell className="text-slate-600 text-sm whitespace-nowrap">{formatLocation(m.from_track, m.from_position)}</TableCell>
                                                    <TableCell className="text-slate-600 text-sm whitespace-nowrap border-l border-slate-100">{formatLocation(m.to_track, m.to_position)}</TableCell>
                                                    <TableCell className="text-slate-500 text-sm">{m.moved_by}</TableCell>
                                                </TableRow>
                                            )
                                        })}
                                        {paddingBottom > 0 && (
                                            <TableRow>
                                                <TableCell style={{ height: `${paddingBottom}px`, padding: 0 }} colSpan={7} />
                                            </TableRow>
                                        )}
                                    </>
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-24 text-center text-slate-500">
                                            Нет записей
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Pagination */}
                    <div className="flex items-center justify-between mt-4">
                        <div className="text-sm text-slate-500">
                            Найдено записей: {total}
                        </div>
                    </div>

                </div>
            </main>
        </div>
    )
}
