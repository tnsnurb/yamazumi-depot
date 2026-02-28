import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
    ArrowLeft,
    Play,
    Square,
    AlertTriangle,
    LayoutGrid,
    Clock,
    LogOut
} from 'lucide-react';

const KIOSK_THEME = {
    bg: 'bg-zinc-950',
    card: 'bg-zinc-900',
    accent: 'text-yellow-400',
    button: 'bg-zinc-800 hover:bg-zinc-700',
    success: 'bg-emerald-600 hover:bg-emerald-500',
    danger: 'bg-rose-600 hover:bg-rose-500',
    text: 'text-zinc-100'
};

type KioskStep = 'auth' | 'track' | 'loco' | 'remark' | 'active';

const Kiosk: React.FC = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState<KioskStep>('auth');
    const [pin, setPin] = useState('');
    const [user, setUser] = useState<any>(null);
    const [locomotives, setLocomotives] = useState<any[]>([]);
    const [remarks, setRemarks] = useState<any[]>([]);
    const [activeWork, setActiveWork] = useState<any>(null);

    const [selectedTrack, setSelectedTrack] = useState<number | null>(null);
    const [selectedLoco, setSelectedLoco] = useState<any>(null);

    // Sound effects
    const playSound = (type: 'success' | 'error' | 'click') => {
        try {
            const context = new (window.AudioContext || (window as any).webkitAudioContext)();
            const oscillator = context.createOscillator();
            const gain = context.createGain();

            oscillator.connect(gain);
            gain.connect(context.destination);

            if (type === 'success') {
                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(800, context.currentTime);
                oscillator.frequency.exponentialRampToValueAtTime(1200, context.currentTime + 0.1);
                gain.gain.setValueAtTime(0.1, context.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.2);
            } else if (type === 'error') {
                oscillator.type = 'square';
                oscillator.frequency.setValueAtTime(200, context.currentTime);
                gain.gain.setValueAtTime(0.1, context.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.3);
            } else {
                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(440, context.currentTime);
                gain.gain.setValueAtTime(0.05, context.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.05);
            }

            oscillator.start();
            oscillator.stop(context.currentTime + 0.3);
        } catch (e) {
            console.error('Audio fail', e);
        }
    };

    useEffect(() => {
        if (user) {
            fetchActiveWork();
        }
    }, [user]);

    const fetchActiveWork = async () => {
        try {
            const res = await fetch('/api/work-logs/active');
            if (res.ok) {
                const data = await res.json();
                if (data) {
                    setActiveWork(data);
                    setStep('active');
                } else {
                    setStep('track');
                }
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handlePinSubmit = async (digit?: string) => {
        const newPin = digit ? pin + digit : pin;
        if (digit) setPin(newPin);

        if (newPin.length === 4) {
            try {
                const kioskRes = await fetch(`/api/kiosk/verify-pin?pin=${newPin}`);

                if (kioskRes.ok) {
                    const userData = await kioskRes.json();
                    setUser(userData);
                    playSound('success');
                    setPin('');
                } else {
                    toast.error('Неверный PIN-код');
                    playSound('error');
                    setPin('');
                }
            } catch (e) {
                toast.error('Ошибка входа');
                playSound('error');
                setPin('');
            }
        }
    };

    const handleLogout = () => {
        setUser(null);
        setStep('auth');
        playSound('click');
    };

    const startWork = async (remarkId: string) => {
        try {
            const res = await fetch('/api/work-logs/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ remark_id: remarkId })
            });
            if (res.ok) {
                playSound('success');
                fetchActiveWork();
            } else {
                const err = await res.json();
                toast.error(err.error || 'Ошибка старта');
                playSound('error');
            }
        } catch (e) {
            toast.error('Ошибка сети');
        }
    };

    const stopWork = async () => {
        if (!activeWork) return;
        try {
            const res = await fetch('/api/work-logs/stop', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ log_id: activeWork.id })
            });
            if (res.ok) {
                playSound('success');
                setActiveWork(null);
                setStep('track');
            } else {
                toast.error('Ошибка завершения');
                playSound('error');
            }
        } catch (e) {
            toast.error('Ошибка сети');
        }
    };

    // Auth Screen
    if (step === 'auth') {
        return (
            <div className={`fixed inset-0 ${KIOSK_THEME.bg} ${KIOSK_THEME.text} flex flex-col items-center justify-center p-4 overflow-y-auto`}>
                <h1 className="text-2xl md:text-4xl font-black mb-6 md:mb-8 text-yellow-400 tracking-tighter uppercase text-center">
                    РЕЖИМ КИОСКА
                </h1>

                <div className="text-2xl mb-8 md:mb-12 flex gap-3 md:gap-4">
                    {[0, 1, 2, 3].map(i => (
                        <div key={i} className={`w-10 h-10 md:w-12 md:h-12 border-2 md:border-4 rounded-xl flex items-center justify-center transition-all ${pin.length > i ? 'border-yellow-400 bg-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.3)]' : 'border-zinc-800 bg-zinc-900'}`}>
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-3 gap-4 md:gap-6 max-w-sm w-full">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'C', 0, '←'].map((key, idx) => (
                        <button
                            key={`${key}-${idx}`}
                            onClick={() => {
                                if (key === 'C') setPin('');
                                else if (key === '←') setPin(pin.slice(0, -1));
                                else if (typeof key === 'number' && pin.length < 4) handlePinSubmit(key.toString());
                                playSound('click');
                            }}
                            className="aspect-square flex items-center justify-center text-3xl md:text-4xl font-bold rounded-2xl bg-zinc-900 hover:bg-zinc-800 active:scale-90 transition-all text-white border-2 border-zinc-800 shadow-lg active:bg-yellow-400 active:text-black active:border-yellow-400"
                        >
                            {key}
                        </button>
                    ))}
                </div>

                <button
                    onClick={() => navigate('/map')}
                    className="mt-10 md:mt-12 text-zinc-500 flex items-center gap-2 hover:text-zinc-300 transition-colors py-2 px-4"
                >
                    <ArrowLeft size={18} />
                    <span className="text-sm font-medium uppercase tracking-wider">Вернуться на карту</span>
                </button>
            </div>
        );
    }

    return (
        <div className={`fixed inset-0 ${KIOSK_THEME.bg} ${KIOSK_THEME.text} flex flex-col`}>
            {/* Header */}
            <header className="h-20 bg-zinc-900 border-b border-zinc-800 px-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-yellow-400 rounded-full flex items-center justify-center text-black font-bold">
                        {user?.full_name?.charAt(0) || 'U'}
                    </div>
                    <div>
                        <div className="font-bold text-xl uppercase">{user?.full_name}</div>
                        <div className="text-zinc-500 text-sm uppercase">{user?.role}</div>
                    </div>
                </div>
                <button onClick={handleLogout} className="p-4 rounded-xl bg-zinc-800 text-rose-400">
                    <LogOut size={28} />
                </button>
            </header>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto p-4 md:p-6 text-center">
                {step === 'active' && activeWork && (
                    <div className="max-w-4xl mx-auto flex flex-col h-full justify-center">
                        <div className="bg-zinc-900 border-2 md:border-4 border-emerald-500 rounded-2xl md:rounded-3xl p-6 md:p-10 text-center shadow-2xl">
                            <div className="flex justify-center mb-4 md:mb-6">
                                <div className="w-16 h-16 md:w-24 md:h-24 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center">
                                    <Clock size={40} className="animate-pulse md:hidden" />
                                    <Clock size={64} className="animate-pulse hidden md:block" />
                                </div>
                            </div>
                            <h2 className="text-2xl md:text-4xl font-bold mb-3 md:mb-4 uppercase">РАБОТА В ПРОЦЕССЕ</h2>
                            <div className="text-3xl md:text-5xl font-mono text-yellow-400 mb-6 md:mb-8 border-y md:border-y-2 border-zinc-800 py-4 md:py-6 text-center">
                                ЛОКОМОТИВ {activeWork.locomotive_remarks?.locomotives?.number}
                            </div>
                            <p className="text-lg md:text-2xl text-zinc-400 mb-8 md:mb-12 px-2">
                                Задача: <span className="text-white uppercase font-bold">{activeWork.locomotive_remarks?.text}</span>
                            </p>
                            <button
                                onClick={stopWork}
                                className={`w-full py-6 md:py-10 rounded-xl md:rounded-2xl text-2xl md:text-4xl font-black flex items-center justify-center gap-4 md:gap-6 ${KIOSK_THEME.danger} shadow-xl active:scale-95 transition-all outline-none uppercase tracking-tight`}
                            >
                                <Square size={32} className="md:hidden" fill="white" />
                                <Square size={48} className="hidden md:block" fill="white" />
                                ЗАВЕРШИТЬ РАБОТУ
                            </button>
                        </div>
                    </div>
                )}

                {step === 'track' && (
                    <div className="h-full flex flex-col">
                        <h2 className="text-xl md:text-3xl font-black mb-6 md:mb-8 flex items-center gap-3 md:gap-4 justify-center uppercase tracking-tight">
                            <LayoutGrid className="text-yellow-400 w-6 h-6 md:w-8 md:h-8" />
                            ВЫБЕРИТЕ ПУТЬ
                        </h2>
                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 max-w-5xl mx-auto w-full">
                            {[1, 2, 3, 4, 5, 6].map(t => (
                                <button
                                    key={t}
                                    onClick={async () => {
                                        setSelectedTrack(t);
                                        playSound('click');
                                        const res = await fetch(`/api/locomotives?track=${t}`);
                                        if (res.ok) setLocomotives(await res.json());
                                        setStep('loco');
                                    }}
                                    className="py-10 md:py-16 rounded-2xl md:rounded-3xl bg-zinc-900 border-2 border-zinc-800 text-4xl md:text-6xl font-black hover:border-yellow-400 hover:bg-zinc-800 active:scale-90 transition-all shadow-lg active:bg-yellow-400 active:text-black active:border-yellow-400"
                                >
                                    {t}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {step === 'loco' && (
                    <div className="h-full flex flex-col items-center">
                        <div className="flex items-center gap-3 md:gap-4 mb-6 md:mb-8 w-full max-w-4xl">
                            <button
                                onClick={() => { setStep('track'); playSound('click'); }}
                                className="p-3 md:p-4 rounded-xl md:rounded-2xl bg-zinc-800 active:scale-90 transition-transform"
                            >
                                <ArrowLeft className="w-6 h-6 md:w-8 md:h-8" />
                            </button>
                            <h2 className="text-xl md:text-3xl font-black uppercase flex-1 truncate">ПУТЬ {selectedTrack}</h2>
                        </div>
                        <div className="grid grid-cols-1 gap-4 md:gap-6 w-full max-w-4xl">
                            {locomotives.length === 0 ? (
                                <div className="text-center p-12 md:p-20 text-zinc-600 text-2xl md:text-3xl italic font-medium uppercase opacity-50">ПУТЬ ПУСТ</div>
                            ) : (
                                locomotives.map(l => (
                                    <button
                                        key={l.id}
                                        onClick={async () => {
                                            setSelectedLoco(l);
                                            playSound('click');
                                            const res = await fetch(`/api/locomotives/${l.id}/remarks?is_completed=false`);
                                            if (res.ok) setRemarks(await res.json());
                                            setStep('remark');
                                        }}
                                        className="p-6 md:p-10 rounded-2xl md:rounded-3xl bg-zinc-900 border-2 border-zinc-800 flex items-center justify-between hover:border-yellow-400 hover:bg-zinc-800 active:scale-95 transition-all shadow-lg text-left active:border-yellow-400"
                                    >
                                        <div className="flex flex-col">
                                            <span className="text-4xl md:text-6xl font-black tracking-tighter">{l.number}</span>
                                            <span className="text-xs md:hidden text-zinc-500 font-bold uppercase mt-1">{l.repair_type}</span>
                                        </div>
                                        <span className="px-4 py-1.5 md:px-6 md:py-2 rounded-full bg-yellow-400/10 text-yellow-400 text-sm md:text-2xl font-black uppercase tracking-tight">
                                            {({
                                                repair: 'Ремонт',
                                                waiting: 'Ожидание',
                                                active: 'Активен'
                                            } as any)[l.status] || l.status}
                                        </span>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {step === 'remark' && (
                    <div className="h-full flex flex-col items-center">
                        <div className="flex items-center gap-3 md:gap-4 mb-6 md:mb-8 w-full max-w-4xl">
                            <button
                                onClick={() => { setStep('loco'); playSound('click'); }}
                                className="p-3 md:p-4 rounded-xl md:rounded-2xl bg-zinc-800 active:scale-90 transition-transform"
                            >
                                <ArrowLeft className="w-6 h-6 md:w-8 md:h-8" />
                            </button>
                            <h2 className="text-xl md:text-3xl font-black uppercase flex-1 truncate">ЗАДАЧИ: {selectedLoco?.number}</h2>
                        </div>
                        <div className="flex flex-col gap-4 md:gap-6 w-full max-w-4xl pb-10">
                            {remarks.length === 0 ? (
                                <div className="bg-emerald-500/10 border-2 border-emerald-500/30 rounded-2xl md:rounded-3xl p-8 md:p-10 text-center text-emerald-500 text-xl md:text-3xl font-black uppercase tracking-tight shadow-[0_0_30px_rgba(16,185,129,0.1)]">
                                    НЕТ НЕИСПРАВНОСТЕЙ. <br />ВЫПУСКАЙТЕ!
                                </div>
                            ) : (
                                remarks.map(r => (
                                    <button
                                        key={r.id}
                                        onClick={() => {
                                            startWork(r.id);
                                            playSound('click');
                                        }}
                                        className="p-6 md:p-10 rounded-2xl md:rounded-3xl bg-zinc-900 border-2 border-zinc-800 text-left hover:border-emerald-500 active:scale-95 transition-all group shadow-lg active:border-emerald-500"
                                    >
                                        <div className="flex items-center gap-3 mb-3 md:mb-4">
                                            {r.priority === 'high' ? (
                                                <div className="px-3 py-1 md:px-4 md:py-2 rounded-lg bg-rose-600 text-white font-black text-sm md:text-xl uppercase tracking-tighter">Критично</div>
                                            ) : (
                                                <div className="px-3 py-1 md:px-4 md:py-2 rounded-lg bg-zinc-800 text-zinc-400 font-black text-sm md:text-xl uppercase tracking-tighter">{r.category || 'Ремонт'}</div>
                                            )}
                                        </div>
                                        <div className="text-xl md:text-3xl font-bold mb-4 md:mb-6 uppercase leading-tight">{r.text}</div>
                                        <div className="flex items-center gap-3 md:gap-4 text-emerald-500 text-lg md:text-2xl font-black xs:opacity-0 xs:group-hover:opacity-100 transition-opacity uppercase animate-pulse">
                                            <Play className="w-6 h-6 md:w-8 md:h-8" fill="currentColor" /> ПРИСТУПИТЬ
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </main>

            {/* Warning Footer */}
            {(step as string) !== 'auth' && (
                <footer className="h-24 bg-zinc-900 border-t border-zinc-800 px-6 flex items-center justify-center text-zinc-500 gap-4">
                    <AlertTriangle size={24} className="text-yellow-400/50" />
                    <span className="text-xl uppercase tracking-widest font-bold">ТЕРМИНАЛ ЦЕХА №1</span>
                </footer>
            )}
        </div>
    );
};

export default Kiosk;
