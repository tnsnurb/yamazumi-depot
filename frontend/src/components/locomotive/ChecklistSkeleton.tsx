import { Skeleton } from "@/components/ui/skeleton"

export function ChecklistSkeleton() {
    return (
        <div className="space-y-6 animate-in fade-in duration-500 max-w-5xl mx-auto w-full">
            {/* Statistics Row Placeholder */}
            <div className="bg-white border border-slate-200 rounded-[2rem] p-6 md:p-8 shadow-sm">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="flex flex-col items-center space-y-3">
                            <Skeleton className="h-8 w-16 bg-slate-200/60 rounded-lg" />
                            <Skeleton className="h-3 w-12 bg-slate-100/80 rounded-full" />
                        </div>
                    ))}
                </div>
                
                {/* Progress Bar Placeholder */}
                <div className="mt-8 space-y-2">
                    <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-slate-300 px-1">
                        <Skeleton className="h-3 w-24 bg-slate-100" />
                        <Skeleton className="h-3 w-16 bg-slate-100" />
                    </div>
                    <Skeleton className="h-2 w-full bg-slate-100 rounded-full overflow-hidden" />
                </div>
            </div>

            {/* Filter Bar Placeholder */}
            <div className="flex flex-col md:flex-row items-center gap-4 px-2">
                <div className="flex gap-2 w-full md:w-auto">
                    <Skeleton className="h-11 w-32 bg-slate-200/50 rounded-xl" />
                    <Skeleton className="h-11 w-32 bg-slate-200/50 rounded-xl" />
                    <Skeleton className="hidden md:block h-11 w-32 bg-slate-200/50 rounded-xl" />
                </div>
                <div className="ml-auto w-full md:w-48">
                    <Skeleton className="h-11 w-full bg-emerald-100/50 rounded-xl" />
                </div>
            </div>

            {/* Checklist Groups & Items Placeholders */}
            <div className="space-y-4">
                {[1, 2].map((group) => (
                    <div key={group} className="space-y-2 pt-2">
                        {/* Group Header */}
                        <div className="flex items-center gap-3 px-2 mb-3">
                            <Skeleton className="w-5 h-5 bg-slate-200 rounded-md" />
                            <Skeleton className="h-6 w-48 bg-slate-200/70 rounded-lg" />
                            <Skeleton className="h-4 w-8 bg-slate-100 rounded-full ml-auto" />
                        </div>

                        {/* Items */}
                        {[1, 2, 3].map((item) => (
                            <div key={item} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                                <div className="flex items-start gap-4">
                                    <Skeleton className="w-6 h-6 bg-slate-100 rounded-md shrink-0 mt-1" />
                                    <div className="flex-1 space-y-2">
                                        <Skeleton className="h-4 w-full bg-slate-200/60 rounded-md" />
                                        <Skeleton className="h-4 w-3/4 bg-slate-100 rounded-md" />
                                    </div>
                                    <div className="flex gap-2 shrink-0">
                                        <Skeleton className="w-10 h-10 bg-slate-100 rounded-lg" />
                                        <Skeleton className="w-10 h-10 bg-slate-100 rounded-lg" />
                                        <Skeleton className="w-10 h-10 bg-slate-100 rounded-lg" />
                                    </div>
                                </div>
                                <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                                    <Skeleton className="h-3 w-32 bg-slate-50" />
                                    <Skeleton className="h-10 w-32 bg-emerald-50 rounded-lg" />
                                </div>
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    )
}
