import { useState } from "react"
import { Search, Train, ArrowLeft, ChevronsUpDown, Check } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { cn } from "@/lib/utils"
import { locomotiveApi } from "@/api/locomotiveService"
import { LocomotiveDashboard } from "@/components/locomotive/LocomotiveDashboard"
import type { Locomotive } from "@/types/locomotive"

export default function Journal() {
    const [open, setOpen] = useState(false)
    const [selectedLoco, setSelectedLoco] = useState<Locomotive | null>(null)

    const { data: locos = [] } = useQuery({
        queryKey: ['locomotives-catalog'],
        queryFn: () => locomotiveApi.getJournalLocomotives(),
        staleTime: 60000,
    })

    const Combobox = ({ className }: { className?: string }) => (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn("w-full justify-between bg-white h-14 text-lg border-2 border-slate-200 hover:border-blue-400 hover:bg-slate-50 transition-colors shadow-sm", className)}
                >
                    {selectedLoco ? (
                        <div className="flex items-center gap-2">
                            <Train className="w-5 h-5 text-blue-600" />
                            <span className="font-semibold text-slate-800">{selectedLoco.series} {selectedLoco.number}</span>
                        </div>
                    ) : (
                        <span className="text-slate-400 font-normal">Выберите или введите номер локомотива...</span>
                    )}
                    <ChevronsUpDown className="ml-2 h-5 w-5 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                    <CommandInput placeholder="Поиск по номеру или серии..." className="h-12 text-base" />
                    <CommandList className="max-h-[300px]">
                        <CommandEmpty className="py-6 text-center text-sm text-slate-500">
                            Локомотив не найден.
                        </CommandEmpty>
                        <CommandGroup>
                            {locos.map((loco) => (
                                <CommandItem
                                    key={loco.id}
                                    value={`${loco.series} ${loco.number}`}
                                    onSelect={() => {
                                        setSelectedLoco(loco)
                                        setOpen(false)
                                    }}
                                    className="flex items-center gap-3 py-3 px-4 cursor-pointer"
                                >
                                    <Check
                                        className={cn(
                                            "h-5 w-5 text-blue-600",
                                            selectedLoco?.id === loco.id ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    <div className="flex flex-col">
                                        <span className="font-semibold text-slate-900 text-base">{loco.series} {loco.number}</span>
                                        <span className="text-xs text-slate-500 font-medium">
                                            {loco.is_on_map ? `На пути ${loco.track}` : 'Вне депо'}
                                        </span>
                                    </div>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )

    return (
        <div className="flex-1 overflow-auto bg-slate-50/50 p-4 md:p-8">
            <div className="max-w-7xl mx-auto space-y-6">
                {!selectedLoco ? (
                    <div className="flex flex-col flex-1 items-center justify-center py-16 md:py-32 px-4 max-w-2xl mx-auto text-center space-y-8 animate-in fade-in zoom-in-95 duration-700">
                        <div className="w-24 h-24 bg-blue-50 text-blue-600 rounded-[2rem] flex items-center justify-center shadow-inner ring-8 ring-white">
                            <Search className="w-10 h-10" />
                        </div>
                        <div className="w-full max-w-lg mx-auto relative z-10">
                            <Combobox className="rounded-2xl shadow-md border-blue-200" />
                        </div>
                        <div className="space-y-3">
                            <h2 className="text-4xl font-semibold tracking-tight text-slate-900">
                                Паспорт локомотива
                            </h2>
                            <p className="text-slate-500 text-lg max-w-md mx-auto leading-relaxed">
                                Единый хаб. Введите серию или номер локомотива для просмотра статуса, замечаний, метрологии и истории.
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6 animate-in fade-in duration-500">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-2 border border-slate-200 rounded-2xl shadow-sm">
                            <Button 
                                variant="ghost" 
                                onClick={() => setSelectedLoco(null)}
                                className="text-slate-500 hover:text-slate-900 rounded-xl"
                            >
                                <ArrowLeft className="mr-2 h-4 w-4" /> 
                                Назад к поиску
                            </Button>
                            <div className="w-full sm:w-[350px]">
                                <Combobox className="h-10 rounded-xl bg-slate-50 border-transparent hover:border-slate-300" />
                            </div>
                        </div>

                        <LocomotiveDashboard locomotive={selectedLoco} />
                    </div>
                )}
            </div>
        </div>
    )
}
