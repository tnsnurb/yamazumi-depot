import { Card, CardContent } from "@/components/ui/card"
import { Cloud, Thermometer, Wind } from "lucide-react"

export function WeatherStatus() {
    // Mock weather for depot location
    return (
        <Card className="border-none bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-3xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300">
            <CardContent className="p-6">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex flex-col gap-1">
                        <span className="text-sm font-medium text-blue-100 italic">Текущая погода</span>
                        <div className="flex items-end gap-2">
                            <span className="text-4xl font-black tabular-nums">-4°C</span>
                            <span className="text-sm font-medium text-blue-100 pb-1">Облачно</span>
                        </div>
                    </div>
                    <div className="relative">
                        <div className="absolute inset-0 blur-2xl bg-white/20 rounded-full" />
                        <Cloud className="h-12 w-12 text-white relative" />
                    </div>
                </div>
                
                <div className="mt-6 grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/10">
                        <Wind className="h-4 w-4 text-blue-200" />
                        <span className="text-xs font-semibold">5 м/с СВ</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/10">
                        <Thermometer className="h-4 w-4 text-blue-200" />
                        <span className="text-xs font-semibold">Влаж. 65%</span>
                    </div>
                </div>
                <p className="mt-4 text-[10px] text-blue-200/80 leading-tight">
                    * Погода влияет на тормозной путь и время маневров. Рекомендуется повышенная бдительность.
                </p>
            </CardContent>
        </Card>
    )
}
