import { useEffect, useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import imageCompression from 'browser-image-compression'
import { useParams, useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import {
    ChevronLeft,
    CheckCircle2,
    AlertCircle,
    Tag,
    ChevronDown,
    MessageSquare,
    Camera,
    History,
    Send,
    Download,
    ClipboardPaste,
    Plus,
    FileText,
    BookOpen,
    Search,
    Loader2,
} from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/hooks/useAuth"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import {
    Item,
    ItemGroup,
    ItemTitle,
} from "@/components/ui/item"
import { Input } from "@/components/ui/input"
import { FloatingInput } from "@/components/ui/FloatingInput"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

interface RemarkComment {
    id: string;
    text: string;
    created_at: string;
    user_id: {
        full_name: string;
        username: string;
    } | null;
}

interface RemarkPhoto {
    id: string;
    photo_url: string;
    created_at: string;
    user_id: {
        full_name: string;
        username: string;
    } | null;
}

interface RemarkHistory {
    id: string;
    action: string;
    details: string;
    created_at: string;
    user_id: {
        full_name: string;
        username: string;
    } | null;
}

interface Remark {
    id: string;
    text: string;
    priority: "low" | "medium" | "high";
    category: string | null;
    is_completed: boolean;
    completed_at: string | null;
    created_at: string;
    completed_by: {
        full_name: string;
        username: string;
    } | null;
    created_by?: {
        full_name: string;
        username: string;
    } | null;
    is_verified?: boolean;
    verified_at?: string | null;
    verified_by?: {
        full_name: string;
        username: string;
    } | null;
    assigned_to?: number | null;
    assigned_user?: {
        full_name: string;
        username: string;
        specialization: string | null;
    } | null;
}

export default function LocomotiveRemarks() {
    const { id: locomotiveId } = useParams()
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    const [locomotive, setLocomotive] = useState<any>(null)
    const [isPasteOpen, setIsPasteOpen] = useState(false)
    const [pasteText, setPasteText] = useState("")
    const [confirmRemark, setConfirmRemark] = useState<Remark | null>(null)
    const [togglingRemarkId, setTogglingRemarkId] = useState<string | null>(null)

    // Catalog state
    const [catalogTemplates, setCatalogTemplates] = useState<any[]>([])
    const [isCatalogOpen, setIsCatalogOpen] = useState(false)
    const [catalogSearch, setCatalogSearch] = useState("")
    useEffect(() => {
        setAddedTemplateIds([])
    }, [catalogSearch])
    const [isAddManualOpen, setIsAddManualOpen] = useState(false)
    const [manualRemark, setManualRemark] = useState("")
    const [manualPriority, setManualPriority] = useState("medium")
    const [manualCategory, setManualCategory] = useState("")

    const { user: authUser } = useAuth()
    const [user, setUser] = useState<any>(null)

    useEffect(() => {
        if (authUser) setUser(authUser)
    }, [authUser])

    // Expanded state
    const [expandedRemarkId, setExpandedRemarkId] = useState<string | null>(null)
    const [activeTab, setActiveTab] = useState<"comments" | "photos" | "history">("comments")

    // Comments state
    const [comments, setComments] = useState<Record<string, RemarkComment[]>>({})
    const [commentText, setCommentText] = useState("")
    const [loadingComments, setLoadingComments] = useState<string | null>(null)

    // Photos state
    const [photos, setPhotos] = useState<Record<string, RemarkPhoto[]>>({})
    const [loadingPhotos, setLoadingPhotos] = useState<string | null>(null)
    const [uploadingPhoto, setUploadingPhoto] = useState(false)

    // History state
    const [history, setHistory] = useState<Record<string, RemarkHistory[]>>({})
    const [loadingHistory, setLoadingHistory] = useState<string | null>(null)

    // Users for assignment
    const [allUsers, setAllUsers] = useState<any[]>([])

    // Loading states for UX
    const [isSubmittingTemplate, setIsSubmittingTemplate] = useState(false)
    const [addedTemplateIds, setAddedTemplateIds] = useState<number[]>([])
    const [selectedTemplateIds, setSelectedTemplateIds] = useState<number[]>([])

    // Reject Dialog state
    const [rejectRemarkId, setRejectRemarkId] = useState<string | null>(null)
    const [rejectComment, setRejectComment] = useState("")
    useEffect(() => {
        if (locomotiveId) {
            fetchLocomotive()
            fetchUsers()
            fetchCatalogTemplates()
        }
    }, [locomotiveId])

    const { data: remarks = [], isLoading: isRemarksLoading } = useQuery({
        queryKey: ['remarks', locomotiveId],
        queryFn: async () => {
            const res = await fetch(`/api/locomotives/${locomotiveId}/remarks`)
            if (!res.ok) throw new Error("Ошибка загрузки замечаний")
            return res.json() as Promise<Remark[]>
        },
        enabled: !!locomotiveId
    })

    const fetchUsers = async () => {
        try {
            const res = await fetch('/api/public/users')
            if (res.ok) {
                setAllUsers(await res.json())
            }
        } catch (e) {
            console.error("Error fetching users:", e)
        }
    }

    const fetchCatalogTemplates = async () => {
        try {
            const res = await fetch('/api/remark-templates')
            if (res.ok) setCatalogTemplates(await res.json())
        } catch (e) { console.error(e) }
    }

    const fetchLocomotive = async () => {
        try {
            const res = await fetch(`/api/locomotives/${locomotiveId}`)
            if (res.ok) {
                setLocomotive(await res.json())
            }
        } catch (e) {
            console.error("Error fetching locomotive:", e)
        }
    }

    const assignWorkerMutation = useMutation({
        mutationFn: async ({ remarkId, userId }: { remarkId: string, userId: number | null }) => {
            const res = await fetch(`/api/remarks/${remarkId}/assign`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ assigned_to: userId })
            })
            if (!res.ok) {
                const error = await res.json()
                throw new Error(error.error || "Ошибка назначения")
            }
            return res.json()
        },
        onSuccess: (updatedRemark, variables) => {
            queryClient.setQueryData(['remarks', locomotiveId], (old: Remark[] | undefined) => {
                if (!old) return old
                return old.map(r => r.id === updatedRemark.id ? { ...r, assigned_to: updatedRemark.assigned_to, assigned_user: updatedRemark.assigned_user } : r)
            })
            toast.success(variables.userId ? "Исполнитель назначен" : "Назначение снято")
            if (expandedRemarkId === variables.remarkId && activeTab === 'history') {
                fetchHistory(variables.remarkId)
            }
        },
        onError: (error: Error) => {
            toast.error(error.message)
        }
    })

    const assignWorker = (remarkId: string, userId: number | null) => {
        assignWorkerMutation.mutate({ remarkId, userId })
    }

    const pasteRemarksMutation = useMutation({
        mutationFn: async (lines: string[]) => {
            const res = await fetch(`/api/locomotives/${locomotiveId}/remarks/bulk`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ texts: lines })
            })
            if (!res.ok) throw new Error("Ошибка при добавлении замечаний")
            return res.json()
        },
        onSuccess: (_, lines) => {
            toast.success(`Добавлено замечаний: ${lines.length}`)
            setIsPasteOpen(false)
            setPasteText("")
            queryClient.invalidateQueries({ queryKey: ['remarks', locomotiveId] })
        },
        onError: () => toast.error("Ошибка при добавлении замечаний")
    })

    const handlePasteSubmit = () => {
        if (!pasteText.trim()) return

        const lines = pasteText
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .map(line => line.replace(/^\d+[.)\]]\s*/, ''))

        if (lines.length === 0) {
            toast.error("Текст не содержит валидных строк")
            return
        }
        pasteRemarksMutation.mutate(lines)
    }

    const toggleTemplateSelection = (templateId: number) => {
        setSelectedTemplateIds(prev =>
            prev.includes(templateId)
                ? prev.filter(id => id !== templateId)
                : [...prev, templateId]
        )
    }

    const addTemplatesMutation = useMutation({
        mutationFn: async (templateIds: number[]) => {
            const results = await Promise.all(
                templateIds.map(templateId =>
                    fetch(`/api/locomotives/${locomotiveId}/remarks/template`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ template_id: templateId })
                    })
                )
            )
            const allOk = results.every(res => res.ok)
            if (!allOk) throw new Error("Некоторые замечания не были добавлены")
            return results
        },
        onSuccess: (_, variables) => {
            toast.success(`Добавлено замечаний: ${variables.length}`)
            setAddedTemplateIds(prev => [...prev, ...variables])
            setSelectedTemplateIds([])
            queryClient.invalidateQueries({ queryKey: ['remarks', locomotiveId] })
        },
        onError: (error: Error) => toast.error(error.message),
        onSettled: () => setIsSubmittingTemplate(false)
    })

    const handleAddSelectedTemplates = () => {
        if (selectedTemplateIds.length === 0 || isSubmittingTemplate) return
        setIsSubmittingTemplate(true)
        addTemplatesMutation.mutate(selectedTemplateIds)
    }

    const addManualRemarkMutation = useMutation({
        mutationFn: async (newRemarkInfo: any) => {
            const res = await fetch(`/api/locomotives/${locomotiveId}/remarks`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newRemarkInfo)
            })
            if (!res.ok) throw new Error("Ошибка при добавлении")
            return res.json()
        },
        onMutate: async (newRemarkInfo) => {
            await queryClient.cancelQueries({ queryKey: ['remarks', locomotiveId] })
            const previousRemarks = queryClient.getQueryData<Remark[]>(['remarks', locomotiveId])
            queryClient.setQueryData<Remark[]>(['remarks', locomotiveId], old => {
                const optimisticRemark = {
                    id: Math.random().toString(),
                    ...newRemarkInfo,
                    is_completed: false,
                    created_at: new Date().toISOString(),
                }
                return old ? [...old, optimisticRemark] : [optimisticRemark]
            })
            return { previousRemarks }
        },
        onError: (_err, _newRemarkInfo, context) => {
            queryClient.setQueryData(['remarks', locomotiveId], context?.previousRemarks)
            toast.error("Ошибка при добавлении")
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['remarks', locomotiveId] })
        },
        onSuccess: () => {
            toast.success("Замечание добавлено")
            setManualRemark("")
            setManualCategory("")
            setManualPriority("medium")
            setIsAddManualOpen(false)
        }
    })

    const handleManualSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!manualRemark.trim()) return
        addManualRemarkMutation.mutate({
            text: manualRemark,
            priority: manualPriority,
            category: manualCategory
        })
    }

    const completeRemarkMutation = useMutation({
        mutationFn: async ({ remark, newStatus }: { remark: Remark, newStatus: boolean }) => {
            const res = await fetch(`/api/remarks/${remark.id}/complete`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ is_completed: newStatus })
            })
            if (!res.ok) throw new Error("Ошибка при обновлении статуса")
            return res.json()
        },
        onMutate: async ({ remark, newStatus }) => {
            await queryClient.cancelQueries({ queryKey: ['remarks', locomotiveId] })
            const previousRemarks = queryClient.getQueryData<Remark[]>(['remarks', locomotiveId])
            queryClient.setQueryData<Remark[]>(['remarks', locomotiveId], old => {
                if (!old) return old
                return old.map(r => r.id === remark.id ? { ...r, is_completed: newStatus, completed_by: newStatus ? user?.id : null } : r)
            })
            return { previousRemarks }
        },
        onError: (_err, _newRemarkInfo, context) => {
            if (context?.previousRemarks) {
                queryClient.setQueryData(['remarks', locomotiveId], context.previousRemarks)
            }
            toast.error("Ошибка при обновлении статуса")
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['remarks', locomotiveId] })
            setTogglingRemarkId(null)
            setConfirmRemark(null)
        },
        onSuccess: (_, variables) => {
            toast.success(variables.newStatus ? "Замечание выполнено" : "Отметка о выполнении снята")
        }
    })

    const toggleCompletion = (remark: Remark) => {
        if (!user) {
            toast.error("Необходима авторизация")
            return
        }
        const newStatus = !remark.is_completed
        if (newStatus) {
            setConfirmRemark(remark)
            return
        }
        setTogglingRemarkId(remark.id)
        completeRemarkMutation.mutate({ remark, newStatus })
    }

    const executeCompletion = (remark: Remark, newStatus: boolean) => {
        setTogglingRemarkId(remark.id)
        completeRemarkMutation.mutate({ remark, newStatus })
    }

    const verifyRemarkMutation = useMutation({
        mutationFn: async (remarkId: string) => {
            const res = await fetch(`/api/remarks/${remarkId}/verify`, { method: "PUT" })
            if (!res.ok) throw new Error("Ошибка при принятии замечания")
            return res.json()
        },
        onSuccess: () => {
            toast.success("Замечание принято")
            queryClient.invalidateQueries({ queryKey: ['remarks', locomotiveId] })
        },
        onError: () => toast.error("Ошибка сети")
    })

    const rejectRemarkMutation = useMutation({
        mutationFn: async ({ id, comment }: { id: string, comment: string }) => {
            const res = await fetch(`/api/remarks/${id}/reject`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ comment })
            })
            if (!res.ok) throw new Error("Ошибка при возврате замечания")
            return res.json()
        },
        onSuccess: () => {
            toast.success("Замечание возвращено на доработку")
            queryClient.invalidateQueries({ queryKey: ['remarks', locomotiveId] })
            setRejectRemarkId(null)
            setRejectComment("")
        },
        onError: () => toast.error("Ошибка сети")
    })

    const fetchComments = async (remarkId: string) => {
        setLoadingComments(remarkId)
        try {
            const res = await fetch(`/api/remarks/${remarkId}/comments`)
            if (res.ok) {
                const data = await res.json()
                setComments(prev => ({ ...prev, [remarkId]: data }))
            }
        } catch (e) {
            toast.error("Ошибка загрузки комментариев")
        } finally {
            setLoadingComments(null)
        }
    }

    const fetchPhotos = async (remarkId: string) => {
        setLoadingPhotos(remarkId)
        try {
            const res = await fetch(`/api/remarks/${remarkId}/photos`)
            if (res.ok) {
                const data = await res.json()
                setPhotos(prev => ({ ...prev, [remarkId]: data }))
            }
        } catch (e) {
            toast.error("Ошибка загрузки фото")
        } finally {
            setLoadingPhotos(null)
        }
    }

    const fetchHistory = async (remarkId: string) => {
        setLoadingHistory(remarkId)
        try {
            const res = await fetch(`/api/remarks/${remarkId}/history`)
            if (res.ok) {
                const data = await res.json()
                setHistory(prev => ({ ...prev, [remarkId]: data }))
            }
        } catch (e) {
            toast.error("Ошибка загрузки истории")
        } finally {
            setLoadingHistory(null)
        }
    }

    const toggleExpanded = (remarkId: string, tab: "comments" | "photos" | "history") => {
        if (expandedRemarkId === remarkId && activeTab === tab) {
            setExpandedRemarkId(null)
        } else {
            setExpandedRemarkId(remarkId)
            setActiveTab(tab)
            setCommentText("")

            if (tab === "comments" && !comments[remarkId]) fetchComments(remarkId)
            if (tab === "photos" && !photos[remarkId]) fetchPhotos(remarkId)
            if (tab === "history" && !history[remarkId]) fetchHistory(remarkId)
        }
    }

    const handlePhotoUpload = async (remarkId: string, event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) return

        setUploadingPhoto(true)
        try {
            // Options for compression
            const options = {
                maxSizeMB: 0.5,
                maxWidthOrHeight: 1280,
                useWebWorker: true,
                initialQuality: 0.8
            }

            const compressedFile = await imageCompression(file, options)

            const formData = new FormData()
            formData.append("photo", compressedFile, compressedFile.name)

            const res = await fetch(`/api/remarks/${remarkId}/photos`, {
                method: "POST",
                body: formData
            })

            if (res.ok) {
                const newPhoto = await res.json()
                setPhotos(prev => ({
                    ...prev,
                    [remarkId]: [...(prev[remarkId] || []), newPhoto]
                }))
                toast.success("Фото прикреплено")
            } else {
                toast.error("Ошибка загрузки фото")
            }
        } catch (e) {
            toast.error("Ошибка сети")
        } finally {
            setUploadingPhoto(false)
        }
    }

    const updateRemark = async (remarkId: string, updates: Partial<Remark>) => {
        try {
            const res = await fetch(`/api/remarks/${remarkId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updates)
            })

            if (res.ok) {
                const updatedRemark = await res.json()
                queryClient.setQueryData(['remarks', locomotiveId], (old: Remark[] | undefined) => {
                    if (!old) return old
                    return old.map(r => r.id === updatedRemark.id ? updatedRemark : r)
                })
                toast.success("Обновлено")
                // Refetch history if expanded
                if (expandedRemarkId === remarkId && activeTab === 'history') {
                    fetchHistory(remarkId)
                }
            } else {
                toast.error("Ошибка обновления")
            }
        } catch (e) {
            toast.error("Ошибка сети")
        }
    }

    const submitComment = async (remarkId: string) => {
        if (!commentText.trim()) return

        try {
            const res = await fetch(`/api/remarks/${remarkId}/comments`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: commentText })
            })

            if (res.ok) {
                const newComment = await res.json()
                setComments(prev => ({
                    ...prev,
                    [remarkId]: [...(prev[remarkId] || []), newComment]
                }))
                setCommentText("")
                toast.success("Комментарий добавлен")
            } else {
                toast.error("Ошибка при добавлении комментария")
            }
        } catch (e) {
            toast.error("Ошибка сети")
        }
    }

    // Sort: incomplete first, completed last
    const sortedRemarks = [...remarks].sort((a, b) => {
        if (a.is_completed === b.is_completed) return 0
        return a.is_completed ? 1 : -1
    })

    const downloadRemarks = async (filter: 'all' | 'completed' | 'incomplete') => {
        const XLSX = await import("xlsx-js-style")
        let data = sortedRemarks
        if (filter === 'completed') data = remarks.filter(r => r.is_completed)
        if (filter === 'incomplete') data = remarks.filter(r => !r.is_completed)

        const rows = data.map((r, i) => ({
            '№': i + 1,
            'Замечание': r.text,
            'Статус': r.is_completed ? 'Выполнено' : 'Не выполнено',
            'Выполнил': r.is_completed && r.completed_by ? r.completed_by.full_name : '',
            'Дата выполнения': r.completed_at ? new Date(r.completed_at).toLocaleString('ru-RU') : ''
        }))

        const ws = XLSX.utils.json_to_sheet(rows)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, 'Замечания')

        const filterLabel = filter === 'all' ? '' : filter === 'completed' ? '_выполненные' : '_невыполненные'
        const fileName = `Замечания_${locomotive?.number || 'лок'}${filterLabel}.xlsx`
        XLSX.writeFile(wb, fileName)
        toast.success(`Скачано: ${rows.length} замечаний`)
    }

    const downloadPDF = (filter: 'all' | 'completed' | 'incomplete') => {
        let data = sortedRemarks
        if (filter === 'completed') data = remarks.filter(r => r.is_completed)
        if (filter === 'incomplete') data = remarks.filter(r => !r.is_completed)

        const filterTitle = filter === 'all' ? 'Все замечания' : filter === 'completed' ? 'Выполненные' : 'Невыполненные'
        const locoNum = locomotive?.number || ''

        const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Замечания ${locoNum}</title>
<style>
  body { font-family: Arial, sans-serif; padding: 30px; color: #333; }
  h1 { font-size: 18px; margin-bottom: 4px; }
  .subtitle { font-size: 13px; color: #666; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { background: #f1f5f9; text-align: left; padding: 8px 10px; border: 1px solid #e2e8f0; font-weight: 600; }
  td { padding: 8px 10px; border: 1px solid #e2e8f0; vertical-align: top; }
  tr:nth-child(even) { background: #f8fafc; }
  .completed { color: #94a3b8; text-decoration: line-through; }
  .status-done { color: #16a34a; font-weight: 600; }
  .status-open { color: #d97706; font-weight: 600; }
  .priority { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; }
  .priority-high { background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5; }
  .priority-medium { background: #fef3c7; color: #b45309; border: 1px solid #fde68a; }
  .priority-low { background: #dcfce3; color: #15803d; border: 1px solid #86efac; }
  .category { font-size: 11px; color: #64748b; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; display: inline-block; }
  .footer { margin-top: 20px; font-size: 11px; color: #94a3b8; }
  @media print { body { padding: 10px; } }
</style></head><body>
<h1>Наряд-Задание (Замечания) — Локомотив #${locoNum}</h1>
<div class="subtitle">${filterTitle} • ${new Date().toLocaleDateString('ru-RU')} • Всего: ${data.length}</div>
<table>
  <thead><tr>
    <th style="width:30px">№</th>
    <th style="width:70px">Приоритет</th>
    <th>Замечание</th>
    <th style="width:90px">Категория</th>
    <th style="width:90px">Статус</th>
    <th style="width:120px">Выполнил</th>
    <th style="width:90px">Дата</th>
  </tr></thead>
  <tbody>
    ${data.map((r, i) => `<tr>
      <td>${i + 1}</td>
      <td>
        <span class="priority priority-${r.priority || 'medium'}">
          ${r.priority === 'high' ? 'Высокий' : r.priority === 'low' ? 'Низкий' : 'Средний'}
        </span>
      </td>
      <td class="${r.is_completed ? 'completed' : ''}">${r.text}</td>
      <td><span class="category">${r.category || 'Без категории'}</span></td>
      <td class="${r.is_completed ? 'status-done' : 'status-open'}">${r.is_completed ? '✓ Выполнено' : '○ Открыто'}</td>
      <td>${r.is_completed && r.completed_by ? r.completed_by.full_name : '—'}</td>
      <td>${r.completed_at ? new Date(r.completed_at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
    </tr>`).join('')}
  </tbody>
</table>
<div class="footer">Yamazumi Depot • Сформировано ${new Date().toLocaleString('ru-RU')}</div>
<script>window.onload = () => window.print();</script>
</body></html>`

        const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        window.open(url, '_blank')
    }

    return (
        <div className="flex-1 flex flex-col items-center overflow-auto bg-slate-50/50">
            <main className="flex-1 w-full p-4 md:p-6 max-w-5xl mx-auto">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                    <div className="flex items-start gap-3 md:gap-4">
                        <Button variant="ghost" size="icon" onClick={() => navigate('/map')} className="shrink-0 -ml-2 md:ml-0">
                            <ChevronLeft className="w-5 h-5 text-slate-500" />
                        </Button>
                        <div className="min-w-0">
                            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 truncate">
                                Замечания {locomotive ? `— #${locomotive.number}` : ''}
                            </h1>
                            <p className="text-xs md:text-sm text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-1">
                                {locomotive ? (
                                    <>
                                        <span className="font-medium text-slate-700 whitespace-nowrap">
                                            {({
                                                active: 'Активный',
                                                repair: 'Ремонт',
                                                waiting: 'Ожидание',
                                                completed: 'Завершён'
                                            } as Record<string, string>)[locomotive.status] || locomotive.status}
                                        </span>
                                        <span className="text-slate-300">•</span>
                                        <span className="truncate">{locomotive.repair_type || 'Без типа ремонта'}</span>
                                    </>
                                ) : 'Загрузка данных...'}
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2 w-full md:w-auto">
                        {(user?.role === 'admin' || user?.permissions?.can_edit_catalog || user?.permissions?.can_complete_remarks) && (
                            <>
                                <Button onClick={() => setIsAddManualOpen(true)} className="gap-2 bg-emerald-600 hover:bg-emerald-700 flex-1 md:flex-none h-9 text-sm">
                                    <Tag className="w-4 h-4" /> Добавить
                                </Button>
                                <Button onClick={() => setIsCatalogOpen(true)} className="gap-2 bg-amber-500 hover:bg-amber-600 flex-1 md:flex-none h-9 text-sm text-white">
                                    <BookOpen className="w-4 h-4" /> Каталог
                                </Button>
                                <Button onClick={() => setIsPasteOpen(true)} className="gap-2 bg-indigo-600 hover:bg-indigo-700 flex-1 md:flex-none h-9 text-sm">
                                    <ClipboardPaste className="w-4 h-4" /> <span className="hidden xs:inline">Из Excel</span><span className="xs:hidden">Excel</span>
                                </Button>
                            </>
                        )}
                        {remarks.length > 0 && (
                            <div className="flex gap-2 flex-1 md:flex-none">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline" className="gap-2 flex-1 md:flex-none h-9 text-sm">
                                            <Download className="w-4 h-4" /> Excel
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => downloadRemarks('all')}>Все замечания</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => downloadRemarks('incomplete')} className="text-amber-600">Невыполненные</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => downloadRemarks('completed')} className="text-green-600">Выполненные</DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline" className="gap-2 flex-1 md:flex-none h-9 text-sm">
                                            <FileText className="w-4 h-4" /> PDF
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => downloadPDF('all')}>Все замечания</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => downloadPDF('incomplete')} className="text-amber-600">Невыполненные</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => downloadPDF('completed')} className="text-green-600">Выполненные</DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        )}
                    </div>
                </div>

                {/* Statistics */}
                {!isRemarksLoading && remarks.length > 0 && (() => {
                    const total = remarks.length
                    const completed = remarks.filter(r => r.is_completed).length
                    const remaining = total - completed
                    const percent = Math.round((completed / total) * 100)

                    // Who completed how many
                    const completedBy: Record<string, number> = {}
                    remarks.forEach(r => {
                        if (r.is_completed && r.completed_by?.full_name) {
                            completedBy[r.completed_by.full_name] = (completedBy[r.completed_by.full_name] || 0) + 1
                        }
                    })

                    return (
                        <div className="bg-white border rounded-xl shadow-sm p-3 md:p-6 mb-4">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6 mb-4">
                                <div className="space-y-1">
                                    <span className="text-[10px] md:text-xs text-slate-400 uppercase font-bold tracking-wider">Всего</span>
                                    <div className="text-xl md:text-2xl font-black text-slate-900">{total}</div>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[10px] md:text-xs text-slate-400 uppercase font-bold tracking-wider">Выполнено</span>
                                    <div className="text-xl md:text-2xl font-black text-green-600">{completed}</div>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[10px] md:text-xs text-slate-400 uppercase font-bold tracking-wider">Осталось</span>
                                    <div className="text-xl md:text-2xl font-black text-amber-600">{remaining}</div>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[10px] md:text-xs text-slate-400 uppercase font-bold tracking-wider">Прогресс</span>
                                    <div className="text-xl md:text-2xl font-black text-indigo-600">{percent}%</div>
                                </div>
                            </div>

                            <div className="w-full bg-slate-100 rounded-full h-1.5 md:h-2 mb-4">
                                <div
                                    className="bg-green-500 h-1.5 md:h-2 rounded-full transition-all duration-700"
                                    style={{ width: `${percent}%` }}
                                />
                            </div>

                            {Object.keys(completedBy).length > 0 && (
                                <div className="pt-3 border-t border-slate-100 flex flex-wrap gap-2 md:gap-3">
                                    <span className="text-[10px] md:text-xs text-slate-400 w-full md:w-auto mb-1 md:mb-0">Выполнили:</span>
                                    {Object.entries(completedBy)
                                        .sort((a, b) => b[1] - a[1])
                                        .map(([name, count]) => (
                                            <span key={name} className="inline-flex items-center gap-1.5 text-[10px] md:text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg">
                                                <span className="font-semibold">{name}</span>
                                                <span className="bg-white text-slate-900 rounded-md px-1.5 text-[9px] md:text-[10px] font-black border border-slate-200">{count}</span>
                                            </span>
                                        ))}
                                </div>
                            )}
                        </div>
                    )
                })()}

                <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
                    {isRemarksLoading ? (
                        <ItemGroup className="flex flex-col gap-3 p-3 md:p-0">
                            {Array(4).fill(0).map((_, i) => (
                                <Item key={i} variant="outline" className="bg-white border-slate-200 shadow-sm rounded-xl overflow-hidden p-3 md:p-4 min-h-0 flex-col md:flex-row items-stretch md:items-center">
                                    <div className="flex items-start gap-4 flex-1">
                                        <Skeleton className="w-6 md:w-8 h-4 mt-2 shrink-0 bg-slate-200" />
                                        <div className="flex-1 space-y-3 mt-1">
                                            <Skeleton className="h-5 w-3/4 bg-slate-200" />
                                            <div className="flex flex-wrap items-center gap-2 mt-2">
                                                <Skeleton className="h-4 w-24 bg-slate-100" />
                                                <Skeleton className="h-6 w-32 rounded-full bg-indigo-50" />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-3 md:mt-0 md:ml-4 flex items-center justify-end gap-2 shrink-0 border-t md:border-none pt-3 md:pt-0 border-slate-100">
                                        <Skeleton className="h-8 w-24 rounded-md bg-slate-100" />
                                        <Skeleton className="h-8 w-10 rounded-md bg-slate-100" />
                                        <Skeleton className="h-8 w-10 rounded-md bg-slate-100" />
                                    </div>
                                </Item>
                            ))}
                        </ItemGroup>
                    ) : remarks.length === 0 ? (
                        <div className="p-12 text-center flex flex-col items-center">
                            <ClipboardPaste className="w-12 h-12 text-slate-300 mb-4" />
                            <h3 className="text-lg font-medium text-slate-900 mb-1">Нет замечаний</h3>
                            <p className="text-slate-500 max-w-sm mb-6">
                                Для этого локомотива пока не добавлено ни одного замечания. Вы можете вставить список из Excel или Word.
                            </p>
                            {(user?.role === 'admin' || user?.permissions?.can_edit_catalog || user?.permissions?.can_complete_remarks) && (
                                <Button onClick={() => setIsPasteOpen(true)} variant="outline">
                                    Добавить замечания
                                </Button>
                            )}
                        </div>
                    ) : (
                        <ItemGroup className="flex flex-col gap-3 p-3 md:p-0">
                            {sortedRemarks.map((remark) => (
                                <div key={remark.id}>
                                    <Item
                                        variant="outline"
                                        className={`bg-white border-slate-200 shadow-sm rounded-xl overflow-hidden p-3 md:p-4 min-h-0 flex-col md:flex-row items-stretch md:items-center ${remark.is_verified ? 'opacity-60' : remark.is_completed ? 'border-amber-200/50 shadow-sm' : ''}`}
                                    >
                                        <div className="flex items-start gap-3 flex-1">
                                            <div className="flex-1 min-w-0">
                                                <ItemTitle className={`text-base whitespace-normal leading-snug line-clamp-none ${remark.is_verified ? 'text-slate-400 line-through font-normal' : remark.is_completed ? 'text-slate-700 font-medium' : 'text-slate-900 font-semibold'}`}>
                                                    {remark.text}
                                                </ItemTitle>

                                                <div className="flex flex-wrap items-center gap-2 mt-2">
                                                    {remark.created_by && (
                                                        <div className="text-[11px] md:text-xs text-slate-400 font-medium whitespace-nowrap">
                                                            Добавил(а): {remark.created_by.full_name}
                                                        </div>
                                                    )}

                                                    {/* Worker Assignment Dropdown */}
                                                    <div className="flex items-center gap-1">
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <button className={`inline-flex items-center gap-1.5 text-[11px] md:text-xs px-2.5 py-1 rounded-full border transition-all ${remark.assigned_user ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-slate-50 text-slate-500 border-slate-200 border-dashed hover:border-slate-300'}`}>
                                                                    <div className={`w-2 h-2 rounded-full ${remark.assigned_user ? 'bg-indigo-500 animate-pulse' : 'bg-slate-300'}`} />
                                                                    {remark.assigned_user ? (
                                                                        <span className="font-semibold">{remark.assigned_user.full_name} {remark.assigned_user.specialization ? `(${remark.assigned_user.specialization})` : ''}</span>
                                                                    ) : (
                                                                        <span>Назначить</span>
                                                                    )}
                                                                    <ChevronDown className="w-3 h-3 opacity-50" />
                                                                </button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="start" className="w-[180px] max-h-[300px] overflow-y-auto">
                                                                <DropdownMenuItem onClick={() => assignWorker(remark.id, null)} className="italic text-slate-400">
                                                                    Без исполнителя
                                                                </DropdownMenuItem>
                                                                <div className="h-px bg-slate-100 my-1" />
                                                                {allUsers.map((u: any) => (
                                                                    <DropdownMenuItem key={u.id} onClick={() => assignWorker(remark.id, u.id)} className="flex flex-col items-start gap-0.5 py-2">
                                                                        <span className="font-medium text-xs">{u.full_name}</span>
                                                                        {u.specialization && (
                                                                            <span className="text-[10px] text-slate-400">{u.specialization}</span>
                                                                        )}
                                                                    </DropdownMenuItem>
                                                                ))}
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </div>

                                                    {/* Priority & Category Interactive Badges */}
                                                    <div className="flex gap-1.5">
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <button className={`inline-flex items-center gap-1 text-[11px] md:text-xs px-2 py-1 rounded border transition-colors ${remark.priority === 'high' ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100' :
                                                                    remark.priority === 'low' ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' :
                                                                        'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                                                                    }`}>
                                                                    <AlertCircle className="w-3.5 h-3.5" />
                                                                    {remark.priority === 'high' ? 'Высокий' : remark.priority === 'low' ? 'Низкий' : 'Средний'}
                                                                    <ChevronDown className="w-3 h-3 opacity-50" />
                                                                </button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="start">
                                                                <DropdownMenuItem onClick={() => updateRemark(remark.id, { priority: 'high' })}>Высокий</DropdownMenuItem>
                                                                <DropdownMenuItem onClick={() => updateRemark(remark.id, { priority: 'medium' })}>Средний</DropdownMenuItem>
                                                                <DropdownMenuItem onClick={() => updateRemark(remark.id, { priority: 'low' })}>Низкий</DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>

                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <button className="inline-flex items-center gap-1 text-[11px] md:text-xs px-2 py-1 rounded border bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 transition-colors">
                                                                    <Tag className="w-3.5 h-3.5" />
                                                                    {remark.category || 'Без категории'}
                                                                    <ChevronDown className="w-3 h-3 opacity-50" />
                                                                </button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="start">
                                                                <DropdownMenuItem onClick={() => updateRemark(remark.id, { category: 'Электрика' })}>Электрика</DropdownMenuItem>
                                                                <DropdownMenuItem onClick={() => updateRemark(remark.id, { category: 'Ходовая' })}>Ходовая</DropdownMenuItem>
                                                                <DropdownMenuItem onClick={() => updateRemark(remark.id, { category: 'Дизель' })}>Дизель</DropdownMenuItem>
                                                                <DropdownMenuItem onClick={() => updateRemark(remark.id, { category: 'Тормоза' })}>Тормоза</DropdownMenuItem>
                                                                <DropdownMenuItem onClick={() => updateRemark(remark.id, { category: 'Прочее' })}>Прочее</DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </div>
                                                </div>

                                                {remark.is_completed && remark.completed_by && (
                                                    <div className="mt-2 flex flex-col gap-2">
                                                        <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-xs md:text-sm text-slate-500 border px-2.5 py-1.5 inline-flex rounded-md shadow-sm w-fit ${remark.is_verified ? 'bg-green-50/50 border-green-100' : 'bg-amber-50/50 border-amber-200'}`}>
                                                            <div className="flex items-center gap-1.5">
                                                                <CheckCircle2 className={`w-3.5 md:w-4 h-3.5 md:h-4 ${remark.is_verified ? 'text-green-600' : 'text-amber-600'}`} />
                                                                <span className={`font-semibold ${remark.is_verified ? 'text-green-800' : 'text-amber-800'}`}>
                                                                    {remark.completed_by.full_name}
                                                                </span>
                                                            </div>
                                                            <span className={`hidden md:inline ${remark.is_verified ? 'text-green-300' : 'text-amber-300'}`}>•</span>
                                                            <span className={`${remark.is_verified ? 'text-green-600' : 'text-amber-600'} font-medium`}>
                                                                {new Date(remark.completed_at!).toLocaleString('ru-RU', {
                                                                    day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit'
                                                                })}
                                                            </span>
                                                            {remark.is_verified ? (
                                                                <span className="ml-1 font-bold text-green-700 bg-green-200/50 px-1.5 rounded">✓ Принято</span>
                                                            ) : (
                                                                <span className="ml-1 font-bold text-amber-700 bg-amber-200/50 px-1.5 rounded">⏳ Ожидает проверки</span>
                                                            )}
                                                        </div>

                                                        {user?.permissions?.can_verify_remarks && !remark.is_verified && (
                                                            <div className="flex gap-2 w-full mt-2">
                                                                <Button
                                                                    size="default"
                                                                    onClick={() => verifyRemarkMutation.mutate(remark.id)}
                                                                    disabled={verifyRemarkMutation.isPending || rejectRemarkMutation.isPending}
                                                                    className="bg-green-600 hover:bg-green-700 text-white h-10 px-2 text-[11px] sm:text-xs flex-1 rounded-lg"
                                                                >
                                                                    ✓ Принять работу
                                                                </Button>
                                                                <Button
                                                                    size="default"
                                                                    onClick={() => {
                                                                        setRejectComment("");
                                                                        setRejectRemarkId(remark.id);
                                                                    }}
                                                                    disabled={verifyRemarkMutation.isPending || rejectRemarkMutation.isPending}
                                                                    variant="outline"
                                                                    className="border-red-200 text-red-600 hover:bg-red-50 h-10 px-2 text-[11px] sm:text-xs flex-1 rounded-lg"
                                                                >
                                                                    Вернуть на доработку
                                                                </Button>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>


                                        </div>

                                        <div className="mt-4 md:mt-0 flex flex-col md:flex-row justify-between md:items-center md:ml-4 gap-3 md:gap-0">
                                            <div className="flex gap-2 flex-1 md:flex-none">
                                                <button
                                                    onClick={() => toggleExpanded(remark.id, 'comments')}
                                                    className={`flex-1 md:flex-none inline-flex items-center justify-center gap-2 text-[13px] md:text-sm px-4 md:px-4 py-3 md:py-2 rounded-xl transition-all border ${expandedRemarkId === remark.id && activeTab === 'comments'
                                                        ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                                                        : 'bg-white text-slate-600 border-slate-200 shadow-sm active:bg-slate-50'
                                                        }`}
                                                >
                                                    <MessageSquare className="w-4 h-4" />
                                                    <span className="font-bold">
                                                        {comments[remark.id]?.length ? `Чат (${comments[remark.id].length})` : 'Чат'}
                                                    </span>
                                                </button>

                                                <button
                                                    onClick={() => toggleExpanded(remark.id, 'photos')}
                                                    className={`flex-1 md:flex-none inline-flex items-center justify-center gap-2 text-[13px] md:text-sm px-4 md:px-4 py-3 md:py-2 rounded-xl transition-all border ${expandedRemarkId === remark.id && activeTab === 'photos'
                                                        ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                                                        : 'bg-white text-slate-600 border-slate-200 shadow-sm active:bg-slate-50'
                                                        }`}
                                                >
                                                    <Camera className="w-4.5 h-4.5" />
                                                    <span className="font-bold">Фото {photos[remark.id]?.length ? `(${photos[remark.id].length})` : ''}</span>
                                                </button>

                                                <button
                                                    onClick={() => toggleExpanded(remark.id, 'history')}
                                                    className={`hidden md:inline-flex flex-none items-center justify-center w-11 h-11 rounded-xl transition-all border ${expandedRemarkId === remark.id && activeTab === 'history'
                                                        ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                                                        : 'bg-white text-slate-600 border-slate-200 shadow-sm active:bg-slate-50'
                                                        }`}
                                                    title="История"
                                                >
                                                    <History className="w-4.5 h-4.5" />
                                                </button>
                                            </div>

                                            <button
                                                onClick={() => toggleCompletion(remark)}
                                                disabled={togglingRemarkId === remark.id}
                                                className={`flex items-center justify-center gap-2 h-11 md:h-10 md:px-4 md:ml-3 rounded-xl border shadow-sm transition-all w-full md:w-auto flex-none ${!remark.is_completed
                                                    ? 'bg-green-500 border-green-500 text-white hover:bg-green-600 shadow-green-200 shadow-md active:scale-95 cursor-pointer'
                                                    : 'bg-slate-50 border-slate-200 text-slate-400 opacity-70 cursor-pointer'
                                                    }`}
                                            >
                                                {togglingRemarkId === remark.id ? (
                                                    <Loader2 className="w-5 h-5 animate-spin" />
                                                ) : (
                                                    <>
                                                        <CheckCircle2 className="w-5 h-5 shrink-0" />
                                                        <span className="font-medium text-[15px] md:text-sm">
                                                            {remark.is_completed ? 'Выполнено' : 'Выполнить'}
                                                        </span>
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </Item>

                                    {/* Expanded Panel */}
                                    {expandedRemarkId === remark.id && (
                                        <div className="px-3 md:px-4 pb-4 ml-7 md:ml-14 mr-3 md:mr-4">
                                            <div className="bg-slate-50 rounded-lg border p-2 md:p-3">

                                                {/* Comments Tab */}
                                                {activeTab === 'comments' && (
                                                    <div className="space-y-3">
                                                        {loadingComments === remark.id ? (
                                                            <p className="text-[10px] md:text-xs text-slate-400 text-center py-2">Загрузка...</p>
                                                        ) : comments[remark.id]?.length ? (
                                                            <div className="space-y-2 max-h-48 overflow-y-auto pr-2 scrollbar-thin">
                                                                {comments[remark.id].map(c => (
                                                                    <div key={c.id} className="flex gap-2">
                                                                        <div className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[9px] md:text-[10px] font-bold shrink-0 mt-0.5">
                                                                            {(c.user_id?.full_name || '?')[0]}
                                                                        </div>
                                                                        <div className="flex-1 min-w-0">
                                                                            <div className="flex items-baseline gap-2">
                                                                                <span className="text-[10px] md:text-xs font-medium text-slate-700 truncate">{c.user_id?.full_name || 'Пользователь'}</span>
                                                                                <span className="text-[9px] md:text-[10px] text-slate-400 shrink-0">
                                                                                    {new Date(c.created_at).toLocaleString('ru-RU', {
                                                                                        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                                                                                    })}
                                                                                </span>
                                                                            </div>
                                                                            <p className="text-[10px] md:text-xs text-slate-600 mt-0.5 break-words">{c.text}</p>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <p className="text-[10px] md:text-xs text-slate-400 text-center py-1">Нет комментариев</p>
                                                        )}

                                                        {/* Add comment input */}
                                                        <div className="flex gap-2 pt-1 border-t border-slate-200">
                                                            <input
                                                                type="text"
                                                                value={commentText}
                                                                onChange={e => setCommentText(e.target.value)}
                                                                onKeyDown={e => { if (e.key === 'Enter' && commentText.trim()) submitComment(remark.id) }}
                                                                placeholder="Написать..."
                                                                className="flex-1 text-[10px] md:text-xs bg-white border rounded-md px-2 md:px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                                            />
                                                            <button
                                                                onClick={() => submitComment(remark.id)}
                                                                disabled={!commentText.trim()}
                                                                className="p-1.5 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                                            >
                                                                <Send className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Photos Tab */}
                                                {activeTab === 'photos' && (
                                                    <div className="space-y-3 md:space-y-4">
                                                        <div className="flex justify-between items-center gap-2">
                                                            <span className="text-[10px] md:text-xs font-medium text-slate-700">Фото</span>
                                                            <div className="relative">
                                                                <input
                                                                    type="file"
                                                                    accept="image/*"
                                                                    id={`photo-upload-${remark.id}`}
                                                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                                    onChange={(e) => handlePhotoUpload(remark.id, e)}
                                                                    disabled={uploadingPhoto}
                                                                />
                                                                <Button size="sm" variant="outline" className="h-7 md:h-8 text-[10px] md:text-xs" disabled={uploadingPhoto}>
                                                                    <Camera className="w-3 md:w-3.5 h-3 md:h-3.5 mr-1.5" />
                                                                    {uploadingPhoto ? '...' : 'Добавить'}
                                                                </Button>
                                                            </div>
                                                        </div>

                                                        {loadingPhotos === remark.id ? (
                                                            <p className="text-[10px] md:text-xs text-slate-400 text-center py-4">Загрузка...</p>
                                                        ) : photos[remark.id]?.length ? (
                                                            <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 md:gap-3">
                                                                {photos[remark.id].map(photo => (
                                                                    <a
                                                                        key={photo.id}
                                                                        href={photo.photo_url}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="group relative aspect-square rounded-lg overflow-hidden border border-slate-200 bg-white shadow-sm hover:shadow-md transition-all"
                                                                    >
                                                                        <img
                                                                            src={photo.photo_url}
                                                                            alt="Remark"
                                                                            className="w-full h-full object-cover"
                                                                        />
                                                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                                            <Download className="w-4 h-4 text-white" />
                                                                        </div>
                                                                    </a>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <p className="text-[10px] md:text-xs text-slate-400 text-center py-2">Нет фото</p>
                                                        )}
                                                    </div>
                                                )}

                                                {/* History Tab */}
                                                {activeTab === 'history' && (
                                                    <div className="space-y-2">
                                                        {loadingHistory === remark.id ? (
                                                            <p className="text-[10px] md:text-xs text-slate-400 text-center py-2">Загрузка...</p>
                                                        ) : history[remark.id]?.length ? (
                                                            <div className="space-y-2 max-h-48 overflow-y-auto pr-2 scrollbar-thin">
                                                                {history[remark.id].map(h => (
                                                                    <div key={h.id} className="text-[10px] md:text-xs flex gap-2 items-start py-1 border-b border-slate-100 last:border-0">
                                                                        <span className="text-slate-400 tabular-nums shrink-0 mt-0.5">
                                                                            {new Date(h.created_at).toLocaleString('ru-RU', {
                                                                                day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                                                                            })}
                                                                        </span>
                                                                        <div className="min-w-0">
                                                                            <span className="font-medium text-slate-700">{h.user_id?.full_name || 'Система'}: </span>
                                                                            <span className="text-slate-600">{h.details}</span>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <p className="text-[10px] md:text-xs text-slate-400 text-center py-1">Нет истории</p>
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

                {/* Confirm Completion Dialog */}
                <Dialog open={!!confirmRemark} onOpenChange={(open) => !open && setConfirmRemark(null)}>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle>Завершение работы</DialogTitle>
                            <DialogDescription>
                                Вы действительно выполнили это замечание? Оно будет отмечено в системе вашим именем.
                            </DialogDescription>
                        </DialogHeader>
                        {confirmRemark && (
                            <div className="py-4 px-1">
                                <p className="text-sm font-medium text-slate-900 bg-slate-50 p-3 rounded-lg border">
                                    {confirmRemark.text}
                                </p>
                            </div>
                        )}
                        <DialogFooter className="gap-2 sm:gap-0">
                            <Button variant="outline" onClick={() => setConfirmRemark(null)} className="flex-1 sm:flex-none">
                                Отмена
                            </Button>
                            <Button
                                onClick={() => confirmRemark && executeCompletion(confirmRemark, true)}
                                disabled={togglingRemarkId === confirmRemark?.id}
                                className="bg-green-600 hover:bg-green-700 flex-1 sm:flex-none transition-all duration-300"
                            >
                                {togglingRemarkId === confirmRemark?.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                                {togglingRemarkId === confirmRemark?.id ? "Завершение..." : "Выполнено"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Bulk Paste Dialog */}
                <Dialog open={isPasteOpen} onOpenChange={setIsPasteOpen}>
                    <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col p-0 overflow-hidden">
                        <div className="p-6">
                            <DialogHeader>
                                <DialogTitle>Вставка из Excel</DialogTitle>
                                <DialogDescription>
                                    Скопируйте строки из Excel или Word и вставьте их сюда. Каждая строка станет отдельным замечанием.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="mt-4">
                                <Textarea
                                    value={pasteText}
                                    onChange={(e) => setPasteText(e.target.value)}
                                    placeholder="Вставьте текст здесь...&#10;Пример:&#10;1. Проверить уровень масла&#10;2. Заменить лампу в кабине&#10;3. Подтянуть болты ТЭД"
                                    className="min-h-[250px] font-mono text-sm resize-none"
                                />
                                <p className="text-[10px] md:text-xs text-slate-400 mt-2">
                                    Система автоматически удалит порядковые номера при вставке.
                                </p>
                            </div>
                        </div>
                        <div className="p-4 bg-slate-50 border-t flex flex-wrap gap-3 justify-end">
                            <Button variant="outline" onClick={() => setIsPasteOpen(false)} className="flex-1 sm:flex-none">
                                Отмена
                            </Button>
                            <Button
                                onClick={handlePasteSubmit}
                                disabled={!pasteText.trim()}
                                className="bg-indigo-600 hover:bg-indigo-700 flex-1 sm:flex-none"
                            >
                                <ClipboardPaste className="w-4 h-4 mr-2" /> Добавить {pasteText.split('\n').filter(l => l.trim()).length || ''} строк
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>

                {/* Add Catalog Remark Dialog */}
                <Dialog open={isCatalogOpen} onOpenChange={(open) => {
                    setIsCatalogOpen(open)
                    if (!open) {
                        setAddedTemplateIds([])
                        setSelectedTemplateIds([])
                    }
                }}>
                    <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col p-6">
                        <DialogHeader>
                            <div className="flex justify-between items-center">
                                <div>
                                    <DialogTitle>Каталог типовых замечаний</DialogTitle>
                                    <DialogDescription>Выберите замечания для быстрого добавления</DialogDescription>
                                </div>
                                {selectedTemplateIds.length > 0 && (
                                    <Button
                                        onClick={handleAddSelectedTemplates}
                                        disabled={isSubmittingTemplate}
                                        className="bg-green-600 hover:bg-green-700 animate-in fade-in zoom-in duration-200"
                                    >
                                        {isSubmittingTemplate ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                                        Добавить ({selectedTemplateIds.length})
                                    </Button>
                                )}
                            </div>
                        </DialogHeader>
                        <div className="relative group">
                            <Search className={cn(
                                "absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors z-20",
                                catalogSearch ? "text-indigo-500" : "text-slate-400 group-hover:text-slate-500"
                            )} />
                            <FloatingInput
                                label="Поиск в каталоге..."
                                value={catalogSearch}
                                onChange={(e) => setCatalogSearch(e.target.value)}
                                className="pl-9 h-10"
                                labelClassName="left-9"
                            />
                        </div>
                        <div className="flex-1 overflow-y-auto pr-2 space-y-2 py-2 scrollbar-thin">
                            {catalogTemplates
                                .filter(t => t.text.toLowerCase().includes(catalogSearch.toLowerCase()) || (t.specialization || "").toLowerCase().includes(catalogSearch.toLowerCase()))
                                .sort((a, b) => (b.usage_count || 0) - (a.usage_count || 0))
                                .map(t => (
                                    <button
                                        key={t.id}
                                        disabled={isSubmittingTemplate}
                                        onClick={() => toggleTemplateSelection(t.id)}
                                        className={`w-full text-left p-3 rounded-lg border transition-all group flex flex-col gap-1 ${selectedTemplateIds.includes(t.id)
                                            ? 'bg-indigo-50 border-indigo-400 ring-2 ring-indigo-100 ring-offset-0'
                                            : 'border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50'
                                            } ${isSubmittingTemplate ? 'opacity-80 cursor-wait' : ''}`}
                                    >
                                        <div className="flex justify-between items-start">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${selectedTemplateIds.includes(t.id) ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'
                                                    }`}>
                                                    {selectedTemplateIds.includes(t.id) && <CheckCircle2 className="w-3 h-3 text-white" />}
                                                </div>
                                                <span className={`font-medium ${selectedTemplateIds.includes(t.id) ? 'text-indigo-700' : 'text-slate-900'} group-hover:text-indigo-700`}>{t.text}</span>
                                                {addedTemplateIds.includes(t.id) && (
                                                    <span className="flex items-center text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold ml-2">
                                                        <CheckCircle2 className="w-3 h-3 mr-1" /> Добавлено
                                                    </span>
                                                )}
                                            </div>
                                            {t.priority === 'high' && <span className="text-[9px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded font-bold uppercase shrink-0">High</span>}
                                        </div>
                                        <div className="flex items-center gap-2 ml-6">
                                            {t.specialization && <span className="text-[10px] text-indigo-600 font-semibold">{t.specialization}</span>}
                                            {t.category && <span className="text-[10px] text-slate-400">/ {t.category}</span>}
                                            <span className="text-[9px] text-slate-300 ml-auto leading-none">Использовано: {t.usage_count || 0}</span>
                                        </div>
                                    </button>
                                ))
                            }
                            {catalogTemplates.length === 0 && <div className="p-8 text-center text-slate-500">Загрузка каталога или каталог пуст...</div>}
                        </div>
                    </DialogContent>
                </Dialog>

                {/* Add Manual Remark Dialog */}
                <Dialog open={isAddManualOpen} onOpenChange={setIsAddManualOpen}>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle>Добавить замечание</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleManualSubmit} className="space-y-4 pt-2">
                            <div className="space-y-4 pt-4">
                                <FloatingInput
                                    label="Текст замечания"
                                    value={manualRemark}
                                    onChange={(e) => setManualRemark(e.target.value)}
                                    placeholder="Опишите неисправность..."
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Приоритет</Label>
                                    <Select value={manualPriority} onValueChange={setManualPriority}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="low">Низкий</SelectItem>
                                            <SelectItem value="medium">Средний</SelectItem>
                                            <SelectItem value="high">Высокий</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Категория</Label>
                                    <Input value={manualCategory} onChange={e => setManualCategory(e.target.value)} placeholder="Дизель, Электрика..." />
                                </div>
                            </div>
                            <DialogFooter className="pt-4">
                                <Button type="button" variant="outline" onClick={() => setIsAddManualOpen(false)}>Отмена</Button>
                                <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">Добавить</Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>

                {/* Reject Remark Dialog */}
                <Dialog open={!!rejectRemarkId} onOpenChange={(open) => !open && setRejectRemarkId(null)}>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle>Вернуть на доработку</DialogTitle>
                            <DialogDescription>
                                Укажите причину возврата, чтобы специалист понимал, что нужно исправить.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="py-2">
                            <Textarea
                                placeholder="Комментарий к возврату..."
                                value={rejectComment}
                                onChange={(e) => setRejectComment(e.target.value)}
                                className="min-h-[100px]"
                            />
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setRejectRemarkId(null)}>Отмена</Button>
                            <Button
                                variant="destructive"
                                onClick={() => {
                                    if (rejectRemarkId) {
                                        rejectRemarkMutation.mutate({ id: rejectRemarkId, comment: rejectComment });
                                    }
                                }}
                                disabled={!rejectComment.trim()}
                            >
                                Вернуть работу
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </main>
        </div>
    )
}
