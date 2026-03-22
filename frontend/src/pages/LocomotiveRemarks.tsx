import { useState, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useParams, useNavigate } from "react-router-dom"
import { 
    ChevronLeft, 
    RefreshCw, 
    ClipboardCheck, 
    Plus, 
    BookOpen, 
    Download,
    Search,
    ClipboardPaste,
    FileText,
    CheckCircle2,
    Wrench,
    Loader2,
    Trash2,
    Camera
} from "lucide-react"
import { format, differenceInDays, parseISO } from "date-fns"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { locomotiveApi } from "@/api/locomotiveService"
import { remarkApi } from "@/api/remarkService"
import { gaugeService, type Gauge } from "@/api/gaugeService"
import type { Remark, RemarkTemplate, RemarkUser, CreateRemarkDTO } from "@/types/remark"
import { RemarkItem } from "@/components/remarks/RemarkItem"
import { exportRemarksToExcel, exportRemarksToPDF } from "@/utils/exportRemarks"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { FloatingInput } from "@/components/ui/FloatingInput"
import { cn } from "@/lib/utils"

export default function LocomotiveRemarks() {
    const { id: locomotiveId } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    
    // --- SEARCH & FILTER STATE ---
    const [searchQuery, setSearchQuery] = useState("")

    // --- MODAL STATES ---
    const [isPasteOpen, setIsPasteOpen] = useState(false)
    const [pasteText, setPasteText] = useState("")
    const [isAddManualOpen, setIsAddManualOpen] = useState(false)
    const [isInstallGaugeOpen, setIsInstallGaugeOpen] = useState(false)
    const [selectedWarehouseGaugeId, setSelectedWarehouseGaugeId] = useState<string>("")
    const [installSide, setInstallSide] = useState<'K1' | 'K2'>('K1')
    const [manualRemark, setManualRemark] = useState<{ text: string, priority: "low" | "medium" | "high", category: string }>({ 
        text: "", 
        priority: "medium", 
        category: "" 
    })
    const [isCatalogOpen, setIsCatalogOpen] = useState(false)
    const [catalogSearch, setCatalogSearch] = useState("")
    const [rejectDialog, setRejectDialog] = useState<{ id: string, comment: string } | null>(null)
    const [addingTemplateIds, setAddingTemplateIds] = useState<number[]>([])
    const [addedTemplateIds, setAddedTemplateIds] = useState<number[]>([])

    // --- QUERIES ---
    const { data: locomotive } = useQuery({
        queryKey: ['locomotive', locomotiveId],
        queryFn: () => locomotiveApi.getById(locomotiveId!),
        enabled: !!locomotiveId
    })

    const { data: remarks = [], isLoading, isFetching, refetch } = useQuery<Remark[]>({
        queryKey: ['remarks', locomotiveId],
        queryFn: () => remarkApi.getByLocomotiveId(locomotiveId!),
        enabled: !!locomotiveId
    })

    const { data: locomotiveGauges = [] } = useQuery<Gauge[]>({
        queryKey: ['locomotive-gauges', locomotiveId],
        queryFn: () => gaugeService.getByLocomotive(locomotiveId!),
        enabled: !!locomotiveId
    })

    const { data: allUsers = [] } = useQuery<RemarkUser[]>({
        queryKey: ['users'],
        queryFn: () => locomotiveApi.getUsers(),
    })

    const { data: templates = [] } = useQuery<RemarkTemplate[]>({
        queryKey: ['remark-templates'],
        queryFn: () => fetch('/api/remark-templates').then(r => r.json()),
        staleTime: Infinity,
    })

    const { data: allGauges = [] } = useQuery<Gauge[]>({
        queryKey: ['gauges'],
        queryFn: gaugeService.getAll
    })

    const warehouseGauges = useMemo(() => {
        return allGauges.filter(g => g.status === 'На складе')
    }, [allGauges])

    const selectedWarehouseGauge = useMemo(() => {
        return warehouseGauges.find(g => g.id === selectedWarehouseGaugeId)
    }, [warehouseGauges, selectedWarehouseGaugeId])

    // --- MUTATIONS ---
    const addBatchMutation = useMutation({
        mutationFn: (texts: string[]) => remarkApi.bulkCreate(locomotiveId!, texts),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['remarks', locomotiveId] })
            toast.success("Замечания добавлены")
            setIsPasteOpen(false)
            setPasteText("")
        }
    })

    const completeBatchMutation = useMutation({
        mutationFn: (ids: string[]) => remarkApi.completeBatch(ids),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['remarks', locomotiveId] })
            toast.success("Все замечания отмечены как выполненные")
        }
    })

    const manualAddMutation = useMutation({
        mutationFn: (data: CreateRemarkDTO) => remarkApi.create(locomotiveId!, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['remarks', locomotiveId] })
            setIsAddManualOpen(false)
            setManualRemark({ text: "", priority: "medium", category: "" })
            toast.success("Замечание добавлено")
        }
    })

    const templateAddMutation = useMutation({
        mutationFn: (ids: number[]) => remarkApi.addFromTemplates(locomotiveId!, ids),
        onMutate: async (newTemplateIds) => {
            setAddingTemplateIds(prev => [...prev, ...newTemplateIds])
            
            // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
            await queryClient.cancelQueries({ queryKey: ['remarks', locomotiveId] })

            // Snapshot the previous value
            const previousRemarks = queryClient.getQueryData<Remark[]>(['remarks', locomotiveId])
            const authUser = queryClient.getQueryData<RemarkUser>(['authUser'])

            // Optimistically update to the new value
            if (previousRemarks) {
                const optimisticRemarks: Remark[] = newTemplateIds.map(id => {
                    const template = templates.find(t => t.id === id)
                    return {
                        id: `temp-${Math.random()}`,
                        text: template?.text || "Добавление...",
                        priority: "medium",
                        category: template?.category || null,
                        is_completed: false,
                        completed_at: null,
                        created_at: new Date().toISOString(),
                        completed_by: null,
                        created_by: authUser || null,
                    } as Remark
                })
                
                // Add new optimistic remarks to the top of the list
                queryClient.setQueryData(['remarks', locomotiveId], [...optimisticRemarks, ...previousRemarks])
            }

            return { previousRemarks }
        },
        onError: (err: any, newTemplateIds, context) => {
            setAddingTemplateIds(prev => prev.filter(id => !newTemplateIds.includes(id)))
            
            // Roll back to the previous value if mutation fails
            if (context?.previousRemarks) {
                queryClient.setQueryData(['remarks', locomotiveId], context.previousRemarks)
            }
            toast.error("Ошибка при добавлении: " + err.message)
        },
        onSettled: () => {
            // Always refetch after error or success to sync with server
            queryClient.invalidateQueries({ queryKey: ['remarks', locomotiveId] })
        },
        onSuccess: (_, newTemplateIds) => {
            setAddingTemplateIds(prev => prev.filter(id => !newTemplateIds.includes(id)))
            setAddedTemplateIds(prev => [...prev, ...newTemplateIds])
            
            // Show checkmark for 2 seconds
            setTimeout(() => {
                setAddedTemplateIds(prev => prev.filter(id => !newTemplateIds.includes(id)))
            }, 2000)
        }
    })

    const rejectMutation = useMutation({
        mutationFn: ({ id, comment }: { id: string, comment: string }) => 
            remarkApi.reject(id, comment),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['remarks', locomotiveId] })
            setRejectDialog(null)
            toast.success("Замечание отклонено")
        }
    })

    const updateGaugeMutation = useMutation({
        mutationFn: ({id, ...updates}: Partial<Gauge> & {id: string}) => gaugeService.update(id, updates),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['gauges'] })
            queryClient.invalidateQueries({ queryKey: ['locomotive-gauges', locomotiveId] })
            setIsInstallGaugeOpen(false)
            setSelectedWarehouseGaugeId("")
            setInstallSide('K1')
            toast.success("Данные манометра обновлены")
        },
        onError: (err: any) => {
            toast.error(err.message || "Ошибка при обновлении манометра")
        }
    })

    const handleInstallGauge = () => {
        if (!selectedWarehouseGaugeId) return
        updateGaugeMutation.mutate({
            id: selectedWarehouseGaugeId,
            locomotive_id: parseInt(locomotiveId!),
            status: 'На локомотиве',
            installation_side: installSide
        })
    }

    const handleUninstallGauge = (gaugeId: string) => {
        if (!window.confirm("Снять этот манометр и вернуть на склад?")) return
        updateGaugeMutation.mutate({
            id: gaugeId,
            locomotive_id: null,
            status: 'На складе',
            installation_side: null
        })
    }

    // --- DERIVED DATA ---
    const filteredRemarks = useMemo(() => {
        return remarks
            .filter((r) => r.text.toLowerCase().includes(searchQuery.toLowerCase()))
            .sort((a, b) => (a.is_completed === b.is_completed ? 0 : a.is_completed ? 1 : -1))
    }, [remarks, searchQuery])

    const stats = useMemo(() => ({
        total: remarks.length,
        pending: remarks.filter((r) => !r.is_completed).length,
        done: remarks.filter((r) => r.is_completed).length
    }), [remarks])

    const filteredTemplates = useMemo(() => {
        return templates.filter((t) => t.text.toLowerCase().includes(catalogSearch.toLowerCase()))
    }, [templates, catalogSearch])

    // --- HANDLERS ---
    const handlePasteSubmit = () => {
        const lines = pasteText.split('\n').map(l => l.trim()).filter(l => l.length > 0)
        if (lines.length === 0) return
        addBatchMutation.mutate(lines)
    }

    const handleCompleteAll = () => {
        const incompleteIds = remarks.filter((r) => !r.is_completed).map((r) => r.id)
        if (incompleteIds.length === 0) return
        completeBatchMutation.mutate(incompleteIds)
    }

    if (!locomotiveId) return null

    return (
        <div className="flex-1 flex flex-col bg-slate-50/50 overflow-auto">
            <main className="flex-1 w-full max-w-7xl mx-auto p-6 md:p-12">
                
                {/* Header Section */}
                <div className="flex items-center justify-between gap-4 mb-8">
                    <div className="space-y-1">
                        <button 
                            onClick={() => navigate("/")}
                            className="flex items-center gap-1.5 text-slate-500 hover:text-slate-900 transition-colors text-xs font-medium"
                        >
                            <ChevronLeft className="w-4 h-4" /> Назад к списку
                        </button>
                        <h1 className="text-3xl font-bold text-slate-900">
                            Замечания <span className="text-slate-400 font-normal">#{locomotive?.number || '—'}</span>
                        </h1>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button 
                            onClick={() => refetch()} 
                            variant="outline" 
                            className="bg-white hover:bg-slate-50 border-slate-200"
                        >
                            <RefreshCw className={cn("w-4 h-4 text-slate-400", isFetching && "animate-spin")} />
                        </Button>
                        <Button
                            onClick={handleCompleteAll}
                            disabled={stats.pending === 0}
                            variant="outline"
                            className="bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100"
                        >
                            <ClipboardCheck className="w-4 h-4 mr-2" /> Выполнить все
                        </Button>
                        <Button
                            onClick={() => exportRemarksToExcel(remarks, locomotive!, 'all')}
                            variant="outline"
                            className="bg-white border-slate-200"
                        >
                            <Download className="w-4 h-4 mr-2" /> Excel
                        </Button>
                        <Button
                            onClick={() => exportRemarksToPDF(remarks, locomotive!, 'all')}
                            variant="outline"
                            className="bg-white border-slate-200"
                        >
                            <FileText className="w-4 h-4 mr-2" /> PDF Отчет
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                    <div className="bg-white border border-slate-200 p-5 rounded-2xl">
                        <div className="text-slate-500 text-xs font-medium mb-1">Всего замечаний</div>
                        <div className="text-3xl font-bold text-slate-900">{stats.total}</div>
                    </div>
                    <div className="bg-white border border-slate-200 p-5 rounded-2xl">
                        <div className="text-slate-500 text-xs font-medium mb-1">Выполнено</div>
                        <div className="text-3xl font-bold text-emerald-600">{stats.done}</div>
                    </div>
                    <div className="bg-white border border-slate-200 p-5 rounded-2xl">
                        <div className="text-slate-500 text-xs font-medium mb-1">В работе</div>
                        <div className="text-3xl font-bold text-amber-600">{stats.pending}</div>
                    </div>
                    <div className="bg-white border border-slate-200 p-5 rounded-2xl">
                        <div className="text-slate-500 text-xs font-medium mb-1">Прогресс</div>
                        <div className="text-3xl font-bold text-slate-900">
                            {stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0}%
                        </div>
                    </div>
                </div>

                <div className="bg-white border border-slate-200 p-4 rounded-2xl mb-8 flex flex-col md:flex-row items-center gap-4">
                    <div className="relative flex-1 w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                            placeholder="Поиск по замечаниям..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 bg-slate-50 border-slate-200"
                        />
                    </div>
                    
                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <Button 
                            onClick={() => setIsAddManualOpen(true)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 flex-1 md:flex-none"
                        >
                            <Plus className="w-4 h-4" /> Добавить
                        </Button>
                        <Button 
                            onClick={() => setIsInstallGaugeOpen(true)}
                            className="bg-blue-600 hover:bg-blue-700 text-white gap-2 flex-1 md:flex-none"
                        >
                            <Wrench className="w-4 h-4" /> Установить манометр
                        </Button>
                        <Button 
                            onClick={() => setIsCatalogOpen(true)}
                            className="bg-slate-800 hover:bg-slate-900 text-white gap-2 flex-1 md:flex-none"
                        >
                            <BookOpen className="w-4 h-4" /> Из каталога
                        </Button>
                        <Button 
                            onClick={() => setIsPasteOpen(true)}
                            variant="outline"
                            className="border-slate-200 gap-2 flex-1 md:flex-none"
                        >
                            <ClipboardPaste className="w-4 h-4" /> Быстрая вставка
                        </Button>
                    </div>
                </div>

                {/* Gauges Section */}
                <div className="mb-8 p-6 bg-white border border-slate-200 rounded-3xl shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                            <Wrench className="w-5 h-5 text-blue-600" />
                            Установленные приборы
                        </h3>
                        <div className="flex items-center gap-2">
                            <Button 
                                onClick={() => setIsInstallGaugeOpen(true)}
                                className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
                                size="sm"
                            >
                                <Plus className="w-4 h-4" /> Установить
                            </Button>
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-slate-500 hover:text-slate-700 font-medium"
                                onClick={() => navigate('/gauges')}
                            >
                                Справочник
                            </Button>
                        </div>
                    </div>
                    
                    {locomotiveGauges.length === 0 ? (
                        <div className="py-8 text-center bg-slate-50/50 border border-slate-100 border-dashed rounded-2xl">
                            <p className="text-slate-400 text-sm">На этот локомотив еще не установлены манометры</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {locomotiveGauges.map(gauge => {
                                const daysLeft = differenceInDays(parseISO(gauge.next_verification), new Date())
                                const isExpiring = daysLeft < 30
                                const isOverdue = daysLeft < 0

                                return (
                                    <div key={gauge.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between group">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <code className="text-xs font-bold bg-white px-2 py-0.5 rounded border border-slate-200">
                                                    {gauge.serial_number}
                                                </code>
                                                {gauge.installation_side && (
                                                   <Badge className="bg-blue-600 text-white border-blue-600 text-[10px] h-5 px-1 font-black">
                                                       {gauge.installation_side}
                                                   </Badge>
                                                )}
                                                <span className="text-xs text-slate-500 font-medium">{gauge.part_number}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                                Поверка: {format(parseISO(gauge.next_verification), 'dd.MM.yyyy')}
                                            </div>
                                            {gauge.photo_url && (
                                                <div 
                                                    className="mt-2 w-full h-24 rounded-xl overflow-hidden border border-slate-200 cursor-pointer hover:opacity-90 transition-opacity"
                                                    onClick={() => window.open(gauge.photo_url, '_blank')}
                                                >
                                                    <img src={gauge.photo_url} className="w-full h-full object-cover" alt="Gauge" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            <Badge 
                                                variant="outline" 
                                                className={cn(
                                                    "font-bold text-[10px]",
                                                    isOverdue ? "bg-red-500 text-white border-red-500 animate-pulse" :
                                                    isExpiring ? "bg-amber-100 text-amber-700 border-amber-200" :
                                                    "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                )}
                                            >
                                                {daysLeft} дн.
                                            </Badge>
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="h-6 w-6 text-slate-400 hover:text-red-600 hover:bg-red-50"
                                                title="Снять прибор (на склад)"
                                                onClick={() => handleUninstallGauge(gauge.id)}
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </Button>
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                                onClick={() => navigate(`/gauges?serial=${gauge.serial_number}`)}
                                            >
                                                <Search className="w-3 h-3 text-slate-400" />
                                            </Button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Main List */}
                <div className="space-y-6">
                    {isLoading ? (
                        <div className="flex flex-col items-center py-32 gap-6">
                            <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
                            <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.5em]">Synchronizing Registry</p>
                        </div>
                    ) : filteredRemarks.length === 0 ? (
                        <div className="py-20 text-center bg-white border border-slate-200 border-dashed rounded-2xl">
                            <p className="text-slate-400">Замечаний для этого локомотива не найдено</p>
                        </div>
                    ) : (
                        filteredRemarks.map((remark) => (
                            <RemarkItem 
                                key={remark.id} 
                                remark={remark} 
                                locomotiveId={locomotiveId} 
                                allUsers={allUsers}
                                onReject={(id) => setRejectDialog({ id, comment: "" })}
                            />
                        ))
                    )}
                </div>
            </main>

            {/* --- DIALOGS --- */}

            {/* Manual Entry Dialog */}
            <Dialog open={isAddManualOpen} onOpenChange={setIsAddManualOpen}>
                <DialogContent className="bg-white border-slate-200 max-w-lg rounded-2xl">
                    <DialogHeader>
                        <DialogTitle>Новое замечание</DialogTitle>
                        <DialogDescription>
                            Добавьте новое замечание вручную
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <FloatingInput 
                            label="Текст замечания"
                            value={manualRemark.text}
                            onChange={(e) => setManualRemark(prev => ({ ...prev, text: e.target.value }))}
                        />
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-slate-500">Категория</label>
                                <Input 
                                    className="bg-slate-50"
                                    placeholder="Механика, Электрика..."
                                    value={manualRemark.category}
                                    onChange={(e) => setManualRemark(prev => ({ ...prev, category: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-slate-500">Приоритет</label>
                                <Select 
                                    onValueChange={(val) => setManualRemark(prev => ({ ...prev, priority: val as "low" | "medium" | "high" }))}
                                    defaultValue="medium"
                                >
                                    <SelectTrigger className="bg-slate-50">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="high" className="text-rose-600">Высокий</SelectItem>
                                        <SelectItem value="medium" className="text-amber-600">Средний</SelectItem>
                                        <SelectItem value="low" className="text-emerald-600">Низкий</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button 
                            onClick={() => manualAddMutation.mutate(manualRemark)}
                            disabled={!manualRemark.text.trim() || manualAddMutation.isPending}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white w-full"
                        >
                            {manualAddMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Добавить в реестр"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Catalog Dialog */}
            <Dialog open={isCatalogOpen} onOpenChange={setIsCatalogOpen}>
                <DialogContent className="bg-white border-slate-200 max-w-4xl max-h-[90vh] flex flex-col rounded-2xl">
                    <DialogHeader>
                        <DialogTitle>Каталог замечаний</DialogTitle>
                        <DialogDescription>
                            Выберите типовое замечание из базы знаний
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="relative mb-4 mt-4">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input 
                            placeholder="Поиск по шаблонам..." 
                            value={catalogSearch}
                            onChange={(e) => setCatalogSearch(e.target.value)}
                            className="pl-10 bg-slate-50 border-slate-200"
                        />
                    </div>

                    <div className="flex-1 overflow-y-auto pr-2 space-y-2">
                        {filteredTemplates.map((t) => {
                            const isAdding = addingTemplateIds.includes(t.id)
                            const isAdded = addedTemplateIds.includes(t.id)
                            
                            return (
                                <div 
                                    key={t.id} 
                                    onClick={() => {
                                        if (!isAdding && !isAdded) templateAddMutation.mutate([t.id])
                                    }}
                                    className={cn(
                                        "group flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl transition-colors cursor-pointer",
                                        !isAdding && !isAdded && "hover:bg-slate-100",
                                        (isAdding || isAdded) && "pointer-events-none opacity-80"
                                    )}
                                >
                                    <div className="space-y-0.5 pr-4 flex-1">
                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t.category || "Общее"}</div>
                                        <div className="text-sm font-medium text-slate-900">{t.text}</div>
                                    </div>
                                    <div className={cn(
                                        "w-8 h-8 rounded-full border flex items-center justify-center transition-all",
                                        isAdding ? "bg-white border-slate-200 text-emerald-600" :
                                        isAdded ? "bg-emerald-600 border-emerald-600 text-white" :
                                        "bg-white border-slate-200 text-slate-400 group-hover:bg-emerald-600 group-hover:text-white group-hover:border-emerald-600"
                                    )}>
                                        {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : 
                                         isAdded ? <CheckCircle2 className="w-4 h-4" /> : 
                                         <Plus className="w-4 h-4" />}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Reject/Redo Dialog */}
            <Dialog open={!!rejectDialog} onOpenChange={(open) => !open && setRejectDialog(null)}>
                <DialogContent className="bg-white border-slate-200 max-w-md rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-rose-600">Отклонить выполнение</DialogTitle>
                        <DialogDescription>
                            Укажите причину возврата замечания в работу
                        </DialogDescription>
                    </DialogHeader>
                    <Textarea 
                        placeholder="Причина отклонения..."
                        value={rejectDialog?.comment}
                        onChange={(e) => setRejectDialog(prev => prev ? { ...prev, comment: e.target.value } : null)}
                        className="bg-slate-50 border-slate-200 min-h-[100px] mb-4"
                    />
                    <DialogFooter>
                        <Button 
                            variant="destructive"
                            onClick={() => rejectDialog && rejectMutation.mutate({ id: rejectDialog.id, comment: rejectDialog.comment })}
                            disabled={!rejectDialog?.comment.trim() || rejectMutation.isPending}
                            className="w-full bg-rose-600 hover:bg-rose-700"
                        >
                            Вернуть в работу
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Batch Paste Dialog */}
            <Dialog open={isPasteOpen} onOpenChange={setIsPasteOpen}>
                <DialogContent className="bg-white border-slate-200 max-w-2xl rounded-2xl">
                    <DialogHeader>
                        <DialogTitle>Быстрая вставка замечаний</DialogTitle>
                        <DialogDescription>
                            Вставьте список из Excel или другого документа (одно замечание на строку)
                        </DialogDescription>
                    </DialogHeader>
                    <Textarea 
                        value={pasteText}
                        onChange={(e) => setPasteText(e.target.value)}
                        placeholder="Замечание 1&#10;Замечание 2&#10;..."
                        className="bg-slate-50 border-slate-200 min-h-[200px] mb-4"
                    />
                    <DialogFooter>
                        <Button 
                            onClick={handlePasteSubmit}
                            disabled={!pasteText.trim() || addBatchMutation.isPending}
                            className="w-full bg-slate-800 hover:bg-slate-900 text-white"
                        >
                            {addBatchMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ClipboardPaste className="w-4 h-4 mr-2" />}
                            Импортировать
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Install Gauge Dialog */}
            <Dialog open={isInstallGaugeOpen} onOpenChange={setIsInstallGaugeOpen}>
                <DialogContent className="bg-white border-slate-200 max-w-md rounded-2xl">
                    <DialogHeader>
                        <DialogTitle>Установка манометра</DialogTitle>
                        <DialogDescription>
                            Выберите прибор со склада для установки на локомотив #{locomotive?.number}
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-6 py-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Серийный номер (на складе)</label>
                            <Select value={selectedWarehouseGaugeId} onValueChange={setSelectedWarehouseGaugeId}>
                                <SelectTrigger className="bg-slate-50 border-slate-200">
                                    <SelectValue placeholder="Выберите манометр..." />
                                </SelectTrigger>
                                <SelectContent className="max-h-[300px]">
                                    {warehouseGauges.length === 0 ? (
                                        <div className="p-4 text-center text-slate-500 text-sm">Нет свободных манометров</div>
                                    ) : (
                                        warehouseGauges.map(g => (
                                            <SelectItem key={g.id} value={g.id}>
                                                {g.serial_number} — {g.part_number}
                                            </SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Сторона установки</label>
                            <div className="flex gap-2">
                                {['K1', 'K2'].map((side) => (
                                <button
                                    key={side}
                                    type="button"
                                    onClick={() => setInstallSide(side as 'K1' | 'K2')}
                                    className={`flex-1 py-3 rounded-xl border text-sm font-black transition-all ${
                                    installSide === side 
                                        ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-100' 
                                        : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                                    }`}
                                >
                                    Cabin {side}
                                </button>
                                ))}
                            </div>
                        </div>

                        {selectedWarehouseGauge && (
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                <div className="flex items-start gap-4">
                                    <div className="w-24 h-24 rounded-xl bg-white border border-slate-200 overflow-hidden flex-shrink-0">
                                        {selectedWarehouseGauge.photo_url ? (
                                            <img src={selectedWarehouseGauge.photo_url} className="w-full h-full object-cover" />
                                        ) : selectedWarehouseGauge.model_image_url ? (
                                            <img src={selectedWarehouseGauge.model_image_url} className="w-full h-full object-cover opacity-50 blur-[1px]" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-slate-300">
                                                <Camera className="w-8 h-8" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="space-y-1 py-1">
                                        <div className="text-xs font-bold text-blue-600 uppercase tracking-tighter">Характеристики</div>
                                        <div className="text-lg font-bold text-slate-900 leading-tight">
                                            {selectedWarehouseGauge.part_number}
                                        </div>
                                        <div className="text-xs text-slate-500 font-medium">
                                            {selectedWarehouseGauge.description}
                                        </div>
                                        <div className="pt-2 flex items-center gap-1.5">
                                            <Badge variant="outline" className="bg-white text-[10px] font-bold">
                                                Поверка до: {format(parseISO(selectedWarehouseGauge.next_verification), 'dd.MM.yyyy')}
                                            </Badge>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button 
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-12 rounded-xl shadow-lg shadow-blue-200"
                            disabled={!selectedWarehouseGaugeId || updateGaugeMutation.isPending}
                            onClick={handleInstallGauge}
                        >
                            {updateGaugeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Подтвердить установку"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    )
}
