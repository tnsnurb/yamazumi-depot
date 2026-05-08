import { useState, useEffect } from "react"
import { Plus, Trash2, Upload, Save, FileSpreadsheet, Loader2, Filter } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectGroup, SelectLabel, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
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
    // loading state removed
    const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null)
    const [templateItems, setTemplateItems] = useState<ChecklistItem[]>([])
    const [itemsLoading, setItemsLoading] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    
    // Series list from catalog
    const [uniqueSeries, setUniqueSeries] = useState<string[]>([])

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
        fetchAvailableSeries()
    }, [])

    const fetchAvailableSeries = async () => {
        try {
            const token = localStorage.getItem('access_token')
            const res = await fetch('/api/locomotives', {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            if (res.ok) {
                const catalog = await res.json()
                const seriesSet = new Set<string>()
                catalog.forEach((l: any) => {
                    if (l.series) seriesSet.add(l.series.trim())
                })
                setUniqueSeries(Array.from(seriesSet).sort())
            }
        } catch (error) {
            console.error("Failed to load series catalog", error)
        }
    }

    const fetchTemplates = async () => {
        try {
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
    // Derived values for the editor
    const uniqueGroups = Array.from(new Set(templateItems.map(i => i.group_name).filter(Boolean)))
    const filteredItems = groupFilter === 'all' ? templateItems : templateItems.filter(i => i.group_name === groupFilter)

    return (
        <div className="flex flex-col h-[calc(100vh-12rem)] border rounded-lg overflow-hidden bg-card">
            {/* Top Header: Template Selector & Main Actions */}
            <div className="p-4 border-b flex justify-between items-center bg-muted/10">
                <div className="flex items-center gap-4">
                    <h3 className="font-semibold text-foreground whitespace-nowrap">Шаблон:</h3>
                    
                    <Select 
                        value={selectedTemplate?.toString() || ""} 
                        onValueChange={(val) => fetchTemplateItems(parseInt(val))}
                    >
                        <SelectTrigger className="w-[300px] bg-background">
                            <SelectValue placeholder="Выберите шаблон локомотива..." />
                        </SelectTrigger>
                        <SelectContent className="max-h-[400px]">
                            {Object.entries(seriesGroups).map(([series, tmpls]) => (
                                <SelectGroup key={series}>
                                    <SelectLabel className="text-muted-foreground font-semibold">{series}</SelectLabel>
                                    {tmpls.map(t => (
                                        <SelectItem key={t.id.toString()} value={t.id.toString()}>
                                            {t.series} — {t.repair_type.name} ({t.items?.[0]?.count || 0} п.)
                                        </SelectItem>
                                    ))}
                                </SelectGroup>
                            ))}
                        </SelectContent>
                    </Select>
                    
                    <Button variant="outline" size="sm" onClick={() => setIsCreateDialogOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" /> Создать
                    </Button>

                    {selectedTemplate && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                            onClick={() => handleDeleteTemplate(selectedTemplate)}
                            title="Удалить выбранный шаблон"
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    )}
                </div>

                {selectedTemplate && (
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
                )}
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col bg-background overflow-hidden">
                {!selectedTemplate ? (
                    <div className="flex-1 flex items-center justify-center text-muted-foreground flex-col gap-4">
                        <FileSpreadsheet className="h-12 w-12 opacity-20" />
                        <p>Выберите шаблон сверху или создайте новый</p>
                    </div>
                ) : itemsLoading ? (
                    <div className="flex-1 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                ) : (
                    <div className="flex-1 flex flex-col min-h-0 bg-background">
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
                                    <div className="border rounded-md bg-card shadow-sm overflow-hidden">
                                        <Table>
                                            <TableHeader className="bg-muted/30">
                                                <TableRow>
                                                    <TableHead className="w-[50px] text-center font-semibold">№</TableHead>
                                                    <TableHead className="font-semibold w-[15%]">Группа</TableHead>
                                                    <TableHead className="font-semibold w-[40%]">Описание задачи</TableHead>
                                                    <TableHead className="font-semibold w-[15%]">Исполнитель</TableHead>
                                                    <TableHead className="font-semibold w-[15%]">Контроль</TableHead>
                                                    <TableHead className="w-[60px] text-center font-semibold">Обяз.</TableHead>
                                                    <TableHead className="w-[50px]"></TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {templateItems.map((item, index) => {
                                                    if (groupFilter !== 'all' && item.group_name !== groupFilter) return null;
                                                    
                                                    // Reusable classes for clean 'ghost' inputs
                                                    const ghostInputClass = "h-9 border-transparent shadow-none bg-transparent hover:bg-muted/50 focus-visible:border-primary focus-visible:ring-1 focus-visible:bg-background transition-all"
                                                    const ghostTextareaClass = "min-h-[40px] border-transparent shadow-none bg-transparent hover:bg-muted/50 focus-visible:border-primary focus-visible:ring-1 focus-visible:bg-background transition-all resize-y text-xs text-muted-foreground mt-1"

                                                    return (
                                                        <TableRow key={index} className="group hover:bg-muted/20">
                                                            <TableCell className="text-center text-muted-foreground font-mono text-xs font-medium">
                                                                {index + 1}
                                                            </TableCell>
                                                            <TableCell className="p-1 align-top">
                                                                <Input
                                                                    value={item.group_name || ''}
                                                                    onChange={e => updateItem(index, 'group_name', e.target.value)}
                                                                    placeholder="Группа..." 
                                                                    className={ghostInputClass}
                                                                />
                                                            </TableCell>
                                                            <TableCell className="p-1 align-top">
                                                                <div className="flex flex-col px-2 py-1">
                                                                    <Input
                                                                        value={item.short_description}
                                                                        onChange={e => updateItem(index, 'short_description', e.target.value)}
                                                                        placeholder="Краткое описание" 
                                                                        className={`font-medium px-2 py-1 h-8 ${ghostInputClass}`}
                                                                    />
                                                                    <Textarea
                                                                        value={item.full_description || ''}
                                                                        onChange={e => updateItem(index, 'full_description', e.target.value)}
                                                                        placeholder="Добавить подробную инструкцию..." 
                                                                        className={`px-2 py-1 ${ghostTextareaClass}`}
                                                                    />
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="p-1 align-top">
                                                                <Input
                                                                    value={item.executor_role || ''}
                                                                    onChange={e => updateItem(index, 'executor_role', e.target.value)}
                                                                    placeholder="Мастер/Слесарь" 
                                                                    className={ghostInputClass}
                                                                />
                                                            </TableCell>
                                                            <TableCell className="p-1 align-top">
                                                                <Input
                                                                    value={item.controller_role || ''}
                                                                    onChange={e => updateItem(index, 'controller_role', e.target.value)}
                                                                    placeholder="Мастер (опц.)" 
                                                                    className={ghostInputClass}
                                                                />
                                                            </TableCell>
                                                            <TableCell className="text-center align-middle">
                                                                <div className="flex justify-center">
                                                                    <Switch
                                                                        checked={item.required}
                                                                        onCheckedChange={(c) => updateItem(index, 'required', !!c)}
                                                                        className="scale-90"
                                                                    />
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="text-center align-middle pr-4">
                                                                <Button 
                                                                    variant="ghost" 
                                                                    size="icon" 
                                                                    className="h-8 w-8 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive hover:bg-destructive/10" 
                                                                    onClick={() => removeItem(index)}
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </TableCell>
                                                        </TableRow>
                                                    )
                                                })}
                                            </TableBody>
                                        </Table>
                                    </div>
                                    <div className="pt-4 flex justify-center pb-8">
                                            <Button variant="outline" className="w-full max-w-sm border-dashed" onClick={addItem}>
                                                <Plus className="h-4 w-4 mr-2" /> Добавить пункт
                                            </Button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
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
                            <Select value={newTemplateSeries} onValueChange={setNewTemplateSeries}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Выберите серию из каталога" />
                                </SelectTrigger>
                                <SelectContent>
                                    {uniqueSeries.length === 0 ? (
                                        <SelectItem value="loading" disabled>Загрузка каталога...</SelectItem>
                                    ) : (
                                        uniqueSeries.map(s => (
                                            <SelectItem key={s} value={s}>{s}</SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Тип ремонта</Label>
                            <Select value={newTemplateRepairType} onValueChange={setNewTemplateRepairType}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Выберите тип ремонта" />
                                </SelectTrigger>
                                <SelectContent>
                                    {repairTypes.length === 0 ? (
                                        <SelectItem value="empty" disabled>Загрузка типов ремонта...</SelectItem>
                                    ) : (
                                        repairTypes.map(rt => (
                                            <SelectItem key={rt.id} value={rt.id.toString()}>{rt.name}</SelectItem>
                                        ))
                                    )}
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
