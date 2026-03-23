import { useLocation, useParams, useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { ChevronLeft, Wrench, Train, Calendar } from "lucide-react";
import { RemarkArchiveItem } from "@/components/locomotive/archive/RemarkArchiveItem";
import { ItemGroup } from "@/components/ui/item";
import { formatWO } from "@/lib/utils";

export default function HistorySessionRemarks() {
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
                            <div className="bg-indigo-600 p-2 rounded-xl shadow-indigo-100 shadow-lg">
                                <Wrench className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h1 className="text-lg font-black text-slate-900 tracking-tight leading-none">
                                    Замечания: {id ? formatWO(id, session.locomotive?.number) : ''}
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
                <div className="max-w-5xl mx-auto">
                    {session.remarks && session.remarks.length > 0 ? (
                        <ItemGroup className="flex flex-col gap-2">
                            {session.remarks.map((remark: any) => (
                                <RemarkArchiveItem key={remark.id} remark={remark} />
                            ))}
                        </ItemGroup>
                    ) : (
                        <div className="text-center p-12 bg-white rounded-2xl border border-dashed text-slate-400">
                            Замечаний для этой сессии не найдено
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
