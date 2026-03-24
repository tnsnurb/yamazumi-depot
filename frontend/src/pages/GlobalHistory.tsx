import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Badge } from "@/components/ui/badge";
import { formatWO } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Train, Clock, Wrench, FileText, ChevronRight, MoreHorizontal, History } from "lucide-react";
import { Button } from '@/components/ui/button';

export default function GlobalHistory() {
    const { data: sessions, isLoading, error } = useQuery({
        queryKey: ['global-history'],
        queryFn: async () => {
            const res = await fetch(`/api/sessions/history`);
            if (!res.ok) throw new Error("Ошибка загрузки истории");
            return res.json();
        }
    });

    if (isLoading) {
        return <div className="p-8 text-center text-slate-500 animate-pulse">Загрузка архива...</div>;
    }

    if (error) {
        return <div className="p-4 text-red-500 text-center">Ошибка: {(error as Error).message}</div>;
    }

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('ru-RU', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };

    return (
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-50/30">
            <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200/60 px-4 py-4 md:px-8">
                <div className="max-w-5xl mx-auto flex items-center justify-between">
                    <div className="flex flex-col">
                        <h1 className="text-lg md:text-xl font-semibold text-slate-900 tracking-tight leading-none">
                            Архив ремонтов
                        </h1>
                        <p className="text-[10px] md:text-xs text-slate-400 font-medium tracking-wide mt-1">
                            {sessions?.length} завершенных сессий
                        </p>
                    </div>
                </div>
            </header>

            <main className="flex-1 overflow-auto p-4 md:p-8">
                <div className="max-w-5xl mx-auto">
                    {!sessions || sessions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-12 text-slate-400 bg-white border border-dashed rounded-2xl">
                            <Clock className="w-12 h-12 mb-4 opacity-20" />
                            <p>История пуста</p>
                            <p className="text-sm mt-1">Здесь будут отображаться все закрытые сессии.</p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4 w-full">
                            {sessions.map((session: any) => (
                                <div key={session.id} className="border rounded-xl bg-white p-4 md:p-6 shadow-sm hover:shadow transition-shadow flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="font-semibold text-slate-900 flex items-center gap-2 text-base md:text-lg">
                                            {formatWO(session.id, session.locomotive?.number)}
                                            <span className="text-slate-300 mx-1 md:mx-2">•</span>
                                            <div className="flex items-center gap-1.5 text-blue-600">
                                                <Train className="w-4 h-4 md:w-5 md:h-5" />
                                                {session.locomotive?.series}-{session.locomotive?.number}
                                            </div>
                                        </div>
                                        <div className="text-xs md:text-sm text-slate-500 mt-3 flex flex-wrap items-center gap-2">
                                            <div className="bg-slate-100 px-2 py-1.5 rounded-md flex items-center gap-1.5">
                                                <Clock className="w-3.5 h-3.5" />
                                                ОТ: <span className="font-semibold text-slate-700">{formatDate(session.start_date)}</span>
                                            </div>
                                            <ChevronRight className="w-4 h-4 text-slate-300 hidden sm:block" />
                                            <div className="bg-emerald-50 text-emerald-700 px-2 py-1.5 rounded-md flex items-center gap-1.5">
                                                <Clock className="w-3.5 h-3.5" />
                                                ДО: <span className="font-semibold text-emerald-800">{formatDate(session.end_date)}</span>
                                            </div>
                                            {session.locomotive?.repair_type && (
                                                <div className="bg-emerald-50 text-emerald-700 px-2 py-1.5 rounded-md font-semibold uppercase tracking-wider text-[10px] flex items-center gap-1">
                                                    <span className="text-[8px] text-emerald-400 font-medium">ТИП:</span>
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
                                                <Button variant="outline" className="w-full sm:w-auto border-dashed hover:border-solid bg-slate-50 hover:bg-slate-100/80 transition-all font-medium text-slate-700">
                                                    Действия <MoreHorizontal className="w-4 h-4 ml-2 opacity-50" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-56 font-medium">
                                                <DropdownMenuLabel className="text-xs text-slate-400 font-semibold uppercase tracking-widest px-2 pb-1">Просмотр</DropdownMenuLabel>
                                                <DropdownMenuItem asChild className="cursor-pointer py-2.5 hover:bg-sky-50 focus:bg-sky-50 focus:text-sky-900 group">
                                                    <Link to={`/history/session/${session.id}/checklists`} state={{ session }}>
                                                        <FileText className="w-4 h-4 mr-3 text-sky-500 group-hover:scale-110 transition-transform" />
                                                        <span>Чек-листы</span>
                                                        <Badge variant="secondary" className="ml-auto bg-white/50">{session.checklists?.length || 0}</Badge>
                                                    </Link>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem asChild className="cursor-pointer py-2.5 hover:bg-blue-50 focus:bg-blue-50 focus:text-blue-900 group">
                                                    <Link to={`/history/session/${session.id}/remarks`} state={{ session }}>
                                                        <Wrench className="w-4 h-4 mr-3 text-blue-500 group-hover:scale-110 transition-transform" />
                                                        <span>Замечания</span>
                                                        <Badge variant="secondary" className="ml-auto bg-white/50">{session.remarks?.length || 0}</Badge>
                                                    </Link>
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem asChild className="cursor-pointer py-2.5 mt-1 hover:bg-slate-100">
                                                    <Link to={`/history/${session.locomotive?.number}`}>
                                                        <History className="w-4 h-4 mr-3 text-slate-500" />
                                                        <span>Журнал локомотива</span>
                                                    </Link>
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
        </div>
    );
}
