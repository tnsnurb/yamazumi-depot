import { useEffect, useState } from "react"
import { Header } from "@/components/common/Header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { toast } from "sonner"
import { Plus, Search, Trash2, KeyRound, FileDown, BookOpen } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import * as XLSX from "xlsx"
import { useNavigate } from "react-router-dom"

interface User {
    id: number;
    username: string;
    full_name: string;
    role: string;
    created_at: string;
}

export default function Admin() {
    const navigate = useNavigate()
    const [users, setUsers] = useState<User[]>([])
    const [isAddOpen, setIsAddOpen] = useState(false)

    // Form state
    const [addUsername, setAddUsername] = useState("")
    const [addFullName, setAddFullName] = useState("")
    const [addPassword, setAddPassword] = useState("")
    const [addRole, setAddRole] = useState("employee")

    // Catalog State
    const [catalog, setCatalog] = useState<{ id: number, number: string }[]>([])
    const [isUploading, setIsUploading] = useState(false)

    // User search state
    const [search, setSearch] = useState("")

    useEffect(() => {
        // Check access first
        fetch('/api/me').then(r => r.json()).then(d => {
            if (!d.authenticated || d.user.role !== 'admin') {
                navigate('/map')
                toast.error('У вас нет доступа к этому разделу')
            } else {
                fetchUsers()
                fetchCatalog()
            }
        })
    }, [navigate])

    const fetchUsers = async () => {
        try {
            const res = await fetch("/api/users")
            if (res.ok) {
                setUsers(await res.json())
            }
        } catch (e) {
            toast.error("Ошибка загрузки списка сотрудников")
        }
    }

    const fetchCatalog = async () => {
        try {
            const res = await fetch('/api/catalog')
            if (res.ok) setCatalog(await res.json())
        } catch (e) {
            toast.error("Ошибка загрузки справочника номеров")
        }
    }

    const generatePassword = () => {
        const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*"
        let pass = ""
        for (let i = 0; i < 10; i++) {
            pass += chars.charAt(Math.floor(Math.random() * chars.length))
        }
        setAddPassword(pass)
    }

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!addUsername || !addPassword) return

        try {
            const res = await fetch("/api/users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    username: addUsername,
                    full_name: addFullName,
                    password: addPassword,
                    role: addRole
                })
            })

            const data = await res.json()
            if (res.ok) {
                toast.success(`Сотрудник ${data.username} успешно создан`)
                setIsAddOpen(false)
                setAddUsername("")
                setAddFullName("")
                setAddPassword("")
                fetchUsers()
            } else {
                toast.error(data.error)
            }
        } catch (e) {
            toast.error("Ошибка сети")
        }
    }

    const handleDeleteUser = async (id: number, username: string) => {
        if (username === 'admin') {
            toast.error('Главного администратора нельзя удалить')
            return
        }

        if (!confirm(`Удалить пользователя ${username}? Это действие необратимо.`)) return

        try {
            const res = await fetch(`/api/users/${id}`, { method: "DELETE" })
            if (res.ok) {
                toast.success(`Пользователь ${username} удалён`)
                fetchUsers()
            } else {
                const data = await res.json()
                toast.error(data.error)
            }
        } catch (e) {
            toast.error("Ошибка сети")
        }
    }

    // ==== Catalog Excel Upload ====
    const downloadTemplate = () => {
        const ws = XLSX.utils.json_to_sheet([
            { "Номер": "0001" },
            { "Номер": "0002" },
            { "Номер": "0064" }
        ]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Шаблон Каталога");
        XLSX.writeFile(wb, "Yamazumi_Catalog_Template.xlsx");
    }

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const arrayBuffer = evt.target?.result as ArrayBuffer;
                const uint8View = new Uint8Array(arrayBuffer);
                const wb = XLSX.read(uint8View, { type: 'array' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const parsedData = XLSX.utils.sheet_to_json(ws);

                // Map russian headers to API fields
                const mappedData = parsedData.map((row: any) => ({
                    number: String(row["Номер"] || row["number"] || "").trim()
                })).filter(r => r.number);

                if (mappedData.length === 0) {
                    toast.error("Файл пуст или не содержит колонку 'Номер'");
                    setIsUploading(false);
                    return;
                }

                // Send to bulk API
                const res = await fetch("/api/catalog/bulk", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(mappedData)
                });

                // Check if response is HTML (e.g., from server crash or size limit error)
                const contentType = res.headers.get("content-type");
                if (contentType && contentType.includes("application/json")) {
                    const result = await res.json();
                    if (res.ok) {
                        toast.success(`Успешно добавлено в каталог номеров: ${result.count}`);
                        fetchCatalog();
                    } else {
                        toast.error(result.error || "Ошибка массовой загрузки");
                    }
                } else {
                    const text = await res.text();
                    console.error("Non-JSON API response:", text);
                    toast.error(`Ошибка сервера: Отправлен СЛИШКОМ БОЛЬШОЙ файл или сервер недоступен (${res.status})`);
                }
            } catch (error: any) {
                console.error("Excel upload parse error:", error);
                toast.error(`Ошибка Excel: ${error?.message || String(error)}`);
            } finally {
                setIsUploading(false);
                e.target.value = '';
            }
        };
        reader.onerror = (error) => {
            console.error("FileReader error:", error);
            toast.error("Ошибка чтения файла");
            setIsUploading(false);
        };
        reader.readAsArrayBuffer(file);
    }

    // Filter Users
    const filteredUsers = users.filter(u =>
        u.username.toLowerCase().includes(search.toLowerCase()) ||
        u.full_name.toLowerCase().includes(search.toLowerCase())
    )

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            <Header />

            <main className="flex-1 p-6 flex flex-col items-center">
                <div className="w-full max-w-5xl space-y-6">
                    <div className="flex justify-between items-center">
                        <h1 className="text-2xl font-bold text-slate-900 border-b-2 border-indigo-500 pb-1 pr-4 inline-block">
                            Панель администратора
                        </h1>
                    </div>

                    <Tabs defaultValue="users" className="w-full">
                        <TabsList className="mb-4">
                            <TabsTrigger value="users" className="flex items-center gap-2">
                                <KeyRound className="w-4 h-4" />
                                Сотрудники
                            </TabsTrigger>
                            <TabsTrigger value="catalog" className="flex items-center gap-2">
                                <BookOpen className="w-4 h-4" />
                                Справочник номеров
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="users" className="space-y-4">
                            <div className="flex gap-4">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <Input
                                        placeholder="Поиск сотрудников..."
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        className="pl-9 bg-white"
                                    />
                                </div>
                                <Button onClick={() => setIsAddOpen(true)} className="bg-indigo-600 hover:bg-indigo-700">
                                    <Plus className="w-4 h-4 mr-2" />
                                    Добавить сотрудника
                                </Button>
                            </div>

                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-16 text-center">ID</TableHead>
                                            <TableHead>Логин</TableHead>
                                            <TableHead>ФИО</TableHead>
                                            <TableHead>Роль</TableHead>
                                            <TableHead>Дата регистрации</TableHead>
                                            <TableHead className="text-right">Действия</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredUsers.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                                                    Сотрудники не найдены
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            filteredUsers.map((u) => (
                                                <TableRow key={u.id}>
                                                    <TableCell className="text-center font-mono text-slate-500">{u.id}</TableCell>
                                                    <TableCell className="font-medium text-slate-900">{u.username}</TableCell>
                                                    <TableCell className="text-slate-600">{u.full_name || '—'}</TableCell>
                                                    <TableCell>
                                                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${u.role === 'admin' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                                                            {u.role === 'admin' ? 'Администратор' : 'Сотрудник'}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="text-slate-500 text-sm">
                                                        {new Date(u.created_at).toLocaleDateString('ru-RU')}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                                                            onClick={() => handleDeleteUser(u.id, u.username)}
                                                            title="Удалить"
                                                            disabled={u.username === 'admin'}
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </TabsContent>

                        <TabsContent value="catalog" className="space-y-6">
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                                <div className="flex items-center justify-between mb-6">
                                    <div>
                                        <h2 className="text-lg font-semibold text-slate-900">Массовая загрузка номеров</h2>
                                        <p className="text-sm text-slate-500">Загрузите Excel файл со списком номеров локомотивов</p>
                                    </div>
                                    <Button variant="outline" onClick={downloadTemplate} className="gap-2">
                                        <FileDown className="w-4 h-4" /> Скачать шаблон
                                    </Button>
                                </div>
                                <div className="flex items-center gap-4">
                                    <Input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} disabled={isUploading} className="flex-1" />
                                </div>
                                <div className="mt-8 border-t pt-6">
                                    <h3 className="text-md font-medium text-slate-900 mb-4">Текущий справочник ({catalog.length} записей)</h3>
                                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                                        {catalog.map(item => (
                                            <div key={item.number} className="bg-slate-50 border border-slate-200 rounded px-3 py-2 text-center text-sm font-medium text-slate-700">
                                                {item.number}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>
            </main>

            {/* Add Dialog */}
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Новый сотрудник</DialogTitle>
                        <DialogDescription>
                            Создайте учетную запись для нового сотрудника и выдайте ему пароль.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreateUser} className="space-y-4 pt-2">
                        <div className="space-y-2">
                            <Label>Логин (Username) *</Label>
                            <Input required value={addUsername} onChange={e => setAddUsername(e.target.value)} placeholder="ivanov_i" />
                        </div>

                        <div className="space-y-2">
                            <Label>ФИО</Label>
                            <Input value={addFullName} onChange={e => setAddFullName(e.target.value)} placeholder="Иванов Иван Иванович" />
                        </div>

                        <div className="space-y-2">
                            <Label>Роль</Label>
                            <Select value={addRole} onValueChange={setAddRole}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="employee">Сотрудник (Доступ только к карте/журналу)</SelectItem>
                                    <SelectItem value="admin">Администратор (Полный доступ)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Временный пароль *</Label>
                            <div className="flex gap-2">
                                <Input required value={addPassword} onChange={e => setAddPassword(e.target.value)} />
                                <Button type="button" variant="secondary" onClick={generatePassword} title="Сгенерировать">
                                    <KeyRound className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>

                        <DialogFooter className="pt-4">
                            <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>Отмена</Button>
                            <Button type="submit">Создать</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    )
}
