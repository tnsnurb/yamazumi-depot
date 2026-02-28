import { Link, useLocation } from "react-router-dom";
import { Map as MapIcon, ClipboardList, BarChart3, Users } from "lucide-react";
import { useEffect, useState } from "react";

interface User {
    id: number;
    username: string;
    role: string;
    permissions?: Record<string, boolean>;
}

export function MobileNav() {
    const location = useLocation();
    const [user, setUser] = useState<User | null>(null);

    useEffect(() => {
        fetch('/api/me').then(res => res.json()).then(data => {
            if (data.authenticated) setUser(data.user);
        });
    }, []);

    const navItems = [
        { path: '/map', label: 'Карта', icon: MapIcon, reqPerm: 'can_view_map' },
        { path: '/remarks', label: 'Замечания', icon: ClipboardList, reqPerm: 'can_view_journal' },
        { path: '/dashboard', label: 'Дашборд', icon: BarChart3, reqPerm: 'can_view_dashboard' },
    ];

    const filteredNavItems = navItems.filter(item =>
        user?.role === 'admin' || user?.permissions?.[item.reqPerm] !== false
    );

    return (
        <nav className="fixed bottom-0 left-0 right-0 h-16 bg-slate-900 border-t border-slate-800 flex items-center justify-around px-2 md:hidden z-50 pb-safe">
            {filteredNavItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                    <Link
                        key={item.path}
                        to={item.path}
                        className={`flex flex-col items-center justify-center gap-1 w-full h-full transition-colors ${isActive ? "text-indigo-400" : "text-slate-400 active:text-slate-200"
                            }`}
                    >
                        <item.icon className="w-5 h-5" />
                        <span className="text-[10px] font-medium leading-none">{item.label}</span>
                        {isActive && <div className="absolute bottom-1 w-1 h-1 rounded-full bg-indigo-400" />}
                    </Link>
                );
            })}
            {user?.role === 'admin' && (
                <Link
                    to="/admin"
                    className={`flex flex-col items-center justify-center gap-1 w-full h-full transition-colors ${location.pathname === "/admin" ? "text-indigo-400" : "text-slate-400 active:text-slate-200"
                        }`}
                >
                    <Users className="w-5 h-5" />
                    <span className="text-[10px] font-medium leading-none">Админ</span>
                    {location.pathname === "/admin" && <div className="absolute bottom-1 w-1 h-1 rounded-full bg-indigo-400" />}
                </Link>
            )}
        </nav>
    );
}
