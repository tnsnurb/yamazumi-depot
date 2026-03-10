import { useState, useEffect } from "react"
import { Plus, Trash2, Upload, Save, FileSpreadsheet, Loader2, ChevronRight, Filter } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { toast } from "sonner"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
interface RepairType {
    id: number
    name: string
}

interface ChecklistTemplate {
    id: number
    series: string
    repair_type_id: number
    name: string
    created_at: string
    repair_type: { id: number, name: string }
    items: [{ count: number }]
}

interface ChecklistItem {
    id?: number
    sort_order: number
    group_name: string | null
    short_description: string
    full_description: string | null
    executor_role: string | null
    controller_role: string | null
    required: boolean
}

export function ChecklistAdmin({ repairTypes }: { repairTypes: RepairType[] }) {
    const [templates, setTemplates] = useState<ChecklistTemplate[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null)
    const [templateItems, setTemplateItems] = useState<ChecklistItem[]>([])
    const [itemsLoading, setItemsLoading] = useState(false)
    const [isSaving, setIsSaving] = useState(false)

    // New Template Dialog
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
    const [newTemplateSeries, setNewTemplateSeries] = useState("")
    const [newTemplateRepairType, setNewTemplateRepairType] = useState("")

    // Filter
    const [groupFilter, setGroupFilter] = useState<string>("all")

    // File Upload
    const [uploading, setUploading] = useState(false)

    useEffect(() => {
        fetchTemplates()
    }, [])

    const fetchTemplates = async () => {
        try {
            setLoading(true)
            const token = localStorage.getItem('access_token')
            const res = await fetch('/api/checklists/templates', {
                headers: { 'Authorization': `Bearer ${token} ` }
            })
            if (!res.ok) throw new Error('Failed to fetch templates')
            const data = await res.json()
            setTemplates(data)
        } catch (error) {
            console.error(error)
            toast.error("Ошибка загрузки шаблонов")
        } finally {
            setLoading(false)
        }
    }

    const fetchTemplateItems = async (templateId: number) => {
        try {
            setItemsLoading(true)
            const token = localStorage.getItem('access_token')
            const res = await fetch(`/api/checklists/templates/${templateId}`, {
                headers: { 'Authorization': `Bearer ${token} ` }
            })
            if (!res.ok) throw new Error('Failed to fetch template items')
            const data = await res.json()
            setTemplateItems(data.items || [])
            setSelectedTemplate(templateId)
            setGroupFilter("all")
        } catch (error) {
            console.error(error)
            toast.error("Ошибка загрузки пунктов шаблона")
        } finally {
            setItemsLoading(false)
        }
    }

    const handleCreateTemplate = async () => {
        if (!newTemplateSeries || !newTemplateRepairType) {
            toast.error("Заполните серию и тип ремонта")
            return
        }

        try {
            const token = localStorage.getItem('access_token')
            const res = await fetch('/api/checklists/templates', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token} `,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    series: newTemplateSeries,
                    repair_type_id: parseInt(newTemplateRepairType)
                })
            })

            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || 'Failed to create template')
            }

            toast.success("Шаблон успешно создан")
            setIsCreateDialogOpen(false)
            setNewTemplateSeries("")
            setNewTemplateRepairType("")
            await fetchTemplates()
        } catch (error: any) {
            console.error(error)
            toast.error(error.message || "Ошибка создания шаблона")
        }
    }

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file || !selectedTemplate) return

        const formData = new FormData()
        formData.append('file', file)

        try {
            setUploading(true)
            const token = localStorage.getItem('access_token')
            const res = await fetch(`/api/checklists/templates/${selectedTemplate}/import`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            })

            if (!res.ok) throw new Error('Upload failed')

            const data = await res.json()
            toast.success(`Импортировано ${data.count} пунктов`)
            fetchTemplateItems(selectedTemplate)
            if (e.target) e.target.value = '' // reset input
        } catch (error) {
            console.error(error)
            toast.error("Ошибка при импорте файла")
        } finally {
            setUploading(false)
        }
    }

    const handleSaveItems = async () => {
        if (!selectedTemplate) return

        try {
            setIsSaving(true)
            const token = localStorage.getItem('access_token')
            const res = await fetch(`/api/checklists/templates/${selectedTemplate}/items`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ items: templateItems })
            })

            if (!res.ok) throw new Error('Save failed')
            toast.success("Пункты шаблона сохранены")
            fetchTemplates() // Update counts in sidebar
        } catch (error) {
            console.error(error)
            toast.error("Ошибка при сохранении")
        } finally {
            setIsSaving(false)
        }
    }

    const handleDeleteTemplate = async (templateId: number) => {
        if (!confirm("Вы уверены, что хотите удалить этот шаблон? Все связанные с ним активные чек-листы могут перестать работать корректно.")) return

        try {
            const token = localStorage.getItem('access_token')
            const res = await fetch(`/api/checklists/templates/${templateId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            })

            if (!res.ok) throw new Error('Delete failed')
            toast.success("Шаблон удален")
            if (selectedTemplate === templateId) {
                setSelectedTemplate(null)
                setTemplateItems([])
            }
            fetchTemplates()
        } catch (error) {
            console.error(error)
            toast.error("Ошибка удаления шаблона")
        }
    }

    // Update an item in the list
    const updateItem = (index: number, field: keyof ChecklistItem, value: any) => {
        const newItems = [...templateItems]
        newItems[index] = { ...newItems[index], [field]: value }
        setTemplateItems(newItems)
    }

    const removeItem = (index: number) => {
        const newItems = [...templateItems]
        newItems.splice(index, 1)
        setTemplateItems(newItems)
    }

    const addItem = () => {
        setTemplateItems([...templateItems, {
            sort_order: templateItems.length + 1,
            group_name: "",
            short_description: "",
            full_description: "",
            executor_role: "Слесарь",
            controller_role: "Мастер",
            required: true
        }])
    }

    // Grouping logic for the sidebar
    const seriesGroups = templates.reduce((acc, t) => {
        if (!acc[t.series]) acc[t.series] = []
        acc[t.series].push(t)
        return acc
    }, {} as Record<string, ChecklistTemplate[]>)

    // Derived values for the editor
    const activeTemplate = templates.find(t => t.id === selectedTemplate)
    const uniqueGroups = Array.from(new Set(templateItems.map(i => i.group_name).filter(Boolean)))
    const filteredItems = groupFilter === 'all' ? templateItems : templateItems.filter(i => i.group_name === groupFilter)

    return (
        <div className="flex h-[calc(100vh-12rem)] border rounded-lg overflow-hidden bg-card">
            {/* Left Sidebar: Series & Templates Tree */}
            <div className="w-64 border-r bg-muted/10 flex flex-col">
                <div className="p-4 border-b bg-card flex justify-between items-center">
                    <h3 className="font-semibold text-foreground">Шаблоны</h3>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-primary" onClick={() => setIsCreateDialogOpen(true)}>
                        <Plus className="h-4 w-4" />
                    </Button>
                </div>
                <div className="flex-1 p-2 overflow-y-auto min-h-0">
                    {loading ? (
                        <div className="p-4 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                    ) : Object.keys(seriesGroups).length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center p-4">Нет шаблонов</p>
                    ) : (
                        Object.entries(seriesGroups).map(([series, tmpls]) => (
                            <div key={series} className="mb-4">
                                <div className="text-xs font-semibold text-muted-foreground tracking-wider mb-2 px-2 uppercase">{series}</div>
                                <div className="space-y-1">
                                    {tmpls.map(t => (
                                        <div
                                            key={t.id}
                                            className={`
                                                flex items-center justify-between p-2 rounded-md cursor-pointer text-sm transition-colors
                                                ${selectedTemplate === t.id ? 'bg-primary/15 text-primary font-medium' : 'hover:bg-muted text-foreground'}
                                            `}
                                            onClick={() => fetchTemplateItems(t.id)}
                                        >
                                            <div className="flex items-center gap-2">
                                                <ChevronRight className={`h-4 w-4 ${selectedTemplate === t.id ? 'opacity-100' : 'opacity-0'}`} />
                                                <span>{t.repair_type.name}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Badge variant="secondary" className="text-[10px] px-1.5 h-5">
                                                    {t.items?.[0]?.count || 0}
                                                </Badge>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                                    onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(t.id); }}
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Right Content: Template Editor */}
            <div className="flex-1 flex flex-col bg-background">
                {!selectedTemplate ? (
                    <div className="flex-1 flex items-center justify-center text-muted-foreground flex-col gap-4">
                        <FileSpreadsheet className="h-12 w-12 opacity-20" />
                        <p>Выберите шаблон слева или создайте новый</p>
                    </div>
                ) : itemsLoading ? (
                    <div className="flex-1 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                ) : (
                    <>
                        <div className="p-4 border-b flex justify-between items-center bg-card">
                            <div>
                                <h2 className="text-xl font-bold text-foreground">
                                    {activeTemplate?.series} <span className="text-muted-foreground font-normal mx-2">→</span> {activeTemplate?.repair_type.name}
                                </h2>
                                <p className="text-sm text-muted-foreground">Настройка пунктов чек-листа</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <div>
                                    <input
                                        type="file"
                                        id="excel-upload"
                                        className="hidden"
                                        accept=".xlsx,.xls"
                                        onChange={handleFileUpload}
                                        disabled={uploading}
                                    />
                                    <Label htmlFor="excel-upload">
                                        <div className={`flex items-center gap-2 px-4 py-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground rounded-md cursor-pointer transition-colors text-sm font-medium ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                                            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                                            Импорт из Excel
                                        </div>
                                    </Label>
                                </div>
                                <Button onClick={handleSaveItems} disabled={isSaving}>
                                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                                    Сохранить
                                </Button>
                            </div>
                        </div>

                        {/* Filters */}
                        <div className="p-2 border-b bg-muted/30 flex items-center gap-4 px-4">
                            <Filter className="h-4 w-4 text-muted-foreground" />
                            <div className="flex gap-2">
                                <Badge
                                    variant={groupFilter === 'all' ? 'default' : 'outline'}
                                    className="cursor-pointer"
                                    onClick={() => setGroupFilter('all')}
                                >
                                    Все пункты ({templateItems.length})
                                </Badge>
                                {uniqueGroups.map(group => (
                                    <Badge
                                        key={group || 'empty'}
                                        variant={groupFilter === group ? 'default' : 'outline'}
                                        className="cursor-pointer"
                                        onClick={() => setGroupFilter(group as string)}
                                    >
                                        {group || 'Без группы'}
                                    </Badge>
                                ))}
                            </div>
                        </div>

                        <div className="flex-1 p-4 overflow-y-auto min-h-0">
                            <div className="space-y-4 max-w-5xl mx-auto">
                                {filteredItems.length === 0 ? (
                                    <div className="text-center p-8 border border-dashed rounded-lg bg-muted/10">
                                        <p className="text-muted-foreground mb-4">В этом шаблоне пока нет пунктов.</p>
                                        <div className="flex justify-center gap-4">
                                            <Label htmlFor="excel-upload" className="cursor-pointer">
                                                <div className="flex flex-col items-center gap-2 p-6 border rounded-md hover:border-primary hover:bg-primary/5 transition-colors">
                                                    <Upload className="h-8 w-8 text-muted-foreground" />
                                                    <span className="font-medium">Загрузить Excel</span>
                                                    <span className="text-xs text-muted-foreground">Группа | Кратко | Описание | Исполнитель | Контроль</span>
                                                </div>
                                            </Label>
                                            <div onClick={addItem} className="flex flex-col items-center gap-2 p-6 border rounded-md hover:border-primary hover:bg-primary/5 cursor-pointer transition-colors">
                                                <Plus className="h-8 w-8 text-muted-foreground" />
                                                <span className="font-medium">Добавить вручную</span>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        {/* Table Header like structure */}
                                        <div className="grid grid-cols-[auto_1fr_2fr_1fr_1fr_auto_auto] gap-3 mb-2 px-3 text-sm font-medium text-muted-foreground">
                                            <div className="w-6">№</div>
                                            <div>Группа</div>
                                            <div>Краткое описание / Полное описание</div>
                                            <div>Исполнитель</div>
                                            <div>Контроль</div>
                                            <div className="w-10">Обяз.</div>
                                            <div className="w-8"></div>
                                        </div>

                                        {templateItems.map((item, index) => {
                                            // Hide if filtering
                                            if (groupFilter !== 'all' && item.group_name !== groupFilter) return null;

                                            return (
                                                <div key={index} className="grid grid-cols-[auto_1fr_2fr_1fr_1fr_auto_auto] gap-3 items-start p-3 bg-card border rounded-lg shadow-sm hover:border-primary/50 transition-colors focus-within:ring-1 focus-within:ring-primary">
                                                    <div className="w-6 pt-3 text-muted-foreground font-mono text-xs text-center">{index + 1}</div>

                                                    <div className="flex flex-col gap-2">
                                                        <Input
                                                            value={item.group_name || ''}
                                                            onChange={e => updateItem(index, 'group_name', e.target.value)}
                                                            placeholder="Например: Лаб." className="h-9 text-sm"
                                                        />
                                                    </div>

                                                    <div className="flex flex-col gap-2">
                                                        <Input
                                                            value={item.short_description}
                                                            onChange={e => updateItem(index, 'short_description', e.target.value)}
                                                            placeholder="Проверка уровня масла" className="h-9 font-medium"
                                                        />
                                                        <textarea
                                                            className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-y"
                                                            value={item.full_description || ''}
                                                            onChange={e => updateItem(index, 'full_description', e.target.value)}
                                                            placeholder="Подробная инструкция (опционально)..."
                                                        />
                                                    </div>

                                                    <div className="flex flex-col gap-2">
                                                        <Input
                                                            value={item.executor_role || ''}
                                                            onChange={e => updateItem(index, 'executor_role', e.target.value)}
                                                            placeholder="Мастер/Слесарь" className="h-9 text-sm"
                                                        />
                                                    </div>

                                                    <div className="flex flex-col gap-2">
                                                        <Input
                                                            value={item.controller_role || ''}
                                                            onChange={e => updateItem(index, 'controller_role', e.target.value)}
                                                            placeholder="Мастер (опционально)" className="h-9 text-sm"
                                                        />
                                                    </div>

                                                    <div className="w-10 flex justify-center pt-3">
                                                        <Checkbox
                                                            checked={item.required}
                                                            onCheckedChange={(c) => updateItem(index, 'required', !!c)}
                                                        />
                                                    </div>

                                                    <div className="w-8 pt-1.5 flex justify-center">
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => removeItem(index)}>
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            )
                                        })}

                                        <div className="pt-4 flex justify-center">
                                            <Button variant="outline" className="w-full max-w-sm border-dashed" onClick={addItem}>
                                                <Plus className="h-4 w-4 mr-2" /> Добавить пункт
                                            </Button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Create Template Dialog */}
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Создание шаблона чек-листа</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Серия локомотива</Label>
                            <Input
                                placeholder="ТЭП33А, ТЭ33А, ТЭ33АС..."
                                value={newTemplateSeries}
                                onChange={e => setNewTemplateSeries(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Тип ремонта</Label>
                            <Select value={newTemplateRepairType} onValueChange={setNewTemplateRepairType}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Выберите тип ремонта" />
                                </SelectTrigger>
                                <SelectContent>
                                    {repairTypes.map(rt => (
                                        <SelectItem key={rt.id} value={rt.id.toString()}>{rt.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Отмена</Button>
                        <Button onClick={handleCreateTemplate}>Создать шаблон</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
