import { useEffect, useState } from "react"
import { Header } from "@/components/common/Header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Plus, Search, RefreshCw, Trash2, ArrowLeftFromLine, Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"

export type LocoStatus = 'active' | 'repair' | 'waiting' | 'completed';

export interface Locomotive {
    id: number;
    number: string;
    status: LocoStatus;
    track: number | null;
    position: number | null;
    created_at: string;
}

const statusColors = {
    active: 'bg-green-500',
    repair: 'bg-red-500',
    waiting: 'bg-yellow-500',
    completed: 'bg-blue-500',
};

const statusLabels = {
    active: 'Активный',
    repair: 'Ремонт',
    waiting: 'Ожидание',
    completed: 'Завершён',
};

export default function MapPage() {
    const [locomotives, setLocomotives] = useState<Locomotive[]>([])
    const [searchQuery, setSearchQuery] = useState("")
    const [isAddOpen, setIsAddOpen] = useState(false)
    const [isInfoOpen, setIsInfoOpen] = useState(false)
    const [selectedLoco, setSelectedLoco] = useState<Locomotive | null>(null)
    const [draggedId, setDraggedId] = useState<string | null>(null)

    // Add Form State
    const [addNumber, setAddNumber] = useState("")
    const [addStatus, setAddStatus] = useState<string>("active")
    const [addTrack, setAddTrack] = useState<string>("")
    const [addPosition, setAddPosition] = useState<string>("")
    const [isNumberOpen, setIsNumberOpen] = useState(false)

    // Catalog state
    const [catalog, setCatalog] = useState<{ id: number, number: string }[]>([])

    useEffect(() => {
        fetchLocomotives()
        fetchCatalog()
    }, [])

    const fetchCatalog = async () => {
        try {
            const res = await fetch("/api/catalog")
            if (res.ok) setCatalog(await res.json())
        } catch (e) {
            toast.error("Ошибка загрузки справочника номеров")
        }
    }

    const fetchLocomotives = async () => {
        try {
            const res = await fetch("/api/locomotives")
            if (res.ok) {
                setLocomotives(await res.json())
            }
        } catch (e) {
            toast.error("Ошибка загрузки данных")
        }
    }

    const handleAddSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!addNumber) return

        try {
            const payload = {
                number: addNumber,
                status: addStatus,
                track: addTrack ? parseInt(addTrack) : null,
                position: addPosition ? parseInt(addPosition) : null
            }

            const res = await fetch("/api/locomotives", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            })

            const data = await res.json()
            if (res.ok) {
                toast.success(`Локомотив ${data.number} добавлен`)
                setIsAddOpen(false)
                setAddNumber("")
                setAddTrack("")
                setAddPosition("")
                fetchLocomotives()
            } else {
                toast.error(data.error)
            }
        } catch (e) {
            toast.error("Ошибка сети")
        }
    }

    const handleDelete = async () => {
        if (!selectedLoco) return
        if (!confirm(`Удалить локомотив #${selectedLoco.number}?`)) return

        try {
            const res = await fetch(`/api/locomotives/${selectedLoco.id}`, { method: "DELETE" })
            if (res.ok) {
                toast.success(`Локомотив #${selectedLoco.number} удалён`)
                setIsInfoOpen(false)
                fetchLocomotives()
            } else {
                const data = await res.json()
                toast.error(data.error)
            }
        } catch (e) {
            toast.error("Ошибка сети")
        }
    }

    const handleRemoveFromTrack = async () => {
        if (!selectedLoco) return
        try {
            const res = await fetch(`/api/locomotives/${selectedLoco.id}/move`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ track: null, position: null })
            })
            if (res.ok) {
                toast.success(`Локомотив #${selectedLoco.number} убран с пути`)
                setIsInfoOpen(false)
                fetchLocomotives()
            }
        } catch (e) {
            toast.error("Ошибка сети")
        }
    }

    // Drag and Drop
    const handleDragStart = (e: React.DragEvent<HTMLDivElement>, id: number) => {
        setDraggedId(id.toString())
        e.dataTransfer.setData("text/plain", id.toString())
        e.dataTransfer.effectAllowed = "move"
    }

    const handleDrop = async (e: React.DragEvent<HTMLDivElement>, track: number, pos: number) => {
        e.preventDefault()
        if (!draggedId) return

        const existing = locomotives.find(l => l.track === track && l.position === pos)
        if (existing && existing.id.toString() !== draggedId) {
            toast.error("Позиция уже занята")
            return
        }

        try {
            const res = await fetch(`/api/locomotives/${draggedId}/move`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ track, position: pos })
            })
            if (res.ok) {
                fetchLocomotives()
                toast.success(`Локомотив перемещён`)
            } else {
                const data = await res.json()
                toast.error(data.error)
            }
        } catch (err) {
            toast.error("Ошибка сети")
        }
        setDraggedId(null)
    }

    const filteredLocos = locomotives.filter((l: Locomotive) =>
        l.number.toLowerCase().includes(searchQuery.toLowerCase())
    )

    // Use filteredLocos for rendering the map
    const renderSlot = (track: number, pos: number) => {
        const loco = filteredLocos.find((l: Locomotive) => l.track === track && l.position === pos)
        const isHighlighted = loco && searchQuery && loco.number.toLowerCase().includes(searchQuery.toLowerCase())

        return (
            <div
                key={`${track}-${pos}`}
                className={`relative w-32 h-16 border rounded-md flex items-center justify-center bg-white shadow-sm transition-colors
          ${draggedId ? 'border-dashed border-2 border-slate-300 hover:border-slate-500 hover:bg-slate-50' : 'border-slate-200'}
        `}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDrop(e, track, pos)}
            >
                <div className="absolute top-1 left-2 text-xs text-slate-400 font-mono">{pos}</div>

                {loco && (
                    <div
                        draggable
                        onDragStart={(e) => handleDragStart(e, loco.id)}
                        onClick={() => { setSelectedLoco(loco); setIsInfoOpen(true) }}
                        className={`w-[90%] h-[70%] mt-2 rounded-sm border shadow-sm flex items-center gap-2 px-2 cursor-pointer transition-all
              ${isHighlighted ? 'ring-2 ring-primary bg-primary/10 border-primary' : 'bg-white hover:bg-slate-50 border-slate-300'}
            `}
                    >
                        <div className={`w-2.5 h-2.5 rounded-full ${statusColors[loco.status]}`} />
                        <span className="font-bold text-sm tracking-wide">{loco.number}</span>
                    </div>
                )}
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            <Header />

            <main className="flex-1 p-6 flex flex-col items-center">
                {/* Toolbar */}
                <div className="w-full max-w-6xl flex justify-between items-center mb-8">
                    <div className="flex gap-4 items-center">
                        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Map</h2>
                        <div className="flex gap-3 text-sm ml-4 border-l pl-4">
                            {Object.entries(statusLabels).map(([k, v]) => (
                                <div key={k} className="flex items-center gap-1.5">
                                    <div className={`w-2.5 h-2.5 rounded-full ${statusColors[k as LocoStatus]}`} />
                                    <span className="text-slate-600">{v}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                            <Input
                                placeholder="Номер..."
                                className="pl-9 w-48"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <Button variant="outline" size="icon" onClick={fetchLocomotives}>
                            <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button onClick={() => setIsAddOpen(true)} className="gap-2">
                            <Plus className="h-4 w-4" /> Добавить
                        </Button>
                    </div>
                </div>

                {/* Map Grid Container */}
                <div className="w-full max-w-6xl bg-white rounded-xl shadow-sm border p-8 flex flex-col gap-8 relative overflow-x-auto">
                    {/* Tracks 1-3 */}
                    {[1, 2, 3].map(track => (
                        <div key={track} className="flex items-center gap-4">
                            <div className="w-20 font-medium text-slate-500 text-right shrink-0">Track {track}</div>
                            <div className="flex gap-3 shrink-0">
                                {[1, 2, 3, 4, 5, 6].map(pos => renderSlot(track, pos))}
                            </div>
                            <div className="text-slate-300 ml-4 shrink-0 text-xl tracking-widest">◄──</div>
                        </div>
                    ))}

                    {/* Middle Shops Spacer */}
                    <div className="flex items-center gap-4 py-4">
                        <div className="w-20 shrink-0"></div>
                        <div className="flex gap-3 shrink-0 w-[500px]">
                            <div className="bg-blue-100 text-blue-800 border-blue-200 border rounded-md px-4 py-3 text-sm font-medium">ELECTRO SHOP</div>
                            <div className="bg-purple-100 text-purple-800 border-purple-200 border rounded-md px-4 py-3 text-sm font-medium">WHEEL TURNING</div>
                        </div>
                        <div className="flex gap-3 shrink-0 ml-auto">
                            <div className="bg-green-100 text-green-800 border-green-200 border rounded-md px-4 py-3 text-sm font-medium">OFFICE</div>
                            <div className="bg-amber-100 text-amber-800 border-amber-200 border rounded-md px-4 py-3 text-sm font-medium">GE PARTS WAREHOUSE</div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 pb-4">
                        <div className="w-20 shrink-0"></div>
                        <div className="w-full max-w-[800px] flex justify-center shrink-0">
                            <div className="bg-slate-100 text-slate-700 border-slate-200 border rounded-md px-8 py-3 text-sm font-medium">MECHANICAL SHOP</div>
                        </div>
                    </div>

                    {/* Tracks 4-6 */}
                    {[4, 5, 6].map(track => (
                        <div key={track} className="flex items-center gap-4">
                            <div className="w-20 font-medium text-slate-500 text-right shrink-0">Track {track}</div>
                            <div className="flex gap-3 shrink-0">
                                {[1, 2, 3, 4, 5, 6].map(pos => renderSlot(track, pos))}
                            </div>
                            <div className="text-slate-300 ml-4 shrink-0 text-xl tracking-widest">◄──</div>
                        </div>
                    ))}
                </div>
            </main>

            {/* Add Dialog */}
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Добавить локомотив</DialogTitle>
                    </DialogHeader>

                    <form onSubmit={handleAddSubmit} className="space-y-4 pt-4">
                        <div className="space-y-2 flex flex-col">
                            <Label>Номер локомотива</Label>
                            <Popover open={isNumberOpen} onOpenChange={setIsNumberOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={isNumberOpen}
                                        className="w-full justify-between"
                                    >
                                        {addNumber
                                            ? catalog.find((item) => item.number === addNumber)?.number || addNumber
                                            : "Выберите номер из справочника..."}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[400px] p-0" align="start">
                                    <Command>
                                        <CommandInput placeholder="Поиск номера..." />
                                        <CommandList>
                                            <CommandEmpty>Номер не найден в справочнике.</CommandEmpty>
                                            <CommandGroup>
                                                {catalog.map((item) => (
                                                    <CommandItem
                                                        key={item.number}
                                                        value={item.number}
                                                        onSelect={(currentValue: string) => {
                                                            setAddNumber(currentValue === addNumber ? "" : currentValue)
                                                            setIsNumberOpen(false)
                                                        }}
                                                    >
                                                        <Check
                                                            className={cn(
                                                                "mr-2 h-4 w-4",
                                                                addNumber === item.number ? "opacity-100" : "opacity-0"
                                                            )}
                                                        />
                                                        {item.number}
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>

                        <div className="space-y-2">
                            <Label>Статус</Label>
                            <Select value={addStatus} onValueChange={setAddStatus}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="active">Активный</SelectItem>
                                    <SelectItem value="repair">Ремонт</SelectItem>
                                    <SelectItem value="waiting">Ожидание</SelectItem>
                                    <SelectItem value="completed">Завершён</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Путь (Track)</Label>
                                <Select value={addTrack} onValueChange={setAddTrack}>
                                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">—</SelectItem>
                                        {[1, 2, 3, 4, 5, 6].map(t => <SelectItem key={t} value={t.toString()}>Track {t}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Позиция (Slot)</Label>
                                <Select value={addPosition} onValueChange={setAddPosition}>
                                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">—</SelectItem>
                                        {[1, 2, 3, 4, 5, 6].map(p => <SelectItem key={p} value={p.toString()}>Slot {p}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <DialogFooter className="pt-4">
                            <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>Отмена</Button>
                            <Button type="submit">Добавить на карту</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Info Dialog */}
            <Dialog open={isInfoOpen} onOpenChange={setIsInfoOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Локомотив #{selectedLoco?.number}</DialogTitle>
                    </DialogHeader>
                    {selectedLoco && (
                        <div className="space-y-4 py-4">
                            <div className="grid grid-cols-2 gap-y-2 text-sm">
                                <div className="text-slate-500">Номер:</div>
                                <div className="font-medium">{selectedLoco.number}</div>

                                <div className="text-slate-500">Статус:</div>
                                <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${statusColors[selectedLoco.status]}`} />
                                    {statusLabels[selectedLoco.status]}
                                </div>

                                <div className="text-slate-500">Позиция:</div>
                                <div>{selectedLoco.track ? `Track ${selectedLoco.track}, Slot ${selectedLoco.position}` : '—'}</div>

                                <div className="text-slate-500">Добавлен:</div>
                                <div>{new Date(selectedLoco.created_at).toLocaleString()}</div>
                            </div>

                            <div className="flex gap-2 pt-4">
                                <Button variant="destructive" onClick={handleDelete} className="flex-1 gap-2">
                                    <Trash2 className="w-4 h-4" /> Удалить
                                </Button>
                                <Button variant="secondary" onClick={handleRemoveFromTrack} className="flex-1 gap-2">
                                    <ArrowLeftFromLine className="w-4 h-4" /> Убрать с пути
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
