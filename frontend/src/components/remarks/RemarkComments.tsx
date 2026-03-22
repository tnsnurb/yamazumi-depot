import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { remarkApi } from "@/api/remarkService"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { MessageSquare, Send, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"

interface RemarkCommentsProps {
    remarkId: string;
}

export function RemarkComments({ remarkId }: RemarkCommentsProps) {
    const queryClient = useQueryClient()
    const [commentText, setCommentText] = useState("")

    const { data: comments = [], isLoading } = useQuery({
        queryKey: ['remark-comments', remarkId],
        queryFn: () => remarkApi.getComments(remarkId),
        enabled: !!remarkId,
    })

    const addCommentMutation = useMutation({
        mutationFn: (text: string) => remarkApi.addComment(remarkId, text),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['remark-comments', remarkId] })
            setCommentText("")
            toast.success("Комментарий добавлен")
        },
        onError: () => toast.error("Ошибка при добавлении")
    })

    const handleSend = () => {
        if (!commentText.trim() || addCommentMutation.isPending) return
        addCommentMutation.mutate(commentText)
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 text-slate-400 mb-2">
                <MessageSquare className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">Комментарии ({comments.length})</span>
            </div>

            {isLoading ? (
                <div className="space-y-3">
                    <Skeleton className="h-10 w-full rounded-lg bg-slate-100" />
                    <Skeleton className="h-8 w-3/4 rounded-lg bg-slate-100" />
                </div>
            ) : comments.length === 0 ? (
                <div className="py-6 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Нет комментариев</p>
                </div>
            ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                    {comments.map((comment) => (
                        <div key={comment.id} className="p-3 bg-white rounded-xl border border-slate-100">
                            <div className="flex justify-between items-start mb-1">
                                <span className="text-[10px] font-bold text-slate-900 uppercase tracking-wider">
                                    {comment.user_id?.full_name || "Система"}
                                </span>
                                <span className="text-[9px] text-slate-400 font-medium">
                                    {new Date(comment.created_at).toLocaleString('ru-RU')}
                                </span>
                            </div>
                            <p className="text-sm text-slate-600 font-medium leading-snug">{comment.text}</p>
                        </div>
                    ))}
                </div>
            )}

            <div className="relative mt-2">
                <Textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Напишите комментарий..."
                    className="min-h-[80px] bg-slate-50 border-slate-200 rounded-xl focus:ring-slate-500/10 focus:border-slate-400 transition-all resize-none pr-12"
                />
                <Button
                    onClick={handleSend}
                    disabled={!commentText.trim() || addCommentMutation.isPending}
                    className="absolute bottom-2 right-2 h-8 w-8 rounded-lg bg-slate-900 hover:bg-black text-white p-0"
                >
                    {addCommentMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                </Button>
            </div>
        </div>
    )
}
