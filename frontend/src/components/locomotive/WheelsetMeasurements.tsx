import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Loader2, Info, Settings2, LayoutGrid, Download } from "lucide-react"
import { cn } from "@/lib/utils"
import { LocomotiveAxleMap } from "./LocomotiveAxleMap"
import { WheelProfileSVG } from "./WheelProfileSVG"
import { LIMITS } from "@/utils/wheelsetValidation"

interface Measurement {
    axle_number: number;
    side: 'Left' | 'Right';
    tire_thickness?: number;
    wear?: number;
    flange_thickness?: number;
    flange_steepness?: number;
    diameter?: number;
}

interface WheelsetMeasurementsProps {
    locomotiveId: number;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
}



export function WheelsetMeasurements({ locomotiveId, isOpen, onOpenChange }: WheelsetMeasurementsProps) {
    const queryClient = useQueryClient()
    const [selectedWheel, setSelectedWheel] = useState<{ axle: number; side: 'Left' | 'Right' } | null>(null)
    const [localMeasurements, setLocalMeasurements] = useState<Measurement[]>([])

    const { data: initialData, isLoading } = useQuery({
        queryKey: ['wheelset', locomotiveId],
        queryFn: async () => {
            const res = await fetch(`/api/locomotives/${locomotiveId}/wheelset`)
            if (!res.ok) throw new Error("Ошибка загрузки замеров")
            return res.json()
        },
        enabled: isOpen
    })

    useEffect(() => {
        if (initialData) setLocalMeasurements(initialData)
    }, [initialData])

    const saveMutation = useMutation({
        mutationFn: async (data: Measurement[]) => {
            const res = await fetch(`/api/locomotives/${locomotiveId}/wheelset`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            })
            const result = await res.json()
            if (!res.ok) {
                throw new Error(result.error || result.details || "Ошибка сохранения")
            }
            return result
        },
        onSuccess: () => {
            toast.success("Замеры сохранены успешно")
            queryClient.invalidateQueries({ queryKey: ['wheelset', locomotiveId] })
        },
        onError: (err: any) => {
            console.error("[SAVE ERROR]", err);
            // If the server returned debug info, log it
            if (err.message && err.message.includes("_debug_user")) {
                console.log("[DEBUG USER INFO]", err);
            }
            toast.error(err.message)
        }
    })

    const getMeasurement = (axle: number, side: 'Left' | 'Right') =>
        localMeasurements.find(m => m.axle_number === axle && m.side === side) || { axle_number: axle, side } as Measurement;

    const updateMeasurement = (axle: number, side: 'Left' | 'Right', field: keyof Measurement, value: number | undefined) => {
        setLocalMeasurements(prev => {
            const existingIdx = prev.findIndex(m => m.axle_number === axle && m.side === side)
            if (existingIdx > -1) {
                const updated = [...prev]
                updated[existingIdx] = { ...updated[existingIdx], [field]: value }
                return updated
            } else {
                return [...prev, { axle_number: axle, side, [field]: value } as Measurement]
            }
        })
    }

    const currentM = selectedWheel ? getMeasurement(selectedWheel.axle, selectedWheel.side) : null

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[1300px] w-[95vw] h-[85vh] bg-[#f8fafc] border-none shadow-2xl p-0 overflow-hidden flex flex-col">
                {/* Fixed Header */}
                <div className="flex items-center justify-between px-8 py-5 bg-white border-b shrink-0">
                    <DialogTitle className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <LayoutGrid className="h-5 w-5 text-indigo-500" />
                        Замеры колесных пар
                        {isLoading && <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />}
                    </DialogTitle>
                    <DialogDescription className="sr-only">
                        Просмотр и редактирование геометрических параметров бандажей и гребней колесных пар локомотива.
                    </DialogDescription>
                        <Button
                            onClick={() => window.open(`/api/locomotives/${locomotiveId}/wheelset/export`, '_blank')}
                            variant="outline"
                            className="text-slate-600 border-slate-200 hover:bg-slate-50 font-bold rounded-lg px-4 py-2 text-xs uppercase tracking-wider transition-all"
                        >
                            <Download className="h-4 w-4 mr-2" />
                            ВЫГРУЗИТЬ CSV
                        </Button>
                        <Button
                            onClick={() => saveMutation.mutate(localMeasurements)}
                            disabled={saveMutation.isPending}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-lg px-8 py-2 text-xs uppercase tracking-wider shadow-lg shadow-indigo-100 transition-all hover:scale-105 active:scale-95"
                        >
                            СОХРАНИТЬ ВСЕ ДАННЫЕ
                        </Button>
                </div>

                <div className="flex-1 grid grid-cols-1 lg:grid-cols-[380px_1fr] min-h-0 overflow-hidden">
                    {/* Left Panel: Schematic (Fixed) */}
                    <div className="bg-[#0f172a] p-6 border-r border-slate-800 overflow-y-auto custom-scrollbar flex flex-col items-center">
                        <LocomotiveAxleMap
                            measurements={localMeasurements}
                            selectedWheelId={selectedWheel ? `${selectedWheel.axle}${selectedWheel.side === 'Left' ? 'L' : 'R'}` : null}
                            onSelect={(id) => {
                                const axle = parseInt(id.charAt(0));
                                const side = id.endsWith('L') ? 'Left' : 'Right';
                                setSelectedWheel({ axle, side });
                            }}
                        />
                        <div className="mt-auto pt-8 w-full">
                            <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/50">
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Статус борта:</p>
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center text-[11px]">
                                        <span className="text-slate-400">Техническое состояние</span>
                                        <span className="text-emerald-400 font-bold">В норме</span>
                                    </div>
                                    <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden">
                                        <div className="bg-emerald-500 h-full w-[85%]" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Panel: Detail View (Side-by-Side SVG and Form) */}
                    <div className="flex flex-col min-h-0 bg-[#f8fafc]">
                        {selectedWheel ? (
                            <div className="p-6 flex flex-col h-full gap-6">
                                {/* Context Header */}
                                <div className="flex justify-between items-center bg-white px-5 py-3 rounded-xl shadow-sm border border-slate-200/60 shrink-0">
                                    <div className="flex items-center gap-4">
                                        <div className="h-10 w-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 font-black text-lg">
                                            {selectedWheel.axle}
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-black text-slate-800 tracking-tight leading-none">
                                                Колесо {selectedWheel.side === 'Left' ? 'левое' : 'правое'}
                                            </h3>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">Ось №{selectedWheel.axle} • Секция A</p>
                                        </div>
                                    </div>
                                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 uppercase font-black px-3 py-1 text-[9px] tracking-widest">
                                        Активно
                                    </Badge>
                                </div>

                                {/* MAIN CONTENT AREA (SVG + FORM) */}
                                <div className="flex-1 flex flex-col min-h-0">
                                    {/* SVG Profiler with integrated inputs */}
                                    <div className="flex-1 bg-white rounded-2xl border border-slate-200/60 shadow-sm flex items-center justify-center p-6 relative overflow-hidden">
                                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500 opacity-20" />
                                        <WheelProfileSVG
                                            thickness={currentM?.tire_thickness}
                                            flangeWidth={currentM?.flange_thickness}
                                            treadWear={currentM?.wear}
                                            diameter={currentM?.diameter}
                                            onThicknessChange={v => updateMeasurement(selectedWheel.axle, selectedWheel.side, 'tire_thickness', v)}
                                            onFlangeWidthChange={v => updateMeasurement(selectedWheel.axle, selectedWheel.side, 'flange_thickness', v)}
                                            onTreadWearChange={v => updateMeasurement(selectedWheel.axle, selectedWheel.side, 'wear', v)}
                                            onDiameterChange={v => updateMeasurement(selectedWheel.axle, selectedWheel.side, 'diameter', v)}
                                            className="border-none shadow-none w-full max-w-[800px]"
                                        />
                                    </div>

                                    {/* Bottom Info / Legend */}
                                    <div className="mt-6 bg-white shrink-0 p-5 rounded-xl border border-slate-200/60 shadow-sm">
                                        <div className="flex items-start gap-4">
                                            <div className="h-8 w-8 rounded-lg bg-slate-50 flex items-center justify-center">
                                                <Info className="h-4 w-4 text-slate-400" />
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Технические допуски:</p>
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Бандаж</span>
                                                        <span className="text-xs font-black text-slate-700">&gt;{LIMITS.tire_thickness.min} мм</span>
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Прокат</span>
                                                        <span className="text-xs font-black text-slate-700">&lt;{LIMITS.wear.max} мм</span>
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Гребень</span>
                                                        <span className="text-xs font-black text-slate-700">&gt;{LIMITS.flange_steepness.min} мм</span>
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Диаметр</span>
                                                        <span className="text-xs font-black text-slate-700">&gt;{LIMITS.diameter.min} мм</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-slate-300 text-center p-12">
                                <div className="h-32 w-32 bg-white rounded-3xl shadow-xl shadow-slate-200/50 flex items-center justify-center mb-8 border border-slate-100">
                                    <Settings2 className="h-16 w-16 text-indigo-500/20 animate-spin-slow" />
                                </div>
                                <h4 className="text-xl font-black text-slate-800 tracking-tight">Выберите колесо для замера</h4>
                                <p className="text-sm max-w-[320px] mt-3 font-medium text-slate-400 leading-relaxed">
                                    Используйте интерактивную карту локомотива слева, чтобы выбрать конкретное колесо для ввода технических характеристик
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}

function Badge({ children, className }: any) {
    return <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold border", className)}>{children}</span>
}
