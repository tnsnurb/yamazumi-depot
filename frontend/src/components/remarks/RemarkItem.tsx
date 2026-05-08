import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { remarkApi } from "@/api/remarkService"
import type { Remark } from "@/types/remark"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
    MessageSquare, 
    Camera, 
    History, 
    CheckCircle2, 
    Loader2, 
    Tag, 
    AlertCircle,
    ChevronDown
} from "lucide-react"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { RemarkComments } from "./RemarkComments"
import { RemarkPhotos } from "./RemarkPhotos"
import { RemarkHistory } from "./RemarkHistory"

interface RemarkItemProps {
    remark: Remark;
    locomotiveId: string;
    onReject: (remarkId: string) => void;
}

export function RemarkItem({ remark, locomotiveId, onReject }: RemarkItemProps) {
    const queryClient = useQueryClient()
    const [expandedTab, setExpandedTab] = useState<"comments" | "photos" | "history" | null>(null)

    const priorityColors = {
        low: "bg-emerald-50 text-emerald-600 border-emerald-200",
        medium: "bg-amber-50 text-amber-600 border-amber-200",
        high: "bg-rose-50 text-rose-600 border-rose-200",
    }

    const updateStatusMutation = useMutation({
        mutationFn: ({ remarkId, updates }: { remarkId: string, updates: Partial<Remark> }) => 
            remarkApi.update(remarkId, updates),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['remarks', locomotiveId] })
            toast.success("Обновлено")
        },
        onError: () => toast.error("Ошибка обновления")
    })

    const completeMutation = useMutation({
        mutationFn: ({ remarkId, status }: { remarkId: string, status: boolean }) => 
            remarkApi.complete(remarkId, status),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['remarks', locomotiveId] })
            toast.success("Статус изменен")
        },
        onError: () => toast.error("Ошибка")
    })

    const verifyMutation = useMutation({
        mutationFn: (remarkId: string) => remarkApi.verify(remarkId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['remarks', locomotiveId] })
            toast.success("Замечание принято")
        }
    })

    const handlePriorityChange = (priority: "low" | "medium" | "high") => {
        updateStatusMutation.mutate({ remarkId: remark.id, updates: { priority } })
    }


    const isPending = updateStatusMutation.isPending || completeMutation.isPending || verifyMutation.isPending

    return (
        <div className={cn(
            "group bg-white border border-slate-200 p-5 rounded-2xl transition-all",
            remark.id.toString().startsWith('temp-') && "opacity-50 animate-pulse pointer-events-none cursor-wait"
        )}>
            {/* Top Bar: Controls & Priority */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button className={cn(
                                "h-7 px-2.5 rounded-lg border text-[10px] font-semibold uppercase tracking-wider transition-colors flex items-center gap-1.5",
                                priorityColors[remark.priority || "medium"]
                            )}>
                                <AlertCircle className="w-3 h-3" />
                                {remark.priority === 'high' ? 'Высокий' : remark.priority === 'low' ? 'Низкий' : 'Средний'}
                                <ChevronDown className="w-3 h-3 opacity-50" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="bg-white border-slate-200">
                            <DropdownMenuItem onClick={() => handlePriorityChange("high")} className="text-rose-600 focus:bg-rose-50 focus:text-rose-600 font-medium">Высокий риск</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handlePriorityChange("medium")} className="text-amber-600 focus:bg-amber-50 focus:text-amber-600 font-medium">Средний</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handlePriorityChange("low")} className="text-emerald-600 focus:bg-emerald-50 focus:text-emerald-600 font-medium">Низкий риск</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-100 border border-slate-200 text-[10px] font-semibold text-slate-500 tracking-wider uppercase">
                        <Tag className="w-3 h-3" />
                        {remark.category || "Общее"}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {!remark.is_completed && (
                        <Button
                            size="sm"
                            disabled={isPending}
                            onClick={() => completeMutation.mutate({ remarkId: remark.id, status: true })}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg h-11 px-6 text-xs"
                        >
                            {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-2" />}
                            Выполнить
                        </Button>
                    )}
                    {remark.is_verified && (
                        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 rounded-lg py-1 px-3 text-[10px] uppercase font-semibold">
                            Принято
                        </Badge>
                    )}
                </div>
            </div>

            {/* Content Section */}
            <div className="mb-6">
                <p className="text-base font-semibold text-slate-900 leading-snug">
                    {remark.text}
                </p>
                
                {remark.is_completed && (
                    <div className="mt-3 flex flex-col gap-4">
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            <span>Выполнил: <b>{remark.completed_by?.full_name || "Неизвестно"}</b></span>
                        </div>
                        
                        {!remark.is_verified && (
                            <div className="flex items-center gap-2 w-full">
                                <Button
                                    size="sm"
                                    onClick={() => verifyMutation.mutate(remark.id)}
                                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-12 text-sm font-bold shadow-lg shadow-emerald-100"
                                >
                                    Принять
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => onReject(remark.id)}
                                    className="flex-1 border-rose-200 text-rose-600 hover:bg-rose-50 rounded-xl h-12 text-sm font-bold"
                                >
                                    В работу
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Footer: Assignment & Details Tabs */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-100">
                <div></div>

                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setExpandedTab(expandedTab === "comments" ? null : "comments")}
                        className={cn(
                            "flex items-center gap-2 px-3 h-11 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-colors",
                            expandedTab === "comments" ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"
                        )}
                    >
                        <MessageSquare className="w-3.5 h-3.5" /> Комменты
                    </button>
                    <button
                        onClick={() => setExpandedTab(expandedTab === "photos" ? null : "photos")}
                        className={cn(
                            "flex items-center gap-2 px-3 h-11 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-colors",
                            expandedTab === "photos" ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"
                        )}
                    >
                        <Camera className="w-3.5 h-3.5" /> Фото
                    </button>
                    <button
                        onClick={() => setExpandedTab(expandedTab === "history" ? null : "history")}
                        className={cn(
                            "flex items-center gap-2 px-3 h-11 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-colors",
                            expandedTab === "history" ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"
                        )}
                    >
                        <History className="w-3.5 h-3.5" /> Логи
                    </button>
                </div>
            </div>

            {/* Expandable Content Panel */}
            {expandedTab && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                    {expandedTab === "comments" && <RemarkComments remarkId={remark.id} />}
                    {expandedTab === "photos" && <RemarkPhotos remarkId={remark.id} />}
                    {expandedTab === "history" && <RemarkHistory remarkId={remark.id} />}
                </div>
            )}
        </div>
    )
}
