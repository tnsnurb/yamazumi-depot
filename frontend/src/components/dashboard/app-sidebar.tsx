"use client"

import {
    LayoutDashboard,
    Map as MapIcon,
    History,
    Settings,
    HelpCircle,
    User,
    LogOut,
    TrainFront,
    ShieldCheck,
    ListTodo
} from "lucide-react"

import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarRail,
} from "@/components/ui/sidebar"
import { useNavigate, useLocation } from "react-router-dom"
import { useAuth } from "../../hooks/useAuth"

const navMain = [
    {
        title: "Дашборд",
        url: "/dashboard",
        icon: LayoutDashboard,
    },
    {
        title: "Карта",
        url: "/map",
        icon: MapIcon,
    },
    {
        title: "Журнал",
        url: "/journal",
        icon: History,
    },
    {
        title: "Замечания",
        url: "/remarks",
        icon: ListTodo,
    },
]

const navSecondary = [
    {
        title: "Профиль",
        url: "/profile",
        icon: Settings,
    },
    {
        title: "Помощь",
        url: "#",
        icon: HelpCircle,
    },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
    const navigate = useNavigate()
    const location = useLocation()
    const { user, signOut } = useAuth()

    const isAdmin = user?.role === 'admin' || user?.role === 'global_admin'

    return (
        <Sidebar collapsible="icon" {...props}>
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
                            <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                                <TrainFront className="size-4" />
                            </div>
                            <div className="grid flex-1 text-left text-sm leading-tight">
                                <span className="truncate font-semibold">Yamazumi Depot</span>
                                <span className="truncate text-xs">Система управления</span>
                            </div>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>
            <SidebarContent>
                <SidebarMenu className="p-2">
                    {navMain.map((item) => (
                        <SidebarMenuItem key={item.title}>
                            <SidebarMenuButton
                                tooltip={item.title}
                                onClick={() => navigate(item.url)}
                                isActive={location.pathname === item.url}
                            >
                                {item.icon && <item.icon />}
                                <span>{item.title}</span>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    ))}

                    {isAdmin && (
                        <SidebarMenuItem>
                            <SidebarMenuButton
                                tooltip="Админ-панель"
                                onClick={() => navigate("/admin")}
                                isActive={location.pathname === "/admin"}
                            >
                                <ShieldCheck />
                                <span>Админ-панель</span>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    )}
                </SidebarMenu>

                <div className="mt-auto">
                    <SidebarMenu className="p-2 border-t">
                        {navSecondary.map((item) => (
                            <SidebarMenuItem key={item.title}>
                                <SidebarMenuButton tooltip={item.title} onClick={() => navigate(item.url)}>
                                    {item.icon && <item.icon />}
                                    <span>{item.title}</span>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        ))}
                    </SidebarMenu>
                </div>
            </SidebarContent>
            <SidebarFooter>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <div className="flex items-center gap-2 px-2 py-1.5">
                            <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-muted shrink-0">
                                <User className="size-4" />
                            </div>
                            <div className="grid flex-1 text-left text-sm leading-tight min-w-0 group-data-[collapsible=icon]:hidden">
                                <span className="truncate font-semibold">{user?.full_name || 'Пользователь'}</span>
                                <span className="truncate text-xs text-muted-foreground">{user?.role === 'admin' ? 'Администратор' : user?.role === 'global_admin' ? 'Супер-админ' : 'Слесарь'}</span>
                            </div>
                            <button
                                onClick={signOut}
                                title="Выход"
                                className="ml-auto size-8 flex items-center justify-center rounded-md cursor-pointer text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors group-data-[collapsible=icon]:hidden"
                            >
                                <LogOut className="size-4" />
                            </button>
                        </div>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>
            <SidebarRail />
        </Sidebar>
    )
}
