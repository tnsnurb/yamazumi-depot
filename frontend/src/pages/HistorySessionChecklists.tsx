import { useLocation, useParams, useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { ChevronLeft, ClipboardCheck, Train, Calendar } from "lucide-react";
import { LocomotiveChecklist } from "@/components/locomotive/LocomotiveChecklist";
import { formatWO } from "@/lib/utils";

export default function HistorySessionChecklists() {
    const { id } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const session = location.state?.session;

    if (!session) {
        return <div className="p-8 text-center text-slate-500 bg-slate-50 min-h-screen">Сессия не найдена</div>;
    }

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('ru-RU', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };

    return (
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-50/30">
            <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200/60 px-4 py-3 md:px-8">
                <div className="max-w-5xl mx-auto flex items-center justify-between">
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
                            <div className="bg-sky-600 p-2 rounded-xl shadow-sky-100 shadow-lg">
                                <ClipboardCheck className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h1 className="text-lg font-black text-slate-900 tracking-tight leading-none">
                                    Чек-листы: {id ? formatWO(id, session.locomotive?.number) : ''}
                                </h1>
                                <div className="flex items-center gap-2 mt-1.5 text-[10px] md:text-xs font-medium text-slate-400">
                                    <div className="flex items-center gap-1 text-blue-600">
                                        <Train className="w-3 h-3" />
                                        {session.locomotive?.series}-{session.locomotive?.number}
                                    </div>
                                    <span>•</span>
                                    <div className="flex items-center gap-1">
                                        <Calendar className="w-3 h-3" />
                                        {formatDate(session.start_date)} - {formatDate(session.end_date)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <main className="flex-1 overflow-auto p-4 md:p-8">
                <div className="max-w-5xl mx-auto space-y-6">
                    {session.checklists && session.checklists.length > 0 ? (
                        <div className="space-y-8">
                            {session.checklists.map((cl: any) => (
                                <div key={cl.id} className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden p-6 md:p-8">
                                    <LocomotiveChecklist instanceId={cl.id} readOnly={true} hideHeader={true} />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center p-12 bg-white rounded-2xl border border-dashed text-slate-400">
                            Чек-листы для этой сессии не найдены
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
