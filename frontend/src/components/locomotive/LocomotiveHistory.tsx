import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { CheckCircle2, Clock, Wrench, FileText, User } from "lucide-react";
import { formatWO } from "@/lib/utils";

interface LocomotiveHistoryProps {
    locomotiveId: number | string;
}

export function LocomotiveHistory({ locomotiveId }: LocomotiveHistoryProps) {
    const { data: sessions, isLoading, error } = useQuery({
        queryKey: ['locomotive-history', locomotiveId],
        queryFn: async () => {
            const res = await fetch(`/api/locomotives/${locomotiveId}/sessions`);
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

    if (!sessions || sessions.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-slate-400">
                <Clock className="w-12 h-12 mb-4 opacity-20" />
                <p>История ремонтов пуста</p>
                <p className="text-sm mt-1">Здесь будут отображаться все закрытые сессии.</p>
            </div>
        );
    }

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('ru-RU', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };

    return (
        <ScrollArea className="h-[calc(100vh-250px)] w-full rounded-md mt-4">
            <Accordion type="multiple" className="w-full space-y-4 pr-4">
                {sessions.map((session: any) => (
                    <AccordionItem
                        key={session.id}
                        value={session.id.toString()}
                        className="border rounded-lg bg-white overflow-hidden"
                    >
                        <AccordionTrigger className="hover:no-underline hover:bg-slate-50 px-4 py-3">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between w-full gap-2 text-left">
                                <div>
                                    <div className="font-semibold text-slate-800 flex items-center gap-2">
                                        {formatWO(session.id, session.start_date)}
                                        {session.status === 'active' ? (
                                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Текущий ремонт</Badge>
                                        ) : (
                                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Завершён</Badge>
                                        )}
                                    </div>
                                    <div className="text-sm text-slate-500 mt-1 flex items-center gap-2">
                                        <Clock className="w-3.5 h-3.5" />
                                        {formatDate(session.start_date)} — {session.end_date ? formatDate(session.end_date) : 'В процессе'}
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 text-sm text-slate-500 mr-4">
                                    <span className="flex items-center gap-1" title="Замечания">
                                        <Wrench className="w-4 h-4" /> {session.remarks?.length || 0}
                                    </span>
                                    <span className="flex items-center gap-1" title="Чек-листы">
                                        <FileText className="w-4 h-4" /> {session.checklists?.length || 0}
                                    </span>
                                </div>
                            </div>
                        </AccordionTrigger>

                        <AccordionContent className="px-4 pb-4 pt-2 border-t bg-slate-50/50">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                                {/* Remarks Section */}
                                <div>
                                    <h4 className="font-medium text-slate-700 mb-3 flex items-center gap-2">
                                        <Wrench className="w-4 h-4" /> Замечания
                                    </h4>
                                    {session.remarks && session.remarks.length > 0 ? (
                                        <div className="space-y-2">
                                            {session.remarks.map((remark: any) => (
                                                <Card key={remark.id} className="shadow-sm">
                                                    <CardContent className="p-3 text-sm">
                                                        <div className="flex items-start justify-between gap-2">
                                                            <p className="text-slate-700">{remark.text}</p>
                                                            {remark.is_completed && (
                                                                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                                                            {remark.completed_by_user && (
                                                                <div className="flex items-center gap-1">
                                                                    <User className="w-3 h-3" />
                                                                    <span>{remark.completed_by_user.full_name || remark.completed_by_user.username}</span>
                                                                </div>
                                                            )}
                                                            {remark.category && (
                                                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shadow-none font-normal">
                                                                    {remark.category}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-slate-400 italic bg-white p-3 rounded-md border border-dashed">Замечаний не было</p>
                                    )}
                                </div>

                                {/* Checklists Section */}
                                <div>
                                    <h4 className="font-medium text-slate-700 mb-3 flex items-center gap-2">
                                        <FileText className="w-4 h-4" /> Чек-листы
                                    </h4>
                                    {session.checklists && session.checklists.length > 0 ? (
                                        <div className="space-y-2">
                                            {session.checklists.map((cl: any) => (
                                                <Card key={cl.id} className="shadow-sm">
                                                    <CardContent className="p-3 flex items-center justify-between">
                                                        <div>
                                                            <div className="font-medium text-sm text-slate-700">
                                                                {cl.template?.name || `Чек-лист #${cl.id}`}
                                                            </div>
                                                            {cl.completed_at && (
                                                                <div className="text-xs text-slate-500 mt-0.5">
                                                                    Оформлен: {formatDate(cl.completed_at)}
                                                                </div>
                                                            )}
                                                        </div>
                                                        {cl.status === 'completed' ? (
                                                            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 shadow-none">Сдан</Badge>
                                                        ) : (
                                                            <Badge variant="outline" className="text-slate-500">В процессе</Badge>
                                                        )}
                                                    </CardContent>
                                                </Card>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-slate-400 italic bg-white p-3 rounded-md border border-dashed">Чек-листы не заполнялись</p>
                                    )}
                                </div>
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                ))}
            </Accordion>
        </ScrollArea>
    );
}
