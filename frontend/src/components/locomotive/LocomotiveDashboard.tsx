import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { locomotiveApi } from "@/api/locomotiveService"
import { remarkApi } from "@/api/remarkService"
import { gaugeService } from "@/api/gaugeService"
import { sessionService } from "@/api/sessionService"
import { statusColors, statusLabels } from "@/types/locomotive"
import { MapPin, Train, AlertTriangle, Gauge as GaugeIcon, History as HistoryIcon, Activity, CheckCircle2, Navigation, Calendar, Wrench, ClipboardCheck, User, Timer } from "lucide-react"
import { cn, formatWO } from "@/lib/utils"
import { Progress } from "@/components/ui/progress"

interface LocomotiveDashboardProps {
    locomotive: any; // We'll pass the type later, using any for quick integration
}

export function LocomotiveDashboard({ locomotive }: LocomotiveDashboardProps) {
    const [activeTab, setActiveTab] = useState("overview")

    // --- Data Fetching ---
    const { data: gauges = [], isLoading: isLoadingGauges } = useQuery({
        queryKey: ['loco-gauges', locomotive.id],
        queryFn: () => gaugeService.getByLocomotive(locomotive.id),
        enabled: !!locomotive.id
    })

    const { data: gaugeHistory = [], isLoading: isLoadingGaugeHistory } = useQuery({
        queryKey: ['loco-gauge-history', locomotive.id],
        queryFn: () => gaugeService.getHistoryByLocomotive(locomotive.id),
        enabled: !!locomotive.id
    })

    const { data: remarks = [], isLoading: isLoadingRemarks } = useQuery({
        queryKey: ['loco-remarks', locomotive.id],
        queryFn: () => remarkApi.getByLocomotiveId(locomotive.id),
        enabled: !!locomotive.id
    })

    const { data: history = [], isLoading: isLoadingHistory } = useQuery({
        queryKey: ['loco-history', locomotive.number],
        queryFn: () => locomotiveApi.getHistory(locomotive.number),
        enabled: !!locomotive.number
    })

    const { data: activeSessions = [] } = useQuery({
        queryKey: ['loco-active-sessions', locomotive.id],
        queryFn: () => sessionService.getActiveSessions(locomotive.id),
        enabled: !!locomotive.id
    })

    const { data: historySessions = [] } = useQuery({
        queryKey: ['loco-history-sessions', locomotive.id],
        queryFn: () => sessionService.getHistory(locomotive.id),
        enabled: !!locomotive.id
    })

    const activeRemarks = remarks.filter((r: any) => !r.is_completed)
    const defectiveGauges = gauges.filter(g => g.is_defective || g.status === 'Списан')

    const hasActiveSession = activeSessions.length > 0;
    const lastSession = historySessions[0];

    let repairProgress = 0;
    let repairStatusText = 'Данных нет';
    let progressColorClass = 'bg-slate-200';
    let repairDateText = '—';

    // Calculation logic for the 90-day progress bar
    if (hasActiveSession) {
        repairStatusText = 'На ремонте';
        repairProgress = 100;
        progressColorClass = 'bg-blue-500';
        repairDateText = 'Сейчас';
    } else if (lastSession?.end_date) {
        const lastRepairDate = new Date(lastSession.end_date);
        const nextRepairDate = new Date(lastRepairDate);
        nextRepairDate.setDate(nextRepairDate.getDate() + 90);

        const now = new Date();
        const diffTime = nextRepairDate.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        repairDateText = nextRepairDate.toLocaleDateString('ru-RU');

        if (diffDays <= 0) {
            repairStatusText = 'Просрочено';
            repairProgress = 100;
            progressColorClass = 'bg-rose-500';
        } else {
            repairStatusText = `Через ${diffDays} дн.`;
            repairProgress = Math.min(100, Math.max(0, ((90 - diffDays) / 90) * 100));
            progressColorClass = diffDays <= 15 ? 'bg-amber-500' : 'bg-emerald-500';
        }
    }

    const renderRemarkCard = (remark: any) => (
        <div key={remark.id} className="p-5 border border-slate-200 rounded-xl bg-white shadow-sm flex flex-col gap-3">
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                    <div className={cn("w-2 h-2 rounded-full mt-1.5 shrink-0",
                        remark.priority === 'high' ? 'bg-rose-500' :
                            remark.priority === 'medium' ? 'bg-amber-500' : 'bg-blue-500'
                    )} />
                    <div>
                        <div className="text-sm font-medium text-slate-900 line-clamp-2">{remark.text}</div>
                        <div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className="text-[9px] uppercase tracking-wider px-1.5 py-0">
                                {remark.category || 'Общее'}
                            </Badge>
                            <span>•</span>
                            <span>{new Date(remark.created_at).toLocaleDateString('ru-RU')}</span>
                            {remark.is_completed && remark.completed_by && (
                                <>
                                    <span>•</span>
                                    <span className="flex items-center gap-1 text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded text-[10px] font-bold">
                                        <User className="w-3 h-3" />
                                        Выполнил: {remark.completed_by.full_name || remark.completed_by.username}
                                    </span>
                                </>
                            )}
                        </div>
                    </div>
                </div>
                <Badge variant="secondary" className={cn("text-[10px]",
                    remark.is_completed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                )}>
                    {remark.is_completed ? 'Закрыто' : 'Активно'}
                </Badge>
            </div>
        </div>
    )

    return (
        <div className="w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header Card */}
            <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
                <div className="bg-slate-50 border-b border-slate-100 p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-5">
                        <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center shadow-inner">
                            <Train className="w-8 h-8" />
                        </div>
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <h2 className="text-3xl font-bold text-slate-900 tracking-tight uppercase">
                                    {locomotive.series} {locomotive.number}
                                </h2>
                                <Badge className={cn("text-white border-none text-[10px] font-bold uppercase px-3 h-6 tracking-widest rounded-full shadow-sm", statusColors[locomotive.status] || 'bg-slate-400')}>
                                    {statusLabels[locomotive.status] || locomotive.status}
                                </Badge>
                            </div>
                            <div className="flex items-center gap-2 text-slate-500 font-medium text-sm">
                                <MapPin className="w-4 h-4 text-slate-400" />
                                {locomotive.is_on_map ? (
                                    <span>В депо: Путь <strong className="text-slate-700">{locomotive.track}</strong>, Слот <strong className="text-slate-700">{locomotive.position}</strong></span>
                                ) : (
                                    <span>Вне депо (На линии)</span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <div className="flex flex-col items-end">
                            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Манометры</div>
                            <div className="flex items-center gap-2">
                                <span className="text-2xl font-bold text-slate-900">{gauges.length}</span>
                                {defectiveGauges.length > 0 && (
                                    <Badge variant="destructive" className="h-5 px-1.5 text-[10px] bg-rose-100 text-rose-700 hover:bg-rose-100 border-none">
                                        {defectiveGauges.length} брак
                                    </Badge>
                                )}
                            </div>
                        </div>
                        <div className="w-px bg-slate-200" />
                        <div className="flex flex-col items-end">
                            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Замечания</div>
                            <div className="flex items-center gap-2">
                                <span className="text-2xl font-bold text-slate-900">{activeRemarks.length}</span>
                                {activeRemarks.length > 0 && (
                                    <Badge variant="destructive" className="h-5 px-1.5 text-[10px] bg-amber-100 text-amber-700 hover:bg-amber-100 border-none">
                                        Активны
                                    </Badge>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-2 bg-white">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <TabsList className="w-full justify-start h-auto p-1 bg-slate-50/50 rounded-xl">
                            <TabsTrigger value="overview" className="rounded-lg py-2.5 px-4 text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-blue-700">
                                <Activity className="w-4 h-4 mr-2" /> Обзор
                            </TabsTrigger>
                            <TabsTrigger value="gauges" className="rounded-lg py-2.5 px-4 text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-blue-700">
                                <GaugeIcon className="w-4 h-4 mr-2" /> Метрология ({gauges.length})
                            </TabsTrigger>
                            <TabsTrigger value="remarks" className="rounded-lg py-2.5 px-4 text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-blue-700">
                                <AlertTriangle className="w-4 h-4 mr-2" /> Замечания ({remarks.length})
                            </TabsTrigger>
                            <TabsTrigger value="history" className="rounded-lg py-2.5 px-4 text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-blue-700">
                                <HistoryIcon className="w-4 h-4 mr-2" /> История ({history.length})
                            </TabsTrigger>
                            <TabsTrigger value="checklists" className="rounded-lg py-2.5 px-4 text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-blue-700">
                                <ClipboardCheck className="w-4 h-4 mr-2" /> Чек-листы
                            </TabsTrigger>
                        </TabsList>

                        {/* OVERVIEW TAB */}
                        <TabsContent value="overview" className="p-4 md:p-6 pb-2 outline-none">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                <Card className="border-slate-100 shadow-sm">
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                                            <Wrench className="w-4 h-4 text-slate-400" />
                                            Статус ремонта
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-4">
                                            <div>
                                                <div className="text-xs text-slate-500 mb-1">Вид ремонта</div>
                                                <div className="font-medium text-slate-900">{locomotive.repair_type || '—'}</div>
                                            </div>
                                            <div>
                                                <div className="text-xs text-slate-500 mb-1">Плановый выпуск</div>
                                                <div className="font-medium text-slate-900">
                                                    {locomotive.planned_release ? new Date(locomotive.planned_release).toLocaleString('ru-RU', { dateStyle: 'long', timeStyle: 'short' }) : '—'}
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card className="border-slate-100 shadow-sm bg-gradient-to-br from-slate-50 to-white">
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                                            <Navigation className="w-4 h-4 text-slate-400" />
                                            Последнее действие
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        {isLoadingHistory ? (
                                            <Skeleton className="h-12 w-full" />
                                        ) : history.length > 0 ? (
                                            <div className="flex items-start gap-3">
                                                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                    <Activity className="w-4 h-4 text-blue-600" />
                                                </div>
                                                <div>
                                                    <div className="text-sm font-semibold text-slate-900">{history[0].action}</div>
                                                    <div className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                                                        <Calendar className="w-3 h-3" />
                                                        {new Date(history[0].moved_at).toLocaleString('ru-RU')}
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-sm text-slate-500">Нет истории перемещений</div>
                                        )}
                                    </CardContent>
                                </Card>

                                <Card className="border-slate-100 shadow-sm relative overflow-hidden">
                                    <div className={cn("absolute top-0 left-0 w-1 h-full", progressColorClass)} />
                                    <CardHeader className="pb-3 pl-6">
                                        <CardTitle className="text-base font-bold text-slate-800 flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Timer className="w-4 h-4 text-slate-400" />
                                                Плановое ТО (90 дн.)
                                            </div>
                                            <span className={cn("text-xs font-bold px-2 py-1 rounded-full",
                                                progressColorClass.replace('bg-', 'text-').replace('500', '700'),
                                                progressColorClass.replace('bg-', 'bg-').replace('500', '100')
                                            )}>
                                                {repairStatusText}
                                            </span>
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="pl-6">
                                        <div className="space-y-4">
                                            <div>
                                                <div className="flex justify-between text-xs mb-1.5">
                                                    <span className="text-slate-500">Прогресс цикла</span>
                                                    <span className="font-medium text-slate-700">{Math.round(repairProgress)}%</span>
                                                </div>
                                                <Progress value={repairProgress} className="h-2" indicatorClassName={progressColorClass} />
                                            </div>
                                            <div className="flex justify-between items-end mt-2">
                                                <div>
                                                    <div className="text-xs text-slate-500 mb-0.5">Дата ремонта</div>
                                                    <div className="font-medium text-slate-900">{repairDateText}</div>
                                                </div>
                                                {lastSession && !hasActiveSession && lastSession.end_date && (
                                                    <div className="text-[10px] text-slate-400 text-right">
                                                        Пред. {new Date(lastSession.end_date).toLocaleDateString('ru-RU')}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </TabsContent>

                        {/* GAUGES TAB */}
                        <TabsContent value="gauges" className="p-4 md:p-6 outline-none">
                            <div className="space-y-6">
                                <div>
                                    <h3 className="font-bold text-slate-800 mb-3 text-xs uppercase tracking-widest text-slate-400 px-1">Установленные манометры</h3>
                                    {isLoadingGauges ? (
                                        <div className="space-y-3">
                                            <Skeleton className="h-16 w-full rounded-xl" />
                                            <Skeleton className="h-16 w-full rounded-xl" />
                                        </div>
                                    ) : gauges.length === 0 ? (
                                        <div className="text-center py-12 text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                            <GaugeIcon className="w-8 h-8 mx-auto mb-3 opacity-20" />
                                            Манометры не установлены
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {gauges.map((gauge: any) => (
                                                <div key={gauge.id} className="p-4 border border-slate-200 rounded-xl bg-white shadow-sm flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs uppercase shadow-sm">
                                                            {gauge.installation_side || 'N/A'}
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-sm text-slate-900">{gauge.type?.name || 'Манометр'}</div>
                                                            <div className="text-xs text-slate-500 font-mono mt-0.5">S/N: {gauge.serial_number}</div>
                                                        </div>
                                                    </div>
                                                    <Badge variant={gauge.is_defective ? "destructive" : "outline"} className={cn("text-[10px]", gauge.is_defective ? "" : "bg-emerald-50 text-emerald-700 border-emerald-200")}>
                                                        {gauge.is_defective ? 'Брак' : 'Ок'}
                                                    </Badge>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="pt-2">
                                    <h3 className="font-bold text-slate-800 mb-3 text-xs uppercase tracking-widest text-slate-400 px-1">История изменений</h3>
                                    {isLoadingGaugeHistory ? (
                                        <div className="space-y-3">
                                            <Skeleton className="h-16 w-full rounded-xl" />
                                            <Skeleton className="h-16 w-full rounded-xl" />
                                        </div>
                                    ) : gaugeHistory.length === 0 ? (
                                        <div className="text-center py-8 text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                            <HistoryIcon className="w-6 h-6 mx-auto mb-2 opacity-20" />
                                            История отсутствует
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {gaugeHistory.map((item: any) => (
                                                <div key={item.id} className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <Badge variant="outline" className="text-[10px] bg-slate-50 uppercase tracking-widest">{item.action}</Badge>
                                                            <span className="text-xs font-mono text-slate-500 font-medium">S/N: {item.gauge?.serial_number || 'Неизвестен'}</span>
                                                        </div>
                                                        <div className="text-sm font-medium text-slate-900 mt-1">{item.details || item.action}</div>
                                                        <div className="text-xs flex items-center gap-1.5 text-slate-500 mt-2">
                                                            <div className="w-4 h-4 rounded-full bg-slate-100 flex items-center justify-center text-[8px] font-bold text-slate-600">
                                                                {(item.user?.full_name || item.user?.username || '?')[0]}
                                                            </div>
                                                            {item.user?.full_name || item.user?.username || 'Система'}
                                                        </div>
                                                    </div>
                                                    <div className="text-xs font-medium text-slate-400 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 self-start sm:self-auto tabular-nums">
                                                        {new Date(item.created_at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </TabsContent>

                        {/* REMARKS TAB */}
                        <TabsContent value="remarks" className="p-4 md:p-6 outline-none">
                            {isLoadingRemarks ? (
                                <div className="space-y-3">
                                    <Skeleton className="h-20 w-full rounded-xl" />
                                </div>
                            ) : remarks.length === 0 ? (
                                <div className="text-center py-12 text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                    <CheckCircle2 className="w-8 h-8 mx-auto mb-3 text-emerald-400 opacity-60" />
                                    Замечаний нет
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {/* Активные */}
                                    {activeRemarks.length > 0 && (
                                        <div>
                                            <h3 className="font-bold text-slate-800 mb-3 text-xs uppercase tracking-widest text-slate-400">В работе (Текущие)</h3>
                                            <div className="space-y-3">
                                                {activeRemarks.map(renderRemarkCard)}
                                            </div>
                                        </div>
                                    )}

                                    {/* Архив и Внеплановые */}
                                    {(() => {
                                        const allSessions = [...activeSessions, ...historySessions];
                                        const sessionsWithRemarks = allSessions.map(session => ({
                                            ...session,
                                            remarks: remarks.filter((r: any) => r.is_completed && r.session_id === session.id)
                                        })).filter(session => session.remarks.length > 0);

                                        const mappedSessionIds = new Set(allSessions.map(s => s.id));
                                        const unmappedCompletedRemarks = remarks.filter((r: any) =>
                                            r.is_completed && (!r.session_id || !mappedSessionIds.has(r.session_id))
                                        );

                                        return (
                                            <>
                                                {sessionsWithRemarks.length > 0 && (
                                                    <div className="pt-2">
                                                        <h3 className="font-bold text-slate-800 mb-3 text-xs uppercase tracking-widest text-slate-400">По ремонтам</h3>
                                                        <div className="w-full space-y-4">
                                                            {sessionsWithRemarks.map((session: any) => (
                                                                <Link
                                                                    key={session.id}
                                                                    to={`/history/session/${session.id}/remarks`}
                                                                    state={{ session }}
                                                                    className="block bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md hover:border-blue-300 transition-all cursor-pointer"
                                                                >
                                                                    <div className="flex items-center justify-between px-6 py-4">
                                                                        <div className="flex items-center gap-4">
                                                                            <div className="w-10 h-10 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-600">
                                                                                <Wrench className="w-5 h-5" />
                                                                            </div>
                                                                            <div>
                                                                                <div className="font-bold text-slate-900 text-base">{session.repair_type || session.type || 'Плановый ремонт'} <span className="text-slate-400 ml-1">{formatWO(session.id, locomotive.number)}</span></div>
                                                                                <div className="text-sm text-slate-500 font-medium mt-0.5">
                                                                                    {new Date(session.end_date || session.start_date || new Date()).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex items-center gap-3">
                                                                            <Badge variant="secondary" className="bg-slate-100 text-slate-700 font-medium px-3 py-1">
                                                                                Устранено {session.remarks.length} шт.
                                                                            </Badge>
                                                                        </div>
                                                                    </div>
                                                                </Link>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Внеплановые */}
                                                {unmappedCompletedRemarks.length > 0 && (
                                                    <div className="pt-4 mt-6 border-t border-slate-100">
                                                        <h3 className="font-bold text-slate-800 mb-3 text-xs uppercase tracking-widest text-slate-400">Прочие (Без привязки к ремонту)</h3>
                                                        <div className="space-y-3">
                                                            {unmappedCompletedRemarks.map(renderRemarkCard)}
                                                        </div>
                                                    </div>
                                                )}
                                            </>
                                        );
                                    })()}
                                </div>
                            )}
                        </TabsContent>

                        {/* HISTORY TAB */}
                        <TabsContent value="history" className="p-4 md:p-6 outline-none">
                            {isLoadingHistory ? (
                                <div className="space-y-6">
                                    <Skeleton className="h-10 w-full rounded-xl" />
                                    <Skeleton className="h-10 w-full rounded-xl" />
                                </div>
                            ) : history.length === 0 ? (
                                <div className="text-center py-12 text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                    <HistoryIcon className="w-8 h-8 mx-auto mb-3 opacity-20" />
                                    История пуста
                                </div>
                            ) : (
                                <div className="relative pl-6 space-y-8 before:absolute before:inset-0 before:ml-2 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
                                    {history.slice(0, 10).map((item: any) => (
                                        <div key={item.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                                            {/* Icon */}
                                            <div className="flex items-center justify-center w-6 h-6 rounded-full border-2 border-white bg-blue-100 text-blue-600 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 absolute left-[-26px] md:left-1/2">
                                                <div className="w-2 h-2 bg-blue-600 rounded-full" />
                                            </div>
                                            {/* Card */}
                                            <div className="w-[calc(100%-2rem)] md:w-[calc(50%-1.5rem)] bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                                <div className="flex items-center justify-between mb-1">
                                                    <div className="font-bold text-slate-900 text-sm">{item.action}</div>
                                                    <div className="text-[10px] text-slate-400 font-mono">{new Date(item.moved_at).toLocaleDateString('ru-RU')}</div>
                                                </div>
                                                <div className="text-xs text-slate-500">
                                                    Создал: {item.moved_by}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {history.length > 10 && (
                                        <div className="text-center pt-4">
                                            <span className="text-xs text-slate-400 font-medium bg-slate-100 px-3 py-1 rounded-full">Показаны последние 10 событий</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </TabsContent>

                        {/* CHECKLISTS TAB */}
                        <TabsContent value="checklists" className="p-0 sm:p-4 outline-none">
                            <div className="space-y-6">
                                {/* Текущий активный чек-лист */}
                                {activeSessions.length > 0 ? (
                                    <div>
                                        <h3 className="font-bold text-slate-800 mb-4 text-xs uppercase tracking-widest text-slate-400 px-4 sm:px-0 pt-4 sm:pt-0">Текущий в работе</h3>
                                        <div className="w-full space-y-4 px-4 sm:px-0">
                                            {activeSessions.map((session: any) => (
                                                <Link
                                                    key={session.id}
                                                    to={`/history/session/${session.id}/checklists`}
                                                    state={{ session }}
                                                    className="block bg-white border border-indigo-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md hover:border-indigo-400 transition-all cursor-pointer ring-1 ring-indigo-50"
                                                >
                                                    <div className="flex items-center justify-between px-6 py-4 bg-indigo-50/30">
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-10 h-10 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700 shadow-inner">
                                                                <ClipboardCheck className="w-5 h-5" />
                                                            </div>
                                                            <div>
                                                                <div className="font-bold text-slate-900 text-base">{session.repair_type || session.type || 'Текущий ремонт'} <span className="text-indigo-600 ml-1">{formatWO(session.id, locomotive.number)}</span></div>
                                                                <div className="text-sm text-slate-500 font-medium mt-0.5">
                                                                    Начат: {new Date(session.start_date || new Date()).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <Badge variant="default" className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-3 py-1 shadow-sm">
                                                                Перейти к чек-листу
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                </Link >
                                            ))}
                                        </div >
                                    </div >
                                ) : (
                                    <div>
                                        <h3 className="font-bold text-slate-800 mb-3 text-xs uppercase tracking-widest text-slate-400 px-4 sm:px-0 pt-4 sm:pt-0">Текущий в работе</h3>
                                        <div className="bg-white sm:rounded-xl sm:border border-slate-200 p-0 sm:p-4">
                                            <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
                                                <ClipboardCheck className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                                                <p className="text-slate-500 font-medium mb-4">В данный момент нет активных заездов</p>
                                                <Link to={`/locomotive/${locomotive.id}/checklist`} className="text-indigo-600 font-semibold hover:underline">
                                                    Перейти к общему чек-листу локомотива
                                                </Link>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Архивные чек-листы по сессиям */}
                                {
                                    historySessions.filter((s: any) => s.checklists && s.checklists.length > 0).length > 0 && (
                                        <div className="pt-6 border-t border-slate-100">
                                            <h3 className="font-bold text-slate-800 mb-4 text-xs uppercase tracking-widest text-slate-400 px-4 sm:px-0">Архив чек-листов</h3>
                                            <div className="w-full space-y-4 px-4 sm:px-0">
                                                {historySessions.filter((s: any) => s.checklists && s.checklists.length > 0).map((session: any) => (
                                                    <Link
                                                        key={session.id}
                                                        to={`/history/session/${session.id}/checklists`}
                                                        state={{ session }}
                                                        className="block bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md hover:border-blue-300 transition-all cursor-pointer"
                                                    >
                                                        <div className="flex items-center justify-between px-6 py-4">
                                                            <div className="flex items-center gap-4">
                                                                <div className="w-10 h-10 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-600">
                                                                    <ClipboardCheck className="w-5 h-5" />
                                                                </div>
                                                                <div>
                                                                    <div className="font-bold text-slate-900 text-base">{session.repair_type || session.type || 'Плановый ремонт'} <span className="text-slate-400 ml-1">{formatWO(session.id, locomotive.number)}</span></div>
                                                                    <div className="text-sm text-slate-500 font-medium mt-0.5">
                                                                        {new Date(session.end_date || session.start_date || new Date()).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-3">
                                                                <Badge variant="secondary" className="bg-slate-100 text-slate-700 font-medium px-3 py-1">
                                                                    {session.checklists.length} документ(ов)
                                                                </Badge>
                                                            </div>
                                                        </div>
                                                    </Link>
                                                ))}
                                            </div>
                                        </div>
                                    )
                                }
                            </div >
                        </TabsContent >
                    </Tabs >
                </div >
            </Card >
        </div >
    )
}
