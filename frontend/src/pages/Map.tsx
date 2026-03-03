import React, { useEffect, useState, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useDebounce } from "@/hooks/useDebounce"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Plus, Search, RefreshCw, Trash2, ArrowLeftFromLine, Check, ChevronsUpDown, Printer, Clock, History, ListTodo } from "lucide-react"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { supabase } from "@/lib/supabase"

export type LocoStatus = 'active' | 'repair' | 'waiting' | 'completed';

export interface Location {
    id: number;
    name: string;
    track_count: number;
    slot_count: number;
    gate_position: string | number | null;
    track_config: string | null;
}

export interface Locomotive {
    id: number;
    number: string;
    status: LocoStatus;
    track: number | null;
    position: number | null;
    created_at: string;
    repair_type: string | null;
    planned_release: string | null;
}

const statusColors = {
    active: 'bg-green-500',
    repair: 'bg-red-500',
    waiting: 'bg-yellow-500',
    completed: 'bg-blue-500',
};

const statusLabels: Record<string, string> = {
    active: 'Активный',
    repair: 'Ремонт',
    waiting: 'Ожидание',
    completed: 'Завершён',
};

const LocoCard = React.memo(({ loco, isHighlighted, canMove, onDragStart, onClick }: { loco: Locomotive, isHighlighted: boolean, canMove: boolean, onDragStart: (e: React.DragEvent<HTMLDivElement>, id: number) => void, onClick: (loco: Locomotive) => void }) => {
    return (
        <TooltipProvider delayDuration={200}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div
                        draggable={canMove}
                        onDragStart={(e) => {
                            if (canMove) {
                                onDragStart(e, loco.id)
                            }
                        }}
                        onClick={(e) => { e.stopPropagation(); onClick(loco) }}
                        className={`relative w-[92%] h-[65%] mt-3 rounded-sm shadow-md cursor-pointer transition-all flex flex-row border border-slate-800 group/loco
                            ${isHighlighted ? 'ring-4 ring-blue-500 ring-offset-1 z-10 scale-105' : 'hover:scale-105 hover:z-10 z-0'}
                        `}
                    >
                        <div className="w-1/4 h-full bg-slate-700 relative border-r border-slate-900 flex items-center justify-center overflow-hidden rounded-l-sm">
                            <div className="absolute inset-y-1 right-1 w-1/3 bg-blue-200/30 rounded-sm" />
                            <div className={`w-2.5 h-2.5 rounded-full ${statusColors[loco.status]} border border-slate-900 shadow-sm relative z-10 ring-1 ring-black/20`} />
                        </div>
                        <div className="flex-1 h-full bg-gradient-to-r from-red-700 to-red-500 relative flex items-center justify-center overflow-hidden group-hover/loco:brightness-110 transition-all">
                            <div className="absolute top-[20%] w-full h-[2px] bg-yellow-400 opacity-90" />
                            <div className="absolute bottom-[20%] w-full h-[2px] bg-yellow-400 opacity-90" />
                            <div className="bg-slate-900 px-2 py-0.5 rounded-sm text-white font-mono font-bold text-xs z-10 shadow-inner border border-slate-700/80 drop-shadow-md">
                                {loco.number}
                            </div>
                        </div>
                        <div className="w-[6px] h-full bg-slate-800 rounded-r-sm flex flex-col justify-between py-1 border-l border-slate-900/50">
                            <div className="w-full h-[2px] bg-yellow-200 shadow-[0_0_2px_1px_rgba(253,230,138,0.5)]" />
                            <div className="w-full h-[2px] bg-yellow-200 shadow-[0_0_2px_1px_rgba(253,230,138,0.5)]" />
                        </div>
                    </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs space-y-0.5">
                    <p className="font-bold">{loco.number}</p>
                    <p>{statusLabels[loco.status]}{loco.repair_type ? ` • ${loco.repair_type}` : ''}</p>
                    {(() => {
                        const days = Math.floor((Date.now() - new Date(loco.created_at).getTime()) / (1000 * 60 * 60 * 24));
                        return <p>На пути: {days === 0 ? 'сегодня' : `${days} дн.`}</p>
                    })()}
                    {loco.planned_release && (
                        <p>Выпуск: {new Date(loco.planned_release).toLocaleDateString('ru-RU')}</p>
                    )}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
});

export default function MapPage() {
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    const [draggedId, setDraggedId] = useState<string | null>(null)
    const [isRemoveReasonOpen, setIsRemoveReasonOpen] = useState(false)
    const [removeReason, setRemoveReason] = useState("")
    const [pendingMove, setPendingMove] = useState<{ locoId: string; locoNumber: string; fromTrack: number | null; fromPos: number | null; toTrack: number; toPos: number } | null>(null)

    // Search and filters
    const [searchQuery, setSearchQuery] = useState("")
    const debouncedSearch = useDebounce(searchQuery, 400)
    const [statusFilter, setStatusFilter] = useState<string>("all")

    // Add Form State
    const [isAddOpen, setIsAddOpen] = useState(false)
    const [isInfoOpen, setIsInfoOpen] = useState(false)
    const [selectedLoco, setSelectedLoco] = useState<Locomotive | null>(null)
    const [addNumber, setAddNumber] = useState("")
    const [addStatus, setAddStatus] = useState<string>("active")
    const [addTrack, setAddTrack] = useState<string>("")
    const [addPosition, setAddPosition] = useState<string>("")
    const [addRepairType, setAddRepairType] = useState<string>("")
    const [addPlannedRelease, setAddPlannedRelease] = useState<string>("")
    const [isNumberOpen, setIsNumberOpen] = useState(false)

    // Transfer State
    const [isTransferOpen, setIsTransferOpen] = useState(false)
    const [transferLocationId, setTransferLocationId] = useState<string>("")

    // React Query Hooks
    const { data: user } = useQuery({
        queryKey: ['me'],
        queryFn: () => fetch('/api/me').then(res => res.json()).then(d => d.user)
    })

    const { data: locations = [] } = useQuery({
        queryKey: ['locations'],
        queryFn: () => fetch('/api/locations').then(res => res.json()),
        enabled: !!user
    })

    const { data: locomotives = [], isLoading: isLoadingLocos } = useQuery({
        queryKey: ['locomotives'],
        queryFn: () => fetch("/api/locomotives").then(res => res.json())
    })

    const { data: catalog = [] } = useQuery({
        queryKey: ['catalog'],
        queryFn: () => fetch("/api/catalog").then(res => res.json())
    })

    const { data: repairTypes = [] } = useQuery({
        queryKey: ['repair-types'],
        queryFn: () => fetch("/api/repair-types").then(res => res.json()).then((d: any[]) => d.map((r: any) => r.name))
    })

    // Setup Dynamic Configs
    const activeLocation = (locations as Location[]).find((l: Location) => l.id == user?.active_location_id)
    const trackCount = activeLocation?.track_count || 6
    const slotCount = activeLocation?.slot_count || 6
    const gatePositionRaw = (activeLocation?.gate_position?.toString() || "").split(',').filter((s: string) => s !== "0" && s !== "").join(',')
    const isInside = (pos: number) => {
        if (!gatePositionRaw) return false;
        if (gatePositionRaw.includes(',')) {
            return gatePositionRaw.split(',').includes(pos.toString());
        }
        const num = parseInt(gatePositionRaw);
        return !isNaN(num) && pos <= num;
    };

    const trackConfigObj = (activeLocation?.track_config?.toString() || "").split(',').filter((s: string) => s).reduce((acc: Record<string, string>, curr: string) => {
        const [t, l] = curr.split(':');
        acc[t] = l;
        return acc;
    }, {});

    // No manual fetch needed on mount, handled by React Query

    useEffect(() => {
        if (!user?.active_location_id) return;

        const channel = supabase
            .channel('public:locomotives')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'locomotives' },
                () => {
                    // Simple and robust: just invalidate the list
                    queryClient.invalidateQueries({ queryKey: ['locomotives'] })
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [user?.active_location_id, queryClient])

    // Mutations
    const addMutation = useMutation({
        mutationFn: (payload: any) => fetch("/api/locomotives", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        }).then(async res => {
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            return data
        }),
        onSuccess: (data) => {
            toast.success(`Локомотив ${data.number} добавлен`)
            setIsAddOpen(false)
            setAddNumber("")
            setAddTrack("")
            setAddPosition("")
            setAddRepairType("")
            setAddPlannedRelease("")
            queryClient.invalidateQueries({ queryKey: ['locomotives'] })
        },
        onError: (err: Error) => toast.error(err.message)
    })

    const moveMutation = useMutation({
        mutationFn: ({ id, track, position, reason }: { id: string | number, track: number | null, position: number | null, reason?: string }) =>
            fetch(`/api/locomotives/${id}/move`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ track, position, reason })
            }).then(async res => {
                const data = await res.json()
                if (!res.ok) throw new Error(data.error)
                return data
            }),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['locomotives'] })
            toast.success(`Локомотив #${data.number} перемещён`)
        },
        onError: (err: Error) => toast.error(err.message)
    })

    const deleteMutation = useMutation({
        mutationFn: (id: number) => fetch(`/api/locomotives/${id}`, { method: "DELETE" }).then(async res => {
            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error)
            }
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['locomotives'] })
            setIsInfoOpen(false)
            toast.success("Локомотив удалён")
        },
        onError: (err: Error) => toast.error(err.message)
    })

    const transferMutation = useMutation({
        mutationFn: ({ id, target_location_id }: { id: number, target_location_id: number }) =>
            fetch(`/api/locomotives/${id}/transfer`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ target_location_id })
            }).then(async res => {
                const data = await res.json()
                if (!res.ok) throw new Error(data.error)
                return data
            }),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['locomotives'] })
            setIsTransferOpen(false)
            setIsInfoOpen(false)
            toast.success(`Локомотив #${data.number} передан`)
        },
        onError: (err: Error) => toast.error(err.message)
    })

    const handleAddSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!addNumber) return
        addMutation.mutate({
            number: addNumber,
            status: addStatus,
            track: addTrack ? parseInt(addTrack) : null,
            position: addPosition ? parseInt(addPosition) : null,
            repair_type: addRepairType || null,
            planned_release: addPlannedRelease || null
        })
    }

    const handleDelete = () => {
        if (!selectedLoco) return
        if (!confirm(`Удалить локомотив #${selectedLoco.number}?`)) return
        deleteMutation.mutate(selectedLoco.id)
    }

    const handleRemoveFromTrack = () => {
        if (!selectedLoco) return
        setRemoveReason("")
        setIsRemoveReasonOpen(true)
    }

    const confirmRemoveFromTrack = () => {
        if (!selectedLoco || !removeReason) return
        moveMutation.mutate({ id: selectedLoco.id, track: null, position: null, reason: removeReason })
        setIsRemoveReasonOpen(false)
        setIsInfoOpen(false)
    }

    const handleTransfer = () => {
        if (!selectedLoco || !transferLocationId) return
        transferMutation.mutate({ id: selectedLoco.id, target_location_id: parseInt(transferLocationId) })
    }

    const confirmMove = () => {
        if (!pendingMove) return
        moveMutation.mutate({
            id: pendingMove.locoId,
            track: pendingMove.toTrack,
            position: pendingMove.toPos
        })
        setPendingMove(null)
    }

    const filteredLocos = useMemo(() => {
        return (locomotives || []).filter((l: Locomotive) => {
            const matchSearch = l.number.toLowerCase().includes(debouncedSearch.toLowerCase())
            const matchStatus = statusFilter === "all" || l.status === statusFilter
            return matchSearch && matchStatus
        })
    }, [locomotives, debouncedSearch, statusFilter])

    // Drag and Drop
    const handleDragStart = (e: React.DragEvent<HTMLDivElement>, id: number) => {
        setDraggedId(id.toString())
        e.dataTransfer.setData("text/plain", id.toString())
        e.dataTransfer.effectAllowed = "move"
    }

    const handleDrop = (e: React.DragEvent<HTMLDivElement>, track: number, pos: number) => {
        e.preventDefault()
        if (!draggedId) return

        const existing = (locomotives as Locomotive[]).find((l: Locomotive) => l.track === track && l.position === pos)
        if (existing && existing.id.toString() !== draggedId) {
            toast.error("Позиция уже занята")
            setDraggedId(null)
            return
        }

        const loco = locomotives.find((l: Locomotive) => l.id.toString() === draggedId)
        if (!loco) { setDraggedId(null); return }

        if (loco.track === track && loco.position === pos) {
            setDraggedId(null)
            return
        }

        setPendingMove({
            locoId: draggedId,
            locoNumber: loco.number,
            fromTrack: loco.track,
            fromPos: loco.position,
            toTrack: track,
            toPos: pos
        })
        setDraggedId(null)
    }

    const locoMap = React.useMemo(() => {
        const map = new Map<string, Locomotive>();
        filteredLocos.forEach((l: Locomotive) => {
            if (l.track !== null && l.position !== null) {
                map.set(`${l.track}-${l.position}`, l);
            }
        });
        return map;
    }, [filteredLocos]);

    // Use filteredLocos for rendering the map
    const handleSlotClick = (track: number, pos: number) => {
        setAddTrack(track.toString())
        setAddPosition(pos.toString())
        setAddNumber("")
        setAddStatus("active")
        setAddRepairType("")
        setAddPlannedRelease("")
        setIsAddOpen(true)
    }

    const renderSlot = (track: number, pos: number) => {
        const loco = locoMap.get(`${track}-${pos}`)
        const isHighlighted = !!(loco && searchQuery && loco.number.toLowerCase().includes(searchQuery.toLowerCase()))
        const canMove = !!(user?.role === 'admin' || user?.permissions?.can_move_locomotives)
        const canEdit = !!(user?.role === 'admin' || user?.permissions?.can_edit_catalog)

        return (
            <div
                key={`${track}-${pos}`}
                className={`relative w-32 h-16 border rounded-md flex items-center justify-center transition-colors
          ${draggedId ? 'border-dashed border-2 border-slate-300 hover:border-slate-500 hover:bg-slate-50' : 'border-slate-200'}
          ${!loco && !draggedId ? 'cursor-pointer hover:bg-indigo-50 hover:border-indigo-300 group' : ''}
          ${!isInside(pos) ? 'bg-slate-100/50' : 'bg-white shadow-sm'}
        `}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDrop(e, track, pos)}
                onClick={() => { if (!loco && !draggedId && canEdit) handleSlotClick(track, pos) }}
            >
                <div className="absolute top-1 left-2 text-xs text-slate-400 font-mono">{pos}</div>

                {loco ? (
                    <LocoCard
                        loco={loco}
                        isHighlighted={isHighlighted}
                        canMove={canMove}
                        onDragStart={handleDragStart}
                        onClick={(loco) => { setSelectedLoco(loco); setIsInfoOpen(true) }}
                    />
                ) : (
                    <Plus className="w-5 h-5 text-indigo-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
            </div>
        )
    }

    return (
        <div className="flex-1 flex flex-col items-center overflow-auto bg-slate-50/50">
            <main className="flex-1 w-full p-4 md:p-6 flex flex-col items-center">
                {/* Toolbar */}
                <div className="w-full max-w-6xl flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-8">
                    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center w-full">
                        <h2 className="hidden text-xl md:text-2xl font-bold tracking-tight text-slate-900 border-b lg:border-none pb-2 lg:pb-0 w-full lg:w-auto">Карта депо</h2>
                        <div className="flex flex-wrap gap-2 text-sm sm:ml-4 sm:border-l sm:pl-4">
                            <button
                                onClick={() => setStatusFilter("all")}
                                className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${statusFilter === 'all' ? 'bg-slate-200 text-slate-800 ring-1 ring-slate-300' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`}
                            >
                                Все
                            </button>
                            {Object.entries(statusLabels).map(([k, v]) => {
                                const count = (locomotives as Locomotive[] || []).filter((loco: Locomotive) => loco.status === k && loco.track !== null).length
                                return (
                                    <button
                                        key={k}
                                        onClick={() => setStatusFilter(statusFilter === k ? "all" : k)}
                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${statusFilter === k ? 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200' : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 hover:text-slate-800'}`}
                                    >
                                        <div className={`w-2.5 h-2.5 rounded-full ${statusColors[k as LocoStatus]}`} />
                                        <span>{v}</span>
                                        <span className="bg-white/50 text-slate-500 font-bold text-[10px] px-1.5 py-0.5 rounded-full border border-current opacity-70 group-hover:opacity-100">{count}</span>
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    <div className="flex items-center gap-3 w-full lg:w-auto justify-between lg:justify-end border-t lg:border-none pt-4 lg:pt-0">
                        <div className="flex items-center gap-3 flex-1 lg:flex-none">
                            <div className="relative flex-1 lg:flex-none">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                                <Input
                                    placeholder="Поиск..."
                                    className="pl-9 w-full lg:w-48 bg-white"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                />
                            </div>
                            <Button variant="outline" size="icon" className="shrink-0 bg-white" onClick={() => queryClient.invalidateQueries({ queryKey: ['locomotives'] })}>
                                <RefreshCw className={`h-4 w-4 ${isLoadingLocos ? 'animate-spin' : ''}`} />
                            </Button>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                            <Button variant="outline" size="icon" className="bg-white hidden sm:flex" onClick={() => window.print()} title="Печать карты">
                                <Printer className="h-4 w-4" />
                            </Button>
                            {(user?.role === 'admin' || user?.permissions?.can_edit_catalog) && (
                                <Button onClick={() => setIsAddOpen(true)} className="gap-2 shadow-sm">
                                    <Plus className="h-4 w-4" /> <span className="hidden xs:inline">Добавить</span>
                                </Button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Depot Map Container */}
                <div className="flex-1 w-full overflow-x-auto pb-8 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                    <div className="min-w-max">
                        {isLoadingLocos ? (
                            <div className="space-y-4 animate-pulse">
                                {Array.from({ length: trackCount }).map((_, i) => {
                                    const trackNum = i + 1;
                                    return (
                                        <div key={`skeleton-track-${trackNum}`} className="flex items-center gap-4">
                                            <div className="w-20 font-medium text-slate-300 text-right shrink-0">Путь {trackNum}</div>
                                            <div className="flex gap-3 shrink-0">
                                                {Array.from({ length: slotCount }).map((_, posIdx) => {
                                                    const pos = posIdx + 1;
                                                    return (
                                                        <React.Fragment key={posIdx}>
                                                            <div className={`relative w-24 h-16 border-2 border-dashed border-slate-200 rounded flex flex-col justify-center items-center gap-2 p-1 ${!isInside(pos) ? 'bg-slate-100/30' : 'bg-slate-50/50'}`}>
                                                                <Skeleton className="h-4 w-12" />
                                                                <Skeleton className="h-2 w-16" />
                                                            </div>
                                                            {pos < slotCount && isInside(pos) !== isInside(pos + 1) && (
                                                                <div className="w-3 h-12 border-x border-dashed border-slate-300 mx-1 shrink-0 opacity-50" />
                                                            )}
                                                            {pos === slotCount && (
                                                                <div className="w-3 h-12 shrink-0" />
                                                            )}
                                                        </React.Fragment>
                                                    )
                                                })}
                                            </div>
                                            <div className="text-slate-200 ml-4 shrink-0 text-xl tracking-widest">◄──</div>
                                        </div>
                                    )
                                })}
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {Array.from({ length: trackCount }).map((_, i) => {
                                    const trackNum = i + 1;
                                    const trackLabel = trackConfigObj[trackNum];
                                    return (
                                        <React.Fragment key={trackNum}>
                                            {trackLabel && (
                                                <div className="flex items-center gap-4 mt-8 mb-4">
                                                    <div className="w-20 shrink-0" />
                                                    <div className="flex flex-1 items-center gap-4">
                                                        <div className="h-[1px] flex-1 bg-slate-100" />
                                                        <span className="text-[10px] font-bold tracking-[0.2em] text-slate-400 uppercase whitespace-nowrap">
                                                            {trackLabel}
                                                        </span>
                                                        <div className="h-[1px] flex-[10] bg-slate-100" />
                                                    </div>
                                                </div>
                                            )}
                                            <div className="flex items-center gap-4">
                                                <div className="w-20 font-medium text-slate-500 text-right shrink-0">Путь {trackNum}</div>
                                                <div className="flex gap-3 shrink-0">
                                                    {Array.from({ length: slotCount }).map((_, j) => {
                                                        const pos = j + 1;
                                                        return (
                                                            <React.Fragment key={j}>
                                                                {renderSlot(trackNum, pos)}
                                                                {pos < slotCount && isInside(pos) !== isInside(pos + 1) && (
                                                                    <div className="w-4 h-16 flex flex-col justify-between py-1 shrink-0 items-center">
                                                                        <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                                                                        <div className="w-[1px] h-full bg-gradient-to-b from-slate-200 via-slate-400 to-slate-200" />
                                                                        <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                                                                    </div>
                                                                )}
                                                                {pos === slotCount && <div className="w-4 h-16 shrink-0" />}
                                                            </React.Fragment>
                                                        )
                                                    })}
                                                </div>
                                                <div className="text-slate-300 ml-4 shrink-0 text-xl tracking-widest">◄──</div>
                                            </div>
                                        </React.Fragment>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {/* Add Dialog */}
            < Dialog open={isAddOpen} onOpenChange={setIsAddOpen} >
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
                                            ? catalog.find((item: { number: string }) => item.number === addNumber)?.number || addNumber
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
                                                {catalog.map((item: { number: string }) => (
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
                                <Label>Путь</Label>
                                <Select value={addTrack} onValueChange={setAddTrack}>
                                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">—</SelectItem>
                                        {Array.from({ length: trackCount }).map((_, i) => <SelectItem key={i + 1} value={(i + 1).toString()}>Путь {i + 1}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Позиция</Label>
                                <Select value={addPosition} onValueChange={setAddPosition}>
                                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">—</SelectItem>
                                        {Array.from({ length: slotCount }).map((_, i) => <SelectItem key={i + 1} value={(i + 1).toString()}>Слот {i + 1}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Тип ремонта</Label>
                                <Select value={addRepairType} onValueChange={setAddRepairType}>
                                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">—</SelectItem>
                                        {repairTypes.map((rt: string) => <SelectItem key={rt} value={rt}>{rt}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>План. выпуск</Label>
                                <Input type="date" value={addPlannedRelease} onChange={e => setAddPlannedRelease(e.target.value)} />
                            </div>
                        </div>
                        <DialogFooter className="pt-4">
                            <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>Отмена</Button>
                            <Button type="submit">Добавить на карту</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog >

            {/* Info Dialog */}
            < Dialog open={isInfoOpen} onOpenChange={setIsInfoOpen} >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Локомотив #{selectedLoco?.number}</DialogTitle>
                    </DialogHeader>
                    {selectedLoco && (() => {
                        const daysOnTrack = selectedLoco.track
                            ? Math.floor((Date.now() - new Date(selectedLoco.created_at).getTime()) / (1000 * 60 * 60 * 24))
                            : null
                        return (
                            <div className="space-y-4 py-4">
                                <div className="grid grid-cols-2 gap-y-3 text-sm">
                                    <div className="text-slate-500">Номер:</div>
                                    <div className="font-medium">{selectedLoco.number}</div>

                                    <div className="text-slate-500">Статус:</div>
                                    <div>
                                        <Select
                                            disabled={!(user?.role === 'admin' || user?.permissions?.can_edit_catalog)}
                                            value={selectedLoco.status}
                                            onValueChange={async (val) => {
                                                try {
                                                    const res = await fetch(`/api/locomotives/${selectedLoco.id}`, {
                                                        method: "PUT",
                                                        headers: { "Content-Type": "application/json" },
                                                        body: JSON.stringify({ status: val })
                                                    })
                                                    if (res.ok) {
                                                        toast.success(`Статус изменён на: ${statusLabels[val as LocoStatus]}`)
                                                        setSelectedLoco({ ...selectedLoco, status: val as LocoStatus })
                                                        queryClient.invalidateQueries({ queryKey: ['locomotives'] })
                                                    }
                                                } catch (e) { toast.error("Ошибка сети") }
                                            }}
                                        >
                                            <SelectTrigger className="h-8 w-40">
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-2 h-2 rounded-full ${statusColors[selectedLoco.status]}`} />
                                                    <SelectValue />
                                                </div>
                                            </SelectTrigger>
                                            <SelectContent>
                                                {Object.entries(statusLabels).map(([k, v]) => (
                                                    <SelectItem key={k} value={k}>
                                                        <span className="flex items-center gap-2">
                                                            <span className={`w-2 h-2 rounded-full ${statusColors[k as LocoStatus]}`} />
                                                            {v}
                                                        </span>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="text-slate-500">Позиция:</div>
                                    <div>{selectedLoco.track ? `Путь ${selectedLoco.track}, Слот ${selectedLoco.position}` : '—'}</div>

                                    {daysOnTrack !== null && (
                                        <>
                                            <div className="text-slate-500">На пути:</div>
                                            <div className="flex items-center gap-1.5">
                                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                                <span className={daysOnTrack > 7 ? 'text-red-600 font-semibold' : ''}>
                                                    {daysOnTrack === 0 ? 'Сегодня' : `${daysOnTrack} дн.`}
                                                </span>
                                                {daysOnTrack > 7 && <span className="text-xs text-red-500">⚠️</span>}
                                            </div>
                                        </>
                                    )}

                                    <div className="text-slate-500">Добавлен:</div>
                                    <div>{new Date(selectedLoco.created_at).toLocaleString()}</div>

                                    <div className="text-slate-500">Тип ремонта:</div>
                                    <div>
                                        <Select
                                            disabled={!(user?.role === 'admin' || user?.permissions?.can_edit_catalog)}
                                            value={selectedLoco.repair_type || "none"}
                                            onValueChange={async (val) => {
                                                const finalVal = val === "none" ? null : val;
                                                try {
                                                    const res = await fetch(`/api/locomotives/${selectedLoco.id}`, {
                                                        method: "PUT",
                                                        headers: { "Content-Type": "application/json" },
                                                        body: JSON.stringify({ repair_type: finalVal })
                                                    })
                                                    if (res.ok) {
                                                        toast.success(`Тип ремонта обновлен`)
                                                        setSelectedLoco({ ...selectedLoco, repair_type: finalVal })
                                                        queryClient.invalidateQueries({ queryKey: ['locomotives'] })
                                                    }
                                                } catch (e) { toast.error("Ошибка сети") }
                                            }}
                                        >
                                            <SelectTrigger className="h-8 w-40">
                                                <SelectValue placeholder="—" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">—</SelectItem>
                                                {repairTypes.map((rt: string) => <SelectItem key={rt} value={rt}>{rt}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="text-slate-500">План. выпуск:</div>
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <Input
                                                disabled={!(user?.role === 'admin' || user?.permissions?.can_edit_catalog)}
                                                type="date"
                                                className="h-8 w-40 text-sm"
                                                value={selectedLoco.planned_release ? selectedLoco.planned_release.split('T')[0] : ""}
                                                onChange={async (e) => {
                                                    const val = e.target.value || null;
                                                    try {
                                                        const res = await fetch(`/api/locomotives/${selectedLoco.id}`, {
                                                            method: "PUT",
                                                            headers: { "Content-Type": "application/json" },
                                                            body: JSON.stringify({ planned_release: val })
                                                        })
                                                        if (res.ok) {
                                                            toast.success(`Дата выпуска обновлена`)
                                                            setSelectedLoco({ ...selectedLoco, planned_release: val })
                                                            queryClient.invalidateQueries({ queryKey: ['locomotives'] })
                                                        }
                                                    } catch (err) { toast.error("Ошибка сети") }
                                                }}
                                            />
                                            {selectedLoco.planned_release && (() => {
                                                const releaseDate = new Date(selectedLoco.planned_release!)
                                                const daysLeft = Math.ceil((releaseDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                                                return (
                                                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${daysLeft < 0 ? 'bg-red-100 text-red-700' :
                                                        daysLeft <= 3 ? 'bg-amber-100 text-amber-700' :
                                                            'bg-green-100 text-green-700'
                                                        }`}>
                                                        {daysLeft < 0 ? `-${Math.abs(daysLeft)} дн.` : daysLeft === 0 ? 'сегодня' : `+${daysLeft} дн.`}
                                                    </span>
                                                )
                                            })()}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-2 pt-4">
                                    {user?.role === 'admin' && (
                                        <Button variant="destructive" onClick={handleDelete} className="gap-2">
                                            <Trash2 className="w-4 h-4" /> Удалить
                                        </Button>
                                    )}
                                    <Button variant="outline" onClick={() => { setIsInfoOpen(false); navigate(`/locomotive/${selectedLoco.id}/remarks`) }} className="gap-2">
                                        <ListTodo className="w-4 h-4" /> Замечания
                                    </Button>
                                    <Button variant="outline" onClick={() => { setIsInfoOpen(false); navigate(`/history/${encodeURIComponent(selectedLoco.number)}`) }} className="gap-2">
                                        <History className="w-4 h-4" /> История
                                    </Button>
                                    {selectedLoco.track && (user?.role === 'admin' || user?.permissions?.can_move_locomotives) && (
                                        <Button variant="secondary" onClick={handleRemoveFromTrack} className="gap-2">
                                            <ArrowLeftFromLine className="w-4 h-4" /> Убрать с пути
                                        </Button>
                                    )}
                                    {user?.is_global_admin && (
                                        <Button variant="outline" onClick={() => setIsTransferOpen(true)} className="gap-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800">
                                            Передать в другое депо
                                        </Button>
                                    )}
                                </div>
                            </div>
                        )
                    })()}
                </DialogContent>
            </Dialog >

            {/* Move Confirmation Dialog */}
            < Dialog open={!!pendingMove} onOpenChange={(open) => { if (!open) setPendingMove(null) }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Подтвердите перемещение</DialogTitle>
                    </DialogHeader>
                    {pendingMove && (
                        <div className="space-y-4 py-2">
                            <p className="text-sm text-slate-600">
                                Вы хотите переместить локомотив <span className="font-bold text-slate-900">#{pendingMove.locoNumber}</span>:
                            </p>
                            <div className="flex items-center gap-3 text-sm">
                                <div className="bg-slate-100 rounded-lg px-4 py-3 flex-1 text-center">
                                    <div className="text-xs text-slate-500 mb-1">Откуда</div>
                                    <div className="font-semibold">{pendingMove.fromTrack ? `Путь ${pendingMove.fromTrack}, Слот ${pendingMove.fromPos}` : '—'}</div>
                                </div>
                                <span className="text-slate-400 text-lg">→</span>
                                <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-3 flex-1 text-center">
                                    <div className="text-xs text-indigo-500 mb-1">Куда</div>
                                    <div className="font-semibold text-indigo-700">Путь {pendingMove.toTrack}, Слот {pendingMove.toPos}</div>
                                </div>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setPendingMove(null)}>Отмена</Button>
                        <Button onClick={confirmMove}>Подтвердить</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog >

            {/* Remove Reason Dialog */}
            < Dialog open={isRemoveReasonOpen} onOpenChange={setIsRemoveReasonOpen} >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Причина снятия с пути</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 pt-2">
                        <p className="text-sm text-slate-500">
                            Локомотив <span className="font-semibold text-slate-900">#{selectedLoco?.number}</span> — выберите причину:
                        </p>
                        <div className="grid gap-2">
                            {[
                                "Выпуск из ремонта",
                                "Перестановка на другой путь",
                                "Отправка на линию",
                                "Передача другому депо",
                                "Ожидание запчастей",
                                "Другое"
                            ].map((reason) => (
                                <Button
                                    key={reason}
                                    variant={removeReason === reason ? "default" : "outline"}
                                    className={`justify-start text-left h-auto py-3 ${removeReason === reason ? 'bg-indigo-600 hover:bg-indigo-700' : ''}`}
                                    onClick={() => setRemoveReason(reason)}
                                >
                                    {reason}
                                </Button>
                            ))}
                        </div>
                        {removeReason === "Другое" && (
                            <Input
                                placeholder="Укажите причину..."
                                value={removeReason === "Другое" ? "" : removeReason}
                                onChange={(e) => setRemoveReason(e.target.value || "Другое")}
                                autoFocus
                            />
                        )}
                    </div>
                    <DialogFooter className="pt-4">
                        <Button variant="outline" onClick={() => setIsRemoveReasonOpen(false)}>Отмена</Button>
                        <Button onClick={confirmRemoveFromTrack} disabled={!removeReason}>Подтвердить</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog >

            {/* Transfer Dialog */}
            < Dialog open={isTransferOpen} onOpenChange={setIsTransferOpen} >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Передача локомотива #{selectedLoco?.number}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                        <div className="space-y-2">
                            <Label>Депо назначения</Label>
                            <Select value={transferLocationId} onValueChange={setTransferLocationId}>
                                <SelectTrigger><SelectValue placeholder="Выберите депо..." /></SelectTrigger>
                                <SelectContent>
                                    {locations.filter((l: Location) => l.id !== user?.active_location_id).map((l: Location) => (
                                        <SelectItem key={l.id} value={l.id.toString()}>{l.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsTransferOpen(false)}>Отмена</Button>
                        <Button onClick={handleTransfer} disabled={!transferLocationId}>Передать</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog >
        </div >
    )
}
