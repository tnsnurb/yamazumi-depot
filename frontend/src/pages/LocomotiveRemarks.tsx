import { useEffect, useState } from "react"
import imageCompression from 'browser-image-compression'
import { useParams, useNavigate } from "react-router-dom"
import { Header } from "@/components/common/Header"
import { Button } from "@/components/ui/button"
import { ArrowLeft, CheckCircle2, ClipboardPaste, MessageSquare, Send, Download, FileText, Camera, History, Tag, AlertCircle, ChevronDown } from "lucide-react"
import { toast } from "sonner"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import * as XLSX from "xlsx"

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
}

export default function LocomotiveRemarks() {
    const { id: locomotiveId } = useParams()
    const navigate = useNavigate()
    const [remarks, setRemarks] = useState<Remark[]>([])
    const [locomotive, setLocomotive] = useState<any>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isPasteOpen, setIsPasteOpen] = useState(false)
    const [pasteText, setPasteText] = useState("")
    const [confirmRemark, setConfirmRemark] = useState<Remark | null>(null)

    const [user, setUser] = useState<any>(null)

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

    useEffect(() => {
        fetch('/api/me').then(res => res.json()).then(data => {
            if (data.user) setUser(data.user)
        }).catch(() => { })
    }, [])

    useEffect(() => {
        if (locomotiveId) {
            fetchRemarks()
            fetchLocomotive()
        }
    }, [locomotiveId])

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

    const fetchRemarks = async () => {
        setIsLoading(true)
        try {
            const res = await fetch(`/api/locomotives/${locomotiveId}/remarks`)
            if (res.ok) {
                setRemarks(await res.json())
            } else {
                toast.error("Ошибка загрузки замечаний")
            }
        } catch (e) {
            toast.error("Ошибка сети")
        } finally {
            setIsLoading(false)
        }
    }

    const handlePasteSubmit = async () => {
        if (!pasteText.trim()) return

        const lines = pasteText
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .map(line => line.replace(/^\d+[\.)\]]\s*/, ''))

        if (lines.length === 0) {
            toast.error("Текст не содержит валидных строк")
            return
        }

        try {
            const res = await fetch(`/api/locomotives/${locomotiveId}/remarks/bulk`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ texts: lines })
            })

            if (res.ok) {
                toast.success(`Добавлено замечаний: ${lines.length}`)
                setIsPasteOpen(false)
                setPasteText("")
                fetchRemarks()
            } else {
                toast.error("Ошибка при добавлении замечаний")
            }
        } catch (e) {
            toast.error("Ошибка сети")
        }
    }

    const toggleCompletion = async (remark: Remark) => {
        if (!user) {
            toast.error("Необходима авторизация")
            return
        }

        const newStatus = !remark.is_completed

        if (newStatus) {
            setConfirmRemark(remark)
            return
        }

        await executeCompletion(remark, newStatus)
    }

    const executeCompletion = async (remark: Remark, newStatus: boolean) => {
        try {
            const res = await fetch(`/api/remarks/${remark.id}/complete`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ is_completed: newStatus })
            })

            if (res.ok) {
                const updatedRemark = await res.json()
                setRemarks(prev => prev.map(r => r.id === updatedRemark.id ? updatedRemark : r))
                toast.success(newStatus ? "Замечание выполнено" : "Отметка о выполнении снята")
            } else {
                toast.error("Ошибка при обновлении статуса")
            }
        } catch (e) {
            toast.error("Ошибка сети")
        } finally {
            setConfirmRemark(null)
        }
    }

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
                setRemarks(prev => prev.map(r => r.id === updatedRemark.id ? updatedRemark : r))
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

    const downloadRemarks = (filter: 'all' | 'completed' | 'incomplete') => {
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
        <div className="min-h-screen bg-slate-50 flex flex-col">
            <Header />

            <main className="flex-1 p-4 md:p-6 max-w-5xl w-full mx-auto">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                    <div className="flex items-start gap-3 md:gap-4">
                        <Button variant="ghost" size="icon" onClick={() => navigate('/map')} className="shrink-0 -ml-2 md:ml-0">
                            <ArrowLeft className="w-5 h-5 text-slate-500" />
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
                            <Button onClick={() => setIsPasteOpen(true)} className="gap-2 bg-indigo-600 hover:bg-indigo-700 flex-1 md:flex-none h-9 text-sm">
                                <ClipboardPaste className="w-4 h-4" /> <span className="hidden xs:inline">Из Excel</span><span className="xs:hidden">Excel</span>
                            </Button>
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
                {!isLoading && remarks.length > 0 && (() => {
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
                        <div className="bg-white border rounded-xl shadow-sm p-3 md:p-4 mb-4">
                            <div className="flex flex-wrap items-center gap-x-4 md:gap-x-6 gap-y-2">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-xs md:text-sm text-slate-500">Всего:</span>
                                    <span className="text-xs md:text-sm font-bold text-slate-900">{total}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-xs md:text-sm text-slate-500">Выполнено:</span>
                                    <span className="text-xs md:text-sm font-bold text-green-600">{completed}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-xs md:text-sm text-slate-500">Осталось:</span>
                                    <span className="text-xs md:text-sm font-bold text-amber-600">{remaining}</span>
                                </div>
                                <div className="flex-1 min-w-[80px] md:min-w-[120px]">
                                    <div className="w-full bg-slate-100 rounded-full h-1.5 md:h-2.5">
                                        <div
                                            className="bg-green-500 h-1.5 md:h-2.5 rounded-full transition-all duration-500"
                                            style={{ width: `${percent}%` }}
                                        />
                                    </div>
                                </div>
                                <span className="text-[10px] md:text-xs font-medium text-slate-500">{percent}%</span>
                            </div>

                            {Object.keys(completedBy).length > 0 && (
                                <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-2 md:gap-3">
                                    <span className="text-[10px] md:text-xs text-slate-400">Выполнили:</span>
                                    {Object.entries(completedBy)
                                        .sort((a, b) => b[1] - a[1])
                                        .map(([name, count]) => (
                                            <span key={name} className="inline-flex items-center gap-1.5 text-[10px] md:text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">
                                                <span className="font-medium">{name}</span>
                                                <span className="bg-green-200 text-green-800 rounded-full px-1.5 text-[9px] md:text-[10px] font-bold">{count}</span>
                                            </span>
                                        ))}
                                </div>
                            )}
                        </div>
                    )
                })()}

                <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
                    {isLoading ? (
                        <div className="p-8 text-center text-slate-500">Загрузка...</div>
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
                        <div className="flex flex-col gap-3 p-3 md:p-0 md:divide-y md:divide-slate-100 bg-slate-50 md:bg-white">
                            {sortedRemarks.map((remark, idx) => (
                                <div
                                    key={remark.id}
                                    className={`bg-white md:bg-transparent rounded-xl md:rounded-none border md:border-none shadow-sm md:shadow-none overflow-hidden transition-all ${remark.is_completed ? 'opacity-80' : ''}`}
                                >
                                    <div
                                        className={`p-4 md:p-4 flex gap-3 md:gap-4 transition-colors ${remark.is_completed ? 'bg-slate-50/50' : 'hover:bg-slate-50'}`}
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start gap-2 md:gap-3">
                                                <span className="text-slate-400 font-mono text-xs md:text-sm mt-0.5 w-5 md:w-6 text-right shrink-0">{idx + 1}.</span>
                                                <div className="flex flex-col gap-1 min-w-0">
                                                    <p className={`text-sm ${remark.is_completed ? 'text-slate-400 line-through font-normal' : 'text-slate-900 font-medium'}`}>
                                                        {remark.text}
                                                    </p>
                                                    <div className="flex flex-wrap items-center gap-2 mt-1">
                                                        {remark.created_by && (
                                                            <div className="text-[9px] md:text-[10px] text-slate-400 font-medium">
                                                                Добавил(а): {remark.created_by.full_name}
                                                            </div>
                                                        )}

                                                        {/* Priority & Category Interactive Badges */}
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <button className={`inline-flex items-center gap-1 text-[9px] md:text-[10px] px-1.5 py-0.5 rounded border transition-colors ${remark.priority === 'high' ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100' :
                                                                    remark.priority === 'low' ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' :
                                                                        'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                                                                    }`}>
                                                                    <AlertCircle className="w-2.5 h-2.5 md:w-3 md:h-3" />
                                                                    {remark.priority === 'high' ? 'Высокий' : remark.priority === 'low' ? 'Низкий' : 'Средний'}
                                                                    <ChevronDown className="w-2.5 h-2.5 md:w-3 md:h-3 opacity-50" />
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
                                                                <button className="inline-flex items-center gap-1 text-[9px] md:text-[10px] px-1.5 py-0.5 rounded border bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 transition-colors">
                                                                    <Tag className="w-2.5 h-2.5 md:w-3 md:h-3" />
                                                                    {remark.category || 'Без категории'}
                                                                    <ChevronDown className="w-2.5 h-2.5 md:w-3 md:h-3 opacity-50" />
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
                                            </div>
                                            {remark.is_completed && remark.completed_by && (
                                                <div className="mt-2 ml-7 md:ml-10 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] md:text-xs text-slate-500 bg-white border px-2 py-1 inline-flex rounded-md shadow-sm">
                                                    <div className="flex items-center gap-1.5">
                                                        <CheckCircle2 className="w-3 md:w-3.5 h-3 md:h-3.5 text-green-500" />
                                                        <span className="font-medium text-slate-700">{remark.completed_by.full_name}</span>
                                                    </div>
                                                    <span className="hidden md:inline text-slate-400">•</span>
                                                    <span>{new Date(remark.completed_at!).toLocaleString('ru-RU', {
                                                        day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit'
                                                    })}</span>
                                                </div>
                                            )}

                                            {/* Action Tabs - Optimized for touch */}
                                            <div className="mt-4 ml-0 md:ml-10 flex flex-wrap gap-2">
                                                <button
                                                    onClick={() => toggleExpanded(remark.id, 'comments')}
                                                    className={`flex-1 md:flex-none inline-flex items-center justify-center gap-2 text-xs px-3 py-2.5 rounded-xl transition-all border ${expandedRemarkId === remark.id && activeTab === 'comments'
                                                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                                        : 'bg-slate-50 text-slate-600 border-slate-200 active:bg-slate-100'
                                                        }`}
                                                >
                                                    <MessageSquare className="w-4 h-4" />
                                                    <span>
                                                        {comments[remark.id]?.length
                                                            ? `Чат (${comments[remark.id].length})`
                                                            : 'Чат'}
                                                    </span>
                                                </button>

                                                <button
                                                    onClick={() => toggleExpanded(remark.id, 'photos')}
                                                    className={`flex-1 md:flex-none inline-flex items-center justify-center gap-2 text-xs px-3 py-2.5 rounded-xl transition-all border ${expandedRemarkId === remark.id && activeTab === 'photos'
                                                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                                        : 'bg-slate-50 text-slate-600 border-slate-200 active:bg-slate-100'
                                                        }`}
                                                >
                                                    <Camera className="w-4 h-4" />
                                                    <span>Фото {photos[remark.id]?.length ? `(${photos[remark.id].length})` : ''}</span>
                                                </button>

                                                <button
                                                    onClick={() => toggleExpanded(remark.id, 'history')}
                                                    className={`flex-none inline-flex items-center justify-center p-2.5 rounded-xl transition-all border ${expandedRemarkId === remark.id && activeTab === 'history'
                                                        ? 'bg-slate-800 text-white border-slate-800 shadow-sm'
                                                        : 'bg-slate-50 text-slate-600 border-slate-200 active:bg-slate-100'
                                                        }`}
                                                    title="История"
                                                >
                                                    <History className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                        <div className="shrink-0 flex items-start pt-1">
                                            <button
                                                onClick={() => toggleCompletion(remark)}
                                                className={`w-12 h-12 md:w-10 md:h-10 flex items-center justify-center rounded-2xl md:rounded-full border shadow-sm transition-all ${remark.is_completed
                                                    ? 'bg-green-500 border-green-500 text-white hover:bg-green-600'
                                                    : 'bg-white border-slate-200 text-slate-400 hover:border-green-500 hover:text-green-500 active:scale-95'
                                                    }`}
                                            >
                                                <CheckCircle2 className="w-6 h-6 md:w-5 md:h-5" />
                                            </button>
                                        </div>
                                    </div>

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
                        </div>
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
                                className="bg-green-600 hover:bg-green-700 flex-1 sm:flex-none"
                            >
                                <CheckCircle2 className="w-4 h-4 mr-2" /> Выполнено
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
            </main>
        </div>
    )
}
