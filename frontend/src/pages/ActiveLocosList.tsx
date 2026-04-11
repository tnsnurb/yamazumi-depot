import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Train, Clock, Wrench, FileText, MoreHorizontal, History, QrCode, Scale, Camera } from "lucide-react";
import { formatWO } from "@/lib/utils";
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { WheelsetMeasurements } from "@/components/locomotive/WheelsetMeasurements";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { QRCodeSVG } from 'qrcode.react';
import { Skeleton } from "@/components/ui/skeleton";

export default function ActiveLocosList() {
    const [selectedLocoForQr, setSelectedLocoForQr] = useState<any>(null);
    const [selectedLocoForWheelset, setSelectedLocoForWheelset] = useState<any>(null);

    const { data: sessions, isLoading, error, refetch } = useQuery({
        queryKey: ['active-sessions'],
        queryFn: async () => {
            const res = await fetch('/api/sessions/active');
            if (!res.ok) throw new Error("Ошибка загрузки активных локомотивов");
            return res.json();
        }
    });

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('ru-RU', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };

    if (isLoading) {
        return (
            <div className="flex-1 flex flex-col overflow-hidden bg-slate-50/30">
                <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200/60 px-4 py-4 md:px-8">
                    <div className="max-w-5xl mx-auto flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Skeleton className="w-9 h-9 rounded-xl" />
                            <div className="space-y-2">
                                <Skeleton className="h-5 w-40" />
                                <Skeleton className="h-3 w-24" />
                            </div>
                        </div>
                    </div>
                </header>
                <main className="flex-1 overflow-auto p-4 md:p-8">
                    <div className="max-w-5xl mx-auto flex flex-col gap-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="border rounded-xl bg-white p-4 md:p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="flex-1 space-y-3">
                                    <Skeleton className="h-6 w-3/4" />
                                    <div className="flex gap-2">
                                        <Skeleton className="h-8 w-32 rounded-md" />
                                        <Skeleton className="h-8 w-20 rounded-md" />
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Skeleton className="h-10 w-24 rounded-md" />
                                    <Skeleton className="h-10 w-32 rounded-md" />
                                </div>
                            </div>
                        ))}
                    </div>
                </main>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex-1 p-8 flex flex-col items-center justify-center bg-slate-50/30">
                <div className="bg-red-50 text-red-600 p-6 rounded-2xl border border-red-100 max-w-md text-center">
                    <p className="font-bold mb-2">Ошибка загрузки</p>
                    <p className="text-sm opacity-80">{(error as Error).message}</p>
                    <Button variant="outline" onClick={() => refetch()} className="mt-4 border-red-200 text-red-600 hover:bg-red-100 h-11">
                        Попробовать снова
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-50/30">
            <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200/60 px-4 py-4 md:px-8">
                <div className="max-w-5xl mx-auto flex items-center justify-between">
                    <div className="flex flex-col">
                        <h1 className="text-lg md:text-xl font-semibold text-slate-900 tracking-tight leading-none">
                            Активные ремонты
                        </h1>
                        <p className="text-[10px] md:text-xs text-slate-400 font-medium tracking-wide mt-1 uppercase tracking-widest">
                            {sessions?.length || 0} локомотивов в депо
                        </p>
                    </div>
                </div>
            </header>

            <main className="flex-1 overflow-auto p-4 md:p-8">
                <div className="max-w-5xl mx-auto">
                    {!sessions || sessions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-12 text-slate-400 bg-white border border-dashed rounded-2xl">
                            <Train className="w-12 h-12 mb-4 opacity-20" />
                            <p className="font-medium">Нет активных ремонтов</p>
                            <p className="text-sm mt-1">Все локомотивы на линии или ждут постановки.</p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4 w-full">
                            {sessions.map((session: any) => (
                                <div key={session.id} className="border rounded-xl bg-white p-4 md:p-6 shadow-sm hover:shadow transition-shadow flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="font-bold text-slate-900 flex items-center gap-2 text-base md:text-lg">
                                            {formatWO(session.id, session.locomotive?.number)}
                                            <span className="text-slate-300 mx-1 md:mx-2">•</span>
                                            <div className="flex items-center gap-1.5 text-blue-600">
                                                <Train className="w-4 h-4 md:w-5 md:h-5" />
                                                {session.locomotive?.series}-{session.locomotive?.number}
                                            </div>
                                            {session.status === 'waiting' && (
                                                <Badge variant="secondary" className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-none ml-2">Ожидание</Badge>
                                            )}
                                        </div>
                                        <div className="text-xs md:text-sm text-slate-500 mt-3 flex flex-wrap items-center gap-2">
                                            <div className="bg-slate-100 px-2 py-1.5 rounded-md flex items-center gap-1.5">
                                                <Clock className="w-3.5 h-3.5" />
                                                ОТ: <span className="font-semibold text-slate-700">{formatDate(session.start_date)}</span>
                                            </div>
                                            {session.locomotive?.repair_type && (
                                                <div className="bg-blue-50 text-blue-700 px-2 py-1.5 rounded-md font-bold uppercase tracking-wider text-[10px] flex items-center gap-1">
                                                    <span className="text-[8px] text-blue-400 font-medium">ТИП:</span>
                                                    {session.locomotive.repair_type}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                                        <div className="flex items-center gap-4 text-sm mr-2 md:mr-6">
                                            <div className="flex items-center gap-2 text-slate-600">
                                                <Wrench className="w-4 h-4 text-blue-400" />
                                                <span className="font-medium">{session.remarks?.length || 0}</span>
                                                <span className="hidden lg:inline text-xs text-slate-400 uppercase tracking-wider">зам.</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-slate-600">
                                                <FileText className="w-4 h-4 text-sky-400" />
                                                <span className="font-medium">{session.checklists?.length || 0}</span>
                                                <span className="hidden lg:inline text-xs text-slate-400 uppercase tracking-wider">чек-л.</span>
                                            </div>
                                        </div>

                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="outline" className="w-full sm:w-auto border-dashed hover:border-solid bg-blue-50/50 hover:bg-blue-100 transition-all font-medium text-blue-700 h-11">
                                                    Действия <MoreHorizontal className="w-4 h-4 ml-2 opacity-50" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-56 font-medium">
                                                <DropdownMenuLabel className="text-xs text-slate-400 font-bold uppercase tracking-widest px-2 pb-1">Управление</DropdownMenuLabel>

                                                <DropdownMenuItem asChild className="cursor-pointer py-3.5 hover:bg-blue-50 focus:bg-blue-50 focus:text-blue-900 group">
                                                    <Link to={`/locomotive/${session.locomotive?.id}/remarks`}>
                                                        <Wrench className="w-4 h-4 mr-3 text-blue-500 group-hover:scale-110 transition-transform" />
                                                        <span>Замечания</span>
                                                        <Badge variant="secondary" className="ml-auto bg-white/50">{session.remarks?.length || 0}</Badge>
                                                    </Link>
                                                </DropdownMenuItem>

                                                <DropdownMenuItem asChild className="cursor-pointer py-3.5 hover:bg-slate-100 group">
                                                    <Link to={`/history/${session.locomotive?.number}`}>
                                                        <History className="w-4 h-4 mr-3 text-slate-500 group-hover:rotate-[-45deg] transition-transform" />
                                                        <span>История (Журнал)</span>
                                                    </Link>
                                                </DropdownMenuItem>

                                                <DropdownMenuSeparator />

                                                <DropdownMenuItem
                                                    className="cursor-pointer py-3.5 hover:bg-blue-50 focus:bg-blue-50 text-blue-700 group"
                                                    onClick={() => setSelectedLocoForWheelset(session.locomotive)}
                                                >
                                                    <Scale className="w-4 h-4 mr-3 text-amber-500 group-hover:scale-110 transition-transform" />
                                                    <span>Замеры бандажей</span>
                                                </DropdownMenuItem>

                                                <DropdownMenuItem
                                                    className="cursor-pointer py-3.5 hover:bg-blue-50 focus:bg-blue-50 text-blue-700 group"
                                                    onClick={() => setSelectedLocoForQr(session.locomotive)}
                                                >
                                                    <QrCode className="w-4 h-4 mr-3 text-blue-500 group-hover:scale-110 transition-transform" />
                                                    <span>QR код</span>
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>

            {/* QR Dialog */}
            <Dialog open={!!selectedLocoForQr} onOpenChange={(open) => !open && setSelectedLocoForQr(null)}>
                <DialogContent className="max-w-xs sm:max-w-sm p-0 overflow-hidden border-none shadow-2xl rounded-3xl">
                    <div className="bg-slate-900 pt-8 pb-12 px-6 text-center relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />
                        <div className="relative z-10 flex flex-col items-center">
                            <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center mb-4 border border-white/20">
                                <QrCode className="w-8 h-8 text-white" />
                            </div>
                            <h2 className="text-xl font-semibold text-white tracking-tight">QR код локомотива</h2>
                            <p className="text-blue-200 text-sm font-bold mt-1 uppercase tracking-widest">
                                {selectedLocoForQr?.series} {selectedLocoForQr?.number}
                            </p>
                        </div>
                        <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-blue-500/20 rounded-full blur-3xl" />
                        <div className="absolute -top-12 -left-12 w-32 h-32 bg-purple-500/20 rounded-full blur-3xl" />
                    </div>

                    <div className="px-6 pb-8 -mt-8 relative z-20">
                        <div className="bg-white p-6 rounded-[2rem] shadow-xl border border-slate-100 flex flex-col items-center">
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 mb-6 group transition-all hover:shadow-md">
                                {selectedLocoForQr && (
                                    <QRCodeSVG
                                        value={`${window.location.origin}/locomotive/${selectedLocoForQr.id}/remarks`}
                                        size={180}
                                        level="H"
                                        includeMargin={false}
                                        className="rounded-lg"
                                    />
                                )}
                            </div>

                            <div className="space-y-4 w-full">
                                <div className="flex flex-col gap-2 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                    <div className="flex items-center gap-2 text-slate-400 text-[10px] font-black uppercase tracking-wider">
                                        <Camera className="w-3 h-3" />
                                        <span>Инструкция</span>
                                    </div>
                                    <p className="text-xs text-slate-600 font-medium leading-relaxed">
                                        Наведите камеру мобильного устройства на этот код для мгновенного перехода к списку замечаний.
                                    </p>
                                </div>

                                <Button
                                    onClick={() => setSelectedLocoForQr(null)}
                                    className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-2xl h-12 font-bold transition-all active:scale-[0.98]"
                                >
                                    Закрыть
                                </Button>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Wheelset Measurements Dialog */}
            {selectedLocoForWheelset && (
                <WheelsetMeasurements
                    locomotiveId={selectedLocoForWheelset.id}
                    isOpen={!!selectedLocoForWheelset}
                    onOpenChange={(open) => !open && setSelectedLocoForWheelset(null)}
                />
            )}
        </div>
    );
}
