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
    FileText,
    Loader2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { locomotiveApi } from "@/api/locomotiveService"
import { remarkApi } from "@/api/remarkService"
import type { Remark, CreateRemarkDTO } from "@/types/remark"
import { RemarkItem } from "@/components/remarks/RemarkItem"
import { RemarkSkeleton } from "@/components/locomotive/RemarkSkeleton"
import { RemarkCatalogDrawer } from "@/components/remarks/RemarkCatalogDrawer"
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
    const [isAddManualOpen, setIsAddManualOpen] = useState(false)
    const [manualRemark, setManualRemark] = useState<{ text: string, priority: "low" | "medium" | "high", category: string }>({ 
        text: "", 
        priority: "medium", 
        category: "" 
    })
    const [isCatalogOpen, setIsCatalogOpen] = useState(false)
    const [rejectDialog, setRejectDialog] = useState<{ id: string, comment: string } | null>(null)

    // --- QUERIES ---
    const { data: locomotive } = useQuery({
        queryKey: ['locomotive', locomotiveId],
        queryFn: () => locomotiveApi.getById(locomotiveId!),
        enabled: !!locomotiveId
    })

    const { data: remarks = [], isLoading, isFetching, refetch } = useQuery<Remark[]>({
        queryKey: ['remarks', locomotiveId],
        queryFn: async () => {
            // Artificial delay to show the beautiful skeleton loader
            await new Promise(resolve => setTimeout(resolve, 800))
            return remarkApi.getByLocomotiveId(locomotiveId!)
        },
        enabled: !!locomotiveId
    })



    // --- MUTATIONS ---

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

    const rejectMutation = useMutation({
        mutationFn: ({ id, comment }: { id: string, comment: string }) => 
            remarkApi.reject(id, comment),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['remarks', locomotiveId] })
            setRejectDialog(null)
            toast.success("Замечание отклонено")
        }
    })

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

    // --- HANDLERS ---

    const handleCompleteAll = () => {
        const incompleteIds = remarks.filter((r) => !r.is_completed).map((r) => r.id)
        if (incompleteIds.length === 0) return
        completeBatchMutation.mutate(incompleteIds)
    }

    if (!locomotiveId) return null

    return (
        <div className="flex-1 flex flex-col bg-slate-50/50 overflow-auto">
            <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-8">
                
                {/* Header Section */}
                <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
                    <div className="space-y-1">
                        <button 
                            onClick={() => navigate("/")}
                            className="flex items-center gap-1.5 text-slate-500 hover:text-slate-900 transition-colors text-xs font-medium h-11 pr-4"
                        >
                            <ChevronLeft className="w-5 h-5" /> 
                            <span className="hidden sm:inline">Назад к списку</span>
                        </button>
                        <h1 className="text-2xl md:text-3xl font-semibold text-slate-900 leading-tight">
                            Замечания <span className="text-slate-400 font-normal">#{locomotive?.number || '—'}</span>
                        </h1>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button 
                            onClick={() => refetch()} 
                            variant="outline" 
                            className="bg-white hover:bg-slate-50 border-slate-200 h-11 w-11 p-0 shrink-0"
                        >
                            <RefreshCw className={cn("w-5 h-5 text-slate-400", isFetching && "animate-spin")} />
                        </Button>
                        <Button
                            onClick={handleCompleteAll}
                            disabled={stats.pending === 0}
                            variant="outline"
                            className="bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100 h-11 px-3 md:px-6 shrink-0"
                        >
                            <ClipboardCheck className="w-5 h-5 md:mr-2" /> 
                            <span className="hidden md:inline">Выполнить все</span>
                        </Button>
                        <Button
                            onClick={() => exportRemarksToExcel(remarks, locomotive!, 'all')}
                            variant="outline"
                            className="bg-white border-slate-200 h-11 px-3 md:px-4 shrink-0"
                            title="Экспорт в Excel"
                        >
                            <Download className="w-5 h-5 md:mr-2" />
                            <span className="hidden md:inline">Excel</span>
                        </Button>
                        <Button
                            onClick={() => exportRemarksToPDF(remarks, locomotive!, 'all')}
                            variant="outline"
                            className="bg-white border-slate-200 h-11 px-3 md:px-4 shrink-0"
                            title="Экспорт в PDF"
                        >
                            <FileText className="w-5 h-5 md:mr-2" />
                            <span className="hidden md:inline">PDF Отчет</span>
                        </Button>
                    </div>
                </div>

                <div className="hidden md:grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-white border border-slate-200 p-5 rounded-2xl">
                        <div className="text-slate-500 text-xs font-medium mb-1">Всего замечаний</div>
                        <div className="text-3xl font-semibold text-slate-900">{stats.total}</div>
                    </div>
                    <div className="bg-white border border-slate-200 p-5 rounded-2xl">
                        <div className="text-slate-500 text-xs font-medium mb-1">Выполнено</div>
                        <div className="text-3xl font-semibold text-emerald-600">{stats.done}</div>
                    </div>
                    <div className="bg-white border border-slate-200 p-5 rounded-2xl">
                        <div className="text-slate-500 text-xs font-medium mb-1">В работе</div>
                        <div className="text-3xl font-semibold text-amber-600">{stats.pending}</div>
                    </div>
                    <div className="bg-white border border-slate-200 p-5 rounded-2xl">
                        <div className="text-slate-500 text-xs font-medium mb-1">Прогресс</div>
                        <div className="text-3xl font-semibold text-slate-900">
                            {stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0}%
                        </div>
                    </div>
                </div>

                <div className="bg-white border border-slate-200 p-4 rounded-2xl mb-6 flex flex-col md:flex-row items-center gap-4">
                    <div className="relative flex-1 w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <Input
                            placeholder="Поиск по замечаниям..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-11 bg-slate-50 border-slate-200 h-11"
                        />
                    </div>
                    
                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <Button 
                            onClick={() => setIsAddManualOpen(true)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 flex-1 md:flex-none h-11"
                        >
                            <Plus className="w-5 h-5" /> Добавить
                        </Button>
                        <Button 
                            onClick={() => setIsCatalogOpen(true)}
                            className="bg-slate-800 hover:bg-slate-900 text-white gap-2 flex-1 md:flex-none h-11"
                        >
                            <BookOpen className="w-5 h-5" /> Из каталога
                        </Button>
                    </div>
                </div>

                {/* Main List */}
                <div className="space-y-4">
                    {isLoading ? (
                        <RemarkSkeleton />
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

            {/* Catalog Drawer */}
            <RemarkCatalogDrawer
                open={isCatalogOpen}
                onOpenChange={setIsCatalogOpen}
                locomotiveId={locomotiveId}
            />

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


        </div>
    )
}
