
interface ChecklistItem {
    id: string
    is_completed: boolean
    completed_by_user?: { full_name: string } | null
}

interface ChecklistStatisticsProps {
    items: ChecklistItem[]
}

export function ChecklistStatistics({ items }: ChecklistStatisticsProps) {
    const totalItems = items.length
    const completedItems = items.filter((i) => i.is_completed).length
    const remainingItems = totalItems - completedItems
    const progressPercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0

    const completedBy: Record<string, number> = {}
    items.forEach((r) => {
        if (r.is_completed && r.completed_by_user?.full_name) {
            completedBy[r.completed_by_user.full_name] = (completedBy[r.completed_by_user.full_name] || 0) + 1
        }
    })

    return (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden mb-6">
            <div className="p-4 md:p-6">
                {/* Numbers Row */}
                <div className="flex items-center justify-between gap-2 md:gap-4 mb-6 text-center px-1 pt-1">
                    <div className="flex-1">
                        <div className="text-xl md:text-3xl font-black text-slate-900 leading-none">{totalItems}</div>
                        <div className="text-[9px] font-bold text-slate-400 uppercase mt-1">Всего</div>
                    </div>
                    <div className="w-px h-10 bg-slate-100" />
                    <div className="flex-1">
                        <div className="text-xl md:text-3xl font-black text-emerald-600 leading-none">{completedItems}</div>
                        <div className="text-[9px] font-bold text-slate-400 uppercase mt-1">Готово</div>
                    </div>
                    <div className="w-px h-10 bg-slate-100" />
                    <div className="flex-1">
                        <div className="text-xl md:text-3xl font-black text-amber-600 leading-none">{remainingItems}</div>
                        <div className="text-[9px] font-bold text-slate-400 uppercase mt-1">Осталось</div>
                    </div>
                    <div className="w-px h-10 bg-slate-100" />
                    <div className="flex-1">
                        <div className="text-xl md:text-3xl font-black text-blue-600 leading-none">{progressPercent}%</div>
                        <div className="text-[9px] font-bold text-slate-400 uppercase mt-1">Прогресс</div>
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
    )
}
