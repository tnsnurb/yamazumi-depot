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
  Clock,
  LayoutDashboard
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useState, useEffect, useMemo } from "react";
import { QRScannerModal } from "./QRScanner";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * MobileNav Component (Material Design 3 Style)
 * 
 * Implements a modern M3 Navigation Bar for mobile devices.
 * Features:
 * - 80px constant height
 * - Pill-shaped active indicator (Primary Container style)
 * - Standard Easing motions
 * - Integrated Action Hub (Expanded Menu)
 */
export function MobileNav() {
    const location = useLocation();
    const { user, signOut } = useAuth();
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [recentGauges, setRecentGauges] = useState<any[]>([]);

    useEffect(() => {
        const saved = localStorage.getItem('recent_gauges');
        if (saved) {
            try {
                setRecentGauges(JSON.parse(saved).slice(0, 3));
            } catch (e) {
                console.error("Failed to parse recent gauges", e);
            }
        }

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
    
    // Core navigation items (M3 optimized)
    const navItems = useMemo(() => [
        { path: '/map', label: 'Карта', icon: MapIcon, reqPerm: 'can_view_map' },
        { path: '/active-locomotives', label: 'Ремонт', icon: ClipboardList, reqPerm: 'can_view_journal' },
        { path: '/gauges/terminal', label: 'Сканер', icon: ScanLine, reqPerm: 'can_view_dashboard' },
        { path: '/remarks', label: 'Замечания', icon: AlertTriangle, reqPerm: 'can_view_journal' },
        { path: '/checklists', label: 'Чек-листы', icon: CheckCircle2, reqPerm: 'can_view_journal' },
    ], []);

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
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsMenuOpen(false)}
                            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] md:hidden"
                        />
                        
                        <motion.div
                            initial={{ y: "100%" }}
                            animate={{ y: 0 }}
                            exit={{ y: "100%" }}
                            transition={{ type: "spring", damping: 30, stiffness: 300 }}
                            className="fixed bottom-0 left-0 right-0 bg-slate-50 dark:bg-slate-900 rounded-t-[2.5rem] z-[101] p-8 pb-12 shadow-2xl md:hidden overflow-y-auto max-h-[90vh] border-t border-slate-200/50 dark:border-slate-800"
                        >
                            <div className="w-8 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mb-8 mx-auto" />
                            
                            <div className="flex items-center gap-4 mb-8 p-5 bg-white dark:bg-slate-800 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-700">
                                <div className="w-14 h-14 bg-blue-600 rounded-3xl flex items-center justify-center text-white">
                                    <UserIcon className="w-7 h-7" />
                                </div>
                                <div className="flex-1 overflow-hidden">
                                    <p className="font-semibold text-slate-900 dark:text-white truncate">{user?.full_name}</p>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{user?.role === 'admin' ? 'Администратор' : 'Сотрудник'}</p>
                                </div>
                                <button 
                                    onClick={handleSignOut}
                                    className="p-3 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-2xl transition-colors"
                                >
                                    <LogOut className="w-6 h-6" />
                                </button>
                            </div>

                            {recentGauges.length > 0 && (
                                <div className="mb-8 pl-1">
                                    <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-4 flex items-center gap-2">
                                        <Clock className="w-3.5 h-3.5" /> Недавние приборы
                                    </h3>
                                    <div className="space-y-3">
                                        {recentGauges.map((g, idx) => (
                                            <Link 
                                                key={idx}
                                                to={`/gauges/terminal`}
                                                state={{ serial: g.serial_number }}
                                                onClick={() => setIsMenuOpen(false)}
                                                className="flex items-center gap-4 p-4 bg-white dark:bg-slate-800 rounded-[1.5rem] active:bg-slate-50 transition-colors shadow-sm border border-slate-100 dark:border-slate-700"
                                            >
                                                <div className="w-10 h-10 bg-slate-100 dark:bg-slate-700 rounded-xl flex items-center justify-center text-slate-500">
                                                    <Wrench className="w-5 h-5" />
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-200">{g.serial_number}</p>
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase">{g.description || 'Манометр'}</p>
                                                </div>
                                                <ChevronUp className="w-4 h-4 text-slate-300 rotate-90" />
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <QuickAction 
                                    icon={QrCode} 
                                    label="Сканер" 
                                    color="emerald" 
                                    onClick={() => { setIsMenuOpen(false); setIsScannerOpen(true); }} 
                                />
                                <QuickAction 
                                    icon={JournalIcon} 
                                    label="История" 
                                    color="blue" 
                                    to="/global-history"
                                    onClick={() => setIsMenuOpen(false)} 
                                />
                            </div>

                            {user?.role === 'admin' ? (
                                <Link 
                                    to="/admin" 
                                    onClick={() => setIsMenuOpen(false)}
                                    className="flex items-center gap-4 p-5 bg-slate-950 dark:bg-blue-600 rounded-[2rem] text-white shadow-xl shadow-slate-200 dark:shadow-none active:scale-[0.98] transition-all"
                                >
                                    <Users className="w-6 h-6" />
                                    <span className="font-bold uppercase tracking-widest text-sm flex-1">Панель администратора</span>
                                    <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                                </Link>
                            ) : (
                                <Link 
                                    to="/dashboard" 
                                    onClick={() => setIsMenuOpen(false)}
                                    className="flex items-center gap-4 p-5 bg-slate-950 dark:bg-slate-800 rounded-[2rem] text-white shadow-xl shadow-slate-200 dark:shadow-none active:scale-[0.98] transition-all"
                                >
                                    <LayoutDashboard className="w-6 h-6" />
                                    <span className="font-bold uppercase tracking-widest text-sm flex-1">Дашборд</span>
                                </Link>
                            )}
                            
                            <p className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em] mt-8">Yamazumi Depot v3.0</p>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* M3 Navigation Bar */}
            <nav className="fixed bottom-0 left-0 right-0 h-20 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-around px-2 md:hidden z-[90] safe-area-bottom">
                
                {/* Menu Trigger (Ghost Tab) */}
                <button 
                    onClick={() => setIsMenuOpen(true)}
                    className="absolute -top-3 left-1/2 -translate-x-1/2 bg-slate-200 dark:bg-slate-700 w-12 h-1 rounded-full opacity-50 active:opacity-100 transition-opacity"
                />

                {filteredNavItems.map((item) => {
                    const isActive = location.pathname === item.path;
                    
                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={cn(
                                "flex flex-col items-center justify-center gap-1 w-full h-full relative transition-colors",
                                isActive ? "text-slate-900 dark:text-blue-100" : "text-slate-500 dark:text-slate-500"
                            )}
                        >
                            {/* The Pill Indicator (Signature M3 Element) */}
                            <div className="relative h-8 w-16 mb-1">
                                <AnimatePresence initial={false}>
                                    {isActive && (
                                        <motion.div
                                            layoutId="m3-indicator"
                                            className="absolute inset-0 bg-blue-100 dark:bg-blue-800/60 rounded-full"
                                            initial={{ opacity: 0, scaleX: 0.5 }}
                                            animate={{ opacity: 1, scaleX: 1 }}
                                            exit={{ opacity: 0, scaleX: 0.5 }}
                                            transition={{ type: "spring", bounce: 0, duration: 0.4 }}
                                        />
                                    )}
                                </AnimatePresence>
                                <div className="relative h-full w-full flex items-center justify-center">
                                    <item.icon className={cn(
                                        "w-6 h-6 transition-all",
                                        isActive ? "stroke-[2.5px]" : "stroke-[2px]"
                                    )} />
                                </div>
                            </div>
                            
                            <span className={cn(
                                "text-xs font-semibold tracking-tight transition-all",
                                isActive ? "text-slate-900 dark:text-white" : "opacity-70"
                            )}>
                                {item.label}
                            </span>
                        </Link>
                    );
                })}
            </nav>
            <QRScannerModal isOpen={isScannerOpen} onClose={() => setIsScannerOpen(false)} />
        </>
    );
}

function QuickAction({ icon: Icon, label, color, onClick, to }: any) {
    const content = (
        <>
            <div className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center mb-1",
                color === 'emerald' ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20" : "bg-blue-100 text-blue-700 dark:bg-blue-500/20"
            )}>
                <Icon className="w-6 h-6" />
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider">{label}</span>
        </>
    );

    const className = cn(
        "flex flex-col items-center justify-center p-6 rounded-[2rem] border border-transparent transition-all active:scale-95 text-center",
        color === 'emerald' ? "bg-emerald-50 dark:bg-emerald-500/5 text-emerald-900 dark:text-emerald-100 border-emerald-100 dark:border-emerald-500/20" : "bg-blue-50 dark:bg-blue-500/5 text-blue-900 dark:text-blue-100 border-blue-100 dark:border-blue-500/20"
    );

    return to ? (
        <Link to={to} onClick={onClick} className={className}>{content}</Link>
    ) : (
        <button onClick={onClick} className={className}>{content}</button>
    );
}
