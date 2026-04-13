import { useParams } from "react-router-dom"
import { LocomotiveChecklist } from "@/components/locomotive/LocomotiveChecklist"
import { ChecklistSkeleton } from "@/components/locomotive/ChecklistSkeleton"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { createPortal } from "react-dom"
import { BreadcrumbSeparator, BreadcrumbItem, BreadcrumbPage } from "@/components/ui/breadcrumb"

interface Locomotive {
    id: number
    number: string
    series: string
}

interface ChecklistInstance {
    id: number
    status: string
    template: { name: string }
}

export default function LocomotiveChecklistPage() {
    const { id } = useParams<{ id: string }>()
    const [locomotive, setLocomotive] = useState<Locomotive | null>(null)
    const [instance, setInstance] = useState<ChecklistInstance | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (id) {
            fetchData()
        }
    }, [id])

    const fetchData = async () => {
        setLoading(true)
        await Promise.all([fetchLocomotive(), fetchActiveChecklist()])
        setLoading(false)
    }

    const fetchLocomotive = async () => {
        try {
            const token = localStorage.getItem('access_token')
            const res = await fetch(`/api/locomotives/${id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            if (!res.ok) throw new Error('Failed to fetch locomotive')
            const data = await res.json()
            setLocomotive(data)
        } catch (error) {
            console.error(error)
            toast.error("Ошибка загрузки данных локомотива")
        }
    }

    const fetchActiveChecklist = async () => {
        try {
            const token = localStorage.getItem('access_token')
            const res = await fetch(`/api/checklists/locomotive/${id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            if (!res.ok) throw new Error('Failed to fetch checklist')
            const data = await res.json()
            setInstance(data.instance)
        } catch (error) {
            console.error(error)
        }
    }

    if (!id) return null

    return (
        <div className="flex flex-col h-full bg-slate-50/30">
            {/* Header Portal for Breadcrumbs */}
            {typeof document !== 'undefined' && document.getElementById('breadcrumb-portal') ? (
                createPortal(
                    <div className="flex items-center gap-1.5 min-w-0 animate-in fade-in slide-in-from-left-2 duration-300">
                        <BreadcrumbSeparator />
                        <BreadcrumbItem className="min-w-0">
                            <BreadcrumbPage className="flex items-center gap-2 font-black text-slate-900 truncate">
                                <span>{loading ? "..." : (locomotive ? `${locomotive.series}-${locomotive.number}` : "")}</span>
                                {instance && <span className="text-slate-300 font-normal">/</span>}
                                {instance && (
                                    <span className="text-blue-600 truncate max-w-[120px] sm:max-w-none">
                                        {instance.template.name.includes(' — ') ? instance.template.name.split(' — ').pop() : instance.template.name}
                                    </span>
                                )}
                            </BreadcrumbPage>
                        </BreadcrumbItem>
                        {instance && (
                            <Badge variant={instance.status === 'completed' ? 'default' : 'secondary'} className={`rounded-full px-2 py-0 h-5 text-[9px] font-black uppercase tracking-tighter shrink-0 ml-1 shadow-sm ${
                                instance.status === 'completed' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-blue-50 text-blue-600 border-blue-100'
                            }`}>
                                {instance.status === 'completed' ? 'Выполнено' : 'В ПРОЦЕССЕ'}
                            </Badge>
                        )}
                    </div>,
                    document.getElementById('breadcrumb-portal')!
                )
            ) : null}


            {/* Content */}
            <main className="flex-1 overflow-auto pt-5 pb-4 px-4 md:pt-6 md:pb-8 md:px-10">
                <div className="max-w-7xl mx-auto">
                    {locomotive ? (
                            <LocomotiveChecklist 
                                locomotiveId={Number(id)} 
                                hideHeader={true}
                            />
                    ) : loading ? (
                        <ChecklistSkeleton />
                    ) : (
                        <div className="flex h-40 items-center justify-center text-slate-500">
                            Локомотив не найден
                        </div>
                    )}
                </div>
            </main>
        </div>
    )
}
