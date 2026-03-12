import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { Loader2, Save, Info, LayoutGrid } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

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

const LIMITS = {
    tire_thickness: { min: 45, warning: 50 },
    wear: { max: 7, warning: 5 },
    flange_thickness: { min: 25, max: 33, warning_low: 26, warning_high: 32 },
    flange_steepness: { min: 6.5, warning: 7 }
}

export function WheelsetMeasurements({ locomotiveId, isOpen, onOpenChange }: WheelsetMeasurementsProps) {
    const queryClient = useQueryClient()
    const [selectedWheel, setSelectedWheel] = useState<{ axle: number; side: 'Left' | 'Right' } | null>(null)
    const [localMeasurements, setLocalMeasurements] = useState<Measurement[]>([])

    const { data: initialData, isLoading, isError } = useQuery({
        queryKey: ['wheelset', locomotiveId],
        queryFn: async () => {
            const res = await fetch(`/api/locomotives/${locomotiveId}/wheelset`)
            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || "Ошибка загрузки замеров")
            }
            return res.json()
        },
        enabled: isOpen,
        retry: 1
    })

    useEffect(() => {
        if (initialData && Array.isArray(initialData)) {
            setLocalMeasurements(initialData)
        } else if (isError) {
            setLocalMeasurements([])
        }
    }, [initialData, isError])

    const saveMutation = useMutation({
        mutationFn: (data: Measurement[]) => fetch(`/api/locomotives/${locomotiveId}/wheelset`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        }).then(res => res.json()),
        onSuccess: () => {
            toast.success("Замеры сохранены")
            queryClient.invalidateQueries({ queryKey: ['wheelset', locomotiveId] })
        },
        onError: (err: any) => toast.error(err.message)
    })

    const getMeasurement = (axle: number, side: 'Left' | 'Right') => {
        if (!Array.isArray(localMeasurements)) return undefined
        return localMeasurements.find(m => m.axle_number === axle && m.side === side)
    }

    const updateMeasurement = (axle: number, side: 'Left' | 'Right', field: keyof Measurement, value: string) => {
        const numValue = value === "" ? undefined : parseFloat(value)
        setLocalMeasurements(prev => {
            const current = Array.isArray(prev) ? prev : []
            const existingIdx = current.findIndex(m => m.axle_number === axle && m.side === side)
            if (existingIdx > -1) {
                const updated = [...current]
                updated[existingIdx] = { ...updated[existingIdx], [field]: numValue }
                return updated
            } else {
                return [...current, { axle_number: axle, side, [field]: numValue } as Measurement]
            }
        })
    }

    const getWheelColor = (axle: number, side: 'Left' | 'Right') => {
        const m = getMeasurement(axle, side)
        if (!m) return "fill-slate-200"

        // Logic for color coding
        let status = 'ok'
        if (m.tire_thickness !== undefined) {
            if (m.tire_thickness < LIMITS.tire_thickness.min) status = 'error'
            else if (m.tire_thickness < LIMITS.tire_thickness.warning) status = 'warning'
        }
        if (m.wear !== undefined && status !== 'error') {
            if (m.wear > LIMITS.wear.max) status = 'error'
            else if (m.wear > LIMITS.wear.warning) status = 'warning'
        }

        if (status === 'error') return "fill-red-500 stroke-red-700"
        if (status === 'warning') return "fill-amber-400 stroke-amber-600"
        return "fill-green-500 stroke-green-700"
    }

    const currentM = selectedWheel ? getMeasurement(selectedWheel.axle, selectedWheel.side) : null

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        Замеры колесных пар
                        {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                    </DialogTitle>
                </DialogHeader>

                {isError && (
                    <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 text-sm font-medium text-center">
                        Не удалось загрузить данные. Попробуйте снова позже.
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 py-4">
                    {/* Visual Schematic */}
                    <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 flex flex-col items-center justify-center relative min-h-[400px]">
                        <div className="absolute top-4 left-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Схема (Co-Co)</div>

                        <svg width="300" height="450" viewBox="0 0 300 450" className="drop-shadow-sm">
                            {/* Locomotive Body Outline */}
                            <rect x="70" y="20" width="160" height="410" rx="10" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="2" />

                            {/* Axles */}
                            {[1, 2, 3, 4, 5, 6].map((axle, i) => {
                                const y = 60 + i * 65
                                return (
                                    <g key={`axle-${axle}`}>
                                        {/* Physical Axle Line */}
                                        <line x1="50" y1={y} x2="250" y2={y} stroke="#475569" strokeWidth="6" strokeLinecap="round" />

                                        {/* Left Wheel */}
                                        <g
                                            className="cursor-pointer group"
                                            onClick={() => setSelectedWheel({ axle, side: 'Left' })}
                                        >
                                            <circle
                                                cx="50" cy={y} r="22"
                                                className={cn(
                                                    "transition-all duration-200 stroke-2",
                                                    getWheelColor(axle, 'Left'),
                                                    selectedWheel?.axle === axle && selectedWheel?.side === 'Left' ? "stroke-blue-600 stroke-[4px] scale-110" : "hover:scale-105"
                                                )}
                                            />
                                            <text x="50" y={y + 5} textAnchor="middle" className="fill-white text-[10px] font-bold pointer-events-none">{axle}L</text>
                                        </g>

                                        {/* Right Wheel */}
                                        <g
                                            className="cursor-pointer group"
                                            onClick={() => setSelectedWheel({ axle, side: 'Right' })}
                                        >
                                            <circle
                                                cx="250" cy={y} r="22"
                                                className={cn(
                                                    "transition-all duration-200 stroke-2",
                                                    getWheelColor(axle, 'Right'),
                                                    selectedWheel?.axle === axle && selectedWheel?.side === 'Right' ? "stroke-blue-600 stroke-[4px] scale-110" : "hover:scale-105"
                                                )}
                                            />
                                            <text x="250" y={y + 5} textAnchor="middle" className="fill-white text-[10px] font-bold pointer-events-none">{axle}R</text>
                                        </g>
                                    </g>
                                )
                            })}
                        </svg>

                        <div className="mt-8 grid grid-cols-3 gap-4 text-xs">
                            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-green-500"></div> Норма</div>
                            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-amber-400"></div> Внимание</div>
                            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-red-500"></div> Критично</div>
                        </div>
                    </div>

                    {/* Form Panel */}
                    <div className="flex flex-col gap-6">
                        {selectedWheel ? (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
                                <div className="flex items-center justify-between border-b pb-4">
                                    <h3 className="text-lg font-bold text-slate-900">
                                        Ось {selectedWheel.axle} — {selectedWheel.side === 'Left' ? 'Левое' : 'Правое'}
                                    </h3>
                                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                        Замеры
                                    </Badge>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs uppercase text-slate-500 font-bold">Толщина бандажа (мм)</Label>
                                        <Input
                                            type="number"
                                            placeholder="70-90"
                                            value={currentM?.tire_thickness || ""}
                                            onChange={e => updateMeasurement(selectedWheel.axle, selectedWheel.side, 'tire_thickness', e.target.value)}
                                            className={cn(currentM?.tire_thickness && currentM.tire_thickness < LIMITS.tire_thickness.min && "border-red-500")}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs uppercase text-slate-500 font-bold">Прокат (мм)</Label>
                                        <Input
                                            type="number"
                                            placeholder="max 7"
                                            value={currentM?.wear || ""}
                                            onChange={e => updateMeasurement(selectedWheel.axle, selectedWheel.side, 'wear', e.target.value)}
                                            className={cn(currentM?.wear && currentM.wear > LIMITS.wear.max && "border-red-500")}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs uppercase text-slate-500 font-bold">Толщина гребня (мм)</Label>
                                        <Input
                                            type="number"
                                            placeholder="25-33"
                                            value={currentM?.flange_thickness || ""}
                                            onChange={e => updateMeasurement(selectedWheel.axle, selectedWheel.side, 'flange_thickness', e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs uppercase text-slate-500 font-bold">Диаметр (мм)</Label>
                                        <Input
                                            type="number"
                                            placeholder="1050"
                                            value={currentM?.diameter || ""}
                                            onChange={e => updateMeasurement(selectedWheel.axle, selectedWheel.side, 'diameter', e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100 flex gap-3 text-sm text-blue-800">
                                    <Info className="h-5 w-5 shrink-0" />
                                    <div className="space-y-1">
                                        <p className="font-semibold">Справка по допускам:</p>
                                        <ul className="list-disc list-inside text-xs opacity-80">
                                            <li>Толщина бандажа: не менее {LIMITS.tire_thickness.min} мм</li>
                                            <li>Прокат: не более {LIMITS.wear.max} мм</li>
                                            <li>Крутизна гребня (Qp): не менее 6.5 мм</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-center p-8 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/30">
                                <LayoutGrid className="h-12 w-12 mb-4 opacity-20" />
                                <p className="font-medium text-slate-600">Колесо не выбрано</p>
                                <p className="text-xs max-w-[200px] mt-2">Нажмите на колесо на схеме слева, чтобы внести замеры</p>
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter className="border-t pt-6">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
                    <Button
                        onClick={() => saveMutation.mutate(localMeasurements)}
                        disabled={saveMutation.isPending || localMeasurements.length === 0}
                        className="gap-2 bg-indigo-600 hover:bg-indigo-700 shadow-md px-6"
                    >
                        {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Сохранить все замеры
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
