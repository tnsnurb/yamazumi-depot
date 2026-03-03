import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Trash2, Plus, Edit, KeyRound, ShieldAlert, FileDown, Upload, BookOpen, Search, Wrench, Lock, ArrowDown, ArrowUp, Activity, Loader2, MapPin, Warehouse, ClipboardList } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import * as XLSX from 'xlsx'
import { Skeleton } from "@/components/ui/skeleton"

interface User {
    id: number
    username: string
    full_name: string
    role: string
    created_at: string
    barcode?: string
    is_active?: boolean
    location_id?: number | null
    specialization?: string | null
    total_points?: number
}

interface Role {
    id: number
    name: string
    description: string
    can_view_dashboard: boolean
    can_view_map: boolean
    can_view_journal: boolean
    can_move_locomotives: boolean
    can_edit_catalog: boolean
    can_manage_users: boolean
    can_complete_remarks: boolean
}

interface RepairType {
    id: number
    name: string
}

interface AuditLog {
    id: number
    action: string
    target: string
    details: string
    created_at: string
    user: { username: string, full_name: string, locations?: { name: string } }
}

interface RemarkTemplate {
    id: number
    text: string
    specialization: string
    priority: string
    category: string
    estimated_hours: number | null
    usage_count: number
}

const PERMISSIONS = [
    { key: 'can_view_map', label: 'Карта Депо', desc: 'Доступ к просмотру локомотивов на путях' },
    { key: 'can_view_journal', label: 'Просмотр Журнала', desc: 'Просмотр истории перемещений' },
    { key: 'can_view_dashboard', label: 'Просмотр Дашборда', desc: 'Доступ к дашборду и аналитике' },
    { key: 'can_move_locomotives', label: 'Управление Локомотивами', desc: 'Разрешено перемещать тепловозы' },
    { key: 'can_complete_remarks', label: 'Работа с Замечаниями', desc: 'Разрешено отмечать замечания как устраненные' },
    { key: 'can_edit_catalog', label: 'Справочник Локомотивов', desc: 'Управление записями в справочнике' },
    { key: 'can_manage_users', label: 'Управление Пользователями', desc: 'Настройка профилей, ролей и прав' },
] as const;

const SPECIALIZATIONS = [
    { value: "none", label: "Нет специализации" },
    { value: "Электрик", label: "Электрик" },
    { value: "Ходовик", label: "Ходовик" },
    { value: "Автоматчик", label: "Автоматчик" },
    { value: "Дизелист", label: "Дизелист" },
    { value: "Обтирщик", label: "Обтирщик" },
] as const;
export default function Admin() {
    const navigate = useNavigate()

    // Auth & Mount
    useEffect(() => {
        fetch('/api/me').then(r => r.json()).then(d => {
            if (!d.authenticated || d.user.role !== 'admin') {
                navigate('/map')
            } else {
                fetchAdminUser()
                fetchRoles()
                fetchUsers()
                fetchCatalog()
                fetchRepairTypes()
                fetchAuditLogs()
                fetchLocations()
                fetchRemarkTemplates()
            }
        })
    }, [navigate])

    // --- LOCATIONS STATE ---
    const [locations, setLocations] = useState<{ id: number, name: string, is_active?: boolean, track_count?: number, slot_count?: number, gate_position?: string, track_config?: string }[]>([])
    const [isAddLocationOpen, setIsAddLocationOpen] = useState(false)
    const [addLocationName, setAddLocationName] = useState("")
    const [addLocationTrackCount, setAddLocationTrackCount] = useState<number>(6)
    const [addLocationSlotCount, setAddLocationSlotCount] = useState<number>(6)
    const [addLocationGatePosition, setAddLocationGatePosition] = useState<string>("")
    const [addLocationTrackConfig, setAddLocationTrackConfig] = useState<string>("")


    const [isEditLocationOpen, setIsEditLocationOpen] = useState(false)
    const [editLocationData, setEditLocationData] = useState<{ id: number, name: string, is_active: boolean, track_count: number, slot_count: number } | null>(null)
    const [editLocationName, setEditLocationName] = useState("")
    const [editLocationIsActive, setEditLocationIsActive] = useState(true)
    const [editLocationTrackCount, setEditLocationTrackCount] = useState<number>(6)
    const [editLocationSlotCount, setEditLocationSlotCount] = useState<number>(6)
    const [editLocationGatePosition, setEditLocationGatePosition] = useState<string>("")
    const [editLocationTrackConfig, setEditLocationTrackConfig] = useState<string>("")


    const fetchLocations = async () => {
        const res = await fetch('/api/locations')
        if (res.ok) {
            const data = await res.json()
            const sanitized = data.map((l: any) => ({
                ...l,
                gate_position: (l.gate_position?.toString() || "").split(',').filter((s: string) => s !== '0' && s !== '').join(',')
            }))
            setLocations(sanitized)
        }
    }

    const handleCreateLocation = async (e: React.FormEvent) => {
        e.preventDefault()
        const res = await fetch('/api/locations', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
                name: addLocationName,
                track_count: addLocationTrackCount,
                slot_count: addLocationSlotCount,
                gate_position: addLocationGatePosition,
                track_config: addLocationTrackConfig
            })
        })
        if (res.ok) {
            toast.success('Депо создано')
            setIsAddLocationOpen(false)
            setAddLocationName("")
            setAddLocationTrackCount(6)
            setAddLocationSlotCount(6)
            setAddLocationGatePosition("")
            setAddLocationTrackConfig("")
            fetchLocations()
        } else {
            const err = await res.json()
            toast.error(err.error || 'Ошибка создания')
        }
    }

    const handleUpdateLocation = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!editLocationData) return
        const res = await fetch(`/api/locations/${editLocationData.id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
                name: editLocationName,
                is_active: editLocationIsActive,
                track_count: editLocationTrackCount,
                slot_count: editLocationSlotCount,
                gate_position: editLocationGatePosition,
                track_config: editLocationTrackConfig
            })
        })
        if (res.ok) {
            toast.success('Депо обновлено')
            setIsEditLocationOpen(false)
            fetchLocations()
        } else {
            const err = await res.json()
            toast.error(err.error || 'Ошибка обновления')
        }
    }

    // --- USERS STATE ---
    const [users, setUsers] = useState<User[]>([])
    const [isLoadingUsers, setIsLoadingUsers] = useState(true)
    const [isAddUserOpen, setIsAddUserOpen] = useState(false)
    const [isEditUserOpen, setIsEditUserOpen] = useState(false)
    const [editUserData, setEditUserData] = useState<User | null>(null)

    const [addUsername, setAddUsername] = useState("")
    const [addFullName, setAddFullName] = useState("")
    const [addPassword, setAddPassword] = useState("")
    const [addRole, setAddRole] = useState("employee")
    const [addBarcode, setAddBarcode] = useState("")
    const [addLocationId, setAddLocationId] = useState<string>("1")
    const [addSpecialization, setAddSpecialization] = useState("none")

    const [editUsername, setEditUsername] = useState("")
    const [editFullName, setEditFullName] = useState("")
    const [editRole, setEditRole] = useState("employee")
    const [editBarcode, setEditBarcode] = useState("")
    const [editIsActive, setEditIsActive] = useState(true)
    const [editPassword, setEditPassword] = useState("")
    const [editLocationId, setEditLocationId] = useState<string>("1")
    const [editSpecialization, setEditSpecialization] = useState("none")
    const [editPoints, setEditPoints] = useState<number>(0)

    const [adminUser, setAdminUser] = useState<any>(null)

    const fetchAdminUser = async () => {
        const res = await fetch('/api/me')
        if (res.ok) {
            const data = await res.json()
            setAdminUser(data.user)
            setAddLocationId(String(data.user.active_location_id || 1))
        }
    }

    const [usersSearch, setUsersSearch] = useState("")
    const [usersSortField, setUsersSortField] = useState<'username' | 'created_at' | 'full_name'>('username')
    const [usersSortDir, setUsersSortDir] = useState<'asc' | 'desc'>('asc')
    const [usersPage, setUsersPage] = useState(1)
    const USERS_PER_PAGE = 15

    // --- ROLES STATE ---
    const [roles, setRoles] = useState<Role[]>([])
    const [isAddRoleOpen, setIsAddRoleOpen] = useState(false)
    const [addRoleName, setAddRoleName] = useState("")
    const [addRoleDescription, setAddRoleDescription] = useState("")
    const [addRolePermissions, setAddRolePermissions] = useState({
        can_view_dashboard: false, can_view_map: true, can_view_journal: true,
        can_move_locomotives: false, can_edit_catalog: false, can_manage_users: false, can_complete_remarks: true
    })

    const [isEditRoleOpen, setIsEditRoleOpen] = useState(false)
    const [editRoleData, setEditRoleData] = useState<Role | null>(null)
    const [editRoleName, setEditRoleName] = useState("")
    const [editRoleDescription, setEditRoleDescription] = useState("")
    const [editRolePermissions, setEditRolePermissions] = useState({
        can_view_dashboard: false, can_view_map: true, can_view_journal: true,
        can_move_locomotives: false, can_edit_catalog: false, can_manage_users: false, can_complete_remarks: true
    })

    // --- CATALOG STATE ---
    const [catalog, setCatalog] = useState<{ id: number, number: string }[]>([])
    const [isLoadingCatalog, setIsLoadingCatalog] = useState(true)
    const [catalogSearch, setCatalogSearch] = useState("")
    const [catalogPage, setCatalogPage] = useState(1)
    const CATALOG_PER_PAGE = 20
    const [isUploading, setIsUploading] = useState(false)

    const [isAddLocoOpen, setIsAddLocoOpen] = useState(false)
    const [addLocoNumber, setAddLocoNumber] = useState("")

    const [isEditLocoOpen, setIsEditLocoOpen] = useState(false)
    const [editLocoId, setEditLocoId] = useState<number | null>(null)
    const [editLocoNumber, setEditLocoNumber] = useState("")

    // --- REPAIR TYPES STATE ---
    const [repairTypes, setRepairTypes] = useState<RepairType[]>([])
    const [isAddRepairTypeOpen, setIsAddRepairTypeOpen] = useState(false)
    const [addRepairTypeName, setAddRepairTypeName] = useState("")

    // --- AUDIT LOGS STATE ---
    const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
    const [auditLogsTotal, setAuditLogsTotal] = useState(0)
    const [isLoadingLogs, setIsLoadingLogs] = useState(true)
    const [logsPage, setLogsPage] = useState(1)
    const LOGS_PER_PAGE = 20

    // --- REMARK TEMPLATES STATE ---
    const [remarkTemplates, setRemarkTemplates] = useState<RemarkTemplate[]>([])
    const [isLoadingTemplates, setIsLoadingTemplates] = useState(true)
    const [templateSearch, setTemplateSearch] = useState("")

    const [isAddTemplateOpen, setIsAddTemplateOpen] = useState(false)
    const [addTemplateText, setAddTemplateText] = useState("")
    const [addTemplateSpecialization, setAddTemplateSpecialization] = useState("none")
    const [addTemplatePriority, setAddTemplatePriority] = useState("medium")
    const [addTemplateCategory, setAddTemplateCategory] = useState("")
    const [addTemplateHours, setAddTemplateHours] = useState("")

    const [isEditTemplateOpen, setIsEditTemplateOpen] = useState(false)
    const [editTemplateData, setEditTemplateData] = useState<RemarkTemplate | null>(null)
    const [editTemplateText, setEditTemplateText] = useState("")
    const [editTemplateSpecialization, setEditTemplateSpecialization] = useState("none")
    const [editTemplatePriority, setEditTemplatePriority] = useState("medium")
    const [editTemplateCategory, setEditTemplateCategory] = useState("")
    const [editTemplateHours, setEditTemplateHours] = useState("")

    // ================================= FETCHERS =================================

    const fetchUsers = async () => {
        setIsLoadingUsers(true)
        const res = await fetch('/api/users')
        if (res.ok) setUsers(await res.json())
        setIsLoadingUsers(false)
    }

    const fetchRoles = async () => {
        const res = await fetch('/api/roles')
        if (res.ok) setRoles(await res.json())
    }

    const fetchCatalog = async () => {
        setIsLoadingCatalog(true)
        const res = await fetch('/api/catalog')
        if (res.ok) setCatalog(await res.json())
        setIsLoadingCatalog(false)
    }

    const fetchRepairTypes = async () => {
        const res = await fetch('/api/repair-types')
        if (res.ok) setRepairTypes(await res.json())
    }

    const fetchAuditLogs = async (page = 1) => {
        setIsLoadingLogs(true)
        const offset = (page - 1) * LOGS_PER_PAGE
        const res = await fetch(`/api/audit-logs?limit=${LOGS_PER_PAGE}&offset=${offset}`)
        if (res.ok) {
            const data = await res.json()
            setAuditLogs(data.logs)
            setAuditLogsTotal(data.total)
        }
        setIsLoadingLogs(false)
    }

    useEffect(() => {
        fetchAuditLogs(logsPage)
    }, [logsPage])

    const fetchRemarkTemplates = async () => {
        setIsLoadingTemplates(true)
        const res = await fetch('/api/remark-templates')
        if (res.ok) setRemarkTemplates(await res.json())
        setIsLoadingTemplates(false)
    }

    const handleCreateTemplate = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            console.log("Creating template with:", { addTemplateText, addTemplateSpecialization, addTemplatePriority, addTemplateCategory, addTemplateHours });
            const res = await fetch('/api/remark-templates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: addTemplateText,
                    specialization: addTemplateSpecialization,
                    priority: addTemplatePriority,
                    category: addTemplateCategory,
                    estimated_hours: parseFloat(addTemplateHours) || null
                })
            })
            if (res.ok) {
                toast.success('Шаблон добавлен')
                setIsAddTemplateOpen(false)
                setAddTemplateText(""); setAddTemplateSpecialization("none"); setAddTemplatePriority("medium"); setAddTemplateCategory(""); setAddTemplateHours("")
                fetchRemarkTemplates()
            } else {
                const err = await res.json()
                toast.error(err.error || 'Ошибка добавления')
            }
        } catch (error: any) {
            console.error("Create template error:", error);
            toast.error(`Сетевая ошибка при добавлении: ${error.name} - ${error.message}`)
        }
    }

    const handleUpdateTemplate = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!editTemplateData) return
        try {
            console.log("Updating template with:", { editTemplateText, editTemplateSpecialization, editTemplatePriority, editTemplateCategory, editTemplateHours });
            const res = await fetch(`/api/remark-templates/${editTemplateData.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: editTemplateText,
                    specialization: editTemplateSpecialization,
                    priority: editTemplatePriority,
                    category: editTemplateCategory,
                    estimated_hours: parseFloat(editTemplateHours) || null
                })
            })
            if (res.ok) {
                toast.success('Шаблон обновлен')
                setIsEditTemplateOpen(false)
                fetchRemarkTemplates()
            } else {
                const err = await res.json()
                toast.error(err.error || 'Ошибка обновления')
            }
        } catch (error: any) {
            console.error("Update template error:", error);
            toast.error(`Сетевая ошибка при обновлении: ${error.name} - ${error.message}`)
        }
    }

    const handleDeleteTemplate = async (id: number, text: string) => {
        if (!confirm(`Удалить шаблон "${text}"?`)) return
        const res = await fetch(`/api/remark-templates/${id}`, { method: 'DELETE' })
        if (res.ok) {
            toast.success('Шаблон удален')
            fetchRemarkTemplates()
        } else {
            const err = await res.json()
            toast.error(err.error || 'Ошибка удаления')
        }
    }

    // ================================= USERS ACTIONS =================================

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault()
        const payload = {
            username: addUsername,
            full_name: addFullName,
            password: addPassword,
            role: addRole,
            barcode: addBarcode,
            location_id: parseInt(addLocationId) || 1,
            specialization: addSpecialization || null
        }
        const res = await fetch('/api/users', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        })
        if (res.ok) {
            toast.success('Пользователь создан')
            setIsAddUserOpen(false)
            fetchUsers()
            setAddUsername(""); setAddFullName(""); setAddPassword(""); setAddRole("employee"); setAddBarcode(""); setAddLocationId("1"); setAddSpecialization("")
        } else {
            const err = await res.json()
            toast.error(err.error || 'Ошибка создания')
        }
    }

    const openEditUserDialog = (u: User) => {
        setEditUserData(u)
        setEditUsername(u.username)
        setEditFullName(u.full_name || "")
        setEditRole(u.role)
        setEditBarcode(u.barcode || "")
        setEditIsActive(u.is_active !== false)
        setEditLocationId(u.location_id?.toString() || "1")
        setEditSpecialization(u.specialization || "")
        setEditPoints(u.total_points || 0)
        setEditPassword("")
        setIsEditUserOpen(true)
    }

    const handleUpdateUser = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!editUserData) return

        const payload: any = {
            username: editUsername,
            full_name: editFullName,
            role: editRole,
            barcode: editBarcode,
            is_active: editIsActive,
            location_id: parseInt(editLocationId) || 1,
            specialization: editSpecialization || null,
            total_points: editPoints
        }
        if (editPassword) payload.password = editPassword

        const res = await fetch(`/api/users/${editUserData.id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        })
        if (res.ok) {
            toast.success('Пользователь обновлен')
            setIsEditUserOpen(false)
            fetchUsers()
        } else {
            const err = await res.json()
            toast.error(err.error || 'Ошибка обновления')
        }
    }

    const handleDeleteUser = async (id: number, username: string) => {
        if (!confirm(`Вы действительно хотите заблокировать пользователя ${username}?`)) return
        const res = await fetch(`/api/users/${id}`, { method: 'DELETE' })
        if (res.ok) {
            toast.success('Пользователь заблокирован')
            fetchUsers()
        } else {
            const err = await res.json()
            toast.error(err.error || 'Ошибка блокировки')
        }
    }

    const exportUsersToExcel = () => {
        const ws = XLSX.utils.json_to_sheet(users.map(u => ({
            'ID': u.id,
            'Логин': u.username,
            'ФИО': u.full_name || '',
            'Роль': roles.find(r => r.name === u.role)?.description || u.role,
            'Штрих-код': u.barcode || '',
            'Дата регистрации': new Date(u.created_at).toLocaleDateString('ru-RU'),
            'Статус': u.is_active === false ? 'Заблокирован' : 'Активен'
        })))
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, "Сотрудники")
        XLSX.writeFile(wb, "Users_List.xlsx")
    }

    const generatePassword = () => {
        const pChars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*"
        let p = ""
        for (let i = 0; i < 10; i++) p += pChars.charAt(Math.floor(Math.random() * pChars.length))
        setAddPassword(p)
    }

    // --- Users Sorting & Pagination ---
    let processedUsers = [...users].filter(u =>
        u.username.toLowerCase().includes(usersSearch.toLowerCase()) ||
        (u.full_name || "").toLowerCase().includes(usersSearch.toLowerCase())
    )

    processedUsers.sort((a, b) => {
        let valA: any = a[usersSortField] || ""
        let valB: any = b[usersSortField] || ""
        if (usersSortField === 'created_at') {
            valA = new Date(valA as string).getTime()
            valB = new Date(valB as string).getTime()
        } else {
            valA = String(valA).toLowerCase()
            valB = String(valB).toLowerCase()
        }
        if (valA < valB) return usersSortDir === 'asc' ? -1 : 1
        if (valA > valB) return usersSortDir === 'asc' ? 1 : -1
        return 0
    })

    const totalUsersPages = Math.ceil(processedUsers.length / USERS_PER_PAGE) || 1
    const pagedUsers = processedUsers.slice((usersPage - 1) * USERS_PER_PAGE, usersPage * USERS_PER_PAGE)

    const toggleSort = (field: typeof usersSortField) => {
        if (usersSortField === field) setUsersSortDir(d => d === 'asc' ? 'desc' : 'asc')
        else { setUsersSortField(field); setUsersSortDir('asc') }
        setUsersPage(1)
    }

    // ================================= CATALOG ACTIONS =================================

    const handleAddLoco = async (e: React.FormEvent) => {
        e.preventDefault()
        const res = await fetch('/api/catalog/manual', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ number: addLocoNumber })
        })
        if (res.ok) {
            toast.success('Локомотив добавлен')
            setIsAddLocoOpen(false); setAddLocoNumber(""); fetchCatalog()
        } else {
            const err = await res.json()
            toast.error(err.error || 'Ошибка добавления')
        }
    }

    const handleEditLoco = async (e: React.FormEvent) => {
        e.preventDefault()
        const res = await fetch(`/api/catalog/${editLocoId}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ number: editLocoNumber })
        })
        if (res.ok) {
            toast.success('Локомотив обновлен')
            setIsEditLocoOpen(false); fetchCatalog()
        } else {
            const err = await res.json()
            toast.error(err.error || 'Ошибка обновления')
        }
    }

    const handleDeleteLoco = async (id: number, number: string) => {
        if (!confirm(`Удалить локомотив ${number} из каталога? Вы сможете добавить его заново.`)) return
        const res = await fetch(`/api/catalog/${id}`, { method: 'DELETE' })
        if (res.ok) {
            toast.success('Локомотив удален')
            fetchCatalog()
        } else {
            const err = await res.json()
            toast.error(err.error || 'Ошибка удаления')
        }
    }

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) return
        setIsUploading(true)
        const reader = new FileReader()
        reader.onload = async (e) => {
            try {
                const data = e.target?.result
                const workbook = XLSX.read(data, { type: 'binary' })
                const firstSheetName = workbook.SheetNames[0]
                const worksheet = workbook.Sheets[firstSheetName]
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })

                const numbers = jsonData
                    .slice(1) // skip header
                    .map((row: any) => row[0])
                    .filter((n: any) => n !== undefined && n !== null && String(n).trim() !== '')

                if (numbers.length === 0) throw new Error("Не найдено номеров в первой колонке")

                const response = await fetch('/api/catalog/bulk', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(numbers)
                })
                const result = await response.json()
                if (response.ok) {
                    toast.success(`Загружено ${result.count} уникальных локомотивов`)
                    fetchCatalog()
                } else throw new Error(result.error)
            } catch (err: any) {
                toast.error(err.message || "Ошибка при чтении файла")
            } finally {
                setIsUploading(false)
                event.target.value = ''
            }
        }
        reader.readAsBinaryString(file)
    }

    const downloadTemplate = () => {
        const ws = XLSX.utils.aoa_to_sheet([["Номер"], ["2345"], ["9876"]])
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, "Шаблон")
        XLSX.writeFile(wb, "Locomotives_Template.xlsx")
    }

    // --- Catalog Pagination ---
    let processedCatalog = [...catalog].filter(c => c.number.toLowerCase().includes(catalogSearch.toLowerCase()))
    const totalCatalogPages = Math.ceil(processedCatalog.length / CATALOG_PER_PAGE) || 1
    const pagedCatalog = processedCatalog.slice((catalogPage - 1) * CATALOG_PER_PAGE, catalogPage * CATALOG_PER_PAGE)

    // ================================= ROLES & REPAIR TYPES ACTIONS =================================
    const handleCreateRole = async (e: React.FormEvent) => {
        e.preventDefault()
        const payload = { name: addRoleName, description: addRoleDescription, ...addRolePermissions }
        const res = await fetch('/api/roles', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        if (res.ok) {
            toast.success('Роль добавлена')
            setIsAddRoleOpen(false); fetchRoles()
        } else {
            const err = await res.json()
            toast.error(err.error || 'Ошибка добавления')
        }
    }

    const handleEditRole = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!editRoleData) return
        const payload = { name: editRoleName, description: editRoleDescription, ...editRolePermissions }
        const res = await fetch(`/api/roles/${editRoleData.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        if (res.ok) {
            toast.success('Роль обновлена')
            setIsEditRoleOpen(false); fetchRoles()
        } else {
            const err = await res.json()
            toast.error(err.error || 'Ошибка обновления')
        }
    }

    const handleDeleteRole = async (id: number, name: string) => {
        if (!confirm(`Удалить роль ${name}?`)) return
        const res = await fetch(`/api/roles/${id}`, { method: 'DELETE' })
        if (res.ok) { toast.success('Роль удалена'); fetchRoles() }
        else { const err = await res.json(); toast.error(err.error || 'Ошибка удаления') }
    }

    const handleAddRepairType = async (e: React.FormEvent) => {
        e.preventDefault()
        const res = await fetch('/api/repair-types', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: addRepairTypeName }) })
        if (res.ok) { toast.success('Тип ремонта добавлен'); setIsAddRepairTypeOpen(false); setAddRepairTypeName(""); fetchRepairTypes() }
        else { const err = await res.json(); toast.error(err.error || 'Ошибка добавления') }
    }

    const handleDeleteRepairType = async (id: number, name: string) => {
        if (!confirm(`Удалить тип ремонта ${name}?`)) return
        const res = await fetch(`/api/repair-types/${id}`, { method: 'DELETE' })
        if (res.ok) { toast.success('Тип ремонта удален'); fetchRepairTypes() }
        else { const err = await res.json(); toast.error(err.error || 'Ошибка удаления') }
    }

    return (
        <div className="flex-1 flex flex-col items-center overflow-auto bg-slate-50/50">
            <main className="flex-1 w-full p-3 md:p-6 flex flex-col items-center">
                <div className="w-full max-w-6xl space-y-4 md:space-y-6">
                    <div className="flex justify-between items-center">
                        <h1 className="text-xl md:text-2xl font-bold text-slate-900 border-b-2 border-indigo-500 pb-1 pr-4 inline-block">
                            Панель администратора
                        </h1>
                    </div>

                    <Tabs defaultValue="users" className="w-full">
                        <div className="overflow-x-auto pb-2 scrollbar-none">
                            <TabsList className="mb-2 w-max min-w-full justify-start md:w-full md:justify-center">
                                <TabsTrigger value="users" className="flex items-center gap-2"><KeyRound className="w-4 h-4" /> <span className="hidden sm:inline">Сотрудники</span><span className="sm:hidden">Люди</span></TabsTrigger>
                                <TabsTrigger value="remarkTemplates" className="flex items-center gap-2"><ClipboardList className="w-4 h-4" /> <span className="hidden sm:inline">Шаблоны замечаний</span><span className="sm:hidden">Шаблоны</span></TabsTrigger>
                                <TabsTrigger value="roles" className="flex items-center gap-2"><ShieldAlert className="w-4 h-4" /> <span className="hidden sm:inline">Роли</span><span className="sm:hidden">Роли</span></TabsTrigger>
                                <TabsTrigger value="catalog" className="flex items-center gap-2"><BookOpen className="w-4 h-4" /> <span className="hidden sm:inline">Справочник номеров</span><span className="sm:hidden">Номера</span></TabsTrigger>
                                <TabsTrigger value="repairTypes" className="flex items-center gap-2"><Wrench className="w-4 h-4" /> <span className="hidden sm:inline">Типы ремонта</span><span className="sm:hidden">Ремонт</span></TabsTrigger>
                                <TabsTrigger value="locations" className="flex items-center gap-2"><MapPin className="w-4 h-4" /> <span className="hidden sm:inline">Депо</span><span className="sm:hidden">Депо</span></TabsTrigger>
                                <TabsTrigger value="audit" className="flex items-center gap-2"><Activity className="w-4 h-4" /> <span className="hidden sm:inline">Журнал действий</span><span className="sm:hidden">Логи</span></TabsTrigger>
                            </TabsList>
                        </div>

                        {/* USERS TAB */}
                        <TabsContent value="users" className="space-y-4 outline-none">
                            <div className="flex flex-col sm:flex-row gap-3">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <Input placeholder="Поиск по логину или ФИО..." value={usersSearch} onChange={(e) => { setUsersSearch(e.target.value); setUsersPage(1); }} className="pl-9 bg-white h-9" />
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="outline" onClick={exportUsersToExcel} className="gap-2 h-9 flex-1 sm:flex-none">
                                        <FileDown className="w-4 h-4" /> <span className="hidden xs:inline">Экспорт</span>
                                    </Button>
                                    <Button onClick={() => setIsAddUserOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 h-9 gap-2 flex-1 sm:flex-none">
                                        <Plus className="w-4 h-4" /> <span className="hidden xs:inline">Добавить сотрудника</span><span className="xs:inline sm:hidden lg:inline">Добавить</span><span className="hidden lg:hidden">Добавить</span>
                                    </Button>
                                </div>
                            </div>

                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                <div className="overflow-x-auto scrollbar-thin">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-slate-50">
                                                <TableHead className="w-12 md:w-16 text-center px-2 md:px-4">ID</TableHead>
                                                <TableHead className="cursor-pointer hover:bg-slate-100 px-2 md:px-4 whitespace-nowrap" onClick={() => toggleSort('username')}>
                                                    Логин {usersSortField === 'username' && (usersSortDir === 'asc' ? <ArrowUp className="w-3 h-3 inline" /> : <ArrowDown className="w-3 h-3 inline" />)}
                                                </TableHead>
                                                <TableHead className="cursor-pointer hover:bg-slate-100 px-2 md:px-4 whitespace-nowrap" onClick={() => toggleSort('full_name')}>
                                                    ФИО {usersSortField === 'full_name' && (usersSortDir === 'asc' ? <ArrowUp className="w-3 h-3 inline" /> : <ArrowDown className="w-3 h-3 inline" />)}
                                                </TableHead>
                                                <TableHead className="px-2 md:px-4">Роль</TableHead>
                                                <TableHead className="px-2 md:px-4 whitespace-nowrap">Штрих-код</TableHead>
                                                <TableHead className="cursor-pointer hover:bg-slate-100 px-2 md:px-4 whitespace-nowrap" onClick={() => toggleSort('created_at')}>
                                                    Добавлен {usersSortField === 'created_at' && (usersSortDir === 'asc' ? <ArrowUp className="w-3 h-3 inline" /> : <ArrowDown className="w-3 h-3 inline" />)}
                                                </TableHead>
                                                <TableHead className="text-right px-2 md:px-4 sticky right-0 bg-slate-50 shadow-[-4px_0_10px_-4px_rgba(0,0,0,0.1)]">Действия</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {isLoadingUsers ? (
                                                Array(5).fill(0).map((_, i) => (
                                                    <TableRow key={`s-${i}`}>
                                                        <TableCell><Skeleton className="h-4 w-8 mx-auto" /></TableCell>
                                                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                                                        <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                                                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                                        <TableCell><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                                                    </TableRow>
                                                ))
                                            ) : pagedUsers.length === 0 ? (
                                                <TableRow><TableCell colSpan={7} className="text-center py-8 text-slate-500">Сотрудники не найдены</TableCell></TableRow>
                                            ) : (
                                                pagedUsers.map((u) => (
                                                    <TableRow key={u.id} className={`${u.is_active === false ? 'opacity-50 grayscale' : ''} hover:bg-slate-50 transition-colors`}>
                                                        <TableCell className="text-center font-mono text-slate-500 text-xs px-2 md:px-4">{u.id}</TableCell>
                                                        <TableCell className="font-medium text-slate-900 text-sm px-2 md:px-4 whitespace-nowrap">{u.username}</TableCell>
                                                        <TableCell className="text-slate-600 text-sm px-2 md:px-4 whitespace-nowrap">{u.full_name || '—'}</TableCell>
                                                        <TableCell className="px-2 md:px-4">
                                                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] md:text-xs font-medium border ${u.role === 'admin' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                                                                {roles.find(r => r.name === u.role)?.description || u.role}
                                                            </span>
                                                            {u.specialization && (
                                                                <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] md:text-xs font-medium border bg-amber-50 text-amber-700 border-amber-200">
                                                                    {u.specialization}
                                                                </span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="font-mono text-[10px] md:text-xs text-slate-500 px-2 md:px-4">{u.barcode || '—'}</TableCell>
                                                        <TableCell className="text-slate-500 text-xs px-2 md:px-4 whitespace-nowrap">{new Date(u.created_at).toLocaleDateString('ru-RU')}</TableCell>
                                                        <TableCell className="text-right px-2 md:px-4 space-x-1 sticky right-0 bg-white/95 backdrop-blur-sm shadow-[-4px_0_10px_-4px_rgba(0,0,0,0.1)] group-hover:bg-slate-50/95">
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-indigo-500 hover:text-indigo-600 hover:bg-indigo-50" onClick={() => openEditUserDialog(u)} title="Настройки">
                                                                <Edit className="w-3.5 h-3.5" />
                                                            </Button>
                                                            {u.is_active !== false ? (
                                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50" onClick={() => handleDeleteUser(u.id, u.username)} title="Заблокировать" disabled={u.username === 'admin'}>
                                                                    <Lock className="w-3.5 h-3.5" />
                                                                </Button>
                                                            ) : (
                                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50" title="Заблокирован: Разблокируйте через редактирование" disabled>
                                                                    <Lock className="w-3.5 h-3.5" />
                                                                </Button>
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                                {/* Pagination Controls */}
                                {!isLoadingUsers && totalUsersPages > 1 && (
                                    <div className="flex justify-between items-center p-4 border-t">
                                        <span className="text-sm text-slate-500">Показано {(usersPage - 1) * USERS_PER_PAGE + 1} - {Math.min(usersPage * USERS_PER_PAGE, processedUsers.length)} из {processedUsers.length}</span>
                                        <div className="flex gap-1">
                                            <Button variant="outline" size="sm" disabled={usersPage <= 1} onClick={() => setUsersPage(p => p - 1)}>Пред.</Button>
                                            <Button variant="outline" size="sm" disabled={usersPage >= totalUsersPages} onClick={() => setUsersPage(p => p + 1)}>След.</Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </TabsContent>

                        {/* ROLES TAB */}
                        <TabsContent value="roles" className="space-y-4 outline-none">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-3 md:p-4 rounded-xl shadow-sm border border-slate-200">
                                <div><h2 className="text-lg font-semibold text-slate-900">Справочник ролей</h2></div>
                                <Button onClick={() => setIsAddRoleOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 gap-2 w-full sm:w-auto h-9 text-xs md:text-sm"><Plus className="w-4 h-4" /> Добавить роль</Button>
                            </div>
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                <div className="overflow-x-auto scrollbar-thin">
                                    <Table>
                                        <TableHeader><TableRow className="bg-slate-50"><TableHead className="w-16 px-2 md:px-4">ID</TableHead><TableHead className="px-2 md:px-4">Имя</TableHead><TableHead className="px-2 md:px-4">Описание</TableHead><TableHead className="text-right px-2 md:px-4">Действия</TableHead></TableRow></TableHeader>
                                        <TableBody>
                                            {roles.map((r) => (
                                                <TableRow key={r.id} className="hover:bg-slate-50 transition-colors">
                                                    <TableCell className="font-mono text-slate-500 text-xs px-2 md:px-4">{r.id}</TableCell>
                                                    <TableCell className="font-medium text-slate-900 text-sm px-2 md:px-4">{r.name}</TableCell>
                                                    <TableCell className="text-slate-600 text-xs md:text-sm px-2 md:px-4">{r.description || '—'}</TableCell>
                                                    <TableCell className="text-right space-x-1 px-2 md:px-4 whitespace-nowrap">
                                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditRoleData(r); setEditRoleName(r.name); setEditRoleDescription(r.description); setEditRolePermissions(r as any); setIsEditRoleOpen(true) }} disabled={r.name === 'admin' || r.name === 'employee'}><Edit className="w-3.5 h-3.5 text-indigo-500" /></Button>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDeleteRole(r.id, r.name)} disabled={r.name === 'admin' || r.name === 'employee'}><Trash2 className="w-3.5 h-3.5 text-rose-500" /></Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        </TabsContent>

                        {/* CATALOG TAB */}
                        <TabsContent value="catalog" className="space-y-4 outline-none">
                            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center bg-white p-3 md:p-4 rounded-xl shadow-sm border border-slate-200">
                                <div className="w-full sm:flex-1 sm:max-w-xs relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <Input placeholder="Поиск в каталоге..." value={catalogSearch} onChange={e => { setCatalogSearch(e.target.value); setCatalogPage(1); }} className="pl-9 h-9" />
                                </div>
                                <div className="flex flex-wrap gap-2 w-full sm:w-auto sm:ml-auto">
                                    <label className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-md cursor-pointer hover:bg-slate-50 transition-colors text-xs font-medium h-9 flex-1 sm:flex-none justify-center">
                                        {isUploading ? <Loader2 className="w-4 h-4 animate-spin text-indigo-600" /> : <Upload className="w-4 h-4 text-slate-500" />}
                                        <span className="hidden xs:inline">Массовая загрузка</span><span className="xs:hidden">Импорт</span>
                                        <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
                                    </label>
                                    <Button variant="outline" onClick={downloadTemplate} className="gap-2 h-9 text-xs flex-1 sm:flex-none">
                                        <FileDown className="w-4 h-4" /> <span className="hidden xs:inline">Шаблон</span>
                                    </Button>
                                    <Button onClick={() => setIsAddLocoOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 gap-2 h-9 text-xs flex-1 sm:flex-none">
                                        <Plus className="w-4 h-4" /> <span className="hidden xs:inline">Добавить 1 шт.</span><span className="xs:hidden">Добавить</span>
                                    </Button>
                                </div>
                            </div>

                            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                                <div className="overflow-x-auto scrollbar-thin">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-slate-50">
                                                <TableHead className="w-20 md:w-24 text-center px-2 md:px-4">ID</TableHead>
                                                <TableHead className="px-2 md:px-4">Номер локомотива</TableHead>
                                                <TableHead className="text-right px-2 md:px-4 sticky right-0 bg-slate-50 shadow-[-4px_0_10px_-4px_rgba(0,0,0,0.1)]">Действия</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {isLoadingCatalog ? (
                                                Array(5).fill(0).map((_, i) => (
                                                    <TableRow key={`c-${i}`}><TableCell><Skeleton className="h-4 w-8 mx-auto" /></TableCell><TableCell><Skeleton className="h-4 w-32" /></TableCell><TableCell><Skeleton className="h-8 w-16 ml-auto" /></TableCell></TableRow>
                                                ))
                                            ) : pagedCatalog.length === 0 ? (
                                                <TableRow><TableCell colSpan={3} className="text-center py-8 text-slate-500">Ничего не найдено</TableCell></TableRow>
                                            ) : (
                                                pagedCatalog.map(item => (
                                                    <TableRow key={item.id} className="hover:bg-slate-50 transition-colors">
                                                        <TableCell className="text-center text-slate-500 font-mono text-xs px-2 md:px-4">{item.id}</TableCell>
                                                        <TableCell className="font-semibold text-slate-900 text-sm px-2 md:px-4">{item.number}</TableCell>
                                                        <TableCell className="text-right px-2 md:px-4 space-x-1 sticky right-0 bg-white/95 backdrop-blur-sm shadow-[-4px_0_10px_-4px_rgba(0,0,0,0.1)] group-hover:bg-slate-50/95">
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-indigo-500 hover:text-indigo-600" onClick={() => { setEditLocoId(item.id); setEditLocoNumber(item.number); setIsEditLocoOpen(true); }}><Edit className="w-3.5 h-3.5" /></Button>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-500 hover:text-rose-600" onClick={() => handleDeleteLoco(item.id, item.number)}><Trash2 className="w-3.5 h-3.5" /></Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                            {!isLoadingCatalog && totalCatalogPages > 1 && (
                                <div className="flex justify-between items-center p-4 border-t">
                                    <span className="text-sm text-slate-500">Показано {(catalogPage - 1) * CATALOG_PER_PAGE + 1} - {Math.min(catalogPage * CATALOG_PER_PAGE, processedCatalog.length)} из {processedCatalog.length}</span>
                                    <div className="flex gap-1">
                                        <Button variant="outline" size="sm" disabled={catalogPage <= 1} onClick={() => setCatalogPage(p => p - 1)}>Пред.</Button>
                                        <Button variant="outline" size="sm" disabled={catalogPage >= totalCatalogPages} onClick={() => setCatalogPage(p => p + 1)}>След.</Button>
                                    </div>
                                </div>
                            )}
                        </TabsContent>

                        {/* REPAIR TYPES TAB */}
                        <TabsContent value="repairTypes" className="space-y-4 outline-none">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-3 md:p-4 rounded-xl shadow-sm border border-slate-200">
                                <div><h2 className="text-lg font-semibold">Типы ремонта</h2></div>
                                <Button onClick={() => setIsAddRepairTypeOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 gap-2 h-9 text-xs md:text-sm w-full sm:w-auto"><Plus className="w-4 h-4" /> Добавить</Button>
                            </div>
                            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                                <div className="overflow-x-auto scrollbar-thin">
                                    <Table>
                                        <TableHeader><TableRow className="bg-slate-50"><TableHead className="w-16 px-2 md:px-4">ID</TableHead><TableHead className="px-2 md:px-4">Шифр</TableHead><TableHead className="text-right px-2 md:px-4">Дей</TableHead></TableRow></TableHeader>
                                        <TableBody>
                                            {repairTypes.map(rt => (
                                                <TableRow key={rt.id} className="hover:bg-slate-50 transition-colors">
                                                    <TableCell className="px-2 md:px-4 text-xs font-mono text-slate-500">{rt.id}</TableCell>
                                                    <TableCell className="px-2 md:px-4 text-sm font-medium">{rt.name}</TableCell>
                                                    <TableCell className="text-right px-2 md:px-4"><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDeleteRepairType(rt.id, rt.name)}><Trash2 className="w-3.5 h-3.5 text-rose-500" /></Button></TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        </TabsContent>

                        {/* LOCATIONS TAB */}
                        <TabsContent value="locations" className="space-y-4 outline-none">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-3 md:p-4 rounded-xl shadow-sm border border-slate-200">
                                <div><h2 className="text-lg font-semibold">Список Депо</h2></div>
                                <Button onClick={() => setIsAddLocationOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 gap-2 h-9 text-xs md:text-sm w-full sm:w-auto"><Plus className="w-4 h-4" /> Добавить депо</Button>
                            </div>
                            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                                <div className="overflow-x-auto scrollbar-thin">
                                    <Table>
                                        <TableHeader><TableRow className="bg-slate-50"><TableHead className="w-16 px-2 md:px-4">ID</TableHead><TableHead className="px-2 md:px-4">Название</TableHead><TableHead className="px-2 md:px-4">Пути х Слоты</TableHead><TableHead className="px-2 md:px-4">Статус</TableHead><TableHead className="text-right px-2 md:px-4">Дей</TableHead></TableRow></TableHeader>
                                        <TableBody>
                                            {locations.map(loc => (
                                                <TableRow key={loc.id} className={`${loc.is_active === false ? 'opacity-50 grayscale' : ''} hover:bg-slate-50 transition-colors`}>
                                                    <TableCell className="px-2 md:px-4 text-xs font-mono text-slate-500">{loc.id}</TableCell>
                                                    <TableCell className="px-2 md:px-4 text-sm font-medium">{loc.name}</TableCell>
                                                    <TableCell className="text-slate-500 px-2 md:px-4 text-xs">{loc.track_count || 6} x {loc.slot_count || 6}</TableCell>
                                                    <TableCell className="px-2 md:px-4">
                                                        {loc.is_active !== false ? <span className="text-emerald-600 font-medium text-[10px] md:text-xs">Активно</span> : <span className="text-rose-600 font-medium text-[10px] md:text-xs">Неактивно</span>}
                                                    </TableCell>
                                                    <TableCell className="text-right px-2 md:px-4">
                                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                                                            setEditLocationData(loc as any);
                                                            setEditLocationName(loc.name);
                                                            setEditLocationIsActive(loc.is_active !== false);
                                                            setEditLocationTrackCount(loc.track_count || 6);
                                                            setEditLocationSlotCount(loc.slot_count || 6);
                                                            setEditLocationGatePosition(loc.gate_position?.toString() || "");
                                                            setEditLocationTrackConfig(loc.track_config || "");
                                                            setIsEditLocationOpen(true);
                                                        }}><Edit className="w-3.5 h-3.5 text-indigo-500" /></Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        </TabsContent>

                        {/* REMARK TEMPLATES TAB */}
                        <TabsContent value="remarkTemplates" className="space-y-4 outline-none">
                            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center bg-white p-3 md:p-4 rounded-xl shadow-sm border border-slate-200">
                                <div className="w-full sm:flex-1 sm:max-w-xs relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <Input placeholder="Поиск в шаблонах..." value={templateSearch} onChange={e => setTemplateSearch(e.target.value)} className="pl-9 h-9" />
                                </div>
                                <Button onClick={() => setIsAddTemplateOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 gap-2 h-9 text-xs sm:ml-auto">
                                    <Plus className="w-4 h-4" /> Добавить шаблон
                                </Button>
                            </div>

                            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                                <div className="overflow-x-auto scrollbar-thin">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-slate-50">
                                                <TableHead className="w-16 px-2 md:px-4">ID</TableHead>
                                                <TableHead className="px-2 md:px-4">Текст замечания</TableHead>
                                                <TableHead className="px-2 md:px-4">Специализация</TableHead>
                                                <TableHead className="px-2 md:px-4">Приоритет</TableHead>
                                                <TableHead className="px-2 md:px-4">Категория</TableHead>
                                                <TableHead className="w-20 text-center px-2 md:px-4">Использ.</TableHead>
                                                <TableHead className="text-right px-2 md:px-4 sticky right-0 bg-slate-50">Действия</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {isLoadingTemplates ? (
                                                Array(5).fill(0).map((_, i) => (
                                                    <TableRow key={`rt-${i}`}><TableCell><Skeleton className="h-4 w-8" /></TableCell><TableCell><Skeleton className="h-4 w-48" /></TableCell><TableCell><Skeleton className="h-4 w-24" /></TableCell><TableCell><Skeleton className="h-4 w-16" /></TableCell><TableCell><Skeleton className="h-4 w-24" /></TableCell><TableCell><Skeleton className="h-4 w-8" /></TableCell><TableCell><Skeleton className="h-8 w-16 ml-auto" /></TableCell></TableRow>
                                                ))
                                            ) : remarkTemplates.length === 0 ? (
                                                <TableRow><TableCell colSpan={7} className="text-center py-8 text-slate-500">Шаблоны не найдены</TableCell></TableRow>
                                            ) : (
                                                remarkTemplates
                                                    .filter(t => t.text.toLowerCase().includes(templateSearch.toLowerCase()) || (t.specialization || "").toLowerCase().includes(templateSearch.toLowerCase()))
                                                    .map(t => (
                                                        <TableRow key={t.id} className="hover:bg-slate-50 transition-colors">
                                                            <TableCell className="text-slate-500 font-mono text-xs px-2 md:px-4">{t.id}</TableCell>
                                                            <TableCell className="font-medium text-slate-900 text-sm px-2 md:px-4">{t.text}</TableCell>
                                                            <TableCell className="px-2 md:px-4">
                                                                {t.specialization && (
                                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] md:text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                                                                        {t.specialization}
                                                                    </span>
                                                                )}
                                                            </TableCell>
                                                            <TableCell className="px-2 md:px-4">
                                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] md:text-xs font-medium border ${t.priority === 'high' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                                                                    t.priority === 'medium' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                                        'bg-slate-50 text-slate-700 border-slate-200'
                                                                    }`}>
                                                                    {t.priority === 'high' ? 'Высокий' : t.priority === 'medium' ? 'Средний' : 'Низкий'}
                                                                </span>
                                                            </TableCell>
                                                            <TableCell className="text-slate-600 text-xs px-2 md:px-4">{t.category || '—'}</TableCell>
                                                            <TableCell className="text-center text-slate-500 text-xs px-2 md:px-4">{t.usage_count}</TableCell>
                                                            <TableCell className="text-right px-2 md:px-4 space-x-1 sticky right-0 bg-white/95 backdrop-blur-sm">
                                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-indigo-500 hover:text-indigo-600" onClick={() => {
                                                                    setEditTemplateData(t);
                                                                    setEditTemplateText(t.text);
                                                                    setEditTemplateSpecialization(t.specialization || "none");
                                                                    setEditTemplatePriority(t.priority || "medium");
                                                                    setEditTemplateCategory(t.category || "");
                                                                    setEditTemplateHours(t.estimated_hours?.toString() || "");
                                                                    setIsEditTemplateOpen(true);
                                                                }}>
                                                                    <Edit className="w-3.5 h-3.5" />
                                                                </Button>
                                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-500 hover:text-rose-600" onClick={() => handleDeleteTemplate(t.id, t.text)}>
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </Button>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        </TabsContent>

                        {/* AUDIT LOGS TAB */}
                        <TabsContent value="audit" className="space-y-4 outline-none">
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                <div className="overflow-x-auto scrollbar-thin">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-slate-50">
                                                <TableHead className="w-40 md:w-48 px-2 md:px-4">Время действия</TableHead>
                                                <TableHead className="px-2 md:px-4">Депо</TableHead>
                                                <TableHead className="px-2 md:px-4">Сотрудник</TableHead>
                                                <TableHead className="px-2 md:px-4">Событие</TableHead>
                                                <TableHead className="px-2 md:px-4">Объект</TableHead>
                                                <TableHead className="px-2 md:px-4 min-w-[200px]">Детали</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {isLoadingLogs ? (
                                                Array(5).fill(0).map((_, i) => (
                                                    <TableRow key={`log-${i}`}><TableCell><Skeleton className="h-4 w-32" /></TableCell><TableCell><Skeleton className="h-4 w-24" /></TableCell><TableCell><Skeleton className="h-4 w-24" /></TableCell><TableCell><Skeleton className="h-4 w-32" /></TableCell><TableCell><Skeleton className="h-4 w-24" /></TableCell><TableCell><Skeleton className="h-4 w-48" /></TableCell></TableRow>
                                                ))
                                            ) : auditLogs.length === 0 ? (
                                                <TableRow><TableCell colSpan={6} className="text-center py-8 text-slate-500">Журнал пуст</TableCell></TableRow>
                                            ) : (
                                                auditLogs.map(log => (
                                                    <TableRow key={log.id} className="hover:bg-slate-50 transition-colors">
                                                        <TableCell className="text-[10px] md:text-sm text-slate-500 px-2 md:px-4 whitespace-nowrap">{new Date(log.created_at).toLocaleString('ru-RU')}</TableCell>
                                                        <TableCell className="text-[10px] md:text-sm text-slate-700 px-2 md:px-4 whitespace-nowrap">{log.user?.locations?.name || 'Система'}</TableCell>
                                                        <TableCell className="font-medium text-slate-900 text-[10px] md:text-sm px-2 md:px-4 whitespace-nowrap">{log.user?.full_name || log.user?.username || 'Система'}</TableCell>
                                                        <TableCell className="px-2 md:px-4"><span className="inline-flex px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[9px] md:text-xs font-semibold whitespace-nowrap">{log.action}</span></TableCell>
                                                        <TableCell className="font-mono text-[9px] md:text-xs px-2 md:px-4 whitespace-nowrap">{log.target}</TableCell>
                                                        <TableCell className="text-[10px] md:text-sm text-slate-600 px-2 md:px-4 max-w-xs truncate">{log.details}</TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                                {!isLoadingLogs && auditLogsTotal > LOGS_PER_PAGE && (
                                    <div className="flex justify-between items-center p-3 md:p-4 border-t">
                                        <span className="text-[10px] md:text-sm text-slate-500">Всего: {auditLogsTotal}</span>
                                        <div className="flex gap-1">
                                            <Button variant="outline" size="sm" className="h-8 text-xs px-2" disabled={logsPage <= 1} onClick={() => setLogsPage(p => p - 1)}>Пред.</Button>
                                            <Button variant="outline" size="sm" className="h-8 text-xs px-2" disabled={logsPage * LOGS_PER_PAGE >= auditLogsTotal} onClick={() => setLogsPage(p => p + 1)}>След.</Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>
            </main>

            {/* MODALS / DIALOGS */}

            {/* Add User Dialog */}
            <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Новый сотрудник</DialogTitle></DialogHeader>
                    <form onSubmit={handleCreateUser} className="space-y-4 pt-2">
                        <div className="space-y-2"><Label>Логин (Username) *</Label><Input required value={addUsername} onChange={e => setAddUsername(e.target.value)} /></div>
                        <div className="space-y-2"><Label>ФИО</Label><Input value={addFullName} onChange={e => setAddFullName(e.target.value)} /></div>
                        <div className="space-y-2">
                            <Label>Роль</Label>
                            <Select value={addRole} onValueChange={setAddRole}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>{roles.map(r => <SelectItem key={r.id} value={r.name}>{r.description || r.name}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Депо (Локация)</Label>
                            <Select value={addLocationId} onValueChange={setAddLocationId} disabled={!adminUser?.is_global_admin}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>{locations.map(l => <SelectItem key={l.id} value={l.id.toString()}>{l.name}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Специализация (для слесарей)</Label>
                            <Select value={addSpecialization} onValueChange={setAddSpecialization}>
                                <SelectTrigger><SelectValue placeholder="Выберите специализацию" /></SelectTrigger>
                                <SelectContent>
                                    {SPECIALIZATIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Временный пароль *</Label>
                            <div className="flex gap-2">
                                <Input required value={addPassword} onChange={e => setAddPassword(e.target.value)} />
                                <Button type="button" variant="secondary" onClick={generatePassword}><KeyRound className="w-4 h-4" /></Button>
                            </div>
                        </div>
                        <div className="space-y-2"><Label>Штрих-код</Label><Input value={addBarcode} onChange={e => setAddBarcode(e.target.value)} /></div>
                        <DialogFooter><Button type="button" variant="outline" onClick={() => setIsAddUserOpen(false)}>Отмена</Button><Button type="submit">Создать</Button></DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* REMARK TEMPLATE DIALOGS */}
            <Dialog open={isAddTemplateOpen} onOpenChange={setIsAddTemplateOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Новый шаблон замечания</DialogTitle></DialogHeader>
                    <form onSubmit={handleCreateTemplate} className="space-y-4 pt-2">
                        <div className="space-y-2"><Label>Текст замечания *</Label><Input required value={addTemplateText} onChange={e => setAddTemplateText(e.target.value)} placeholder="Например: Теч масла ТК" /></div>
                        <div className="space-y-2">
                            <Label>Специализация</Label>
                            <Select value={addTemplateSpecialization} onValueChange={setAddTemplateSpecialization}>
                                <SelectTrigger><SelectValue placeholder="Выберите специализацию" /></SelectTrigger>
                                <SelectContent>
                                    {SPECIALIZATIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Приоритет</Label>
                            <Select value={addTemplatePriority} onValueChange={setAddTemplatePriority}>
                                <SelectTrigger><SelectValue placeholder="Выберите приоритет" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="high">Высокий</SelectItem>
                                    <SelectItem value="medium">Средний</SelectItem>
                                    <SelectItem value="low">Низкий</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2"><Label>Категория</Label><Input value={addTemplateCategory} onChange={e => setAddTemplateCategory(e.target.value)} placeholder="Например: Дизель" /></div>
                        <div className="space-y-2"><Label>Норма часов (Примерно)</Label><Input type="number" step="0.5" value={addTemplateHours} onChange={e => setAddTemplateHours(e.target.value)} placeholder="1.5" /></div>
                        <DialogFooter><Button type="button" variant="outline" onClick={() => setIsAddTemplateOpen(false)}>Отмена</Button><Button type="submit">Создать</Button></DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={isEditTemplateOpen} onOpenChange={setIsEditTemplateOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Редактировать шаблон</DialogTitle></DialogHeader>
                    <form onSubmit={handleUpdateTemplate} className="space-y-4 pt-2">
                        <div className="space-y-2"><Label>Текст замечания *</Label><Input required value={editTemplateText} onChange={e => setEditTemplateText(e.target.value)} /></div>
                        <div className="space-y-2">
                            <Label>Специализация</Label>
                            <Select value={editTemplateSpecialization} onValueChange={setEditTemplateSpecialization}>
                                <SelectTrigger><SelectValue placeholder="Выберите специализацию" /></SelectTrigger>
                                <SelectContent>
                                    {SPECIALIZATIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Приоритет</Label>
                            <Select value={editTemplatePriority} onValueChange={setEditTemplatePriority}>
                                <SelectTrigger><SelectValue placeholder="Выберите приоритет" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="high">Высокий</SelectItem>
                                    <SelectItem value="medium">Средний</SelectItem>
                                    <SelectItem value="low">Низкий</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2"><Label>Категория</Label><Input value={editTemplateCategory} onChange={e => setEditTemplateCategory(e.target.value)} /></div>
                        <div className="space-y-2"><Label>Норма часов</Label><Input type="number" step="0.5" value={editTemplateHours} onChange={e => setEditTemplateHours(e.target.value)} /></div>
                        <DialogFooter><Button type="button" variant="outline" onClick={() => setIsEditTemplateOpen(false)}>Отмена</Button><Button type="submit">Сохранить</Button></DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Edit User Dialog */}
            <Dialog open={isEditUserOpen} onOpenChange={setIsEditUserOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Редактирование профиля: {editUserData?.username}</DialogTitle></DialogHeader>
                    <form onSubmit={handleUpdateUser} className="space-y-4 pt-2">
                        <div className="space-y-2"><Label>Логин</Label><Input required value={editUsername} onChange={e => setEditUsername(e.target.value)} disabled={editUserData?.username === 'admin'} /></div>
                        <div className="space-y-2"><Label>ФИО</Label><Input value={editFullName} onChange={e => setEditFullName(e.target.value)} /></div>
                        <div className="space-y-2">
                            <Label>Роль</Label>
                            <Select value={editRole} onValueChange={setEditRole} disabled={editUserData?.username === 'admin'}>
                                <SelectTrigger><SelectValue placeholder="Выберите роль" /></SelectTrigger>
                                <SelectContent>{roles.map(r => <SelectItem key={r.id} value={r.name}>{r.description || r.name}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Депо (Локация)</Label>
                            <Select value={editLocationId} onValueChange={setEditLocationId} disabled={editUserData?.username === 'admin' || !adminUser?.is_global_admin}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>{locations.map(l => <SelectItem key={l.id} value={l.id.toString()}>{l.name}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Специализация</Label>
                            <Select value={editSpecialization} onValueChange={setEditSpecialization}>
                                <SelectTrigger><SelectValue placeholder="Выберите специализацию" /></SelectTrigger>
                                <SelectContent>
                                    {SPECIALIZATIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Баллы (Всего)</Label>
                            <Input type="number" value={editPoints} onChange={e => setEditPoints(parseInt(e.target.value) || 0)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Новый пароль (оставьте пустым, чтобы не менять)</Label>
                            <Input type="text" value={editPassword} onChange={e => setEditPassword(e.target.value)} placeholder="••••••••" />
                        </div>
                        <div className="space-y-2"><Label>Штрих-код</Label><Input value={editBarcode} onChange={e => setEditBarcode(e.target.value)} /></div>
                        <div className="flex items-center space-x-2 bg-slate-50 p-3 rounded border">
                            <Checkbox id="is_active_toggle" checked={editIsActive} onCheckedChange={(c) => setEditIsActive(!!c)} disabled={editUserData?.username === 'admin'} />
                            <div>
                                <Label htmlFor="is_active_toggle" className="font-semibold text-slate-800 cursor-pointer">Активный аккаунт</Label>
                                <p className="text-xs text-slate-500">Если снято, пользователь не сможет авторизоваться в системе.</p>
                            </div>
                        </div>
                        <DialogFooter><Button type="button" variant="outline" onClick={() => setIsEditUserOpen(false)}>Отмена</Button><Button type="submit">Сохранить</Button></DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Catalog Dialogs */}
            <Dialog open={isAddLocoOpen} onOpenChange={setIsAddLocoOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Добавить локомотив</DialogTitle></DialogHeader>
                    <form onSubmit={handleAddLoco} className="space-y-4"><div className="space-y-2"><Label>Номер локомотива</Label><Input required value={addLocoNumber} onChange={e => setAddLocoNumber(e.target.value)} placeholder="0001" /></div><DialogFooter><Button type="submit">Добавить</Button></DialogFooter></form>
                </DialogContent>
            </Dialog>
            <Dialog open={isEditLocoOpen} onOpenChange={setIsEditLocoOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Редактировать номер</DialogTitle></DialogHeader>
                    <form onSubmit={handleEditLoco} className="space-y-4"><div className="space-y-2"><Label>Номер локомотива</Label><Input required value={editLocoNumber} onChange={e => setEditLocoNumber(e.target.value)} /></div><DialogFooter><Button type="submit">Сохранить</Button></DialogFooter></form>
                </DialogContent>
            </Dialog>

            {/* ROLE DIALOGS */}
            <Dialog open={isAddRoleOpen} onOpenChange={setIsAddRoleOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader><DialogTitle>Новая роль</DialogTitle></DialogHeader>
                    <form onSubmit={handleCreateRole} className="space-y-4">
                        <Input required value={addRoleName} onChange={e => setAddRoleName(e.target.value)} placeholder="Имя роли (eng)" />
                        <Input value={addRoleDescription} onChange={e => setAddRoleDescription(e.target.value)} placeholder="Описание" />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
                            {PERMISSIONS.map(p => (
                                <div key={`add-${p.key}`} className="flex items-start space-x-3 p-2 bg-white rounded border shadow-sm">
                                    <Checkbox
                                        id={`add-perm-${p.key}`}
                                        checked={(addRolePermissions as any)[p.key]}
                                        onCheckedChange={(c) => setAddRolePermissions(prev => ({ ...prev, [p.key]: !!c }))}
                                    />
                                    <div className="grid gap-1.5 leading-none">
                                        <label htmlFor={`add-perm-${p.key}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">{p.label}</label>
                                        <p className="text-xs text-muted-foreground">{p.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <DialogFooter><Button type="submit">Создать</Button></DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={isEditRoleOpen} onOpenChange={setIsEditRoleOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader><DialogTitle>Редактировать роль: {editRoleName}</DialogTitle></DialogHeader>
                    <form onSubmit={handleEditRole} className="space-y-4">
                        <div className="space-y-2"><Label>Имя роли (системное)</Label><Input required value={editRoleName} onChange={e => setEditRoleName(e.target.value)} disabled={editRoleData?.name === 'admin'} /></div>
                        <div className="space-y-2"><Label>Описание (понятное)</Label><Input value={editRoleDescription} onChange={e => setEditRoleDescription(e.target.value)} /></div>

                        <div className="space-y-2 mt-4 pt-4 border-t">
                            <Label className="font-bold flex items-center gap-2"><ShieldAlert className="w-4 h-4" /> Права доступа</Label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 bg-slate-50 rounded-lg border border-slate-200 max-h-60 overflow-y-auto shadow-inner">
                                {PERMISSIONS.map(p => (
                                    <div key={`edit-${p.key}`} className={`flex items-start space-x-3 p-3 bg-white border rounded shadow-sm transition-colors ${editRoleData?.name === 'admin' ? 'opacity-50 grayscale' : 'hover:border-indigo-300'}`}>
                                        <Checkbox
                                            id={`edit-perm-${p.key}`}
                                            checked={(editRolePermissions as any)[p.key]}
                                            onCheckedChange={(c) => setEditRolePermissions(prev => ({ ...prev, [p.key]: !!c }))}
                                            disabled={editRoleData?.name === 'admin'}
                                        />
                                        <div className="grid gap-1.5 leading-none">
                                            <Label htmlFor={`edit-perm-${p.key}`} className="text-sm font-semibold text-slate-700 cursor-pointer">{p.label}</Label>
                                            <p className="text-xs text-slate-500 leading-tight">{p.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <DialogFooter><Button type="submit" disabled={editRoleData?.name === 'admin'}>Сохранить</Button></DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* REPAIR TYPE DIALOG */}
            <Dialog open={isAddRepairTypeOpen} onOpenChange={setIsAddRepairTypeOpen}><DialogContent><DialogHeader><DialogTitle>Тип ремонта</DialogTitle></DialogHeader><form onSubmit={handleAddRepairType} className="space-y-4"><Input required value={addRepairTypeName} onChange={e => setAddRepairTypeName(e.target.value)} placeholder="ТО-2" /><DialogFooter><Button type="submit">Добавить</Button></DialogFooter></form></DialogContent></Dialog>

            {/* LOCATION DIALOGS */}
            <Dialog open={isAddLocationOpen} onOpenChange={setIsAddLocationOpen}><DialogContent className="max-h-[85vh] overflow-y-auto max-w-2xl"><DialogHeader><DialogTitle>Добавить депо</DialogTitle></DialogHeader><form onSubmit={handleCreateLocation} className="space-y-4">
                <div className="space-y-2"><Label>Название</Label><Input required value={addLocationName} onChange={e => setAddLocationName(e.target.value)} placeholder="ТЧЭ-1 Входная" /></div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Количество путей</Label><Input type="number" min={1} max={20} required value={addLocationTrackCount} onChange={e => setAddLocationTrackCount(parseInt(e.target.value) || 6)} /></div>
                    <div className="space-y-2"><Label>Слотов на путь</Label><Input type="number" min={1} max={20} required value={addLocationSlotCount} onChange={e => setAddLocationSlotCount(parseInt(e.target.value) || 6)} /></div>
                </div>
                <div className="space-y-4 pt-2 border-t mt-2">
                    <Label className="text-slate-700 font-bold flex items-center gap-2">
                        <Warehouse className="w-4 h-4" /> Настройка слотов (Депо vs Улица)
                    </Label>
                    <p className="text-xs text-slate-500">
                        Нажмите на номер слота, чтобы пометить его как <strong className="text-indigo-600">Депо</strong> (белый фон).
                        Остальные будут считаться <strong className="text-slate-400">Улицей</strong> (серый фон).
                    </p>
                    <div className="flex flex-wrap gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                        {Array.from({ length: addLocationSlotCount }).map((_, i) => {
                            const slotNum = (i + 1).toString();
                            const isInside = addLocationGatePosition.split(',').includes(slotNum);
                            return (
                                <Button
                                    key={i}
                                    type="button"
                                    size="sm"
                                    variant={isInside ? "default" : "outline"}
                                    className={`w-10 h-10 p-0 font-bold transition-all ${isInside ? 'bg-indigo-600 shadow-md ring-2 ring-indigo-200' : 'bg-white text-slate-400 border-dashed hover:border-indigo-400 hover:text-indigo-500'}`}
                                    onClick={() => {
                                        const current = addLocationGatePosition ? addLocationGatePosition.split(',') : [];
                                        const next = isInside
                                            ? current.filter((s: string) => s !== slotNum)
                                            : [...current, slotNum].filter((s: string) => s !== '0' && s !== '').sort((a, b) => parseInt(a) - parseInt(b));
                                        setAddLocationGatePosition(next.join(','));
                                    }}
                                >
                                    {slotNum}
                                </Button>
                            );
                        })}
                    </div>
                </div>

                <div className="space-y-4 pt-2 border-t mt-2">
                    <Label className="text-slate-700 font-bold flex items-center gap-2">
                        <Activity className="w-4 h-4" /> Настройка зон (Минимализм)
                    </Label>
                    <p className="text-xs text-slate-500">Введите названия цехов для нужных путей. Разделитель появится перед путем.</p>
                    <div className="space-y-2 max-h-40 overflow-y-auto p-2 bg-slate-50 rounded border">
                        {Array.from({ length: addLocationTrackCount }).map((_, i) => {
                            const trackNum = i + 1;
                            const currentConfig = addLocationTrackConfig.split(',').filter(s => s).reduce((acc: any, curr) => {
                                const [t, l] = curr.split(':');
                                acc[t] = l;
                                return acc;
                            }, {});
                            return (
                                <div key={trackNum} className="flex items-center gap-2">
                                    <span className="text-xs font-medium w-12 shrink-0">Путь {trackNum}</span>
                                    <Input
                                        placeholder="Название зоны..."
                                        className="h-8 text-xs"
                                        value={currentConfig[trackNum] || ""}
                                        onChange={e => {
                                            const val = e.target.value.replace(/[:,]/g, '').trim();
                                            const newConfig = { ...currentConfig };
                                            if (val) {
                                                newConfig[trackNum] = val;
                                            } else {
                                                delete newConfig[trackNum];
                                            }

                                            const configStr = Object.entries(newConfig)
                                                .filter(([_, v]) => v)
                                                .map(([t, v]) => `${t}:${v}`)
                                                .join(',');
                                            setAddLocationTrackConfig(configStr);
                                        }}
                                    />
                                </div>
                            );
                        })}
                    </div>
                </div>

                <DialogFooter><Button type="submit">Добавить</Button></DialogFooter></form></DialogContent></Dialog>
            <Dialog open={isEditLocationOpen} onOpenChange={setIsEditLocationOpen}><DialogContent className="max-h-[85vh] overflow-y-auto max-w-2xl"><DialogHeader><DialogTitle>Редактировать депо</DialogTitle></DialogHeader><form onSubmit={handleUpdateLocation} className="space-y-4">
                <div className="space-y-2"><Label>Название</Label><Input required value={editLocationName} onChange={e => setEditLocationName(e.target.value)} /></div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Количество путей</Label><Input type="number" min={1} max={20} required value={editLocationTrackCount} onChange={e => setEditLocationTrackCount(parseInt(e.target.value) || 6)} /></div>
                    <div className="space-y-2"><Label>Слотов на путь</Label><Input type="number" min={1} max={20} required value={editLocationSlotCount} onChange={e => setEditLocationSlotCount(parseInt(e.target.value) || 6)} /></div>
                </div>
                <div className="space-y-4 pt-2 border-t mt-2">
                    <Label className="text-slate-700 font-bold flex items-center gap-2">
                        <Warehouse className="w-4 h-4" /> Настройка слотов (Депо vs Улица)
                    </Label>
                    <p className="text-xs text-slate-500">
                        Нажмите на номер слота, чтобы пометить его как <strong className="text-indigo-600">Депо</strong> (белый фон).
                        Остальные будут считаться <strong className="text-slate-400">Улицей</strong> (серый фон).
                    </p>
                    <div className="flex flex-wrap gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                        {Array.from({ length: editLocationSlotCount }).map((_, i) => {
                            const slotNum = (i + 1).toString();
                            const isInside = editLocationGatePosition.split(',').includes(slotNum);
                            return (
                                <Button
                                    key={i}
                                    type="button"
                                    size="sm"
                                    variant={isInside ? "default" : "outline"}
                                    className={`w-10 h-10 p-0 font-bold transition-all ${isInside ? 'bg-indigo-600 shadow-md ring-2 ring-indigo-200' : 'bg-white text-slate-400 border-dashed hover:border-indigo-400 hover:text-indigo-500'}`}
                                    onClick={() => {
                                        const current = editLocationGatePosition ? editLocationGatePosition.split(',') : [];
                                        const next = isInside
                                            ? current.filter((s: string) => s !== slotNum)
                                            : [...current, slotNum].filter((s: string) => s !== '0' && s !== '').sort((a, b) => parseInt(a) - parseInt(b));
                                        setEditLocationGatePosition(next.join(','));
                                    }}
                                >
                                    {slotNum}
                                </Button>
                            );
                        })}
                    </div>
                </div>

                <div className="flex items-center space-x-2 bg-slate-50 p-3 rounded border">
                    <Checkbox id="loc_is_active_toggle" checked={editLocationIsActive} onCheckedChange={(c) => setEditLocationIsActive(!!c)} />
                    <div>
                        <Label htmlFor="loc_is_active_toggle" className="font-semibold text-slate-800 cursor-pointer">Активное депо</Label>
                        <p className="text-xs text-slate-500">Если снято, локомотивы нельзя будет туда перевести.</p>
                    </div>
                </div>
                <div className="space-y-4 pt-2 border-t mt-2">
                    <Label className="text-slate-700 font-bold flex items-center gap-2">
                        <Activity className="w-4 h-4" /> Настройка зон (Минимализм)
                    </Label>
                    <p className="text-xs text-slate-500">Введите названия цехов для нужных путей. Разделитель появится перед путем.</p>
                    <div className="space-y-2 max-h-40 overflow-y-auto p-2 bg-slate-50 rounded border">
                        {Array.from({ length: editLocationTrackCount }).map((_, i) => {
                            const trackNum = i + 1;
                            const currentConfig = editLocationTrackConfig.split(',').filter(s => s).reduce((acc: any, curr) => {
                                const [t, l] = curr.split(':');
                                acc[t] = l;
                                return acc;
                            }, {});
                            return (
                                <div key={trackNum} className="flex items-center gap-2">
                                    <span className="text-xs font-medium w-12 shrink-0">Путь {trackNum}</span>
                                    <Input
                                        placeholder="Название зоны..."
                                        className="h-8 text-xs"
                                        value={currentConfig[trackNum] || ""}
                                        onChange={e => {
                                            const val = e.target.value.replace(/[:,]/g, '').trim();
                                            const newConfig = { ...currentConfig };
                                            if (val) {
                                                newConfig[trackNum] = val;
                                            } else {
                                                delete newConfig[trackNum];
                                            }

                                            const configStr = Object.entries(newConfig)
                                                .filter(([_, v]) => v)
                                                .map(([t, v]) => `${t}:${v}`)
                                                .join(',');
                                            setEditLocationTrackConfig(configStr);
                                        }}
                                    />
                                </div>
                            );
                        })}
                    </div>
                </div>

                <DialogFooter><Button type="button" variant="outline" onClick={() => setIsEditLocationOpen(false)}>Отмена</Button><Button type="submit">Сохранить</Button></DialogFooter>
            </form></DialogContent></Dialog>

        </div >
    )
}
