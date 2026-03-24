import { useState, useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import { Eye, EyeOff, Loader2, Mail } from "lucide-react"
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
// removed unused cn import
// removed static import of html5-qrcode

const loginSchema = z.object({
    username: z.string().min(1, "Введите логин"),
    password: z.string().min(1, "Введите пароль"),
})

// removed PublicUser interface

export default function Login() {
    const queryClient = useQueryClient()
    const navigate = useNavigate()
    const [error, setError] = useState("")
    const [showPassword, setShowPassword] = useState(false)

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

    const handleMagicLink = async () => {
        const username = form.getValues("username")
        if (!username) {
            toast.error("Введите email")
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
            toast.error("Введите email")
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

    const form = useForm<z.infer<typeof loginSchema>>({
        resolver: zodResolver(loginSchema),
        defaultValues: { username: "", password: "" },
    })

    async function onSubmit(values: z.infer<typeof loginSchema>) {
        setError("")
        try {
            const email = values.username.includes('@')
                ? values.username
                : `${values.username}@yamazumi.id`

            console.log(`[DEBUG] Attempting login with email: ${email}`);

            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password: values.password
            })

            if (!error && data.user && data.session) {
                const loginRes = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        token: data.session.access_token,
                        user: data.user
                    })
                });
                const loginData = await loginRes.json();

                if (loginData.success && loginData.user) {
                    queryClient.setQueryData(['authUser'], loginData.user);
                }

                navigate("/active-locomotives")
            } else {
                setError(error?.message || "Ошибка авторизации")
            }
        } catch (err) {
            setError("Ошибка сети")
        }
    }

    return (
        <>
            <div className="min-h-screen flex">
                {/* Left side — login form */}
                <div className="w-full lg:w-1/2 bg-white flex flex-col items-center justify-center p-8 shadow-2xl z-10">
                    {isOAuthCallback ? (
                        <div className="flex flex-col items-center justify-center gap-4">
                            <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
                            <p className="text-slate-500 text-lg font-medium">Авторизация через Google...</p>
                        </div>
                    ) : (
                        <div className="w-full max-w-sm">

                            {/* Header */}
                            <div className="text-center mb-10">
                                <h1 className="text-4xl font-bold tracking-tight text-slate-900 mt-2">Yamazumi</h1>
                                <p className="text-slate-500 mt-2">Введите данные для входа в систему</p>
                            </div>

                            <Form {...form}>
                                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

                                    {/* Email field */}
                                    <FormField
                                        control={form.control}
                                        name="username"
                                        render={({ field }) => (
                                            <FormItem className="space-y-0">
                                                <FormControl>
                                                    <div className="relative">
                                                        <FloatingInput
                                                            label="Email или логин"
                                                            {...field}
                                                            className="pr-12 h-[56px] rounded-xl text-lg px-4"
                                                            error={!!form.formState.errors.username}
                                                        />
                                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                                                            <Mail className="w-5 h-5 text-slate-400" />
                                                        </div>
                                                    </div>
                                                </FormControl>
                                                <FormMessage className="mt-1" />
                                            </FormItem>
                                        )}
                                    />

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
                                                            className="pr-12 h-[56px] rounded-xl text-lg px-4"
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
                                                        className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
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
                                        disabled={form.formState.isSubmitting}
                                        className="w-full h-[56px] rounded-xl text-lg font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-all shadow-lg flex items-center justify-center gap-2"
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
                                            className="h-[48px] rounded-xl text-blue-600 border-blue-200 hover:bg-blue-50 hover:border-blue-300 transition-all flex items-center justify-center gap-2"
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
                                <div className="w-2 h-2 rounded-full bg-blue-400" />
                                Управление
                            </div>
                        </div>
                    </div>
                </div>
            </div>

        </>
    )
}
