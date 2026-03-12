import { useParams, useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ClipboardCheck } from "lucide-react"
import { LocomotiveChecklist } from "@/components/locomotive/LocomotiveChecklist"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { LocomotiveHistory } from "@/components/locomotive/LocomotiveHistory"

interface Locomotive {
    id: number
    number: string
    series: string
}

export default function LocomotiveChecklistPage() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const [locomotive, setLocomotive] = useState<Locomotive | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (id) {
            fetchLocomotive()
        }
    }, [id])

    const fetchLocomotive = async () => {
        try {
            setLoading(true)
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
        } finally {
            setLoading(false)
        }
    }

    if (!id) return null

    return (
        <div className="flex flex-col h-full bg-slate-50/30">
            {/* Header */}
            <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200/60 px-4 py-3 md:px-8">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate(-1)}
                            className="h-9 w-9 text-slate-500 hover:text-slate-900 bg-slate-100/50"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </Button>
                        <div className="flex items-center gap-3">
                            <div className="bg-indigo-600 p-2 rounded-xl shadow-indigo-100 shadow-lg">
                                <ClipboardCheck className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h1 className="text-lg md:text-xl font-black text-slate-900 tracking-tight leading-none">
                                    Локомотив {loading ? "..." : `${locomotive?.series}-${locomotive?.number}`}
                                </h1>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* Content */}
            <main className="flex-1 overflow-auto p-4 md:p-8">
                <div className="max-w-7xl mx-auto h-full">
                    {locomotive ? (
                        <Tabs defaultValue="active" className="w-full h-full flex flex-col">
                            <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
                                <TabsTrigger value="active">Текущий ремонт</TabsTrigger>
                                <TabsTrigger value="history">История ремонтов</TabsTrigger>
                            </TabsList>
                            <TabsContent value="active" className="flex-1 mt-4">
                                <LocomotiveChecklist locomotiveId={locomotive.id} />
                            </TabsContent>
                            <TabsContent value="history" className="flex-1 mt-4">
                                <LocomotiveHistory locomotiveId={locomotive.id} />
                            </TabsContent>
                        </Tabs>
                    ) : (
                        <div className="flex h-40 items-center justify-center text-slate-500">
                            {loading ? "Загрузка..." : "Локомотив не найден"}
                        </div>
                    )}
                </div>
            </main>
        </div>
    )
}
