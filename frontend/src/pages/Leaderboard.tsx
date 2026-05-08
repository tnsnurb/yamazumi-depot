import { useEffect, useState } from "react"
import { Trophy, Medal, Award, Star, ThumbsUp, User, Target, Crown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"

interface LeaderboardUser {
    id: number
    username: string
    full_name: string
    role: string
    specialization: string | null
    total_points: number
    avatar_url: string | null
    tasks_completed: number
    tasks_rejected: number
    accuracy: number
}

export default function Leaderboard() {
    const [users, setUsers] = useState<LeaderboardUser[]>([])
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        fetchLeaderboard()
    }, [])

    const fetchLeaderboard = async () => {
        setIsLoading(true)
        try {
            const res = await fetch('/api/users/leaderboard')
            if (res.ok) {
                const data = await res.json()
                setUsers(data)
            } else {
                const err = await res.json()
                toast.error(err.error || "Ошибка загрузки списка")
            }
        } catch (e) {
            toast.error("Сетевая ошибка при загрузке лидерборда")
        } finally {
            setIsLoading(false)
        }
    }

    const topThree = users.slice(0, 3)
    const restUsers = users.slice(3)

    return (
        <div className="flex-1 flex flex-col items-center overflow-auto bg-slate-50/50">
            <main className="flex-1 w-full max-w-5xl p-4 md:p-8 flex flex-col items-center">
                
                {/* Header */}
                <div className="text-center mb-10 w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <div className="inline-flex items-center justify-center p-3 sm:p-4 bg-amber-100 rounded-full mb-4">
                        <Trophy className="w-8 h-8 sm:w-10 sm:h-10 text-amber-600" />
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 mb-2">
                        Глобальный Рейтинг
                    </h1>
                    <p className="text-slate-500 max-w-xl mx-auto">
                        Лучшие бригадиры и механики по количеству баллов и качеству работы без брака.
                    </p>
                </div>

                {isLoading ? (
                    <div className="w-full space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {[1, 2, 3].map(i => <Skeleton key={i} className="h-48 w-full rounded-2xl" />)}
                        </div>
                        <div className="space-y-4">
                            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
                        </div>
                    </div>
                ) : (
                    <div className="w-full">
                        
                        {/* Podium for Top 3 */}
                        {topThree.length > 0 && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 items-end">
                                {/* 2nd Place */}
                                {topThree[1] && (
                                    <div className="order-2 md:order-1 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-150">
                                        <PodiumCard user={topThree[1]} rank={2} />
                                    </div>
                                )}
                                
                                {/* 1st Place */}
                                {topThree[0] && (
                                    <div className="order-1 md:order-2 animate-in fade-in slide-in-from-bottom-12 duration-700">
                                        <div className="-translate-y-4 md:-translate-y-8">
                                            <PodiumCard user={topThree[0]} rank={1} />
                                        </div>
                                    </div>
                                )}
                                
                                {/* 3rd Place */}
                                {topThree[2] && (
                                    <div className="order-3 md:order-3 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
                                        <PodiumCard user={topThree[2]} rank={3} />
                                    </div>
                                )}
                            </div>
                        )}

                        {/* List for the rest */}
                        {restUsers.length > 0 && (
                            <div className="w-full space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-500">
                                <h3 className="text-lg font-semibold text-slate-800 mb-4 px-2">Остальные участники</h3>
                                {restUsers.map((user, idx) => (
                                    <Card key={user.id} className="border-slate-100 hover:border-slate-200 hover:shadow-md transition-all duration-300">
                                        <CardContent className="p-4 sm:p-5 flex items-center gap-4 sm:gap-6">
                                            <div className="text-xl sm:text-2xl font-bold text-slate-300 min-w-8 text-center bg-slate-50 rounded-lg p-2">
                                                #{idx + 4}
                                            </div>
                                            
                                            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 text-slate-500 border border-slate-200">
                                                <User className="w-6 h-6" />
                                            </div>
                                            
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-bold text-slate-900 truncate">{user.full_name}</h4>
                                                <div className="flex flex-wrap gap-2 text-xs text-slate-500 mt-1">
                                                    <span>{user.role === 'admin' ? 'Админ' : user.role === 'controller' ? 'Мастер' : 'Слесарь'}</span>
                                                    {user.specialization && (
                                                        <>
                                                            <span className="hidden sm:inline">•</span>
                                                            <span className="truncate">{user.specialization}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Stats badges */}
                                            <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 sm:gap-4">
                                                <div className="text-right">
                                                    <div className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 justify-end">
                                                        <Star className="w-3.5 h-3.5 text-amber-500" />
                                                        {user.total_points} очков
                                                    </div>
                                                </div>
                                                
                                                <div className="hidden md:block w-px h-8 bg-slate-200"></div>

                                                <TooltipAccuracy accuracy={user.accuracy} rejected={user.tasks_rejected} completed={user.tasks_completed} />
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    )
}

function PodiumCard({ user, rank }: { user: LeaderboardUser, rank: 1 | 2 | 3 }) {
    const config = {
        1: { border: "border-amber-200", bg: "bg-gradient-to-b from-amber-50 to-white", badge: "bg-amber-100 text-amber-700", icon: <Crown className="w-8 h-8 text-amber-500 mb-1" /> },
        2: { border: "border-slate-300", bg: "bg-gradient-to-b from-slate-100 to-white", badge: "bg-slate-200 text-slate-700", icon: <Medal className="w-8 h-8 text-slate-400 mb-1" /> },
        3: { border: "border-orange-200", bg: "bg-gradient-to-b from-orange-50 to-white", badge: "bg-orange-100 text-orange-700", icon: <Award className="w-8 h-8 text-orange-400 mb-1" /> },
    }
    const c = config[rank]

    return (
        <Card className={cn("border-2 shadow-sm hover:shadow-lg transition-all duration-300 relative overflow-hidden group", c.border, c.bg)}>
            {rank === 1 && (
                <div className="absolute inset-0 bg-yellow-400/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
            <CardContent className="p-6 flex flex-col items-center text-center">
                
                {c.icon}
                
                <div className="relative mb-4">
                    <div className="w-20 h-20 rounded-full border-4 border-white shadow bg-slate-100 flex items-center justify-center">
                        <User className="w-10 h-10 text-slate-400" />
                    </div>
                    <div className={cn("absolute -bottom-3 -right-2 w-8 h-8 rounded-full border-2 border-white shadow-sm flex items-center justify-center font-bold text-sm", c.badge)}>
                        {rank}
                    </div>
                </div>

                <h3 className="font-bold text-lg text-slate-900 leading-tight mb-1">{user.full_name}</h3>
                <p className="text-xs text-slate-500 mb-4">{user.specialization || 'Специалист'}</p>

                <div className="w-full bg-slate-100 rounded-xl p-3 flex flex-col gap-1 items-center">
                    <div className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-1.5">
                        {user.total_points} <span className="text-sm font-semibold text-slate-500 tracking-normal">очков</span>
                    </div>
                    
                    <div className={cn(
                        "text-xs font-medium px-2 py-1 rounded-md w-full flex justify-between",
                        user.accuracy > 95 ? "bg-green-100 text-green-700" : "bg-slate-200 text-slate-600"
                    )}>
                        <span>Точность:</span>
                        <span>{user.accuracy}%</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

function TooltipAccuracy({ accuracy, rejected, completed }: { accuracy: number, rejected: number, completed: number }) {
    if (completed === 0) {
        return (
             <Badge variant="outline" className="bg-slate-50 text-slate-500 border-slate-200">
                Нет данных
            </Badge>
        )
    }

    const isPerfect = accuracy === 100
    const isGood = accuracy >= 90

    return (
        <Badge variant={isPerfect ? "default" : isGood ? "secondary" : "destructive"} 
               className={cn(
                   "gap-1",
                   isPerfect && "bg-green-100 text-green-700 hover:bg-green-200 border-transparent",
                   isGood && !isPerfect && "bg-blue-100 text-blue-700 hover:bg-blue-200 border-transparent"
               )}
               title={`Задач выполнено: ${completed}\nВозвратов: ${rejected}`}
        >
            {isPerfect ? <ThumbsUp className="w-3 h-3" /> : <Target className="w-3 h-3" />}
            {accuracy}% точность
        </Badge>
    )
}
