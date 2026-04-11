import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { FilterX, Loader2, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface ChecklistFiltersProps {
    selectedGroup: string
    setSelectedGroup: (val: string) => void
    statusFilter: string
    setStatusFilter: (val: string) => void
    isCompact: boolean
    setIsCompact: (val: boolean) => void
    scrollGroups: string[]
    readOnly: boolean
    remainingItems: number
    instanceStatus: string | undefined
    isBatchLoading: boolean
    handleBulkComplete: () => void
}

export function ChecklistFilters({
    selectedGroup,
    setSelectedGroup,
    statusFilter,
    setStatusFilter,
    isCompact,
    setIsCompact,
    scrollGroups,
    readOnly,
    remainingItems,
    instanceStatus,
    isBatchLoading,
    handleBulkComplete
}: ChecklistFiltersProps) {
    return (
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6 px-1">
            <div className="flex flex-wrap items-center gap-2">
                <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                    <SelectTrigger className="w-[150px] h-11 bg-white border-slate-200 text-[11px] font-bold uppercase tracking-tight rounded-xl shadow-sm transition-all hover:border-blue-400">
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
                    <SelectTrigger className="w-[140px] h-11 bg-white border-slate-200 text-[11px] font-bold uppercase tracking-tight rounded-xl shadow-sm transition-all hover:border-blue-400">
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
                        "h-11 px-4 font-bold text-[10px] uppercase tracking-widest transition-all rounded-xl border shadow-sm",
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
                        className="h-11 w-11 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0 border border-slate-200 rounded-xl shadow-sm"
                        title="Сбросить фильтры"
                    >
                        <FilterX className="w-4 h-4" />
                    </Button>
                )}
            </div>

            {!readOnly && remainingItems > 0 && instanceStatus !== 'completed' && (
                <Button 
                    onClick={handleBulkComplete} 
                    disabled={isBatchLoading}
                    className="h-11 px-6 text-[11px] font-black uppercase tracking-widest bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-200/50 transition-all active:scale-95 flex items-center gap-2 group rounded-xl"
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
    )
}
