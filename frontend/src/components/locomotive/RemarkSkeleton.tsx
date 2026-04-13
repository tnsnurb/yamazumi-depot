import { Skeleton } from "@/components/ui/skeleton"

export function RemarkSkeleton() {
    return (
        <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto w-full">
            {/* Header Cards Skeleton */}
            <div className="hidden md:grid grid-cols-1 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="bg-white border border-slate-200 p-5 rounded-2xl space-y-2">
                        <Skeleton className="h-3 w-20 bg-slate-100" />
                        <Skeleton className="h-8 w-12 bg-slate-200" />
                    </div>
                ))}
            </div>

            {/* Search Bar Skeleton */}
            <div className="bg-white border border-slate-200 p-4 rounded-2xl flex flex-col md:flex-row items-center gap-4">
                <Skeleton className="h-11 flex-1 bg-slate-100 rounded-xl" />
                <div className="flex gap-2 w-full md:w-auto">
                    <Skeleton className="h-11 w-32 bg-emerald-100/50 rounded-xl" />
                    <Skeleton className="h-11 w-32 bg-slate-800/10 rounded-xl" />
                </div>
            </div>

            {/* Remark Items Skeleton */}
            <div className="space-y-4">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                        <div className="flex items-start gap-4">
                            {/* Icon Placeholder */}
                            <Skeleton className="size-14 rounded-2xl bg-slate-200 shrink-0" />
                            
                            <div className="flex-1 space-y-3">
                                <div className="flex items-center gap-3">
                                    <Skeleton className="h-6 w-48 bg-slate-200" />
                                    <Skeleton className="h-5 w-20 bg-slate-100 rounded-full" />
                                </div>
                                <Skeleton className="h-4 w-32 bg-slate-100" />
                                
                                <div className="space-y-2 pt-2">
                                    <div className="flex justify-between">
                                        <Skeleton className="h-3 w-24 bg-slate-50" />
                                        <Skeleton className="h-3 w-16 bg-slate-50" />
                                    </div>
                                    <Skeleton className="h-2 w-full bg-slate-50 rounded-full" />
                                </div>
                            </div>

                            {/* Action Placeholder */}
                            <Skeleton className="size-11 rounded-full bg-slate-100 shrink-0 self-center" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
