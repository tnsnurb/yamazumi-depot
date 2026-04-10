import { useState, useEffect } from "react"
import { User as LucideUser, ShieldCheck, Download, ChevronRight, ChevronDown, Loader2, Info, Clock, CheckCircle2, MessageSquare, Camera, History, Send, X, AlertCircle, Settings2, LayoutGrid, FilterX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Item, ItemGroup, ItemTitle } from "@/components/ui/item"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/hooks/useAuth"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import imageCompression from 'browser-image-compression'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Label } from "@/components/ui/label"

interface ChecklistInstance {
    id: string
    locomotive_id: number
    template_id: number
    status: string
    created_at: string
    completed_at: string | null
    template: { name: string }
}

interface ChecklistItem {
    id: string
    instance_id: string
    template_item_id: number
    sort_order: number
    is_completed: boolean
    completed_by: number | null
    completed_at: string | null
    verified_by: number | null
    verified_at: string | null
    notes: string | null
    template_item: {
        group_name: string | null
        short_description: string
        full_description: string | null
        executor_role: string | null
        controller_role: string | null
        required: boolean
        points?: number
    }
    completed_by_user?: { full_name: string } | null
    verified_by_user?: { full_name: string } | null
}

interface LocomotiveChecklistProps {
    locomotiveId?: number;
    instanceId?: number;
    readOnly?: boolean;
    hideHeader?: boolean;
    locomotiveIdentifier?: string; // e.g. "ТЭ33А-0008"
}

export function LocomotiveChecklist({ locomotiveId, instanceId, readOnly = false, hideHeader = false, locomotiveIdentifier }: LocomotiveChecklistProps) {
    const { user } = useAuth()
    const [instance, setInstance] = useState<ChecklistInstance | null>(null)
    const [items, setItems] = useState<ChecklistItem[]>([])
    const [loading, setLoading] = useState(true)
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})
    const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({})
    const [selectedGroup, setSelectedGroup] = useState<string>("all")
    const [statusFilter, setStatusFilter] = useState<string>("all")

    // Details states
    const [expandedItemId, setExpandedItemId] = useState<string | null>(null)
    const [activeDetailTab, setActiveDetailTab] = useState<'comments' | 'photos' | 'history'>('comments')
    const [comments, setComments] = useState<Record<string, any[]>>({})
    const [photos, setPhotos] = useState<Record<string, any[]>>({})
    const [history, setHistory] = useState<Record<string, any[]>>({})
    const [loadingDetails, setLoadingDetails] = useState<Record<string, boolean>>({})
    const [commentText, setCommentText] = useState("")
    const [uploadingPhoto, setUploadingPhoto] = useState(false)
    const [isCompact, setIsCompact] = useState(false)
    const [isBatchLoading, setIsBatchLoading] = useState(false)
    const [itemLoading, setItemLoading] = useState<Record<string, boolean>>({})

    // Rejection states
    const [rejectItemId, setRejectItemId] = useState<string | null>(null)
    const [rejectComment, setRejectComment] = useState("")
    const [isRejecting, setIsRejecting] = useState(false)

    useEffect(() => {
        fetchChecklist()
    }, [locomotiveId, instanceId])

    const fetchChecklist = async () => {
        try {
            setLoading(true)
            const token = localStorage.getItem('access_token')
            let res
            if (instanceId) {
                res = await fetch(`/api/checklists/instances/${instanceId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
            } else if (locomotiveId) {
                res = await fetch(`/api/checklists/locomotive/${locomotiveId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
            } else {
                return
            }
            if (!res.ok) throw new Error('Failed to fetch checklist')
            const data = await res.json()
            setInstance(data.instance)
            setItems(data.items || [])

            // Auto-expand all groups initially
            if (data.items) {
                const uniqueGroups = Array.from(new Set(data.items.map((i: any) => i.template_item?.group_name || 'Без группы')))
                const initialExpanded = uniqueGroups.reduce((acc: any, g: any) => ({ ...acc, [g]: true }), {})
                setExpandedGroups(initialExpanded as Record<string, boolean>)
            }
        } catch (error) {
            console.error(error)
            toast.error("Ошибка загрузки чек-листа")
        } finally {
            setLoading(false)
        }
    }

    const toggleItemId = (itemId: string, tab: 'comments' | 'photos' | 'history') => {
        if (expandedItemId === itemId && activeDetailTab === tab) {
            setExpandedItemId(null)
        } else {
            setExpandedItemId(itemId)
            setActiveDetailTab(tab)
            fetchItemDetails(itemId, tab)
        }
    }

    const fetchItemDetails = async (itemId: string, tab: string) => {
        try {
            setLoadingDetails((prev: Record<string, boolean>) => ({ ...prev, [itemId]: true }))
            const token = localStorage.getItem('access_token')
            const res = await fetch(`/api/checklists/items/${itemId}/${tab}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            const data = await res.json()
            if (tab === 'comments') setComments((prev: Record<string, any[]>) => ({ ...prev, [itemId]: data }))
            if (tab === 'photos') setPhotos((prev: Record<string, any[]>) => ({ ...prev, [itemId]: data }))
            if (tab === 'history') setHistory((prev: Record<string, any[]>) => ({ ...prev, [itemId]: data }))
        } catch (e) {
            console.error(e)
        } finally {
            setLoadingDetails(prev => ({ ...prev, [itemId]: false }))
        }
    }

    const submitComment = async (itemId: string) => {
        if (!commentText.trim()) return
        try {
            const token = localStorage.getItem('access_token')
            const res = await fetch(`/api/checklists/items/${itemId}/comments`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ text: commentText })
            })
            if (res.ok) {
                const newComment = await res.json()
                setComments((prev: Record<string, any[]>) => ({
                    ...prev,
                    [itemId]: [...(prev[itemId] || []), newComment]
                }))
                setCommentText("")
                toast.success("Комментарий добавлен")
                fetchItemDetails(itemId, 'history')
            }
        } catch (e) {
            toast.error("Ошибка сети")
        }
    }

    const handlePhotoUpload = async (itemId: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        try {
            setUploadingPhoto(true)
            const options = {
                maxSizeMB: 0.5,
                maxWidthOrHeight: 1280,
                useWebWorker: true,
                initialQuality: 0.8
            }
            const compressedFile = await imageCompression(file, options)
            
            const formData = new FormData()
            formData.append('photo', compressedFile, compressedFile.name)
            const token = localStorage.getItem('access_token')
            const res = await fetch(`/api/checklists/items/${itemId}/photos`, {
                method: "POST",
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            })
            if (res.ok) {
                const newPhoto = await res.json()
                setPhotos((prev: Record<string, any[]>) => ({
                    ...prev,
                    [itemId]: [...(prev[itemId] || []), newPhoto]
                }))
                toast.success("Фото загружено")
                fetchItemDetails(itemId, 'history')
            }
        } catch (e) {
            toast.error("Ошибка загрузки фото")
        } finally {
            setUploadingPhoto(false)
        }
    }

    const handleReject = async () => {
        if (!rejectItemId || !rejectComment.trim()) return
        try {
            setIsRejecting(true)
            const token = localStorage.getItem('access_token')
            const res = await fetch(`/api/checklists/items/${rejectItemId}/reject`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ comment: rejectComment })
            })
            if (res.ok) {
                const updatedItem = await res.json()
                setItems((prev: ChecklistItem[]) => prev.map((i: ChecklistItem) => i.id === rejectItemId ? updatedItem : i))
                setRejectItemId(null)
                setRejectComment("")
                toast.success("Пункт отклонен и возвращен в работу")
            } else {
                toast.error("Ошибка при отклонении")
            }
        } catch (error) {
            toast.error("Ошибка сети")
        } finally {
            setIsRejecting(false)
        }
    }

    const handleCompleteItem = async (itemId: string, checked: boolean) => {
        setItemLoading(prev => ({ ...prev, [itemId]: true }));
        const previousItems = [...items];
        setItems(prev => prev.map(i => i.id === itemId ? {
            ...i,
            is_completed: checked,
            completed_by_user: checked ? { full_name: user?.full_name || 'Я' } : null,
            completed_at: checked ? new Date().toISOString() : null
        } : i));

        try {
            const token = localStorage.getItem('access_token')
            const res = await fetch(`/api/checklists/items/${itemId}/complete`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ is_completed: checked })
            })
            if (!res.ok) throw new Error('Failed to complete item')
            const updatedItem = await res.json()
            setItems((prev: ChecklistItem[]) => prev.map((i: ChecklistItem) => i.id === itemId ? updatedItem : i))
        } catch (error) {
            console.error(error)
            toast.error("Ошибка при обновлении пункта")
            setItems(previousItems);
        } finally {
            setItemLoading(prev => ({ ...prev, [itemId]: false }));
        }
    }

    const handleCompleteBatch = async (itemIds: string[], checked: boolean) => {
        if (itemIds.length === 0) return;
        const previousItems = [...items];
        setItems(prev => prev.map(i => itemIds.includes(i.id) ? {
            ...i,
            is_completed: checked,
            completed_by_user: checked ? { full_name: user?.full_name || 'Я' } : null,
            completed_at: checked ? new Date().toISOString() : null
        } : i));

        try {
            setIsBatchLoading(true);
            const token = localStorage.getItem('access_token');
            const res = await fetch(`/api/checklists/items/complete-batch`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ itemIds, is_completed: checked })
            });
            if (!res.ok) throw new Error('Failed to complete items in batch');
            const updatedItems = await res.json();
            const updatedItemsMap = new Map<string, ChecklistItem>(updatedItems.map((i: any) => [i.id, i]));
            setItems(prev => prev.map(i => updatedItemsMap.has(i.id) ? updatedItemsMap.get(i.id)! : i));
            toast.success(checked ? `Выполнено: ${itemIds.length} шт.` : `Сброшено: ${itemIds.length} шт.`);
        } catch (error) {
            console.error(error);
            toast.error("Ошибка при групповом обновлении");
            setItems(previousItems);
        } finally {
            setIsBatchLoading(false);
        }
    };

    const handleBulkComplete = () => {
        const available = items.filter(i => !i.is_completed && !i.verified_at).map(i => i.id);
        if (available.length === 0) return;
        if (window.confirm(`Отметить все оставшиеся пункты (${available.length}) как выполненные?`)) {
            handleCompleteBatch(available, true);
        }
    };

    const handleVerifyItem = async (itemId: string, verified: boolean) => {
        try {
            const token = localStorage.getItem('access_token')
            const res = await fetch(`/api/checklists/items/${itemId}/verify`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ is_verified: verified })
            })
            if (!res.ok) throw new Error('Failed to verify item')
            const updatedItem = await res.json()
            setItems((prev: ChecklistItem[]) => prev.map((i: ChecklistItem) => i.id === itemId ? updatedItem : i))
        } catch (error) {
            console.error(error)
            toast.error("Ошибка при проверке пункта")
        }
    }

    const toggleGroup = (group: string) => {
        setExpandedGroups((prev: Record<string, boolean>) => ({ ...prev, [group]: !prev[group] }))
    }

    const toggleItemDetails = (itemId: string) => {
        setExpandedItems((prev: Record<string, boolean>) => ({ ...prev, [itemId]: !prev[itemId] }))
    }

    const downloadPDF = () => {
        if (!instance || items.length === 0) return
        const grouped = items.reduce((acc: Record<string, ChecklistItem[]>, item: ChecklistItem) => {
            const key = item.template_item?.group_name || 'Без группы'
            if (!acc[key]) acc[key] = []
            acc[key].push(item)
            return acc
        }, {} as Record<string, ChecklistItem[]>)

        const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Чек-лист: ${instance.template.name}</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; font-size: 12px; }
        h1 { font-size: 18px; margin-bottom: 5px; }
        .subtitle { color: #666; margin-bottom: 20px; font-size: 14px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background: #f5f5f5; font-weight: bold; }
        .group-row { background: #eef2ff; font-weight: bold; text-transform: uppercase; }
        .status-done { color: #16a34a; font-weight: bold; }
        .status-open { color: #d97706; font-weight: bold; }
        .footer { margin-top: 30px; font-size: 10px; color: #888; text-align: center; }
    </style>
</head>
<body>
    <h1>Чек-лист: ${instance.template.name}</h1>
    <div class="subtitle">
        Статус: ${instance.status === 'completed' ? 'Завершен' : 'В процессе'} <br/>
        Дата формирования: ${new Date().toLocaleString('ru-RU')}
    </div>
    <table>
        <thead>
            <tr>
                <th style="width:5%">№</th>
                <th style="width:40%">Описание</th>
                <th style="width:15%">Исполнитель / Контроль</th>
                <th style="width:15%">Статус</th>
                <th style="width:25%">Подтверждение</th>
            </tr>
        </thead>
        <tbody>
            ${Object.keys(grouped).sort().map(group => `
                <tr class="group-row"><td colspan="5">${group}</td></tr>
                ${grouped[group].map((item: ChecklistItem, index: number) => `
                    <tr>
                        <td>${index + 1}</td>
                        <td>
                            <strong>${item.template_item?.short_description}</strong>
                            ${item.template_item?.full_description ? `<br/><span style="color:#666; font-size:10px">${item.template_item.full_description}</span>` : ''}
                        </td>
                        <td>
                            ${item.template_item?.executor_role || '—'} / ${item.template_item?.controller_role || '—'}
                        </td>
                        <td class="${item.is_completed ? 'status-done' : 'status-open'}">
                            ${item.is_completed ? '✓ Выполнено' : '○ В процессе'}
                        </td>
                        <td style="font-size:10px">
                            ${item.is_completed ? `Исп: ${item.completed_by_user?.full_name || '—'} <br/> ${item.completed_at ? new Date(item.completed_at).toLocaleString('ru-RU') : ''}` : ''}
                            ${item.verified_at ? `<br/>Контр: ${item.verified_by_user?.full_name || '—'} <br/> ${new Date(item.verified_at).toLocaleString('ru-RU')}` : ''}
                        </td>
                    </tr>
                `).join('')}
            `).join('')}
        </tbody>
    </table>
    <div class="footer">Yamazumi Depot • Сформировано автоматически</div>
    <script>window.onload = () => window.print();</script>
</body>
</html>`
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        window.open(url, '_blank')
    }

    if (loading) {
        return (
            <div className="flex justify-center items-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        )
    }

    if (!instance || items.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center rounded-xl border border-dashed text-muted-foreground bg-muted/20">
                <CheckCircle2 className="w-12 h-12 mb-4 opacity-20" />
                <h3 className="text-lg font-medium text-foreground">Нет активного чек-листа</h3>
                <p className="mt-2 text-sm max-w-sm">
                    Для данного локомотива не найден чек-лист. Он должен создаваться автоматически при приёмке на ремонт, если в системе заведен шаблон для этой серии и типа ремонта.
                </p>
            </div>
        )
    }

    const totalItems = items.length
    const completedItems = items.filter((i: ChecklistItem) => i.is_completed).length
    const remainingItems = totalItems - completedItems
    const progressPercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0

    // Who completed how many
    const completedBy: Record<string, number> = {}
    items.forEach((r: ChecklistItem) => {
        if (r.is_completed && r.completed_by_user?.full_name) {
            completedBy[r.completed_by_user.full_name] = (completedBy[r.completed_by_user.full_name] || 0) + 1
        }
    })

    // Group items (apply status filters here)
    const itemsToDisplay = items.filter(item => {
        if (statusFilter === "all") return true;
        if (statusFilter === "not_completed") return !item.is_completed;
        if (statusFilter === "for_review") return item.is_completed && !item.verified_at;
        return true;
    });

    const groupedItems = itemsToDisplay.reduce((acc: Record<string, ChecklistItem[]>, item: ChecklistItem) => {
        const key = item.template_item?.group_name || 'Без группы'
        if (!acc[key]) acc[key] = []
        acc[key].push(item)
        return acc
    }, {} as Record<string, ChecklistItem[]>)

    const scrollGroups = Object.keys(groupedItems).sort()
    const displayGroups = selectedGroup === "all" ? scrollGroups : scrollGroups.filter(g => g === selectedGroup)

    return (
        <div className="space-y-6">
            {/* Header info */}
            {!hideHeader && (
                <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 mb-5">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center flex-wrap sm:flex-nowrap gap-x-4 gap-y-2">
                            <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tighter uppercase whitespace-normal sm:whitespace-nowrap">
                                {locomotiveIdentifier && <span className="text-slate-400 mr-2">{locomotiveIdentifier} —</span>}
                                {instance.template.name.includes(' — ') ? instance.template.name.split(' — ').pop() : instance.template.name}
                            </h2>
                            <Badge variant={instance.status === 'completed' ? 'default' : 'secondary'} className={cn(
                                "rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest",
                                instance.status === 'completed' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-blue-50 text-blue-600 border-blue-100'
                            )}>
                                {instance.status === 'completed' ? 'Завершен' : 'В процессе'}
                            </Badge>
                            {instance.status === 'completed' && instance.completed_at && (
                                <div className="text-[10px] text-slate-400 font-bold flex items-center bg-slate-50 px-2.5 py-1 rounded-full border border-slate-100">
                                    <Clock className="w-3.5 h-3.5 mr-1.5 text-slate-300" />
                                    {new Date(instance.completed_at).toLocaleString('ru-RU')}
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-3 w-full sm:w-auto">
                            {!readOnly && remainingItems > 0 && instance.status !== 'completed' && (
                                <Button 
                                    onClick={handleBulkComplete} 
                                    disabled={isBatchLoading}
                                    className="flex-1 sm:flex-none h-11 px-6 text-[11px] font-black uppercase tracking-widest bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200/50 transition-all active:scale-95"
                                >
                                    {isBatchLoading ? (
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    ) : (
                                        <CheckCircle2 className="w-4 h-4 mr-2" />
                                    )}
                                    Выполнить все
                                </Button>
                            )}
                            
                            {/* Mobile Filters Trigger */}
                            <div className="md:hidden">
                                <Sheet>
                                    <SheetTrigger asChild>
                                        <Button variant="outline" size="icon" className="h-10 w-10 shrink-0 relative border-slate-200 bg-white">
                                            <Settings2 className="w-5 h-5 text-slate-600" />
                                            {(selectedGroup !== "all" || statusFilter !== "all") && (
                                                <span className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-white" />
                                            )}
                                        </Button>
                                    </SheetTrigger>
                                    <SheetContent className="w-[300px] sm:w-[400px]">
                                        <SheetHeader className="pb-6 border-b">
                                            <SheetTitle className="text-xl font-bold flex items-center gap-2">
                                                <LayoutGrid className="w-5 h-5 text-blue-500" />
                                                Фильтры чек-листа
                                            </SheetTitle>
                                            <SheetDescription>
                                                Настройте отображение задач и разделов
                                            </SheetDescription>
                                        </SheetHeader>
                                        <div className="py-6 space-y-8">
                                            <div className="space-y-3">
                                                <Label className="text-xs font-bold uppercase tracking-wider text-slate-400">Группа задач</Label>
                                                <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                                                    <SelectTrigger className="h-11 border-slate-200 bg-slate-50 font-semibold text-sm">
                                                        <SelectValue placeholder="Все группы" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="all">Все группы</SelectItem>
                                                        {scrollGroups.map(g => (
                                                            <SelectItem key={g} value={g}>{g}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div className="space-y-3">
                                                <Label className="text-xs font-bold uppercase tracking-wider text-slate-400">Статус выполнения</Label>
                                                <Select value={statusFilter} onValueChange={setStatusFilter}>
                                                    <SelectTrigger className="h-11 border-slate-200 bg-slate-50 font-semibold text-sm">
                                                        <SelectValue placeholder="Все статусы" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="all">Все пункты</SelectItem>
                                                        <SelectItem value="not_completed">Не выполнено</SelectItem>
                                                        <SelectItem value="for_review">На проверку</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div className="pt-4 flex flex-col gap-3">
                                                <Button
                                                    variant={isCompact ? "default" : "outline"}
                                                    className={cn("h-11 font-bold", isCompact ? "bg-slate-900" : "")}
                                                    onClick={() => setIsCompact(!isCompact)}
                                                >
                                                    {isCompact ? "Обычный вид" : "Компактный вид"}
                                                </Button>
                                                
                                                {(selectedGroup !== "all" || statusFilter !== "all") && (
                                                    <Button
                                                        variant="ghost"
                                                        className="text-red-500 hover:text-red-600 hover:bg-red-50 font-bold h-11"
                                                        onClick={() => {
                                                            setSelectedGroup("all")
                                                            setStatusFilter("all")
                                                        }}
                                                    >
                                                        <FilterX className="w-4 h-4 mr-2" />
                                                        Сбросить фильтры
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </SheetContent>
                                </Sheet>
                            </div>

                            <Button variant="outline" size="icon" className="hidden sm:flex h-10 w-10 border-slate-200 hover:bg-slate-50 group" onClick={downloadPDF} title="Скачать PDF">
                                <Download className="w-4 h-4 text-slate-600 group-hover:text-blue-600 transition-colors" />
                            </Button>
                        </div>
                    </div>
                </div>
            )}


            {/* Statistics Card - Optimized for Mobile */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden mb-6">
                <div className="p-4 md:p-6">
                    {/* Numbers Row */}
                        <div className="flex items-center justify-between gap-2 md:gap-4 mb-6 text-center px-1 pt-1">
                            <div className="flex-1">
                                <div className="text-xl md:text-3xl font-black text-slate-900 leading-none">{totalItems}</div>
                            </div>
                            <div className="w-px h-10 bg-slate-100" />
                            <div className="flex-1">
                                <div className="text-xl md:text-3xl font-black text-emerald-600 leading-none">{completedItems}</div>
                            </div>
                            <div className="w-px h-10 bg-slate-100" />
                            <div className="flex-1">
                                <div className="text-xl md:text-3xl font-black text-amber-600 leading-none">{remainingItems}</div>
                            </div>
                            <div className="w-px h-10 bg-slate-100" />
                            <div className="flex-1">
                                <div className="text-xl md:text-3xl font-black text-blue-600 leading-none">{progressPercent}%</div>
                            </div>
                        </div>

                    {/* Progress Row */}
                    <div className="space-y-3 mb-5 px-1">
                        <div className="flex items-center justify-between text-[10px] md:text-[11px] font-black uppercase tracking-widest text-slate-400">
                            <span>Прогресс выполнения</span>
                            <span className="text-blue-600 font-black">{progressPercent}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-emerald-500 transition-all duration-1000 ease-in-out rounded-full shadow-[0_0_12px_rgba(16,185,129,0.2)]"
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>
                    </div>

                    {/* Performers Row */}
                    {Object.keys(completedBy).length > 0 && (
                        <div className="flex items-center gap-4 px-1 overflow-hidden">
                            <span className="text-[10px] md:text-[11px] font-black uppercase tracking-widest text-slate-400 shrink-0">Исполнители:</span>
                            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                                {Object.entries(completedBy)
                                    .sort((a, b) => b[1] - a[1])
                                    .map(([name, count]) => (
                                        <span key={name} className="inline-flex items-center gap-1 text-[10px] md:text-xs bg-slate-50/50 text-slate-700 pr-1 pl-2.5 py-1 rounded-full border border-slate-100/80 shrink-0 whitespace-nowrap shadow-sm">
                                            <span className="font-bold">{name}</span>
                                            <span className="bg-white text-slate-900 rounded-full w-5 h-5 flex items-center justify-center text-[9px] font-black border border-slate-200 ml-1.5">{count}</span>
                                        </span>
                                    ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Actions Row — Below Statistics */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6 px-1">
                <div className="flex flex-wrap items-center gap-2">
                    <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                        <SelectTrigger className="w-[150px] h-9 bg-white border-slate-200 text-[11px] font-bold uppercase tracking-tight rounded-xl shadow-sm transition-all hover:border-blue-400">
                            <SelectValue placeholder="Все группы" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all" className="font-bold text-[11px] uppercase">Все группы</SelectItem>
                            {scrollGroups.map(g => (
                                <SelectItem key={g} value={g} className="text-[11px] font-medium">{g}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[140px] h-9 bg-white border-slate-200 text-[11px] font-bold uppercase tracking-tight rounded-xl shadow-sm transition-all hover:border-blue-400">
                            <SelectValue placeholder="Все пункты" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all" className="font-bold text-[11px] uppercase">Все пункты</SelectItem>
                            <SelectItem value="not_completed" className="text-[11px] font-bold text-amber-600 uppercase">Не выполнено</SelectItem>
                            <SelectItem value="for_review" className="text-[11px] font-bold text-blue-600 uppercase">На проверку</SelectItem>
                        </SelectContent>
                    </Select>

                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsCompact(!isCompact)}
                        className={cn(
                            "h-9 px-4 font-bold text-[10px] uppercase tracking-widest transition-all rounded-xl border shadow-sm",
                            isCompact ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                        )}
                    >
                        {isCompact ? "Обычный вид" : "Компактный вид"}
                    </Button>

                    {(selectedGroup !== "all" || statusFilter !== "all") && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                                setSelectedGroup("all")
                                setStatusFilter("all")
                            }}
                            className="h-9 w-9 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0 border border-slate-200 rounded-xl shadow-sm"
                            title="Сбросить фильтры"
                        >
                            <FilterX className="w-4 h-4" />
                        </Button>
                    )}
                </div>

                {!readOnly && remainingItems > 0 && instance.status !== 'completed' && (
                    <Button 
                        onClick={handleBulkComplete} 
                        disabled={isBatchLoading}
                        className="h-10 px-6 text-[11px] font-black uppercase tracking-widest bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-200/50 transition-all active:scale-95 flex items-center gap-2 group rounded-xl"
                    >
                        {isBatchLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <CheckCircle2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
                        )}
                        <span>{isBatchLoading ? "Загрузка..." : `ВЫПОЛНИТЬ ВСЁ (${remainingItems})`}</span>
                    </Button>
                )}
            </div>

            {/* Checklist items by group */}
            <div className="space-y-6">
                {displayGroups
                    .map(group => {
                        const groupItems = groupedItems[group]
                        const isExpanded = expandedGroups[group] ?? true
                        const groupCompleted = groupItems.filter((i: ChecklistItem) => i.is_completed).length

                        return (
                            <div key={group} className="space-y-3">
                                {/* Group Header */}
                                <div
                                    className="flex items-center justify-between cursor-pointer group hover:opacity-80 transition-opacity px-1"
                                    onClick={() => toggleGroup(group)}
                                >
                                    <div className="flex items-center gap-2">
                                        <div className={cn(
                                            "w-6 h-6 rounded-md flex items-center justify-center transition-all",
                                            isExpanded ? "bg-blue-50 text-blue-600" : "bg-slate-100 text-slate-400"
                                        )}>
                                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                        </div>
                                        <h3 className="font-semibold text-slate-800 tracking-tight">{group}</h3>
                                        <span className="text-xs font-semibold text-slate-300 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100">
                                            {groupItems.length}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {!readOnly && groupItems.some(i => !i.is_completed) && (
                                            <Button 
                                                variant="ghost" 
                                                size="sm" 
                                                className="h-7 text-[10px] font-semibold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 px-2"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    const available = groupItems.filter(i => !i.is_completed && !i.verified_at).map(i => i.id);
                                                    handleCompleteBatch(available, true);
                                                }}
                                                disabled={isBatchLoading}
                                            >
                                                Выполнить группу
                                            </Button>
                                        )}
                                        <div className="hidden sm:block w-32 bg-slate-100 h-1 rounded-full overflow-hidden">
                                            <div
                                                className="bg-emerald-400 h-full transition-all"
                                                style={{ width: `${(groupCompleted / groupItems.length) * 100}%` }}
                                            />
                                        </div>
                                        <span className="text-xs font-semibold text-slate-400">
                                            {groupCompleted} / {groupItems.length}
                                        </span>
                                    </div>
                                </div>

                                {/* Group Items */}
                                {isExpanded && (
                                    <ItemGroup className="flex flex-col gap-3">
                                        {groupItems.map((item: ChecklistItem) => (
                                            <div key={item.id}>
                                                <Item
                                                    variant="outline"
                                                    className={cn(
                                                        "bg-white border-slate-200 shadow-sm rounded-xl overflow-hidden p-3 md:p-4 min-h-0 flex-col items-stretch transition-all",
                                                        item.verified_at ? "opacity-60" : item.is_completed ? "border-amber-200/50 shadow-sm" : "hover:border-blue-200"
                                                    )}
                                                >
                                                    <div className={cn("flex flex-col md:flex-row md:items-center gap-4 flex-1", isCompact && "md:gap-2")}>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-start justify-between gap-2">
                                                                <ItemTitle className={cn(
                                                                    isCompact ? "text-sm" : "text-base",
                                                                    "whitespace-normal leading-snug cursor-pointer hover:text-blue-600 transition-colors",
                                                                    item.verified_at ? "text-slate-400 line-through font-normal" :
                                                                        item.is_completed ? "text-slate-700 font-medium" :
                                                                            "text-slate-900 font-semibold"
                                                                )} onClick={() => item.template_item?.full_description && toggleItemDetails(item.id)}>
                                                                    {item.template_item?.short_description}
                                                                </ItemTitle>
                                                                {item.template_item?.full_description && (
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className={cn(
                                                                            "h-7 w-7 p-0 shrink-0",
                                                                            expandedItems[item.id] ? "text-blue-600 bg-blue-50" : "text-slate-400"
                                                                        )}
                                                                        onClick={() => toggleItemDetails(item.id)}
                                                                    >
                                                                        <Info className="w-4 h-4" />
                                                                    </Button>
                                                                )}
                                                            </div>

                                                            <div className={cn("flex flex-wrap items-center gap-2", isCompact ? "mt-1" : "mt-2")}>
                                                                {item.template_item?.executor_role && (
                                                                    <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                                                                        <LucideUser className="w-3 h-3" />
                                                                        {item.template_item.executor_role}
                                                                    </div>
                                                                )}
                                                                {item.template_item?.controller_role && (
                                                                    <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-400 bg-blue-50/50 px-2 py-0.5 rounded border border-blue-100">
                                                                        <ShieldCheck className="w-3 h-3" />
                                                                        {item.template_item.controller_role}
                                                                    </div>
                                                                )}
                                                                {item.is_completed && item.completed_by_user && (
                                                                    <div
                                                                        className={cn(
                                                                            "text-[11px] font-semibold flex items-center gap-1 px-2 py-0.5 rounded border shadow-sm transition-all",
                                                                            item.verified_at
                                                                                ? "text-emerald-700 bg-emerald-50/50 border-emerald-100"
                                                                                : "text-amber-700 bg-amber-50/50 border-amber-200"
                                                                        )}
                                                                        title="Дата выполнения"
                                                                    >
                                                                        <CheckCircle2 className={cn("w-3 h-3", item.verified_at ? "text-emerald-600" : "text-amber-600")} />
                                                                        <span className={item.verified_at ? "text-emerald-800" : "text-amber-800"}>
                                                                            {item.completed_by_user.full_name}
                                                                        </span>
                                                                        <span className={cn("font-medium ml-1", item.verified_at ? "text-emerald-600" : "text-amber-600")}>
                                                                            {item.completed_at ? new Date(item.completed_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : ''}
                                                                        </span>
                                                                    </div>
                                                                )}
                                                                {item.verified_at && item.verified_by_user && (
                                                                    <div className="text-[11px] text-blue-600 font-semibold flex items-center gap-1 bg-blue-100/50 px-2 py-0.5 rounded border border-blue-200" title="Дата проверки">
                                                                        <ShieldCheck className="w-3 h-3" />
                                                                        {item.verified_by_user.full_name}
                                                                        <span className="text-blue-400 font-medium ml-1">
                                                                            {item.verified_at ? new Date(item.verified_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : ''}
                                                                        </span>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {item.is_completed && !item.verified_at && !readOnly && (user?.role === 'admin' || user?.role === 'master' || user?.permissions?.can_verify_remarks) && (
                                                                <div className={cn("flex gap-2 w-full sm:w-auto", isCompact ? "mt-1.5" : "mt-3")}>
                                                                    <Button
                                                                        size="sm"
                                                                        onClick={() => handleVerifyItem(item.id, true)}
                                                                        className="bg-blue-600 hover:bg-blue-700 h-8 px-4 text-xs font-semibold"
                                                                    >
                                                                        ✓ Принять
                                                                    </Button>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="outline"
                                                                        onClick={() => {
                                                                            setRejectItemId(item.id)
                                                                            setRejectComment("")
                                                                        }}
                                                                        className="border-red-200 text-red-600 hover:bg-red-50 h-8 px-4 text-xs font-semibold"
                                                                    >
                                                                        Вернуть
                                                                    </Button>
                                                                </div>
                                                            )}
                                                        </div>

                                                        <div className={cn("flex flex-col md:flex-row items-stretch md:items-center gap-2", !isCompact && "mt-3 md:mt-0")}>
                                                            {/* Actions Row */}
                                                            <div className="flex gap-1.5 flex-1 md:flex-none order-2 md:order-1">
                                                                <button
                                                                    onClick={() => toggleItemId(item.id, 'comments')}
                                                                    className={cn(
                                                                        "flex-1 md:flex-none inline-flex items-center justify-center gap-1.5 text-xs rounded-lg transition-all border",
                                                                        isCompact ? "px-2 py-1" : "px-3 py-2",
                                                                        expandedItemId === item.id && activeDetailTab === 'comments'
                                                                            ? "bg-slate-900 text-white border-slate-900"
                                                                            : "bg-white text-slate-600 border-slate-200"
                                                                    )}
                                                                >
                                                                    <MessageSquare className={isCompact ? "w-3 h-3" : "w-3.5 h-3.5"} />
                                                                    {comments[item.id]?.length ? comments[item.id].length : ''}
                                                                </button>
                                                                <button
                                                                    onClick={() => toggleItemId(item.id, 'photos')}
                                                                    className={cn(
                                                                        "flex-1 md:flex-none inline-flex items-center justify-center gap-1.5 text-xs rounded-lg transition-all border",
                                                                        isCompact ? "px-2 py-1" : "px-3 py-2",
                                                                        expandedItemId === item.id && activeDetailTab === 'photos'
                                                                            ? "bg-slate-900 text-white border-slate-900"
                                                                            : "bg-white text-slate-600 border-slate-200"
                                                                    )}
                                                                >
                                                                    <Camera className={isCompact ? "w-3 h-3" : "w-3.5 h-3.5"} />
                                                                    {photos[item.id]?.length ? photos[item.id].length : ''}
                                                                </button>
                                                                <button
                                                                    onClick={() => toggleItemId(item.id, 'history')}
                                                                    className={cn(
                                                                        "flex-none inline-flex items-center justify-center rounded-lg transition-all border",
                                                                        isCompact ? "w-7 h-7" : "w-9 h-9",
                                                                        expandedItemId === item.id && activeDetailTab === 'history'
                                                                            ? "bg-slate-900 text-white border-slate-900"
                                                                            : "bg-white text-slate-600 border-slate-200"
                                                                    )}
                                                                >
                                                                    <History className={isCompact ? "w-3 h-3" : "w-3.5 h-3.5"} />
                                                                </button>
                                                            </div>

                                                            <div className="order-1 md:order-2">
                                                                {!readOnly && (
                                                                    !item.is_completed ? (
                                                                        <Button
                                                                            onClick={() => handleCompleteItem(item.id, true)}
                                                                            disabled={itemLoading[item.id]}
                                                                            className={cn("gap-2 bg-emerald-600 hover:bg-emerald-700 font-semibold shadow-sm w-full md:w-auto", isCompact ? "h-8 px-3 text-xs" : "h-9 px-4 text-sm")}
                                                                        >
                                                                            {itemLoading[item.id] ? (
                                                                                <Loader2 className={cn("animate-spin", isCompact ? "w-3.5 h-3.5" : "w-4 h-4")} />
                                                                            ) : (
                                                                                <CheckCircle2 className={cn(isCompact ? "w-3.5 h-3.5" : "w-4 h-4")} />
                                                                            )} 
                                                                            Выполнить
                                                                        </Button>
                                                                    ) : (
                                                                        <Button
                                                                            variant="ghost"
                                                                            onClick={() => handleCompleteItem(item.id, false)}
                                                                            disabled={itemLoading[item.id]}
                                                                            className={cn("gap-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg w-full md:w-auto", isCompact ? "h-8 px-3 text-xs" : "h-9 px-4 text-sm")}
                                                                            title="Снять отметку"
                                                                        >
                                                                            {itemLoading[item.id] ? (
                                                                                <Loader2 className={cn("animate-spin", isCompact ? "w-3.5 h-3.5" : "w-4 h-4")} />
                                                                            ) : (
                                                                                <X className={cn(isCompact ? "w-3.5 h-3.5" : "w-4 h-4")} />
                                                                            )}
                                                                            {isCompact ? "Снять" : "Снять отметку"}
                                                                        </Button>
                                                                    )
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Expanded Full Description */}
                                                    {item.template_item?.full_description && expandedItems[item.id] && (
                                                        <div className="mt-3 text-sm text-slate-500 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100 animate-in fade-in slide-in-from-top-1 duration-200">
                                                            <div className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider mb-1 flex items-center gap-1">
                                                                <Info className="w-3 h-3" /> Инструкция
                                                            </div>
                                                            {item.template_item.full_description}
                                                        </div>
                                                    )}
                                                </Item>

                                                {/* Expanded Details Panel (Comments, Photos, History) */}
                                                {expandedItemId === item.id && (
                                                    <div className="px-3 md:px-4 pb-4 ml-7 md:ml-14 mr-3 md:mr-4 -mt-2">
                                                        <div className="bg-slate-50 rounded-b-xl border border-t-0 p-3 md:p-4 shadow-inner">
                                                            {activeDetailTab === 'comments' && (
                                                                <div className="space-y-3">
                                                                    <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-slate-400 uppercase tracking-tight">
                                                                        <MessageSquare className="w-3 h-3" /> Комментарии
                                                                    </div>
                                                                    {loadingDetails[item.id] ? (
                                                                        <p className="text-center py-4 text-xs text-slate-400">Загрузка...</p>
                                                                    ) : comments[item.id]?.length ? (
                                                                        <div className="space-y-3 max-h-48 overflow-y-auto pr-2 scrollbar-thin">
                                                                            {comments[item.id].map((c: any) => (
                                                                                <div key={c.id} className="flex gap-2">
                                                                                    <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-semibold shrink-0">
                                                                                        {(c.user_id?.full_name || '?')[0]}
                                                                                    </div>
                                                                                    <div className="flex-1 min-w-0">
                                                                                        <div className="flex items-baseline gap-2">
                                                                                            <span className="text-xs font-semibold text-slate-700">{c.user_id?.full_name}</span>
                                                                                            <span className="text-[9px] text-slate-400">
                                                                                                {new Date(c.created_at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                                                                            </span>
                                                                                        </div>
                                                                                        <p className="text-xs text-slate-600 mt-0.5 break-words">{c.text}</p>
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    ) : (
                                                                        <p className="text-center py-2 text-xs text-slate-400">Нет комментариев</p>
                                                                    )}
                                                                    {!readOnly && (
                                                                        <div className="flex gap-2 pt-2 border-t">
                                                                            <input
                                                                                type="text"
                                                                                value={commentText}
                                                                                onChange={e => setCommentText(e.target.value)}
                                                                                placeholder="Добавить комментарий..."
                                                                                className="flex-1 text-xs bg-white border rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                                                onKeyDown={e => e.key === 'Enter' && submitComment(item.id)}
                                                                            />
                                                                            <Button size="sm" onClick={() => submitComment(item.id)} disabled={!commentText.trim()}>
                                                                                <Send className="w-3.5 h-3.5" />
                                                                            </Button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}

                                                            {activeDetailTab === 'photos' && (
                                                                <div className="space-y-3">
                                                                    <div className="flex justify-between items-center mb-2">
                                                                        <div className="text-xs font-semibold text-slate-400 uppercase tracking-tight flex items-center gap-2">
                                                                            <Camera className="w-3 h-3" /> Фотографии
                                                                        </div>
                                                                        {!readOnly && (
                                                                            <div className="relative">
                                                                                <input
                                                                                    type="file"
                                                                                    accept="image/*"
                                                                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                                                    onChange={(e) => handlePhotoUpload(item.id, e)}
                                                                                    disabled={uploadingPhoto}
                                                                                />
                                                                                <Button size="sm" variant="outline" className="h-7 text-xs" disabled={uploadingPhoto}>
                                                                                    {uploadingPhoto ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Camera className="w-3 h-3 mr-1" />}
                                                                                    Загрузить
                                                                                </Button>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    {loadingDetails[item.id] ? (
                                                                        <p className="text-center py-4 text-xs text-slate-400">Загрузка...</p>
                                                                    ) : photos[item.id]?.length ? (
                                                                        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                                                                            {photos[item.id].map((p: any) => (
                                                                                <div key={p.id} className="relative aspect-square group rounded-lg overflow-hidden bg-slate-200 shadow-sm border border-slate-200">
                                                                                    <img src={p.url} alt="remark" className="w-full h-full object-cover" />
                                                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                                                        <a href={p.url} target="_blank" rel="noreferrer" className="bg-white/20 backdrop-blur-md p-2 rounded-full hover:bg-white/40 transition-colors">
                                                                                            <Download className="w-4 h-4 text-white" />
                                                                                        </a>
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    ) : (
                                                                        <p className="text-center py-2 text-xs text-slate-400">Нет фото</p>
                                                                    )}
                                                                </div>
                                                            )}

                                                            {activeDetailTab === 'history' && (
                                                                <div className="space-y-3">
                                                                    <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-slate-400 uppercase tracking-tight">
                                                                        <History className="w-3 h-3" /> История изменений
                                                                    </div>
                                                                    {loadingDetails[item.id] ? (
                                                                        <p className="text-center py-4 text-xs text-slate-400">Загрузка...</p>
                                                                    ) : history[item.id]?.length ? (
                                                                        <div className="space-y-1">
                                                                            {history[item.id].map((h: any) => (
                                                                                <div key={h.id} className="text-[11px] flex items-start gap-2 py-1 border-b border-slate-100 last:border-0">
                                                                                    <span className="text-slate-400 tabular-nums shrink-0 whitespace-nowrap">
                                                                                        {new Date(h.created_at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                                                                    </span>
                                                                                    <div className="min-w-0">
                                                                                        <span className="font-semibold text-slate-700">{h.user_id?.full_name || 'Система'}: </span>
                                                                                        <span className="text-slate-600">{h.details}</span>
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    ) : (
                                                                        <p className="text-center py-2 text-xs text-slate-400">История отсутствует</p>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </ItemGroup>
                                )}
                            </div>
                        )
                    })
                }
            </div>

            {/* Rejection Dialog */}
            <Dialog open={!!rejectItemId} onOpenChange={(open) => !open && setRejectItemId(null)}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Отклонить выполнение</DialogTitle>
                        <DialogDescription>
                            Укажите причину отклонения. Пункт будет возвращен в статус «В процессе», а баллы исполнителя будут отозваны.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-2">
                        <Textarea
                            placeholder="Напишите, что именно нужно исправить..."
                            value={rejectComment}
                            onChange={(e) => setRejectComment(e.target.value)}
                            className="min-h-[100px]"
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRejectItemId(null)} disabled={isRejecting}>Отмена</Button>
                        <Button
                            variant="destructive"
                            onClick={handleReject}
                            disabled={!rejectComment.trim() || isRejecting}
                        >
                            {isRejecting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <AlertCircle className="w-4 h-4 mr-2" />}
                            Отклонить
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
