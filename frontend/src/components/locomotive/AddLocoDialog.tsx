import React, { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatToDateTimeLocal } from "../../types/locomotive";

interface AddLocoDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (data: any) => void;
    catalog: any[];
    repairTypes: string[];
    trackCount: number;
    slotCount: number;
    isPending: boolean;
    initialTrack?: string;
    initialPosition?: string;
}

export const AddLocoDialog = React.memo(({
    isOpen,
    onOpenChange,
    onSubmit,
    catalog,
    repairTypes,
    trackCount,
    slotCount,
    isPending,
    initialTrack,
    initialPosition
}: AddLocoDialogProps) => {
    const [series, setSeries] = useState("")
    const [number, setNumber] = useState("")
    const [status, setStatus] = useState<string>("waiting")
    const [track, setTrack] = useState<string>(initialTrack || "")
    const [position, setPosition] = useState<string>(initialPosition || "")
    const [repairType, setRepairType] = useState<string>("")
    const [acceptanceTime, setAcceptanceTime] = useState<string>(formatToDateTimeLocal(new Date().toISOString()))
    const [isNumberOpen, setIsNumberOpen] = useState(false)
    const [search, setSearch] = useState("")

    const filteredCatalog = useMemo(() => {
        const s = search.toLowerCase()
        return catalog
            .filter(item =>
                `${item.series || ''} ${item.number}`.toLowerCase().includes(s)
            )
            .slice(0, 100)
    }, [catalog, search])

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!number) return
        onSubmit({
            series,
            number,
            status,
            track: track && track !== 'none' ? parseInt(track) : null,
            position: position && position !== 'none' ? parseInt(position) : null,
            repair_type: repairType && repairType !== 'none' ? repairType : null,
            planned_release: null,
            acceptance_time: acceptanceTime || null
        })
    }

    useEffect(() => {
        if (isOpen) {
            setSeries("")
            setNumber("")
            setStatus("waiting")
            setTrack(initialTrack || "")
            setPosition(initialPosition || "")
            setRepairType("")
            setAcceptanceTime(formatToDateTimeLocal(new Date().toISOString()))
            setSearch("")
        }
    }, [isOpen, initialTrack, initialPosition])

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Добавить локомотив</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                    <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-1 space-y-2">
                            <Label>Серия</Label>
                            <Input
                                value={series}
                                onChange={e => setSeries(e.target.value)}
                                placeholder="ТЭ33А"
                            />
                        </div>
                        <div className="col-span-2 space-y-2">
                            <Label>Номер</Label>
                            <Popover open={isNumberOpen} onOpenChange={setIsNumberOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={isNumberOpen}
                                        className="w-full justify-between"
                                        disabled={isPending}
                                    >
                                        {number || "Выберите..."}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[300px] p-0" align="start">
                                    <Command shouldFilter={false}>
                                        <CommandInput
                                            placeholder="Поиск в справочнике..."
                                            value={search}
                                            onValueChange={setSearch}
                                        />
                                        <CommandList>
                                            <CommandEmpty>Ничего не найдено.</CommandEmpty>
                                            <CommandGroup>
                                                {filteredCatalog.map((item: any) => (
                                                    <CommandItem
                                                        key={item.id}
                                                        value={`${item.series} ${item.number}`}
                                                        onSelect={() => {
                                                            setSeries(item.series || "")
                                                            setNumber(item.number)
                                                            setIsNumberOpen(false)
                                                        }}
                                                    >
                                                        <Check
                                                            className={cn(
                                                                "mr-2 h-4 w-4",
                                                                number === item.number && series === item.series ? "opacity-100" : "opacity-0"
                                                            )}
                                                        />
                                                        {item.series} {item.number}
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Статус</Label>
                        <Select value={status} onValueChange={setStatus}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="repair">Ремонт</SelectItem>
                                <SelectItem value="waiting">Ожидание</SelectItem>
                                <SelectItem value="completed">Завершён</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Путь</Label>
                            <Select value={track} onValueChange={setTrack}>
                                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">—</SelectItem>
                                    {Array.from({ length: trackCount }).map((_, i) => (
                                        <SelectItem key={i + 1} value={(i + 1).toString()}>
                                            Путь {i + 1}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Позиция</Label>
                            <Select value={position} onValueChange={setPosition}>
                                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">—</SelectItem>
                                    {Array.from({ length: slotCount }).map((_, i) => (
                                        <SelectItem key={i + 1} value={(i + 1).toString()}>
                                            Слот {i + 1}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {(status === 'repair' || status === 'waiting') && (
                        <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                            <Label>Тип ремонта</Label>
                            <Select value={repairType} onValueChange={setRepairType}>
                                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">—</SelectItem>
                                    {repairTypes.map((rt: string) => (
                                        <SelectItem key={rt} value={rt}>{rt}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label>Время приемки</Label>
                        <Input
                            type="datetime-local"
                            value={acceptanceTime}
                            onChange={e => setAcceptanceTime(e.target.value)}
                        />
                    </div>

                    <div className="pt-4">
                        <Button type="submit" className="w-full" disabled={isPending || !number}>
                            {isPending ? "Добавление..." : "Добавить локомотив"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
});
