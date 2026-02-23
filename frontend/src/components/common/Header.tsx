import { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { LogOut, Map as MapIcon, ClipboardList, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

interface User {
    id: number;
    username: string;
    full_name: string;
    role: string;
}

export function Header() {
    const navigate = useNavigate();
    const location = useLocation();
    const [user, setUser] = useState<User | null>(null);

    useEffect(() => {
        fetch('/api/me').then(res => res.json()).then(data => {
            if (data.authenticated) {
                setUser(data.user);
            } else {
                navigate('/');
            }
        });
    }, [navigate]);

    const handleLogout = async () => {
        try {
            await fetch('/api/logout', { method: 'POST' });
            navigate('/');
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <header className="flex h-16 items-center justify-between px-6 bg-slate-900 border-b border-slate-800 text-white shadow-sm">
            <div className="flex items-center gap-4">
                <h1 className="text-xl font-bold flex items-center gap-2">
                    🚂 Yamazumi Depot
                </h1>
            </div>

            <div className="flex items-center gap-4">
                <nav className="flex gap-2 mr-4">
                    <Button
                        variant={location.pathname === '/map' ? 'secondary' : 'ghost'}
                        className={location.pathname !== '/map' ? 'text-slate-300 hover:text-white hover:bg-slate-800' : ''}
                        asChild
                    >
                        <Link to="/map" className="flex items-center gap-2">
                            <MapIcon className="w-4 h-4" /> Карта
                        </Link>
                    </Button>
                    <Button
                        variant={location.pathname === '/journal' ? 'secondary' : 'ghost'}
                        className={location.pathname !== '/journal' ? 'text-slate-300 hover:text-white hover:bg-slate-800' : ''}
                        asChild
                    >
                        <Link to="/journal" className="flex items-center gap-2">
                            <ClipboardList className="w-4 h-4" /> Журнал
                        </Link>
                    </Button>
                    {user?.role === 'admin' && (
                        <Button
                            variant={location.pathname === '/admin' ? 'secondary' : 'ghost'}
                            className={location.pathname !== '/admin' ? 'text-slate-300 hover:text-white hover:bg-slate-800' : ''}
                            asChild
                        >
                            <Link to="/admin" className="flex items-center gap-2">
                                <Users className="w-4 h-4" /> Сотрудники
                            </Link>
                        </Button>
                    )}
                </nav>

                <div className="flex items-center gap-3 border-l border-slate-700 pl-4">
                    <div className="flex flex-col items-end">
                        <span className="text-sm font-medium text-slate-200">{user?.full_name || user?.username}</span>
                        <span className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">{user?.role === 'admin' ? 'Администратор' : 'Сотрудник'}</span>
                    </div>
                    <Button variant="ghost" size="icon" onClick={handleLogout} title="Выход" className="text-slate-300 hover:text-white hover:bg-slate-800 ml-2">
                        <LogOut className="w-4 h-4" />
                        <span className="sr-only">Выход</span>
                    </Button>
                </div>
            </div>
        </header>
    );
}
