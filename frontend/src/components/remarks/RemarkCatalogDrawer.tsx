import { useState, useMemo, useRef, useCallback } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { remarkApi, type CatalogItem } from "@/api/remarkService"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from "@/components/ui/sheet"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import {
    Search,
    Plus,
    Loader2,
    CheckCircle2,
    Hash,
    ChevronRight,
    X,
    BookOpen,
} from "lucide-react"

interface RemarkCatalogDrawerProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    locomotiveId: string
}

export function RemarkCatalogDrawer({ open, onOpenChange, locomotiveId }: RemarkCatalogDrawerProps) {
    const queryClient = useQueryClient()
    const searchRef = useRef<HTMLInputElement>(null)

    // State
    const [searchQuery, setSearchQuery] = useState("")
    const [activeCategory, setActiveCategory] = useState<string | null>(null)
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [customTexts, setCustomTexts] = useState<Record<string, string>>({})
    const [placeholderDialog, setPlaceholderDialog] = useState<CatalogItem | null>(null)
    const [placeholderValue, setPlaceholderValue] = useState("")

    // Queries
    const { data: catalogItems = [], isLoading } = useQuery<CatalogItem[]>({
        queryKey: ['remark-catalog'],
        queryFn: () => remarkApi.getCatalog(),
        staleTime: 5 * 60 * 1000, // Cache for 5 minutes
        enabled: open,
    })

    // Compute categories from data
    const categories = useMemo(() => {
        const counts: Record<string, number> = {}
        catalogItems.forEach(item => {
            counts[item.category] = (counts[item.category] || 0) + 1
        })
        return Object.entries(counts)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
    }, [catalogItems])

    // Filter items
    const filteredItems = useMemo(() => {
        let items = catalogItems

        if (activeCategory) {
            items = items.filter(i => i.category === activeCategory)
        }

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase()
            items = items.filter(i =>
                (i.description_ru && i.description_ru.toLowerCase().includes(q)) ||
                (i.description_en && i.description_en.toLowerCase().includes(q)) ||
                i.code.includes(q)
            )
        }

        return items
    }, [catalogItems, activeCategory, searchQuery])

    // Mutation
    const addMutation = useMutation({
        mutationFn: () => remarkApi.addFromCatalog(locomotiveId, Array.from(selectedIds), customTexts),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['remarks', locomotiveId] })
            toast.success(`Добавлено ${selectedIds.size} замечаний из каталога`)
            setSelectedIds(new Set())
            setCustomTexts({})
            onOpenChange(false)
        },
        onError: (err: any) => {
            toast.error("Ошибка: " + err.message)
        }
    })

    // Handlers
    const toggleItem = useCallback((item: CatalogItem) => {
        if (item.has_placeholder && !selectedIds.has(item.id)) {
            // Open placeholder dialog first
            setPlaceholderDialog(item)
            setPlaceholderValue("")
            return
        }

        setSelectedIds(prev => {
            const next = new Set(prev)
            if (next.has(item.id)) {
                next.delete(item.id)
                // Clean up custom text
                setCustomTexts(ct => {
                    const copy = { ...ct }
                    delete copy[item.id]
                    return copy
                })
            } else {
                next.add(item.id)
            }
            return next
        })
    }, [selectedIds])

    const confirmPlaceholder = useCallback(() => {
        if (!placeholderDialog) return

        const item = placeholderDialog
        let text = item.description_ru || item.description_en || ""

        // Replace placeholder patterns with user-provided value
        if (placeholderValue.trim()) {
            text = text
                .replace(/#___/g, `#${placeholderValue.trim()}`)
                .replace(/№___/g, `№${placeholderValue.trim()}`)
                .replace(/_____/g, placeholderValue.trim())
        }

        setSelectedIds(prev => new Set(prev).add(item.id))
        setCustomTexts(prev => ({ ...prev, [item.id]: text }))
        setPlaceholderDialog(null)
        setPlaceholderValue("")
    }, [placeholderDialog, placeholderValue])

    const handleSubmit = useCallback(() => {
        if (selectedIds.size === 0) return
        addMutation.mutate()
    }, [selectedIds, addMutation])

    const clearSelection = useCallback(() => {
        setSelectedIds(new Set())
        setCustomTexts({})
    }, [])

    return (
        <>
            <Sheet open={open} onOpenChange={onOpenChange}>
                <SheetContent
                    side="right"
                    className="w-full sm:max-w-2xl p-0 flex flex-col bg-white"
                >
                    {/* Header */}
                    <SheetHeader className="px-5 pt-5 pb-3 border-b border-slate-100">
                        <SheetTitle className="flex items-center gap-2 text-lg">
                            <BookOpen className="w-5 h-5 text-slate-400" />
                            Каталог замечаний
                        </SheetTitle>
                        <SheetDescription className="text-xs text-slate-400">
                            {catalogItems.length} замечаний · {categories.length} систем
                        </SheetDescription>
                    </SheetHeader>

                    {/* Search */}
                    <div className="px-5 pt-4 pb-2">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <Input
                                ref={searchRef}
                                placeholder="Искать по каталогу..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10 bg-slate-50 border-slate-200 h-11 text-sm"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery("")}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Category chips - horizontally scrollable */}
                    <div className="px-5 pb-3">
                        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                            <button
                                onClick={() => setActiveCategory(null)}
                                className={cn(
                                    "shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                                    !activeCategory
                                        ? "bg-slate-900 text-white"
                                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                )}
                            >
                                Все ({catalogItems.length})
                            </button>
                            {categories.map(cat => (
                                <button
                                    key={cat.name}
                                    onClick={() => setActiveCategory(activeCategory === cat.name ? null : cat.name)}
                                    className={cn(
                                        "shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap",
                                        activeCategory === cat.name
                                            ? "bg-slate-900 text-white"
                                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                    )}
                                >
                                    {cat.name} ({cat.count})
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Items list */}
                    <div className="flex-1 overflow-y-auto px-5 pb-24">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-20">
                                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                            </div>
                        ) : filteredItems.length === 0 ? (
                            <div className="text-center py-16 text-slate-400">
                                <Search className="w-8 h-8 mx-auto mb-3 opacity-50" />
                                <p className="text-sm">Ничего не найдено</p>
                            </div>
                        ) : (
                            <div className="space-y-1.5">
                                {filteredItems.map(item => {
                                    const isSelected = selectedIds.has(item.id)
                                    const displayText = customTexts[item.id] || item.description_ru || item.description_en || ""

                                    return (
                                        <button
                                            key={item.id}
                                            onClick={() => toggleItem(item)}
                                            className={cn(
                                                "w-full text-left flex items-start gap-3 p-3 rounded-xl transition-all border",
                                                isSelected
                                                    ? "bg-emerald-50 border-emerald-200"
                                                    : "bg-white border-slate-100 hover:bg-slate-50 hover:border-slate-200"
                                            )}
                                        >
                                            <div className={cn(
                                                "mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors",
                                                isSelected
                                                    ? "bg-emerald-600 border-emerald-600"
                                                    : "border-slate-300"
                                            )}>
                                                {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <span className="text-[10px] font-mono font-bold text-slate-400">
                                                        {item.code}
                                                    </span>
                                                    {!activeCategory && (
                                                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 font-medium text-slate-400 border-slate-200">
                                                            {item.category}
                                                        </Badge>
                                                    )}
                                                    {item.has_placeholder && (
                                                        <Hash className="w-3 h-3 text-amber-500" />
                                                    )}
                                                </div>
                                                <p className="text-sm text-slate-800 leading-snug">
                                                    {displayText}
                                                </p>
                                            </div>

                                            {item.has_placeholder && !isSelected && (
                                                <ChevronRight className="w-4 h-4 text-slate-300 shrink-0 mt-1" />
                                            )}
                                        </button>
                                    )
                                })}
                            </div>
                        )}
                    </div>

                    {/* Sticky footer with Add button */}
                    {selectedIds.size > 0 && (
                        <div className="absolute bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-sm border-t border-slate-200">
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={clearSelection}
                                    className="text-xs text-slate-400 hover:text-slate-600 transition-colors shrink-0"
                                >
                                    Сбросить
                                </button>
                                <Button
                                    onClick={handleSubmit}
                                    disabled={addMutation.isPending}
                                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white h-12 rounded-xl text-sm font-semibold shadow-lg shadow-emerald-200"
                                >
                                    {addMutation.isPending ? (
                                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                    ) : (
                                        <Plus className="w-4 h-4 mr-2" />
                                    )}
                                    Добавить ({selectedIds.size})
                                </Button>
                            </div>
                        </div>
                    )}
                </SheetContent>
            </Sheet>

            {/* Placeholder fill-in Dialog */}
            <Dialog open={!!placeholderDialog} onOpenChange={(v) => !v && setPlaceholderDialog(null)}>
                <DialogContent className="bg-white border-slate-200 max-w-md rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-base">Укажите номер позиции</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-3 py-2">
                        <p className="text-sm text-slate-600 leading-snug">
                            {placeholderDialog?.description_ru || placeholderDialog?.description_en}
                        </p>
                        <Input
                            placeholder="Номер (например: 3, А1, Каб.2)"
                            value={placeholderValue}
                            onChange={(e) => setPlaceholderValue(e.target.value)}
                            className="bg-slate-50 border-slate-200 h-12 text-base"
                            autoFocus
                            onKeyDown={(e) => e.key === 'Enter' && confirmPlaceholder()}
                        />
                    </div>

                    <DialogFooter className="gap-2">
                        <Button
                            variant="outline"
                            onClick={() => {
                                // Add without filling — keep original text with #___
                                if (placeholderDialog) {
                                    setSelectedIds(prev => new Set(prev).add(placeholderDialog.id))
                                }
                                setPlaceholderDialog(null)
                            }}
                            className="flex-1"
                        >
                            Пропустить
                        </Button>
                        <Button
                            onClick={confirmPlaceholder}
                            disabled={!placeholderValue.trim()}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                            Подтвердить
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
