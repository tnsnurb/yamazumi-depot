import { Link, useLocation } from "react-router-dom";
import { 
  Map as MapIcon, 
  ClipboardList, 
  Users, 
  QrCode, 
  History as JournalIcon, 
  Wrench, 
  ScanLine,
  AlertTriangle,
  CheckCircle2,
  ChevronUp,
  LogOut,
  User as UserIcon,
  Clock
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useState, useEffect } from "react";
import { QRScannerModal } from "./QRScanner";
import { motion, AnimatePresence } from "framer-motion";

export function MobileNav() {
    const location = useLocation();
    const { user, signOut } = useAuth();
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [recentGauges, setRecentGauges] = useState<any[]>([]);

    useEffect(() => {
        // Load recent gauges from localStorage
        const saved = localStorage.getItem('recent_gauges');
        if (saved) {
            try {
                setRecentGauges(JSON.parse(saved).slice(0, 3));
            } catch (e) {
                console.error("Failed to parse recent gauges", e);
            }
        }

        // Listen for new scans (custom event)
        const handleNewScan = (e: any) => {
            const newGauge = e.detail;
            setRecentGauges(prev => {
                const filtered = prev.filter(g => g.serial_number !== newGauge.serial_number);
                const updated = [newGauge, ...filtered].slice(0, 3);
                localStorage.setItem('recent_gauges', JSON.stringify(updated));
                return updated;
            });
        };

        window.addEventListener('gauge-scanned', handleNewScan);
        return () => window.removeEventListener('gauge-scanned', handleNewScan);
    }, []);
    
    // Core navigation items (5 tabs as requested)
    const navItems = [
        { path: '/map', label: 'Карта', icon: MapIcon, reqPerm: 'can_view_map' },
        { path: '/active-locomotives', label: 'Ремонты', icon: ClipboardList, reqPerm: 'can_view_journal' },
        { path: '/gauges/terminal', label: 'Терминал', icon: ScanLine, reqPerm: 'can_view_dashboard' },
        { path: '/remarks', label: 'Замечания', icon: AlertTriangle, reqPerm: 'can_view_journal' },
        { path: '/checklists', label: 'Чек-листы', icon: CheckCircle2, reqPerm: 'can_view_journal' },
    ];

    const filteredNavItems = navItems.filter(item =>
        user?.role === 'admin' || user?.permissions?.[item.reqPerm] !== false
    );

    const handleSignOut = async () => {
        try {
            await signOut();
            window.location.href = '/';
        } catch (error) {
            console.error("Sign out error", error);
        }
    };

    if (location.pathname === '/' || location.pathname.includes('/login')) return null;

    return (
        <>
            <AnimatePresence>
                {isMenuOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsMenuOpen(false)}
                            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 md:hidden"
                        />
                        
                        {/* Expanded Menu (Action Hub) */}
                        <motion.div
                            initial={{ y: "100%" }}
                            animate={{ y: 0 }}
                            exit={{ y: "100%" }}
                            transition={{ type: "spring", damping: 25, stiffness: 200 }}
                            className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 rounded-t-[3rem] z-50 p-8 pb-12 shadow-2xl border-t border-slate-100 dark:border-slate-800 md:hidden overflow-y-auto max-h-[90vh]"
                        >
                            <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mb-8 mx-auto" />
                            
                            {/* Profile Section */}
                            <div className="flex items-center gap-4 mb-8 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-800">
                                <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-200 dark:shadow-none">
                                    <UserIcon className="w-7 h-7" />
                                </div>
                                <div className="flex-1 overflow-hidden">
                                    <p className="font-semibold text-slate-800 dark:text-white leading-none mb-1 truncate">{user?.full_name}</p>
                                    <p className="text-xs text-slate-400 font-semibold uppercase tracking-widest">{user?.role === 'admin' ? 'Администратор' : 'Сотрудник'}</p>
                                </div>
                                <button 
                                    onClick={handleSignOut}
                                    className="p-3 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-2xl transition-colors"
                                >
                                    <LogOut className="w-6 h-6" />
                                </button>
                            </div>

                            {/* Recent Gauges */}
                            {recentGauges.length > 0 && (
                                <div className="mb-8">
                                    <div className="flex items-center gap-2 mb-4 px-1">
                                        <Clock className="w-4 h-4 text-blue-500" />
                                        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Недавние приборы</span>
                                    </div>
                                    <div className="space-y-2">
                                        {recentGauges.map((g, idx) => (
                                            <Link 
                                                key={idx}
                                                to={`/gauges/terminal`}
                                                state={{ serial: g.serial_number }}
                                                onClick={() => setIsMenuOpen(false)}
                                                className="flex items-center gap-4 p-4 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl active:bg-slate-50 transition-colors"
                                            >
                                                <div className="w-10 h-10 bg-slate-100 dark:bg-slate-700 rounded-xl flex items-center justify-center text-slate-500">
                                                    <Wrench className="w-5 h-5" />
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{g.serial_number}</p>
                                                    <p className="text-[10px] text-slate-400 font-semibold uppercase">{g.description || 'Прибор'}</p>
                                                </div>
                                                <ChevronUp className="w-4 h-4 text-slate-300 rotate-90" />
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4 mb-8">
                                <button 
                                    onClick={() => { setIsMenuOpen(false); setIsScannerOpen(true); }}
                                    className="flex flex-col items-center justify-center gap-3 p-6 bg-emerald-50 dark:bg-emerald-500/10 rounded-3xl border border-emerald-100 dark:border-emerald-500/20 text-emerald-600 active:scale-95 transition-all"
                                >
                                    <QrCode className="w-8 h-8" />
                                    <span className="text-sm font-semibold uppercase tracking-widest">Сканер</span>
                                </button>
                                <Link 
                                    to="/global-history" 
                                    onClick={() => setIsMenuOpen(false)}
                                    className="flex flex-col items-center justify-center gap-3 p-6 bg-blue-50 dark:bg-blue-500/10 rounded-3xl border border-blue-100 dark:border-blue-500/20 text-blue-600 active:scale-95 transition-all"
                                >
                                    <JournalIcon className="w-8 h-8" />
                                    <span className="text-sm font-semibold uppercase tracking-widest">История</span>
                                </Link>
                            </div>

                            {user?.role === 'admin' && (
                                <Link 
                                    to="/admin" 
                                    onClick={() => setIsMenuOpen(false)}
                                    className="flex items-center gap-4 p-5 bg-slate-900 dark:bg-blue-600 rounded-3xl text-white mb-4 active:scale-95 transition-all shadow-xl shadow-slate-200 dark:shadow-none"
                                >
                                    <Users className="w-6 h-6" />
                                    <span className="font-semibold uppercase tracking-widest text-sm flex-1">Админ Панель</span>
                                    <div className="w-2 h-2 rounded-full bg-blue-400 dark:bg-blue-200 shadow-[0_0_8px_rgba(96,165,250,0.8)]" />
                                </Link>
                            )}
                            
                            <p className="text-center text-[10px] text-slate-400 font-semibold uppercase tracking-[0.2em] mt-4">Yamazumi Depot v2.0</p>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Floating Nav Bar (Apple Style) */}
            <motion.nav 
                initial={false}
                animate={{ y: 0, opacity: 1 }}
                className="fixed bottom-6 left-4 right-4 h-20 bg-white/80 dark:bg-slate-900/90 backdrop-blur-2xl rounded-[2.5rem] border border-white/20 dark:border-slate-800 shadow-[0_20px_50px_rgba(0,0,0,0.15)] flex items-center justify-around px-2 md:hidden z-40 transition-all duration-300"
            >
                <div 
                    className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full pb-2 opacity-50 active:opacity-100 transition-opacity"
                    onClick={() => setIsMenuOpen(true)}
                >
                    <div className="w-12 h-1.5 bg-slate-400 rounded-full" />
                </div>

                {filteredNavItems.map((item) => {
                    const isActive = location.pathname === item.path;
                    const isCenter = item.path === '/gauges/terminal';
                    
                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`relative flex flex-col items-center justify-center gap-1 w-full h-full transition-all duration-300 ${
                                isActive ? "text-blue-600 scale-110" : "text-slate-400 active:text-slate-600"
                            }`}
                        >
                            {isCenter ? (
                                <div className={`p-3.5 rounded-2xl transition-all shadow-lg ${
                                    isActive ? 'bg-blue-600 text-white shadow-blue-200' : 'bg-slate-100 text-slate-500'
                                }`}>
                                    <item.icon className="w-6 h-6" />
                                </div>
                            ) : (
                                <>
                                    <item.icon className={`w-6 h-6 transition-all ${isActive ? 'scale-110' : ''}`} />
                                    <span className={`text-[9px] font-semibold uppercase tracking-tighter mt-1 transition-all ${
                                        isActive ? 'opacity-100' : 'opacity-0 h-0 scale-0'
                                    }`}>
                                        {item.label}
                                    </span>
                                </>
                            )}
                            {isActive && !isCenter && <div className="absolute bottom-1 w-1 h-1 rounded-full bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.8)]" />}
                        </Link>
                    );
                })}
            </motion.nav>
            <QRScannerModal isOpen={isScannerOpen} onClose={() => setIsScannerOpen(false)} />
        </>
    );
}

