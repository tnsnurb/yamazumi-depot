import { useState, useEffect, useRef } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import { Eye, EyeOff, User, ChevronDown, Barcode, CheckCircle2, Camera, Loader2, Mail } from "lucide-react"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormMessage,
} from "@/components/ui/form"
import { FloatingInput } from "@/components/ui/FloatingInput"
import { cn } from "@/lib/utils"
// removed static import of html5-qrcode

const loginSchema = z.object({
    username: z.string().min(1, "Введите логин"),
    password: z.string().min(1, "Введите пароль"),
})

interface PublicUser {
    username: string;
    full_name: string;
    role_name: string;
    avatar_url?: string;
    email?: string;
}

export default function Login() {
    const queryClient = useQueryClient()
    const navigate = useNavigate()
    const [error, setError] = useState("")
    const [showPassword, setShowPassword] = useState(false)
    const [publicUsers, setPublicUsers] = useState<PublicUser[]>([])
    const [selectedUser, setSelectedUser] = useState<PublicUser | null>(null)
    const [isScanning, setIsScanning] = useState(false)
    const [dropdownOpen, setDropdownOpen] = useState(false)
    const [searchQuery, setSearchQuery] = useState("")
    const dropdownRef = useRef<HTMLDivElement>(null)
    const [isCameraOpen, setIsCameraOpen] = useState(false)
    const scannerRef = useRef<any>(null)
    const scannerContainerRef = useRef<HTMLDivElement>(null)
    // PIN dialog state
    const [scannedBarcode, setScannedBarcode] = useState<string | null>(null)
    const [scannedUser, setScannedUser] = useState<{ id: number; full_name: string; avatar_url?: string } | null>(null)
    const [pinCode, setPinCode] = useState(['', '', '', ''])
    const [pinError, setPinError] = useState('')
    const [isPinLoading, setIsPinLoading] = useState(false)
    const pinRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)]

    // Detect if we're returning from OAuth (Google Auth redirect)
    const [isOAuthCallback, setIsOAuthCallback] = useState(() => {
        const hash = window.location.hash
        return hash.includes('access_token') || hash.includes('refresh_token')
    })

    // Auto-clear OAuth loading if it takes too long (fallback)
    useEffect(() => {
        if (!isOAuthCallback) return
        const timeout = setTimeout(() => setIsOAuthCallback(false), 8000)
        return () => clearTimeout(timeout)
    }, [isOAuthCallback])

    // Barcode scanner
    useEffect(() => {
        let buffer = ""
        let lastKeyTime = Date.now()

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement && e.key === "Enter") return
            if (e.target instanceof HTMLInputElement && e.key !== "Enter") return

            const currentTime = Date.now()
            if (e.key === "Enter") {
                if (buffer.length > 2) handleBarcodeLogin(buffer)
                buffer = ""
                return
            }
            if (e.key.length === 1) {
                if (currentTime - lastKeyTime > 50) buffer = ""
                buffer += e.key
                lastKeyTime = currentTime
            }
        }

        window.addEventListener("keydown", handleKeyDown)
        return () => window.removeEventListener("keydown", handleKeyDown)
    }, [])

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setDropdownOpen(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    // Handle Supabase OAuth / Auth Errors from URL
    useEffect(() => {
        const hash = window.location.hash
        if (hash) {
            const params = new URLSearchParams(hash.replace('#', '?'))
            const errorType = params.get('error')
            const errorDescription = params.get('error_description')

            if (errorType) {
                console.error("Auth Error:", errorType, errorDescription)
                if (errorType === 'access_denied' || errorDescription?.includes('not registered')) {
                    toast.error("Доступ запрещен: ваш Email не зарегистрирован в системе. Обратитесь к администратору.", {
                        duration: 6000
                    })
                } else {
                    toast.error(errorDescription || "Ошибка авторизации")
                }
                // Clear the hash to avoid showing the toast twice on refresh
                window.history.replaceState(null, "", window.location.pathname)
            }
        }
    }, [])

    const handleBarcodeLogin = async (barcode: string) => {
        setIsScanning(true)
        try {
            const res = await fetch("/api/login/barcode", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ barcode }),
            })
            const data = await res.json()
            console.log("Barcode login response:", res.status, res.ok, data)
            if (res.ok && data.found) {
                // Show PIN dialog
                setScannedBarcode(barcode)
                setScannedUser(data.user)
                setPinCode(['', '', '', ''])
                setPinError('')
                setTimeout(() => pinRefs[0]?.current?.focus(), 100)
            } else {
                toast.error(data.error || "Код не распознан")
            }
        } catch {
            toast.error("Ошибка при сканировании")
        } finally {
            setIsScanning(false)
        }
    }

    const handlePinInput = (index: number, value: string) => {
        if (!/^\d*$/.test(value)) return
        const newPin = [...pinCode]
        newPin[index] = value.slice(-1)
        setPinCode(newPin)
        setPinError('')
        if (value && index < 3) {
            pinRefs[index + 1]?.current?.focus()
        }
        // Auto-submit when all 4 digits entered
        if (value && index === 3 && newPin.every(d => d !== '')) {
            handlePinSubmit(newPin.join(''))
        }
    }

    const handlePinKeyDown = (index: number, e: React.KeyboardEvent) => {
        if (e.key === 'Backspace' && !pinCode[index] && index > 0) {
            pinRefs[index - 1]?.current?.focus()
        }
    }

    const handlePinSubmit = async (pin?: string) => {
        const code = pin || pinCode.join('')
        if (code.length !== 4) {
            setPinError('Введите 4 цифры')
            return
        }
        setIsPinLoading(true)
        setPinError('')
        try {
            // Map barcode to dummy email
            const email = `${scannedBarcode}@yamazumi.id`
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password: code
            })

            if (!error && data.user && data.session) {
                // Explicitly sync session with backend
                const loginRes = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        token: data.session.access_token,
                        user: data.user
                    })
                });
                const loginData = await loginRes.json();

                // Immediately set auth data in cache so ProtectedRoute sees the user
                if (loginData.success && loginData.user) {
                    queryClient.setQueryData(['authUser'], loginData.user);
                }

                toast.success(`Добро пожаловать!`)

                setScannedBarcode(null)
                setScannedUser(null)
                navigate("/map")
            } else {
                setPinError(error?.message || 'Неверный пин-код')
                setPinCode(['', '', '', ''])
                pinRefs[0]?.current?.focus()
            }
        } catch (err) {
            setPinError('Ошибка сети')
        } finally {
            setIsPinLoading(false)
        }
    }

    const closePinDialog = () => {
        setScannedBarcode(null)
        setScannedUser(null)
        setPinCode(['', '', '', ''])
        setPinError('')
    }

    const handleMagicLink = async () => {
        const username = form.getValues("username")
        if (!username) {
            toast.error("Сначала выберите пользователя или введите email")
            return
        }

        const email = username.includes("@") ? username : `${username}@yamazumi.id`

        const { error } = await supabase.auth.signInWithOtp({
            email,
            options: {
                emailRedirectTo: window.location.origin + "/dashboard",
            },
        })

        if (error) {
            toast.error(error.message)
        } else {
            toast.success("Ссылка для входа отправлена на ваш Email!")
        }
    }

    const handleForgotPassword = async () => {
        const username = form.getValues("username")
        if (!username) {
            toast.error("Сначала выберите пользователя или введите email")
            return
        }

        const email = username.includes("@") ? username : `${username}@yamazumi.id`

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + "/profile",
        })

        if (error) {
            toast.error(error.message)
        } else {
            toast.success("Инструкции по сбросу пароля отправлены на ваш Email!")
        }
    }

    const handleGoogleLogin = async () => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin,
            }
        })
        if (error) toast.error(error.message)
    }

    // Camera scanner
    useEffect(() => {
        if (!isCameraOpen) return

        const scannerId = 'barcode-scanner-region'
        let stopped = false

        const startScanner = async () => {
            try {
                const { Html5Qrcode: QrCodeScanner } = await import("html5-qrcode")
                const html5QrCode = new QrCodeScanner(scannerId)
                scannerRef.current = html5QrCode
                await html5QrCode.start(
                    { facingMode: 'environment' },
                    {
                        fps: 10,
                        qrbox: { width: 250, height: 150 },
                    },
                    async (decodedText) => {
                        if (stopped) return
                        stopped = true
                        try {
                            await html5QrCode.stop()
                        } catch {
                            // ignore stop error
                        }
                        scannerRef.current = null
                        setIsCameraOpen(false)
                        handleBarcodeLogin(decodedText)
                    },
                    () => { }
                )
            } catch (err) {
                console.error('Camera error:', err)
                toast.error('Не удалось запустить камеру. Проверьте разрешения.')
                setIsCameraOpen(false)
            }
        }

        setTimeout(startScanner, 200)

        return () => {
            stopped = true
            const s = scannerRef.current
            scannerRef.current = null
            if (s) {
                s.stop().catch(() => {
                    // ignore
                })
            }
        }
    }, [isCameraOpen])

    const closeCameraScanner = () => {
        const s = scannerRef.current
        scannerRef.current = null
        if (s) {
            s.stop().catch(() => {
                // ignore
            })
        }
        setIsCameraOpen(false)
    }

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const res = await fetch("/api/public/users")
                if (res.ok) {
                    const data = await res.json()
                    setPublicUsers(data)
                }
            } catch (e) {
                console.error("Ошибка при получении пользователей", e)
            }
        }
        fetchUsers()
    }, [])

    const form = useForm<z.infer<typeof loginSchema>>({
        resolver: zodResolver(loginSchema),
        defaultValues: { username: "", password: "" },
    })

    useEffect(() => {
        if (selectedUser) {
            form.setValue("username", selectedUser.username)
        }
    }, [selectedUser, form])

    async function onSubmit(values: z.infer<typeof loginSchema>) {
        setError("")
        try {
            // Priority: selectedUser.email -> custom input with domain -> username@yamazumi.id
            const email = selectedUser?.email
                ? selectedUser.email
                : values.username.includes('@')
                    ? values.username
                    : `${values.username}@yamazumi.id`

            console.log(`[DEBUG] Attempting login with email: ${email}`);

            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password: values.password
            })

            if (!error && data.user && data.session) {
                // Explicitly sync session with backend
                const loginRes = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        token: data.session.access_token,
                        user: data.user
                    })
                });
                const loginData = await loginRes.json();

                // Immediately set auth data in cache so ProtectedRoute sees the user
                if (loginData.success && loginData.user) {
                    queryClient.setQueryData(['authUser'], loginData.user);
                }

                navigate("/map")
            } else {
                setError(error?.message || "Ошибка авторизации")
            }
        } catch (err) {
            setError("Ошибка сети")
        }
    }

    const filteredUsers = publicUsers.filter(u =>
        u.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.role_name.toLowerCase().includes(searchQuery.toLowerCase())
    )

    return (
        <>
            <div className="min-h-screen flex">
                {/* Left side — login form */}
                <div className="w-full lg:w-1/2 bg-white flex flex-col items-center justify-center p-8 shadow-2xl z-10">
                    {isOAuthCallback ? (
                        <div className="flex flex-col items-center justify-center gap-4">
                            <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
                            <p className="text-slate-500 text-lg font-medium">Авторизация через Google...</p>
                        </div>
                    ) : (
                        <div className="w-full max-w-sm">

                            {/* Header */}
                            <div className="text-center mb-8">
                                <h1 className="text-3xl font-bold text-slate-900 mt-2">Yamazumi</h1>
                                <div className="mt-4 flex items-center gap-3">
                                    <div className="inline-flex items-center gap-2 text-xs text-slate-400 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100">
                                        <Barcode className={`w-3.5 h-3.5 ${isScanning ? 'text-indigo-500 animate-pulse' : 'text-slate-400'}`} />
                                        <span>{isScanning ? 'Авторизация...' : 'USB-сканер активен'}</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setIsCameraOpen(true)}
                                        className="inline-flex items-center gap-2 text-xs text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-full border border-indigo-100 hover:bg-indigo-100 transition-colors cursor-pointer"
                                    >
                                        <Camera className="w-3.5 h-3.5" />
                                        <span>Камера</span>
                                    </button>
                                </div>
                            </div>

                            <Form {...form}>
                                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

                                    {/* User dropdown */}
                                    <div className="space-y-2">
                                        <div className="relative" ref={dropdownRef}>
                                            <button
                                                type="button"
                                                onClick={() => setDropdownOpen(!dropdownOpen)}
                                                className={`w-full flex items-center gap-3 px-4 py-3 h-[52px] rounded-xl border text-left transition-all relative group ${dropdownOpen
                                                    ? "border-indigo-500 ring-2 ring-indigo-500/20 bg-white"
                                                    : "border-slate-200 bg-white hover:border-slate-300"
                                                    }`}
                                            >
                                                {/* Floating Label for Dropdown */}
                                                <span className={cn(
                                                    "absolute left-3 transition-all duration-200 pointer-events-none bg-white px-2 z-10",
                                                    (selectedUser || dropdownOpen)
                                                        ? "-top-2.5 text-xs text-indigo-600 font-medium scale-90"
                                                        : "top-[14px] text-base text-slate-400 scale-100"
                                                )}>
                                                    Выберите пользователя
                                                </span>

                                                {selectedUser ? (
                                                    <>
                                                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0 overflow-hidden">
                                                            {selectedUser.avatar_url ? (
                                                                <img src={selectedUser.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                                                            ) : (
                                                                <User className="w-4 h-4 text-slate-500" />
                                                            )}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="font-medium text-slate-900 text-sm truncate">{selectedUser.full_name}</div>
                                                            <div className="text-xs text-slate-500 truncate">{selectedUser.role_name}</div>
                                                        </div>
                                                        <CheckCircle2 className="w-4 h-4 text-indigo-500 shrink-0" />
                                                    </>
                                                ) : (
                                                    <>
                                                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                                                            <User className="w-4 h-4 text-slate-400" />
                                                        </div>
                                                        <span className="text-transparent text-sm flex-1">Выберите пользователя...</span>
                                                        <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
                                                    </>
                                                )}
                                                {selectedUser && (
                                                    <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
                                                )}
                                            </button>

                                            {dropdownOpen && (
                                                <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
                                                    {/* Search */}
                                                    <div className="p-2 border-b border-slate-100">
                                                        <input
                                                            autoFocus
                                                            type="text"
                                                            placeholder="Поиск..."
                                                            value={searchQuery}
                                                            onChange={(e) => setSearchQuery(e.target.value)}
                                                            className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/30 transition-all placeholder-slate-400"
                                                        />
                                                    </div>

                                                    {/* User list */}
                                                    <div className="max-h-56 overflow-y-auto">
                                                        {filteredUsers.length > 0 ? (
                                                            filteredUsers.map((u) => (
                                                                <button
                                                                    key={u.username}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setSelectedUser(u)
                                                                        setDropdownOpen(false)
                                                                        setSearchQuery("")
                                                                    }}
                                                                    className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-indigo-50 transition-colors text-left ${selectedUser?.username === u.username ? "bg-indigo-50" : ""
                                                                        }`}
                                                                >
                                                                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0 overflow-hidden">
                                                                        {u.avatar_url ? (
                                                                            <img src={u.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                                                                        ) : (
                                                                            <User className="w-4 h-4 text-slate-500" />
                                                                        )}
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="font-medium text-slate-900 text-sm truncate">{u.full_name}</div>
                                                                        <div className="text-xs text-slate-500 truncate">{u.role_name}</div>
                                                                    </div>
                                                                    {selectedUser?.username === u.username && (
                                                                        <CheckCircle2 className="w-4 h-4 text-indigo-500 shrink-0" />
                                                                    )}
                                                                </button>
                                                            ))
                                                        ) : (
                                                            <div className="py-6 text-center text-sm text-slate-400">
                                                                {publicUsers.length === 0 ? "Загрузка..." : "Ничего не найдено"}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Password field */}
                                    <FormField
                                        control={form.control}
                                        name="password"
                                        render={({ field }) => (
                                            <FormItem className="space-y-0">
                                                <FormControl>
                                                    <div className="relative">
                                                        <FloatingInput
                                                            type={showPassword ? "text" : "password"}
                                                            label="Пароль"
                                                            {...field}
                                                            className="pr-12 h-[52px] rounded-xl text-lg px-4"
                                                            error={!!form.formState.errors.password}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    e.preventDefault();
                                                                    form.handleSubmit(onSubmit)();
                                                                }
                                                            }}
                                                        />
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            className="absolute right-2 top-0.5 h-[50px] px-3 text-slate-400 hover:text-slate-600 hover:bg-transparent z-20"
                                                            onClick={() => setShowPassword(!showPassword)}
                                                            tabIndex={-1}
                                                        >
                                                            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                                        </Button>
                                                    </div>
                                                </FormControl>
                                                <FormMessage className="mt-1" />
                                                <div className="flex justify-end">
                                                    <button
                                                        type="button"
                                                        onClick={handleForgotPassword}
                                                        className="text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
                                                    >
                                                        Забыли пароль?
                                                    </button>
                                                </div>
                                            </FormItem>
                                        )}
                                    />

                                    {error && (
                                        <div className="text-sm font-medium text-destructive bg-destructive/10 p-3 rounded-md border border-destructive/20 text-center">
                                            {error}
                                        </div>
                                    )}

                                    <Button
                                        type="submit"
                                        disabled={form.formState.isSubmitting || isScanning || !selectedUser}
                                        className="w-full h-[52px] rounded-xl text-lg font-bold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-lg flex items-center justify-center gap-2"
                                    >
                                        {form.formState.isSubmitting ? (
                                            <>
                                                <Loader2 className="h-5 w-5 animate-spin" />
                                                Вход...
                                            </>
                                        ) : "Войти"}
                                    </Button>

                                    <div className="relative py-2">
                                        <div className="absolute inset-0 flex items-center">
                                            <span className="w-full border-t border-slate-100"></span>
                                        </div>
                                        <div className="relative flex justify-center text-xs uppercase">
                                            <span className="bg-white px-2 text-slate-400">Или</span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={handleGoogleLogin}
                                            className="h-[48px] rounded-xl text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all flex items-center justify-center gap-2"
                                        >
                                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                            </svg>
                                            Google
                                        </Button>

                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={handleMagicLink}
                                            className="h-[48px] rounded-xl text-indigo-600 border-indigo-200 hover:bg-indigo-50 hover:border-indigo-300 transition-all flex items-center justify-center gap-2"
                                        >
                                            <Mail className="w-5 h-5" />
                                            Magic Link
                                        </Button>
                                    </div>
                                </form>
                            </Form>
                        </div>
                    )}
                </div>

                {/* Right side — locomotive background */}
                <div className="hidden lg:block flex-1 relative">
                    <div
                        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
                        style={{ backgroundImage: "url('/images/locomotive-bg.webp')" }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-l from-slate-900/40 via-transparent to-slate-900/20" />

                    <div className="absolute bottom-8 right-8 space-y-3">
                        <div className="flex gap-4 text-sm">
                            <div className="flex items-center gap-2 bg-white/15 backdrop-blur-md text-white px-3 py-2 rounded-lg border border-white/20">
                                <div className="w-2 h-2 rounded-full bg-green-400" />
                                Карта путей
                            </div>
                            <div className="flex items-center gap-2 bg-white/15 backdrop-blur-md text-white px-3 py-2 rounded-lg border border-white/20">
                                <div className="w-2 h-2 rounded-full bg-blue-400" />
                                Журнал
                            </div>
                            <div className="flex items-center gap-2 bg-white/15 backdrop-blur-md text-white px-3 py-2 rounded-lg border border-white/20">
                                <div className="w-2 h-2 rounded-full bg-indigo-400" />
                                Управление
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* PIN Code Dialog */}
            {scannedUser && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
                        <div className="p-6 text-center">
                            <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center mx-auto mb-4 overflow-hidden">
                                {scannedUser.avatar_url ? (
                                    <img src={scannedUser.avatar_url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <User className="w-8 h-8 text-indigo-600" />
                                )}
                            </div>
                            <h3 className="text-lg font-semibold text-slate-900">{scannedUser.full_name}</h3>
                            <p className="text-sm text-slate-500 mt-1">Введите пин-код</p>

                            <div className="flex justify-center gap-3 mt-6">
                                {pinCode.map((digit, i) => (
                                    <input
                                        key={i}
                                        ref={pinRefs[i]}
                                        type="password"
                                        inputMode="numeric"
                                        maxLength={1}
                                        value={digit}
                                        onChange={(e) => handlePinInput(i, e.target.value)}
                                        onKeyDown={(e) => handlePinKeyDown(i, e)}
                                        className="w-14 h-14 text-center text-2xl font-bold border-2 border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                                    />
                                ))}
                            </div>

                            {pinError && (
                                <p className="text-sm text-red-500 mt-3 font-medium">{pinError}</p>
                            )}

                            <div className="flex gap-3 mt-6">
                                <Button variant="outline" className="flex-1" onClick={closePinDialog} disabled={isPinLoading}>
                                    Отмена
                                </Button>
                                <Button
                                    className="flex-1 bg-indigo-600 hover:bg-indigo-700"
                                    onClick={() => handlePinSubmit()}
                                    disabled={isPinLoading || pinCode.some(d => d === '')}
                                >
                                    {isPinLoading ? 'Вход...' : 'Войти'}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Camera Scanner Modal */}
            {isCameraOpen && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="p-4 border-b flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Camera className="w-5 h-5 text-indigo-600" />
                                <h3 className="font-semibold text-slate-900">Сканирование штрих-кода</h3>
                            </div>
                            <button
                                onClick={closeCameraScanner}
                                className="text-slate-400 hover:text-slate-600 text-xl font-bold w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors"
                            >
                                ×
                            </button>
                        </div>
                        <div className="p-4">
                            <div id="barcode-scanner-region" ref={scannerContainerRef} className="w-full rounded-lg overflow-hidden" />
                            <p className="text-xs text-slate-400 text-center mt-3">Наведите камеру на штрих-код бейджа</p>
                        </div>
                        <div className="p-4 border-t">
                            <Button variant="outline" className="w-full" onClick={closeCameraScanner}>
                                Отмена
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
