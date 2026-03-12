import { useState } from "react"
import { CheckCircle2, MessageSquare, Camera, History, Download } from "lucide-react"
import { Item, ItemTitle } from "@/components/ui/item"
import { cn } from "@/lib/utils"

export function RemarkArchiveItem({ remark }: { remark: any }) {
    const [expandedDetailTab, setExpandedDetailTab] = useState<"comments" | "photos" | "history" | null>(null)

    // Details states
    const [comments, setComments] = useState<any[]>([])
    const [photos, setPhotos] = useState<any[]>([])
    const [history, setHistory] = useState<any[]>([])
    const [loadingDetails, setLoadingDetails] = useState(false)

    const toggleDetailTab = (tab: "comments" | "photos" | "history") => {
        if (expandedDetailTab === tab) {
            setExpandedDetailTab(null)
        } else {
            setExpandedDetailTab(tab)
            fetchDetails(tab)
        }
    }

    const fetchDetails = async (tab: string) => {
        try {
            setLoadingDetails(true)
            const token = localStorage.getItem('access_token')
            const res = await fetch(`/api/remarks/${remark.id}/${tab}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            if (!res.ok) throw new Error(`Failed to fetch ${tab}`)
            const data = await res.json()
            if (tab === 'comments') setComments(data)
            if (tab === 'photos') setPhotos(data)
            if (tab === 'history') setHistory(data)
        } catch (e) {
            console.error(e)
        } finally {
            setLoadingDetails(false)
        }
    }

    return (
        <Item
            variant="outline"
            className="bg-white border-slate-200 shadow-sm rounded-xl overflow-hidden p-3 md:p-4 min-h-0 flex-col items-stretch transition-all mb-3"
        >
            <div className="flex flex-col md:flex-row md:items-center gap-4 flex-1">
                <div className="flex-1 min-w-0">
                    <ItemTitle className="text-base whitespace-normal leading-snug text-slate-700 font-medium">
                        {remark.text}
                    </ItemTitle>

                    <div className="flex flex-wrap items-center gap-2 mt-2">
                        {remark.created_by && (
                            <div className="text-[11px] md:text-xs text-slate-400 font-medium whitespace-nowrap">
                                Добавил(а): {remark.created_by.full_name || remark.created_by.username}
                            </div>
                        )}

                        {remark.is_completed && remark.completed_by_user && (
                            <div className="text-[11px] font-bold flex items-center gap-1 bg-emerald-50/50 text-emerald-800 border-emerald-100 px-2 py-0.5 rounded border shadow-sm">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                {remark.completed_by_user.full_name || remark.completed_by_user.username}
                                <span className="font-medium ml-1 text-emerald-600">
                                    {remark.completed_at ? new Date(remark.completed_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : ''}
                                </span>
                            </div>
                        )}

                        {remark.category && (
                            <div className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                                {remark.category}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-1.5 mt-3 md:mt-0">
                    <button
                        onClick={() => toggleDetailTab('comments')}
                        className={cn(
                            "flex-1 md:flex-none inline-flex items-center justify-center gap-1.5 text-xs px-3 py-2 rounded-lg transition-all border",
                            expandedDetailTab === 'comments'
                                ? "bg-slate-900 text-white border-slate-900"
                                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                        )}
                    >
                        <MessageSquare className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={() => toggleDetailTab('photos')}
                        className={cn(
                            "flex-1 md:flex-none inline-flex items-center justify-center gap-1.5 text-xs px-3 py-2 rounded-lg transition-all border",
                            expandedDetailTab === 'photos'
                                ? "bg-slate-900 text-white border-slate-900"
                                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                        )}
                    >
                        <Camera className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={() => toggleDetailTab('history')}
                        className={cn(
                            "flex-none inline-flex items-center justify-center w-9 h-9 rounded-lg transition-all border",
                            expandedDetailTab === 'history'
                                ? "bg-slate-900 text-white border-slate-900"
                                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                        )}
                    >
                        <History className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {/* Expanded Details Panel */}
            {expandedDetailTab && (
                <div className="mt-4 pt-4 border-t border-slate-100 animate-in fade-in slide-in-from-top-2 duration-200">
                    {expandedDetailTab === 'comments' && (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 mb-2 text-xs font-bold text-slate-400 uppercase tracking-tight">
                                <MessageSquare className="w-3 h-3" /> Комментарии
                            </div>
                            {loadingDetails ? (
                                <p className="text-center py-4 text-xs text-slate-400">Загрузка...</p>
                            ) : comments.length ? (
                                <div className="space-y-3 max-h-48 overflow-y-auto pr-2 scrollbar-thin">
                                    {comments.map((c: any) => (
                                        <div key={c.id} className="flex gap-2">
                                            <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-[10px] font-bold shrink-0">
                                                {(c.user_id?.full_name || '?')[0]}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-baseline gap-2">
                                                    <span className="text-xs font-bold text-slate-700">{c.user_id?.full_name}</span>
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
                        </div>
                    )}

                    {expandedDetailTab === 'photos' && (
                        <div className="space-y-3">
                            <div className="text-xs font-bold text-slate-400 uppercase tracking-tight flex items-center gap-2 mb-2">
                                <Camera className="w-3 h-3" /> Фотографии
                            </div>
                            {loadingDetails ? (
                                <p className="text-center py-4 text-xs text-slate-400">Загрузка...</p>
                            ) : photos.length ? (
                                <div className="grid grid-cols-3 xs:grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2">
                                    {photos.map((p: any) => (
                                        <a key={p.id} href={p.photo_url} target="_blank" rel="noreferrer" className="aspect-square rounded-lg border bg-slate-50 p-0.5 overflow-hidden group relative">
                                            <img src={p.photo_url} className="w-full h-full object-cover rounded-md" alt="evidence" />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                <Download className="w-4 h-4 text-white" />
                                            </div>
                                        </a>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-center py-2 text-xs text-slate-400">Нет фотографий</p>
                            )}
                        </div>
                    )}

                    {expandedDetailTab === 'history' && (
                        <div className="space-y-2">
                            <div className="text-xs font-bold text-slate-400 uppercase tracking-tight mb-2 flex items-center gap-2">
                                <History className="w-3 h-3" /> История изменений
                            </div>
                            {loadingDetails ? (
                                <p className="text-center py-4 text-xs text-slate-400">Загрузка...</p>
                            ) : history.length ? (
                                <div className="space-y-2 max-h-48 overflow-y-auto pr-2 scrollbar-thin">
                                    {history.map((h: any) => (
                                        <div key={h.id} className="text-[11px] flex items-start gap-2 py-1 border-b border-slate-100 last:border-0">
                                            <span className="text-slate-400 tabular-nums shrink-0 whitespace-nowrap">
                                                {new Date(h.created_at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                            <div className="min-w-0">
                                                <span className="font-bold text-slate-700">{h.user_id?.full_name || 'Система'}: </span>
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
            )}
        </Item>
    )
}
