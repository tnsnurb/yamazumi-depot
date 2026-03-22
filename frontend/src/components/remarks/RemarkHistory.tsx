import { useQuery } from "@tanstack/react-query"
import { remarkApi } from "@/api/remarkService"
import type { RemarkHistory } from "@/types/remark"
import { History, GitCommit } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"

interface RemarkHistoryProps {
    remarkId: string;
}

export function RemarkHistory({ remarkId }: RemarkHistoryProps) {
    const { data: history = [], isLoading } = useQuery({
        queryKey: ['remark-history', remarkId],
        queryFn: () => remarkApi.getHistory(remarkId),
        enabled: !!remarkId,
    })

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 text-slate-400 mb-2">
                <History className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">История изменений</span>
            </div>

            {isLoading ? (
                <div className="space-y-3">
                    {Array(3).fill(0).map((_, i) => (
                        <Skeleton key={i} className="h-12 w-full rounded-lg bg-slate-100" />
                    ))}
                </div>
            ) : history.length === 0 ? (
                <div className="py-10 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">История пуста</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {history.map((event) => (
                        <div key={event.id} className="p-3 bg-white rounded-xl border border-slate-100">
                            <div className="flex justify-between items-start mb-1">
                                <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest flex items-center gap-1.5">
                                    <GitCommit className="w-3 h-3" />
                                    {event.user_id?.full_name || "Система"}
                                </span>
                                <span className="text-[9px] text-slate-400 font-medium">
                                    {new Date(event.created_at).toLocaleString('ru-RU')}
                                </span>
                            </div>
                            <div className="space-y-0.5">
                                <p className="text-[10px] font-bold text-slate-700 uppercase tracking-tight">{event.action}</p>
                                <p className="text-xs text-slate-500 leading-snug">{event.details}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
