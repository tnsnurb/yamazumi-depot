import { useEffect, useState } from "react"
import { Header } from "@/components/common/Header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { toast } from "sonner"
import { RefreshCw, ArrowRight, Plus, MapPin, Trash2 } from "lucide-react"

interface Movement {
    id: number;
    locomotive_number: string;
    action: 'add' | 'move' | 'remove';
    from_track: number | null;
    from_position: number | null;
    to_track: number | null;
    to_position: number | null;
    moved_at: string;
    moved_by: string;
}

const ITEMS_PER_PAGE = 20;

export default function Journal() {
    const [movements, setMovements] = useState<Movement[]>([])
    const [total, setTotal] = useState(0)
    const [page, setPage] = useState(1)

    const [filterQuery, setFilterQuery] = useState("")
    const [filterAction, setFilterAction] = useState("all")

    useEffect(() => {
        fetchMovements()
    }, [page])

    const fetchMovements = async () => {
        try {
            const offset = (page - 1) * ITEMS_PER_PAGE
            const res = await fetch(`/api/movements?limit=${ITEMS_PER_PAGE}&offset=${offset}`)
            if (res.ok) {
                const data = await res.json()
                setMovements(data.movements)
                setTotal(data.total)
            }
        } catch (e) {
            toast.error("Ошибка загрузки журнала")
        }
    }

    const filteredMovements = movements.filter(m => {
        const matchNumber = m.locomotive_number.toLowerCase().includes(filterQuery.toLowerCase())
        const matchAction = filterAction === "all" || m.action === filterAction
        return matchNumber && matchAction
    })

    const totalPages = Math.ceil(total / ITEMS_PER_PAGE) || 1

    const formatLocation = (track: number | null, pos: number | null) => {
        if (track && pos) return `Track ${track}, Slot ${pos}`
        return "—"
    }

    const renderActionBadge = (action: string) => {
        switch (action) {
            case 'add': return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800"><Plus className="w-3 h-3" /> Добавлен</span>
            case 'move': return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"><MapPin className="w-3 h-3" /> Перемещён</span>
            case 'remove': return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-100 text-rose-800"><Trash2 className="w-3 h-3" /> Удалён</span>
            default: return action
        }
    }

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            <Header />

            <main className="flex-1 p-6 flex flex-col items-center">
                <div className="w-full max-w-6xl">

                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Журнал перемещений</h2>

                        <div className="flex gap-3">
                            <Input
                                placeholder="Номер локомотива..."
                                value={filterQuery}
                                onChange={e => setFilterQuery(e.target.value)}
                                className="w-48 bg-white"
                            />
                            <Select value={filterAction} onValueChange={setFilterAction}>
                                <SelectTrigger className="w-[180px] bg-white">
                                    <SelectValue placeholder="Все действия" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Все действия</SelectItem>
                                    <SelectItem value="add">Добавление</SelectItem>
                                    <SelectItem value="move">Перемещение</SelectItem>
                                    <SelectItem value="remove">Удаление</SelectItem>
                                </SelectContent>
                            </Select>
                            <Button variant="outline" onClick={fetchMovements} className="bg-white gap-2">
                                <RefreshCw className="w-4 h-4" /> Обновить
                            </Button>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                        <Table>
                            <TableHeader>
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
                                {filteredMovements.length > 0 ? (
                                    filteredMovements.map((m, i) => (
                                        <TableRow key={m.id}>
                                            <TableCell className="text-slate-500 font-mono text-sm">{(page - 1) * ITEMS_PER_PAGE + i + 1}</TableCell>
                                            <TableCell className="text-sm">{new Date(m.moved_at).toLocaleString()}</TableCell>
                                            <TableCell className="font-bold">{m.locomotive_number}</TableCell>
                                            <TableCell>{renderActionBadge(m.action)}</TableCell>
                                            <TableCell className="text-slate-600">{formatLocation(m.from_track, m.from_position)}</TableCell>
                                            <TableCell className="text-slate-600 border-l border-slate-100">{formatLocation(m.to_track, m.to_position)}</TableCell>
                                            <TableCell className="text-slate-500">{m.moved_by}</TableCell>
                                        </TableRow>
                                    ))
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
                            Всего записей: {total}
                        </div>
                        <div className="flex items-center gap-4">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page <= 1}
                            >
                                ← Назад
                            </Button>
                            <span className="text-sm text-slate-600 font-medium">
                                Страница {page} из {totalPages}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page >= totalPages}
                            >
                                Вперёд <ArrowRight className="w-4 h-4 ml-1" />
                            </Button>
                        </div>
                    </div>

                </div>
            </main>
        </div>
    )
}
