import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { remarkApi } from "@/api/remarkService"
import type { Remark, RemarkUser } from "@/types/remark"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
    MessageSquare, 
    Camera, 
    History, 
    CheckCircle2, 
    Loader2, 
    UserPlus, 
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { RemarkComments } from "./RemarkComments"
import { RemarkPhotos } from "./RemarkPhotos"
import { RemarkHistory } from "./RemarkHistory"

interface RemarkItemProps {
    remark: Remark;
    locomotiveId: string;
    allUsers: RemarkUser[];
    onReject: (remarkId: string) => void;
}

export function RemarkItem({ remark, locomotiveId, allUsers, onReject }: RemarkItemProps) {
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

    const handleAssign = (userId: string) => {
        const uId = userId === "none" ? null : parseInt(userId)
        remarkApi.assignWorker(remark.id, uId).then(() => {
            queryClient.invalidateQueries({ queryKey: ['remarks', locomotiveId] })
            toast.success(uId ? "Специалист назначен" : "Назначение снято")
        })
    }

    const isPending = updateStatusMutation.isPending || completeMutation.isPending || verifyMutation.isPending

    return (
        <div className={cn(
            "group bg-white border border-slate-200 p-5 rounded-2xl transition-all",
            remark.is_verified && "opacity-60 grayscale-[0.0]",
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
                    {remark.is_completed ? (
                        <>
                            {remark.is_verified ? (
                                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 rounded-lg py-1 px-3 text-[10px] uppercase font-semibold">
                                    Принято
                                </Badge>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <Button
                                        size="sm"
                                        onClick={() => verifyMutation.mutate(remark.id)}
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg h-11 px-6 text-xs"
                                    >
                                        Принять
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => onReject(remark.id)}
                                        className="border-rose-200 text-rose-600 hover:bg-rose-50 h-11 px-6 text-xs"
                                    >
                                        В работу
                                    </Button>
                                </div>
                            )}
                        </>
                    ) : (
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
                </div>
            </div>

            {/* Content Section */}
            <div className="mb-6">
                <p className={cn(
                    "text-lg font-semibold text-slate-900 leading-snug",
                    remark.is_completed && "text-slate-400"
                )}>
                    {remark.text}
                </p>
                
                {remark.is_completed && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        <span>Выполнил: <b>{remark.completed_by?.full_name || "Неизвестно"}</b></span>
                    </div>
                )}
            </div>

            {/* Footer: Assignment & Details Tabs */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-100">
                <div className="flex items-center gap-3">
                    <Select onValueChange={handleAssign} defaultValue={remark.assigned_to?.toString() || "none"}>
                        <SelectTrigger className="w-48 bg-slate-50 border-slate-200 rounded-lg h-11 text-xs">
                            <div className="flex items-center gap-2 truncate">
                                <UserPlus className="w-4 h-4 text-slate-400" />
                                <SelectValue placeholder="Назначить специалиста" />
                            </div>
                        </SelectTrigger>
                        <SelectContent className="bg-white border-slate-200">
                            <SelectItem value="none" className="text-slate-400 italic">Не назначено</SelectItem>
                            {allUsers.map((u: RemarkUser) => (
                                <SelectItem key={u.id} value={u.id.toString()}>
                                    <div className="flex flex-col">
                                        <span className="font-medium">{u.full_name}</span>
                                        <span className="text-[10px] text-slate-400 lowercase italic">{u.specialization || "общий"}</span>
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    
                    {remark.assigned_user && (
                        <div className="px-3 h-11 flex items-center bg-slate-100 text-slate-600 rounded-lg text-[10px] font-semibold uppercase tracking-wider">
                            Исполнитель: {remark.assigned_user.username}
                        </div>
                    )}
                </div>

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
