import { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { LogOut, Map as MapIcon, ClipboardList, Users, BarChart3, UserCircle, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";

interface User {
    id: number;
    username: string;
    full_name: string;
    role: string;
    avatar_url?: string;
    is_global_admin?: boolean;
    active_location_id?: number | null;
    permissions?: Record<string, boolean>;
}

export function Header() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user: authUser } = useAuth();
    const [user, setUser] = useState<User | null>(null);
    const [locations, setLocations] = useState<{ id: number; name: string }[]>([]);
    const [activeLocation, setActiveLocation] = useState<string>("");

    useEffect(() => {
        if (authUser) {
            setUser(authUser as any);
            if (authUser.active_location_id) {
                setActiveLocation(String(authUser.active_location_id));
            } else if ((authUser as any).is_global_admin) {
                setActiveLocation("all");
            }

            if (authUser.role === 'admin' || (authUser as any).is_global_admin) {
                fetch('/api/locations').then(r => r.json()).then(setLocations);
            }
        }
    }, [authUser]);

    const handleLocationChange = async (val: string) => {
        setActiveLocation(val);
        await fetch('/api/me/active-location', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ location_id: val === 'all' ? null : parseInt(val) })
        });
        window.location.reload();
    };

    const handleLogout = async () => {
        try {
            await fetch('/api/logout', { method: 'POST' });
            navigate('/');
        } catch (e) {
            console.error(e);
        }
    };

    const navItems = [
        { path: '/dashboard', label: 'Дашборд', icon: BarChart3, reqPerm: 'can_view_dashboard' },
        { path: '/map', label: 'Карта', icon: MapIcon, reqPerm: 'can_view_map' },
        { path: '/journal', label: 'Журнал', icon: ClipboardList, reqPerm: 'can_view_journal' },
    ];

    const filteredNavItems = navItems.filter(item =>
        user?.role === 'admin' || user?.permissions?.[item.reqPerm] !== false
    );

    return (
        <header className="relative flex h-16 items-center justify-between px-4 md:px-6 bg-slate-900 border-b border-slate-800 text-white shadow-sm print:hidden z-50">
            <div className="flex items-center gap-2 md:gap-4">
                <h1 className="text-lg md:text-xl font-bold flex items-center gap-2 whitespace-nowrap">
                    <span className="hidden xs:inline">Yamazumi Depot</span>
                    <span className="xs:hidden">YD</span>
                </h1>

                {user?.role === 'admin' && locations.length > 0 && (
                    <div className="hidden md:flex ml-6 items-center gap-2 border-l border-slate-700 pl-6">
                        <Building2 className="w-4 h-4 text-slate-400" />
                        <span className="text-sm font-medium text-slate-400 mr-2">Депо:</span>
                        <Select value={activeLocation} onValueChange={handleLocationChange}>
                            <SelectTrigger className="w-[180px] lg:w-[200px] h-8 bg-slate-800 border-none text-slate-100">
                                <SelectValue placeholder="Депо" />
                            </SelectTrigger>
                            <SelectContent>
                                {user?.is_global_admin && (
                                    <SelectItem value="all" className="font-bold text-indigo-400">Вся сеть</SelectItem>
                                )}
                                {locations.map(loc => (
                                    <SelectItem key={loc.id} value={String(loc.id)}>{loc.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-4">
                <nav className="flex gap-1 mr-4">
                    {filteredNavItems.map(item => (
                        <Button
                            key={item.path}
                            variant={location.pathname === item.path ? 'secondary' : 'ghost'}
                            className={`h-9 ${location.pathname !== item.path ? 'text-slate-300 hover:text-white hover:bg-slate-800' : ''}`}
                            asChild
                        >
                            <Link to={item.path} className="flex items-center gap-2">
                                <item.icon className="w-4 h-4" /> {item.label}
                            </Link>
                        </Button>
                    ))}
                    {user?.role === 'admin' && (
                        <Button
                            variant={location.pathname === '/admin' ? 'secondary' : 'ghost'}
                            className={`h-9 ${location.pathname !== '/admin' ? 'text-slate-300 hover:text-white hover:bg-slate-800' : ''}`}
                            asChild
                        >
                            <Link to="/admin" className="flex items-center gap-2">
                                <Users className="w-4 h-4" /> Админ
                            </Link>
                        </Button>
                    )}
                </nav>

                <div className="flex items-center gap-3 border-l border-slate-700 pl-4">
                    <Button
                        variant={location.pathname === '/profile' ? 'secondary' : 'ghost'}
                        className={`h-9 px-3 ${location.pathname !== '/profile' ? 'text-slate-300 hover:text-white hover:bg-slate-800' : ''}`}
                        asChild
                    >
                        <Link to="/profile" className="flex items-center gap-3">
                            {user?.avatar_url ? (
                                <img src={user.avatar_url} alt="avatar" className="w-6 h-6 rounded-full object-cover" />
                            ) : (
                                <UserCircle className="w-5 h-5 text-slate-400" />
                            )}
                            <div className="flex flex-col items-start leading-none">
                                <span className="text-xs font-medium">{user?.full_name || user?.username}</span>
                                <span className="text-[9px] uppercase text-slate-500 font-bold tracking-wider mt-1">{user?.role === 'admin' ? 'Админ' : 'Сотрудник'}</span>
                            </div>
                        </Link>
                    </Button>
                    <Button variant="ghost" size="icon" onClick={handleLogout} title="Выход" className="text-slate-400 hover:text-red-400 hover:bg-red-400/10 h-9 w-9">
                        <LogOut className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            {/* Mobile View Profile Icons / Location Selector */}
            <div className="flex md:hidden items-center gap-3">
                {user?.role === 'admin' && (
                    <Select value={activeLocation} onValueChange={handleLocationChange}>
                        <SelectTrigger className="w-[110px] h-8 bg-slate-800 border-none text-slate-100 text-xs px-2">
                            <SelectValue placeholder="Депо" />
                        </SelectTrigger>
                        <SelectContent>
                            {user?.is_global_admin && <SelectItem value="all">Вся сеть</SelectItem>}
                            {locations.map(loc => <SelectItem key={loc.id} value={String(loc.id)}>{loc.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                )}
                <div className="flex items-center gap-3 border-l border-slate-700 pl-3">
                    <Link to="/profile" className="text-slate-300 hover:text-white transition-colors">
                        {user?.avatar_url ? (
                            <img src={user.avatar_url} alt="avatar" className="w-7 h-7 rounded-full object-cover border border-slate-700" />
                        ) : (
                            <UserCircle className="w-7 h-7" />
                        )}
                    </Link>
                    <Button variant="ghost" size="icon" onClick={handleLogout} className="text-slate-400 hover:text-red-400 h-8 w-8 p-0">
                        <LogOut className="w-4 h-4" />
                    </Button>
                </div>
            </div>
        </header>
    );
}
