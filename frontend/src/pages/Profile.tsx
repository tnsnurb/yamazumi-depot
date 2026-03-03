import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { UserCircle, Key, Shield } from "lucide-react"

interface User {
    id: number
    username: string
    full_name: string
    role: string
    avatar_url?: string
    pin_code?: string
    specialization?: string | null
    total_points?: number
}

export default function Profile() {
    const [user, setUser] = useState<User | null>(null)
    const [currentPassword, setCurrentPassword] = useState("")
    const [newPassword, setNewPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [loading, setLoading] = useState(false)
    const [uploadingAvatar, setUploadingAvatar] = useState(false)
    const [newPinCode, setNewPinCode] = useState("")
    const [loadingPin, setLoadingPin] = useState(false)

    useEffect(() => {
        fetch('/api/me').then(res => res.json()).then(data => {
            if (data.authenticated) setUser(data.user)
        })
    }, [])

    const handleChangePassword = async () => {
        if (!currentPassword || !newPassword) {
            toast.error("Заполните все поля")
            return
        }
        if (newPassword !== confirmPassword) {
            toast.error("Пароли не совпадают")
            return
        }
        if (newPassword.length < 4) {
            toast.error("Пароль минимум 4 символа")
            return
        }

        setLoading(true)
        try {
            const res = await fetch('/api/profile/password', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentPassword, newPassword })
            })
            const data = await res.json()
            if (res.ok) {
                toast.success("Пароль успешно изменён")
                setCurrentPassword("")
                setNewPassword("")
                setConfirmPassword("")
            } else {
                toast.error(data.error || "Ошибка смены пароля")
            }
        } catch (e) {
            toast.error("Ошибка сети")
        }
        setLoading(false)
    }

    const handleChangePinCode = async () => {
        if (newPinCode && newPinCode.length !== 4) {
            toast.error("Пин-код должен состоять из 4 цифр")
            return
        }
        if (newPinCode && !/^\d+$/.test(newPinCode)) {
            toast.error("Пин-код должен содержать только цифры")
            return
        }

        setLoadingPin(true)
        try {
            const res = await fetch('/api/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pin_code: newPinCode || null })
            })
            const data = await res.json()
            if (res.ok) {
                toast.success(newPinCode ? "Пин-код успешно сохранён" : "Пин-код удалён")
                if (user) {
                    setUser({ ...user, pin_code: data.user?.pin_code })
                }
                setNewPinCode("")
            } else {
                toast.error(data.error || "Ошибка сохранения пин-кода")
            }
        } catch (e) {
            toast.error("Ошибка сети")
        }
        setLoadingPin(false)
    }

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        if (file.size > 5 * 1024 * 1024) {
            toast.error("Файл слишком большой (макс 5MB)")
            return
        }

        setUploadingAvatar(true)
        const formData = new FormData()
        formData.append('avatar', file)

        try {
            const res = await fetch('/api/profile/avatar', {
                method: 'POST',
                body: formData
            })
            const data = await res.json()
            if (res.ok) {
                toast.success("Аватар успешно обновлен")
                if (user) {
                    setUser({ ...user, avatar_url: data.avatar_url })
                }
            } else {
                toast.error(data.error || "Ошибка загрузки")
            }
        } catch (error) {
            toast.error("Ошибка сети")
        } finally {
            setUploadingAvatar(false)
        }
    }

    return (
        <div className="flex-1 flex flex-col items-center overflow-auto bg-slate-50/50">
            <main className="flex-1 w-full p-4 md:p-8 flex flex-col items-center">
                <div className="w-full max-w-2xl space-y-6">
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900">Профиль</h2>

                    {/* User info */}
                    <Card>
                        <CardHeader className="flex flex-row items-center gap-4">
                            <div className="relative group cursor-pointer 
                                          w-16 h-16 rounded-full flex items-center justify-center shrink-0
                                          bg-indigo-100 hover:bg-indigo-200 transition-colors"
                            >
                                <Label htmlFor="avatar-upload" className="cursor-pointer">
                                    {user?.avatar_url ? (
                                        <img
                                            src={user.avatar_url}
                                            alt="Avatar"
                                            className="w-16 h-16 rounded-full object-cover"
                                        />
                                    ) : (
                                        <UserCircle className="w-8 h-8 text-indigo-600" />
                                    )}
                                    {/* Upload overlay */}
                                    <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                        <span className="text-white text-xs font-semibold">Изменить</span>
                                    </div>
                                    <Input
                                        id="avatar-upload"
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={handleAvatarUpload}
                                        disabled={uploadingAvatar}
                                    />
                                </Label>
                            </div>
                            <div>
                                <CardTitle className="text-xl">{user?.full_name || user?.username}</CardTitle>
                                <div className="flex flex-wrap gap-2 mt-1.5">
                                    <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 border-indigo-100 text-[10px] font-bold uppercase">
                                        <Shield className="w-3 h-3 mr-1" />
                                        {user?.role === 'admin' ? 'Администратор' : 'Сотрудник'}
                                    </Badge>
                                    {user?.specialization && (
                                        <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-100 text-[10px] font-bold uppercase">
                                            {user.specialization}
                                        </Badge>
                                    )}
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
                                <div className="flex flex-col gap-1">
                                    <span className="text-slate-500 text-xs">Логин</span>
                                    <span className="font-semibold text-slate-900">{user?.username}</span>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <span className="text-slate-500 text-xs">ФИО</span>
                                    <span className="font-semibold text-slate-900">{user?.full_name || '—'}</span>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <span className="text-slate-500 text-xs">Специализация</span>
                                    <span className="font-semibold text-indigo-600">{user?.specialization || 'Не указана'}</span>
                                </div>
                                <div className="flex flex-col gap-1 p-2 bg-indigo-50 rounded-lg border border-indigo-100">
                                    <span className="text-indigo-600 text-[10px] font-bold uppercase">Мои баллы</span>
                                    <span className="text-lg font-black text-indigo-700 leading-none">{user?.total_points || 0}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Change PIN Code */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Key className="w-5 h-5 text-indigo-500" />
                                Пин-код (для входа по бейджу)
                            </CardTitle>
                            <CardDescription>
                                4 цифры, которые запросит система после сканирования вашего штрих-кода.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Новый пин-код</Label>
                                <Input
                                    type="password"
                                    inputMode="numeric"
                                    maxLength={4}
                                    value={newPinCode}
                                    onChange={e => setNewPinCode(e.target.value.replace(/\D/g, ''))}
                                    placeholder="Например: 1234"
                                />
                                <p className="text-xs text-slate-500">Оставьте пустым, чтобы удалить текущий пин-код</p>
                            </div>
                            <Button onClick={handleChangePinCode} disabled={loadingPin} className="w-full bg-indigo-600 hover:bg-indigo-700">
                                {loadingPin ? 'Сохранение...' : 'Сохранить пин-код'}
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Change Password */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Key className="w-5 h-5 text-slate-400" />
                                Смена пароля
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Текущий пароль</Label>
                                <Input
                                    type="password"
                                    value={currentPassword}
                                    onChange={e => setCurrentPassword(e.target.value)}
                                    placeholder="••••••••"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Новый пароль</Label>
                                <Input
                                    type="password"
                                    value={newPassword}
                                    onChange={e => setNewPassword(e.target.value)}
                                    placeholder="••••••••"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Подтвердите новый пароль</Label>
                                <Input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={e => setConfirmPassword(e.target.value)}
                                    placeholder="••••••••"
                                />
                            </div>
                            <Button onClick={handleChangePassword} disabled={loading} className="w-full">
                                {loading ? 'Сохранение...' : 'Сменить пароль'}
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </main>
        </div>
    )
}
