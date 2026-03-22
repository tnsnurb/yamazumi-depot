import { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { gaugeService, type Gauge } from "@/api/gaugeService"
import { gaugeTypeService, type GaugeType } from "@/api/gaugeTypeService"
import { locomotiveApi } from "@/api/locomotiveService"
import { QRCodeSVG } from "qrcode.react"
import { Html5Qrcode } from "html5-qrcode"
import { 
  Search, 
  Plus, 
  Calendar, 
  Settings2, 
  QrCode,
  FileDown,
  Wrench,
  Printer,
  Trash2,
  Camera,
  AlertTriangle,
  ScanLine,
  X
} from "lucide-react"
import { format, differenceInDays, parseISO, addYears } from "date-fns"
import { toast } from "sonner"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select as UISelect,
  SelectContent as UISelectContent,
  SelectItem as UISelectItem,
  SelectTrigger as UISelectTrigger,
  SelectValue as UISelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { useSearchParams } from "react-router-dom"

const Gauges = () => {
  const [searchParams] = useSearchParams()
  const initialSerial = searchParams.get('serial') || ""
  
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState(initialSerial)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [selectedGaugeForQR, setSelectedGaugeForQR] = useState<Gauge | null>(null)
  
  const [isManageTypesOpen, setIsManageTypesOpen] = useState(false)
  const [newGaugeType, setNewGaugeType] = useState({ part_number: "", description: "" })
  
  const [isInstallDialogOpen, setIsInstallDialogOpen] = useState(false)
  const [selectedGaugeForInstall, setSelectedGaugeForInstall] = useState<Gauge | null>(null)
  const [installToLocoId, setInstallToLocoId] = useState<number | null>(null)
  const [installSide, setInstallSide] = useState<'K1' | 'K2'>('K1')

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingGauge, setEditingGauge] = useState<Partial<Gauge> | null>(null)

  // Фильтр по статусу
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // Диалог возврата просроченного
  const [returnDialogGauge, setReturnDialogGauge] = useState<Gauge | null>(null)

  // QR Сканер
  const [isScannerOpen, setIsScannerOpen] = useState(false)
  const [scanResult, setScanResult] = useState<string | null>(null)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const scannerContainerId = "qr-scanner-container"
  
  useEffect(() => {
    if (initialSerial) setSearchTerm(initialSerial)
  }, [initialSerial])

  // QR Scanner lifecycle
  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === 2) { // SCANNING
          await scannerRef.current.stop();
        }
      } catch (e) { /* ignore */ }
      scannerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!isScannerOpen) return;
    
    const timer = setTimeout(async () => {
      const container = document.getElementById(scannerContainerId);
      if (!container) return;
      
      try {
        const scanner = new Html5Qrcode(scannerContainerId);
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            // Успешное сканирование
            setScanResult(decodedText);
            stopScanner();
          },
          () => { /* ignore errors during scanning */ }
        );
      } catch (err) {
        console.error('Ошибка камеры:', err);
        toast.error('Не удалось открыть камеру. Проверьте разрешения.');
        setIsScannerOpen(false);
      }
    }, 300);
    
    return () => {
      clearTimeout(timer);
      stopScanner();
    };
  }, [isScannerOpen, stopScanner]);

  const [newGauge, setNewGauge] = useState<Partial<Gauge>>({
    serial_number: "",
    type_id: "",
    last_verification: format(new Date(), 'yyyy-MM-dd'),
    next_verification: format(addYears(new Date(), 1), 'yyyy-MM-dd'),
    status: 'На складе',
    locomotive_id: null,
    installation_side: null
  })

  // Автоматический расчет следующей поверки (+1 год)
  const handleLastVerificationChange = (dateStr: string) => {
    try {
      const date = parseISO(dateStr);
      if (!isNaN(date.getTime())) {
        const nextDate = addYears(date, 1);
        setNewGauge(prev => ({
          ...prev, 
          last_verification: dateStr,
          next_verification: format(nextDate, 'yyyy-MM-dd')
        }));
      } else {
        setNewGauge(prev => ({...prev, last_verification: dateStr}));
      }
    } catch (e) {
      setNewGauge(prev => ({...prev, last_verification: dateStr}));
    }
  }

  const { data: gauges = [], isLoading } = useQuery({
    queryKey: ['gauges'],
    queryFn: gaugeService.getAll
  })

  // Обработка результата сканирования (после загрузки gauges)
  const handleScanResult = useCallback(() => {
    if (!scanResult || !Array.isArray(gauges)) return;
    
    const serial = scanResult.startsWith('gauge:') 
      ? scanResult.replace('gauge:', '').trim() 
      : scanResult.trim();
    
    const found = gauges.find((g: Gauge) => 
      g.serial_number.toLowerCase() === serial.toLowerCase()
    );
    
    if (found) {
      toast.success(`Найден: ${found.serial_number}`);
      setIsScannerOpen(false);
      setScanResult(null);
      
      if (found.status === 'На складе') {
        setSelectedGaugeForInstall(found);
        setIsInstallDialogOpen(true);
      } else {
        setSearchTerm(found.serial_number);
        setStatusFilter('all');
      }
    } else {
      toast.error(`Манометр "${serial}" не найден в системе`);
      setScanResult(null);
    }
  }, [scanResult, gauges]);

  useEffect(() => {
    if (scanResult) handleScanResult();
  }, [scanResult, handleScanResult]);

  const { data: locomotives = [] } = useQuery({
    queryKey: ['locomotives-list'],
    queryFn: () => locomotiveApi.getAll().then(res => res || [])
  })

  // Фильтрация локомотивов: ТЭ33А/АС/П
  const filteredLocomotivesList = useMemo(() => {
    if (!Array.isArray(locomotives)) return [];
    return locomotives
      .filter((l: any) => {
        const series = String(l.series || "").toUpperCase();
        const numStr = String(l.number || "").toUpperCase();
        
        // Включаем ТЭ33А, ТЭ33АС и ТЭП33А
        const isEvolution = series.includes("ТЭ33") || series.includes("ТЭП33") || numStr.includes("ТЭ33") || numStr.includes("ТЭП33");
        return isEvolution;
      })
      .sort((a: any, b: any) => (a.number || "").localeCompare(b.number || "", undefined, { numeric: true }));
  }, [locomotives]);

  const { data: gaugeTypes = [] } = useQuery({
    queryKey: ['gauge-types'],
    queryFn: gaugeTypeService.getAll
  })

  const createTypeMutation = useMutation({
    mutationFn: (data: Partial<GaugeType>) => gaugeTypeService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gauge-types'] })
      setNewGaugeType({ part_number: "", description: "" })
      toast.success("Новая модель успешно добавлена в справочник")
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || err.message)
    }
  })

  const deleteTypeMutation = useMutation({
    mutationFn: (id: string) => gaugeTypeService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gauge-types'] })
      toast.success("Модель удалена из справочника")
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || err.message || "Ошибка при удалении")
    }
  })

  const createMutation = useMutation({
    mutationFn: (data: Partial<Gauge>) => gaugeService.create(data),
    onSuccess: (createdGauge: any) => {
      queryClient.invalidateQueries({ queryKey: ['gauges'] })
      setIsAddDialogOpen(false)
      toast.success("Манометр успешно добавлен")
      // Авто-показ QR для печати этикетки
      setSelectedGaugeForQR(createdGauge)
      setNewGauge({
        serial_number: "",
        type_id: "",
        last_verification: format(new Date(), 'yyyy-MM-dd'),
        next_verification: format(addYears(new Date(), 1), 'yyyy-MM-dd'),
        status: 'На складе',
        locomotive_id: null
      })
    },
    onError: (err: any) => {
      toast.error(err.message || "Ошибка при добавлении")
    }
  })

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    createMutation.mutate(newGauge)
  }

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (editingGauge && editingGauge.id) {
      updateMutation.mutate({
        id: editingGauge.id,
        ...editingGauge
      }, {
        onSuccess: () => {
          setIsEditDialogOpen(false)
        }
      })
    }
  }

  const updateMutation = useMutation({
    mutationFn: ({id, ...data}: Partial<Gauge> & {id: string}) => gaugeService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gauges'] })
      toast.success("Данные обновлены")
    },
    onError: (err: any) => {
      toast.error(err.message || "Ошибка при обновлении")
    }
  })

  const uploadPhotoMutation = useMutation({
    mutationFn: ({id, file}: {id: string, file: File}) => {
      const formData = new FormData()
      formData.append('photo', file)
      return gaugeService.uploadPhoto(id, formData)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gauges'] })
      toast.success("Фотография успешно загружена")
    },
    onError: (err: any) => {
      toast.error(err.message || "Ошибка при загрузке фото")
    }
  })

  const uploadTypeImageMutation = useMutation({
    mutationFn: ({id, file}: {id: string, file: File}) => {
      const formData = new FormData()
      formData.append('photo', file)
      return gaugeTypeService.uploadPhoto(id, formData)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gauge-types'] })
      queryClient.invalidateQueries({ queryKey: ['gauges'] })
      toast.success("Изображение модели обновлено")
    },
    onError: (err: any) => {
      toast.error(err.message || "Ошибка при загрузке изображения")
    }
  })

  const handleVerify = (gauge: Gauge) => {
    const today = new Date();
    const nextYear = addYears(today, 1);
    
    updateMutation.mutate({
      id: gauge.id,
      last_verification: format(today, 'yyyy-MM-dd'),
      next_verification: format(nextYear, 'yyyy-MM-dd')
    });
  }

  const handleInstall = () => {
    if (!selectedGaugeForInstall || !installToLocoId) return;

    updateMutation.mutate({
      id: selectedGaugeForInstall.id,
      status: 'На локомотиве',
      locomotive_id: installToLocoId,
      installation_side: installSide
    }, {
      onSuccess: () => {
        setIsInstallDialogOpen(false);
        setSelectedGaugeForInstall(null);
        setInstallToLocoId(null);
        setInstallSide('K1');
      }
    });
  }

  const handleUninstall = (gauge: Gauge) => {
    const daysLeft = differenceInDays(parseISO(gauge.next_verification), new Date())
    if (daysLeft < 0) {
      // Просрочен — показать диалог выбора
      setReturnDialogGauge(gauge)
    } else {
      // Обычный возврат
      updateMutation.mutate({
        id: gauge.id,
        status: 'На складе',
        locomotive_id: null,
        installation_side: null
      });
    }
  }

  const handleReturnExpired = (action: 'warehouse' | 'verification' | 'decommission') => {
    if (!returnDialogGauge) return;
    const updates: any = {
      id: returnDialogGauge.id,
      locomotive_id: null,
      installation_side: null
    };
    if (action === 'verification') {
      updates.status = 'На поверке';
    } else if (action === 'decommission') {
      updates.status = 'Списан';
      updates.is_defective = true;
    } else {
      updates.status = 'На складе';
    }
    updateMutation.mutate(updates, {
      onSuccess: () => setReturnDialogGauge(null)
    });
  }

  const getStatusColor = (gauge: Gauge) => {
    if (gauge.is_defective) return "bg-red-100 text-red-700 border-red-200"
    
    const daysLeft = differenceInDays(parseISO(gauge.next_verification), new Date())
    
    if (daysLeft < 0) return "bg-red-500 text-white animate-pulse"
    if (daysLeft < 30) return "bg-amber-100 text-amber-700 border-amber-200"
    return "bg-emerald-50 text-emerald-700 border-emerald-200"
  }

  const getDaysLeft = (dateStr: string) => {
    return differenceInDays(parseISO(dateStr), new Date())
  }

  // Фильтрация
  const filteredGauges = useMemo(() => {
    if (!Array.isArray(gauges)) return [];
    return gauges.filter((g: Gauge) => {
      // Текстовый поиск
      const matchesSearch = g.serial_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        g.part_number?.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchesSearch) return false;
      // Фильтр по статусу
      if (statusFilter === 'all') return true;
      if (statusFilter === 'expired') return getDaysLeft(g.next_verification) < 0;
      if (statusFilter === 'expiring') {
        const d = getDaysLeft(g.next_verification);
        return d >= 0 && d < 30;
      }
      return g.status === statusFilter;
    });
  }, [gauges, searchTerm, statusFilter])

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Wrench className="w-8 h-8 text-blue-600" />
            Метрология
          </h1>
          <p className="text-slate-500 mt-1">
            Учет манометров и контроль сроков поверки
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            className="gap-2 bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 font-bold"
            onClick={() => { setScanResult(null); setIsScannerOpen(true); }}
          >
            <ScanLine className="w-4 h-4" />
            Сканировать
          </Button>
          <Button variant="outline" className="gap-2">
            <FileDown className="w-4 h-4" />
            Экспорт
          </Button>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-blue-600 hover:bg-blue-700 shadow-md">
                <Plus className="w-4 h-4" />
                Добавить прибор
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Добавление манометра</DialogTitle>
                <DialogDescription>
                  Введите данные нового прибора для учета в системе.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddSubmit} className="space-y-6 pt-4">
                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="serial" className="text-slate-600 font-bold">Serial Number</Label>
                    <Input 
                      id="serial"
                      required 
                      placeholder="Напр. KSK0140" 
                      value={newGauge.serial_number}
                      onChange={e => setNewGauge({...newGauge, serial_number: e.target.value})}
                      className="h-11 border-slate-200 focus:ring-blue-500 rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-600 font-bold">Модель (Part Number)</Label>
                    <div className="flex gap-2">
                      <UISelect 
                        value={newGauge.type_id || ""}
                        onValueChange={val => setNewGauge({...newGauge, type_id: val})}
                      >
                        <UISelectTrigger className="h-11 border-slate-200 rounded-xl">
                          <UISelectValue placeholder="Модель..." />
                        </UISelectTrigger>
                        <UISelectContent>
                          {Array.isArray(gaugeTypes) && gaugeTypes.map(t => (
                            <UISelectItem key={t.id} value={t.id}>{t.part_number} — {t.description}</UISelectItem>
                          ))}
                        </UISelectContent>
                      </UISelect>
                      <Button type="button" variant="outline" className="h-11 w-11 p-0 rounded-xl" onClick={() => setIsManageTypesOpen(true)} title="Справочник моделей">
                        <Settings2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-slate-600 font-bold">Последняя поверка</Label>
                    <Input 
                      type="date" 
                      value={newGauge.last_verification}
                      onChange={e => handleLastVerificationChange(e.target.value)}
                      className="h-11 border-slate-200 rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-600 font-bold">Следующая поверка</Label>
                    <Input 
                      type="date" 
                      value={newGauge.next_verification}
                      onChange={e => setNewGauge({...newGauge, next_verification: e.target.value})}
                      className="h-11 border-slate-200 rounded-xl"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-slate-600 font-bold">Статус</Label>
                    <UISelect 
                       value={newGauge.status}
                       onValueChange={val => setNewGauge({...newGauge, status: val as any, locomotive_id: val !== 'На локомотиве' ? null : newGauge.locomotive_id})}
                    >
                      <UISelectTrigger className="h-11 border-slate-200 rounded-xl">
                        <UISelectValue />
                      </UISelectTrigger>
                      <UISelectContent>
                        <UISelectItem value="На складе">На складе</UISelectItem>
                        <UISelectItem value="На локомотиве">На локомотиве</UISelectItem>
                        <UISelectItem value="На поверке">На поверке</UISelectItem>
                      </UISelectContent>
                    </UISelect>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-600 font-bold">Локомотив</Label>
                    <UISelect 
                      value={newGauge.locomotive_id?.toString() || ""}
                      onValueChange={val => setNewGauge({
                        ...newGauge, 
                        locomotive_id: val ? parseInt(val) : null, 
                        status: val ? 'На локомотиве' : 'На складе'
                      })}
                    >
                      <UISelectTrigger className="h-11 border-slate-200 rounded-xl">
                        <UISelectValue placeholder="Номер..." />
                      </UISelectTrigger>
                      <UISelectContent>
                        <UISelectItem value="no">Нет (На складе)</UISelectItem>
                        {filteredLocomotivesList.map((l: any) => (
                          <UISelectItem key={l.id} value={l.id.toString()}>{l.number}</UISelectItem>
                        ))}
                      </UISelectContent>
                    </UISelect>
                  </div>
                </div>

                {newGauge.status === 'На локомотиве' && (
                  <div className="space-y-2 p-4 bg-blue-50/50 rounded-2xl border border-blue-100 animate-in fade-in slide-in-from-top-2">
                    <Label className="text-blue-700 font-black uppercase text-[10px] tracking-wider">Сторона установки (Кабина)</Label>
                    <div className="flex gap-2">
                      {['K1', 'K2'].map((side) => (
                        <button
                          key={side}
                          type="button"
                          onClick={() => setNewGauge({...newGauge, installation_side: side as any})}
                          className={`flex-1 py-3 rounded-xl border text-sm font-black transition-all ${
                            newGauge.installation_side === side 
                              ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-200' 
                              : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                          }`}
                        >
                          Cabin {side}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <Button 
                    type="button" 
                    variant="ghost" 
                    onClick={() => setIsAddDialogOpen(false)}
                    className="flex-1 h-12 rounded-xl text-slate-500 font-bold hover:bg-slate-100"
                  >
                    Отмена
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createMutation.isPending}
                    className="flex-1 h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black shadow-lg shadow-blue-200 transition-all active:scale-95"
                  >
                    {createMutation.isPending ? "Сохранение..." : "Добавить прибор"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className={`border-slate-200 shadow-sm cursor-pointer transition-all hover:shadow-md ${statusFilter === 'all' ? 'ring-2 ring-blue-400 bg-blue-50' : 'bg-white'}`} onClick={() => setStatusFilter('all')}>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase font-semibold text-slate-400">Всего приборов</CardDescription>
            <CardTitle className="text-2xl font-bold text-slate-900">{gauges.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card className={`border-red-100 shadow-sm cursor-pointer transition-all hover:shadow-md ${statusFilter === 'expired' ? 'ring-2 ring-red-400' : ''} bg-red-50`} onClick={() => setStatusFilter(statusFilter === 'expired' ? 'all' : 'expired')}>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase font-semibold text-red-400">Просрочено</CardDescription>
            <CardTitle className="text-2xl font-bold text-red-600">
              {(gauges as Gauge[]).filter((g: Gauge) => getDaysLeft(g.next_verification) < 0).length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className={`border-amber-100 shadow-sm cursor-pointer transition-all hover:shadow-md ${statusFilter === 'expiring' ? 'ring-2 ring-amber-400' : ''} bg-amber-50`} onClick={() => setStatusFilter(statusFilter === 'expiring' ? 'all' : 'expiring')}>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase font-semibold text-amber-500">Срок истекает</CardDescription>
            <CardTitle className="text-2xl font-bold text-amber-600">
              {(gauges as Gauge[]).filter((g: Gauge) => {
                const d = getDaysLeft(g.next_verification)
                return d >= 0 && d < 30
              }).length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className={`border-emerald-100 shadow-sm cursor-pointer transition-all hover:shadow-md ${statusFilter === 'all' && 'opacity-80'} bg-emerald-50`} onClick={() => setStatusFilter('all')}>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase font-semibold text-emerald-500">В норме</CardDescription>
            <CardTitle className="text-2xl font-bold text-emerald-600">
              {(gauges as Gauge[]).filter((g: Gauge) => getDaysLeft(g.next_verification) >= 30).length}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Фильтры по статусу */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: 'all', label: 'Все', color: 'bg-slate-100 text-slate-700' },
          { key: 'На складе', label: 'На складе', color: 'bg-slate-100 text-slate-700' },
          { key: 'На локомотиве', label: 'На локомотиве', color: 'bg-blue-100 text-blue-700' },
          { key: 'На поверке', label: 'На поверке', color: 'bg-amber-100 text-amber-700' },
          { key: 'expired', label: 'Просрочено', color: 'bg-red-100 text-red-700' },
          { key: 'Списан', label: 'Списан', color: 'bg-gray-100 text-gray-700' },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setStatusFilter(f.key)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
              statusFilter === f.key
                ? `${f.color} ring-2 ring-offset-1 ring-blue-400 shadow-sm`
                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input 
                placeholder="Поиск по серийному номеру или артикулу..." 
                className="pl-10 bg-white border-slate-200 focus:border-blue-400 focus:ring-blue-400"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-200">
                Всего: {filteredGauges.length}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="font-semibold text-slate-700">Serial Number</TableHead>
                  <TableHead className="font-semibold text-slate-700">Part Number</TableHead>
                  <TableHead className="font-semibold text-slate-700">Description</TableHead>
                  <TableHead className="font-semibold text-slate-700">Последняя поверка</TableHead>
                  <TableHead className="font-semibold text-slate-700">Следующая поверка</TableHead>
                  <TableHead className="font-semibold text-slate-700">Фото</TableHead>
                  <TableHead className="font-semibold text-slate-700 text-right">Осталось дней</TableHead>
                  <TableHead className="font-semibold text-slate-700">Статус</TableHead>
                  <TableHead className="w-[120px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={8} className="animate-pulse bg-slate-50/50 h-12" />
                    </TableRow>
                  ))
                ) : filteredGauges.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-48 text-center text-slate-500">
                      Манометры не найдены
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredGauges.map((gauge: Gauge) => {
                    const daysLeft = getDaysLeft(gauge.next_verification)
                    return (
                      <TableRow key={gauge.id} className="hover:bg-slate-50/50 transition-colors">
                        <TableCell className="font-medium text-slate-900">
                          <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs font-bold border border-slate-200">
                            {gauge.serial_number}
                          </code>
                        </TableCell>
                        <TableCell className="text-slate-600 text-xs font-mono">
                          {gauge.part_number}
                        </TableCell>
                        <TableCell className="text-slate-600 max-w-[200px] truncate">
                          {gauge.description}
                        </TableCell>
                        <TableCell className="text-slate-500 text-sm">
                          {gauge.last_verification ? format(parseISO(gauge.last_verification), 'dd.MM.yyyy') : '-'}
                        </TableCell>
                        <TableCell>
                           <div className="flex items-center gap-2">
                             <Calendar className="w-3.5 h-3.5 text-slate-400" />
                             <span className={daysLeft < 0 ? "text-red-600 font-bold" : "text-slate-700"}>
                               {gauge.next_verification ? format(parseISO(gauge.next_verification), 'dd.MM.yyyy') : '-'}
                             </span>
                           </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex -space-x-2">
                            {gauge.photo_url ? (
                              <div className="w-10 h-10 rounded-lg border-2 border-white shadow-sm overflow-hidden group relative cursor-pointer" onClick={() => window.open(gauge.photo_url, '_blank')}>
                                <img src={gauge.photo_url} alt="Instance" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                  <Search className="w-4 h-4 text-white" />
                                </div>
                              </div>
                            ) : (
                               <div className="w-10 h-10 rounded-lg bg-slate-50 border border-dashed border-slate-200 flex items-center justify-center text-slate-300">
                                 <Camera className="w-4 h-4" />
                               </div>
                            )}
                            {gauge.model_image_url && (
                              <div className="w-10 h-10 rounded-lg border-2 border-white shadow-sm overflow-hidden group relative cursor-pointer translate-x-2" title="Фото модели" onClick={() => window.open(gauge.model_image_url, '_blank')}>
                                <img src={gauge.model_image_url} alt="Model" className="w-full h-full object-cover opacity-80" />
                                <div className="absolute inset-0 bg-blue-600/20" />
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline" className={`font-bold ${getStatusColor(gauge)}`}>
                            {daysLeft} дн.
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {gauge.status === 'На складе' && <Badge className="bg-slate-200 text-slate-700 hover:bg-slate-200">Склад</Badge>}
                            {gauge.status === 'На локомотиве' && (
                              <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200 gap-1">
                                {gauge.locomotive?.series || 'Лок.'} {gauge.locomotive?.number}
                                {gauge.installation_side && (
                                  <span className="ml-1 px-1 py-0.5 bg-blue-600 text-white rounded text-[10px]">
                                    {gauge.installation_side}
                                  </span>
                                )}
                              </Badge>
                            )}
                            {gauge.status === 'На поверке' && <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Поверка</Badge>}
                            {gauge.status === 'Списан' && <Badge className="bg-gray-200 text-gray-600 hover:bg-gray-200">Списан</Badge>}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                           <div className="flex items-center justify-end gap-1">
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                className="h-8 w-8 text-slate-400 hover:text-green-600" 
                                title="Провести поверку (+1 год)"
                                onClick={() => handleVerify(gauge)}
                              >
                                <Calendar className="w-4 h-4" />
                              </Button>
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                className="h-8 w-8 text-slate-400 hover:text-blue-600" 
                                title="QR Код"
                                onClick={() => setSelectedGaugeForQR(gauge)}
                              >
                                <QrCode className="w-4 h-4" />
                              </Button>
                               <Button 
                                size="icon" 
                                variant="ghost" 
                                className="h-8 w-8 text-slate-400 hover:text-blue-600 relative overflow-hidden" 
                                title="Загрузить фото"
                              >
                                <Camera className="w-4 h-4" />
                                <input 
                                  type="file" 
                                  className="absolute inset-0 opacity-0 cursor-pointer" 
                                  accept="image/*"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0]
                                    if (file) uploadPhotoMutation.mutate({ id: gauge.id, file })
                                  }}
                                />
                              </Button>
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                className="h-8 w-8 text-slate-400 hover:text-blue-600" 
                                title="Редактировать"
                                onClick={() => {
                                  setEditingGauge(gauge);
                                  setIsEditDialogOpen(true);
                                }}
                              >
                                <Settings2 className="w-4 h-4" />
                              </Button>
                              {gauge.status === 'На складе' ? (
                                <Button 
                                  size="sm" 
                                  className="h-8 bg-blue-600 hover:bg-blue-700 text-white font-bold ml-2 px-3"
                                  onClick={() => {
                                    setSelectedGaugeForInstall(gauge);
                                    setIsInstallDialogOpen(true);
                                  }}
                                >
                                  Выдать
                                </Button>
                              ) : gauge.status === 'На локомотиве' ? (
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  className="h-8 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 font-bold ml-2 px-3"
                                  onClick={() => {
                                    if (window.confirm(`Снять манометр ${gauge.serial_number} с локомотива?`)) {
                                      handleUninstall(gauge);
                                    }
                                  }}
                                >
                                  Снять
                                </Button>
                              ) : null}
                           </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isManageTypesOpen} onOpenChange={setIsManageTypesOpen}>
        <DialogContent className="sm:max-w-[700px] rounded-3xl p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="p-8 pb-0 bg-white">
            <DialogTitle className="text-2xl font-black text-slate-900">Справочник моделей</DialogTitle>
            <DialogDescription className="text-slate-500">
              Управление типами манометров (Part Numbers).
            </DialogDescription>
          </DialogHeader>
          <div className="p-8 pt-6 bg-white space-y-6">
            <div className="flex gap-4 items-end bg-slate-50 p-6 rounded-2xl border border-slate-100">
              <div className="flex-1 space-y-2">
                <Label className="text-slate-600 font-bold text-xs uppercase tracking-wider">Part Number</Label>
                <Input 
                  placeholder="Напр. 84A2341" 
                  value={newGaugeType.part_number} 
                  onChange={e => setNewGaugeType(prev => ({...prev, part_number: e.target.value}))} 
                  className="h-11 border-slate-200 rounded-xl"
                />
              </div>
              <div className="flex-1 space-y-2">
                <Label className="text-slate-600 font-bold text-xs uppercase tracking-wider">Описание</Label>
                <Input 
                  placeholder="Напр. Pressure Gauge" 
                  value={newGaugeType.description} 
                  onChange={e => setNewGaugeType(prev => ({...prev, description: e.target.value}))} 
                  className="h-11 border-slate-200 rounded-xl"
                />
              </div>
              <Button 
                onClick={() => {
                  if (newGaugeType.part_number) createTypeMutation.mutate(newGaugeType)
                }}
                disabled={!newGaugeType.part_number || createTypeMutation.isPending}
                className="h-11 px-6 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl shadow-lg shadow-blue-100 transition-all active:scale-95"
              >
                <Plus className="w-4 h-4 mr-2" /> Добавить
              </Button>
            </div>
            
            <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
              <div className="max-h-[350px] overflow-y-auto w-full">
                <Table>
                  <TableHeader className="bg-slate-50/50 sticky top-0 backdrop-blur-sm z-10">
                    <TableRow className="hover:bg-transparent border-slate-100">
                      <TableHead className="font-bold text-slate-400 uppercase text-[10px] tracking-widest pl-6">Part Number</TableHead>
                      <TableHead className="font-bold text-slate-400 uppercase text-[10px] tracking-widest">Описание</TableHead>
                      <TableHead className="w-[100px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!Array.isArray(gaugeTypes) || gaugeTypes.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-slate-400 h-32 italic">Справочник пуст</TableCell>
                      </TableRow>
                    ) : (
                      gaugeTypes.map(t => (
                        <TableRow key={t.id} className="hover:bg-slate-50/50 transition-colors border-slate-50">
                          <TableCell className="font-bold text-slate-900 pl-6">{t.part_number}</TableCell>
                          <TableCell className="text-slate-600 text-sm font-medium">{t.description}</TableCell>
                          <TableCell className="p-2 pr-6 flex items-center gap-2 justify-end">
                            <div className="relative h-9 w-9 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 hover:text-blue-600 cursor-pointer overflow-hidden transition-all hover:shadow-md group" title="Загрузить фото модели">
                              {t.image_url ? (
                                <img src={t.image_url} className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                              ) : (
                                <Camera className="w-4 h-4" />
                              )}
                              <input 
                                type="file" 
                                className="absolute inset-0 opacity-0 cursor-pointer" 
                                accept="image/*"
                                onChange={(e) => {
                                  const file = e.target.files?.[0]
                                  if (file) uploadTypeImageMutation.mutate({ id: t.id, file })
                                }}
                              />
                            </div>
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="text-slate-300 hover:bg-red-50 hover:text-red-600 w-9 h-9 rounded-xl transition-colors" 
                              onClick={() => {
                                if (window.confirm('Удалить эту модель из справочника?')) deleteTypeMutation.mutate(t.id)
                              }}
                              disabled={deleteTypeMutation.isPending}
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
            </div>
            
            <div className="flex justify-end pt-2">
               <Button 
                 variant="ghost" 
                 onClick={() => setIsManageTypesOpen(false)}
                 className="h-12 px-8 rounded-xl text-slate-500 font-bold hover:bg-slate-50"
               >
                 Закрыть
               </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-3xl p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="p-8 pb-0 bg-white">
            <DialogTitle className="text-2xl font-black text-slate-900">Редактирование прибора</DialogTitle>
            <DialogDescription className="text-slate-500">
              Обновите данные манометра {editingGauge?.serial_number}.
            </DialogDescription>
          </DialogHeader>
          <div className="p-8 pt-6 bg-white">
            {editingGauge && (
              <form onSubmit={handleEditSubmit} className="space-y-6">
                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                  <div className="space-y-2">
                    <Label className="text-slate-600 font-bold">Serial Number</Label>
                    <Input 
                      required 
                      value={editingGauge.serial_number}
                      onChange={e => setEditingGauge({...editingGauge, serial_number: e.target.value})}
                      className="h-11 border-slate-200 focus:ring-blue-500 rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-600 font-bold">Модель (Part Number)</Label>
                    <UISelect 
                      value={editingGauge.type_id || ""}
                      onValueChange={val => setEditingGauge({...editingGauge, type_id: val})}
                    >
                      <UISelectTrigger className="h-11 border-slate-200 rounded-xl">
                        <UISelectValue placeholder="Модель..." />
                      </UISelectTrigger>
                      <UISelectContent>
                        {Array.isArray(gaugeTypes) && gaugeTypes.map(t => (
                          <UISelectItem key={t.id} value={t.id}>{t.part_number} — {t.description}</UISelectItem>
                        ))}
                      </UISelectContent>
                    </UISelect>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-slate-600 font-bold">Последняя поверка</Label>
                    <Input 
                      type="date" 
                      value={editingGauge.last_verification}
                      onChange={e => {
                        const date = parseISO(e.target.value);
                        if (!isNaN(date.getTime())) {
                          const nextDate = addYears(date, 1);
                          setEditingGauge({...editingGauge, last_verification: e.target.value, next_verification: format(nextDate, 'yyyy-MM-dd')});
                        } else {
                          setEditingGauge({...editingGauge, last_verification: e.target.value});
                        }
                      }}
                      className="h-11 border-slate-200 rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-600 font-bold">Следующая поверка</Label>
                    <Input 
                      type="date" 
                      value={editingGauge.next_verification}
                      onChange={e => setEditingGauge({...editingGauge, next_verification: e.target.value})}
                      className="h-11 border-slate-200 rounded-xl"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-slate-600 font-bold">Статус</Label>
                    <UISelect 
                       value={editingGauge.status}
                       onValueChange={val => setEditingGauge({...editingGauge, status: val as any, locomotive_id: val !== 'На локомотиве' ? null : editingGauge.locomotive_id})}
                    >
                      <UISelectTrigger className="h-11 border-slate-200 rounded-xl">
                        <UISelectValue />
                      </UISelectTrigger>
                      <UISelectContent>
                        <UISelectItem value="На складе">На складе</UISelectItem>
                        <UISelectItem value="На локомотиве">На локомотиве</UISelectItem>
                        <UISelectItem value="На поверке">На поверке</UISelectItem>
                        <UISelectItem value="Списан">Списан</UISelectItem>
                      </UISelectContent>
                    </UISelect>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-600 font-bold">Локомотив</Label>
                    <UISelect 
                      value={editingGauge.locomotive_id?.toString() || "no"}
                      onValueChange={val => setEditingGauge({
                        ...editingGauge, 
                        locomotive_id: val === "no" ? null : parseInt(val), 
                        status: val === "no" ? 'На складе' : 'На локомотиве'
                      })}
                    >
                      <UISelectTrigger className="h-11 border-slate-200 rounded-xl">
                        <UISelectValue placeholder="Номер..." />
                      </UISelectTrigger>
                      <UISelectContent>
                        <UISelectItem value="no">Нет (На складе)</UISelectItem>
                        {filteredLocomotivesList.map((l: any) => (
                          <UISelectItem key={l.id} value={l.id.toString()}>{l.number}</UISelectItem>
                        ))}
                      </UISelectContent>
                    </UISelect>
                  </div>
                </div>

                {editingGauge.status === 'На локомотиве' && (
                  <div className="space-y-2 p-4 bg-blue-50/50 rounded-2xl border border-blue-100 animate-in fade-in slide-in-from-top-2">
                    <Label className="text-blue-700 font-black uppercase text-[10px] tracking-wider">Сторона установки (Кабина)</Label>
                    <div className="flex gap-2">
                      {['K1', 'K2'].map((side) => (
                        <button
                          key={side}
                          type="button"
                          onClick={() => setEditingGauge({...editingGauge, installation_side: side as any})}
                          className={`flex-1 py-3 rounded-xl border text-sm font-black transition-all ${
                            editingGauge.installation_side === side 
                              ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-200' 
                              : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                          }`}
                        >
                          Cabin {side}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <Button 
                    type="button" 
                    variant="ghost" 
                    onClick={() => setIsEditDialogOpen(false)}
                    className="flex-1 h-12 rounded-xl text-slate-500 font-bold"
                  >
                    Отмена
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={updateMutation.isPending}
                    className="flex-1 h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black shadow-lg shadow-blue-200"
                  >
                    {updateMutation.isPending ? "Сохранение..." : "Сохранить изменения"}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isInstallDialogOpen} onOpenChange={setIsInstallDialogOpen}>
        <DialogContent className="sm:max-w-[450px] rounded-3xl p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="p-8 pb-0 bg-white">
            <DialogTitle className="text-2xl font-black text-slate-900">Выдача на локомотив</DialogTitle>
            <DialogDescription className="text-slate-500">
              Манометр <span className="text-blue-600 font-bold">{selectedGaugeForInstall?.serial_number}</span> будет прикреплен к локомотиву.
            </DialogDescription>
          </DialogHeader>
          <div className="p-8 pt-6 bg-white space-y-6">
            <div className="space-y-2">
              <Label className="text-slate-600 font-bold">Выберите локомотив</Label>
              <UISelect 
                value={installToLocoId?.toString() || ""}
                onValueChange={(val) => setInstallToLocoId(val ? parseInt(val) : null)}
              >
                <UISelectTrigger className="h-12 border-slate-200 rounded-xl bg-slate-50/30">
                  <UISelectValue placeholder="Номер локомотива..." />
                </UISelectTrigger>
                <UISelectContent>
                  {filteredLocomotivesList.map((l: any) => (
                    <UISelectItem key={l.id} value={l.id.toString()}>{l.number}</UISelectItem>
                  ))}
                </UISelectContent>
              </UISelect>
            </div>

            <div className="space-y-3">
              <Label className="text-slate-600 font-bold uppercase text-[10px] tracking-widest">Сторона установки</Label>
              <div className="flex gap-2">
                {['K1', 'K2'].map((side) => (
                  <button
                    key={side}
                    type="button"
                    onClick={() => setInstallSide(side as 'K1' | 'K2')}
                    className={`flex-1 py-4 rounded-2xl border text-sm font-black transition-all ${
                      installSide === side 
                        ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-100' 
                        : 'bg-white text-slate-500 border-slate-200 hover:border-blue-300'
                    }`}
                  >
                    Cabin {side}
                  </button>
                ))}
              </div>
            </div>
            
            {(selectedGaugeForInstall?.photo_url || selectedGaugeForInstall?.model_image_url) && (
              <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 flex justify-center group overflow-hidden">
                 <img 
                   src={selectedGaugeForInstall.photo_url || selectedGaugeForInstall.model_image_url || ""} 
                   className="h-32 w-auto object-contain rounded-xl shadow-sm group-hover:scale-105 transition-transform"
                   alt="Preview"
                 />
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button 
                variant="ghost" 
                className="flex-1 h-12 rounded-xl text-slate-500 font-bold"
                onClick={() => {
                  setIsInstallDialogOpen(false);
                  setSelectedGaugeForInstall(null);
                  setInstallToLocoId(null);
                }}
              >
                Отмена
              </Button>
              <Button 
                className="flex-1 h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black shadow-lg shadow-blue-200 transition-all active:scale-95"
                disabled={!installToLocoId || updateMutation.isPending}
                onClick={handleInstall}
              >
                {updateMutation.isPending ? "Выполняется..." : "Выдать прибор"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedGaugeForQR} onOpenChange={(open) => !open && setSelectedGaugeForQR(null)}>
        <DialogContent className="sm:max-w-[400px] rounded-3xl p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="p-8 pb-0 bg-white">
            <DialogTitle className="text-2xl font-black text-slate-900">QR Код прибора</DialogTitle>
            <DialogDescription className="text-slate-500">
              Код для быстрого сканирования.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center p-8 space-y-6 bg-white">
            <div className="p-6 bg-white rounded-[2rem] shadow-xl shadow-slate-200 border border-slate-100">
              {selectedGaugeForQR && (
                <QRCodeSVG 
                  value={`gauge:${selectedGaugeForQR.serial_number}`} 
                  size={220}
                  level="H"
                  includeMargin={true}
                />
              )}
            </div>
            <div className="text-center space-y-1">
              <p className="text-xl font-black text-slate-900 tracking-tight">{selectedGaugeForQR?.serial_number}</p>
              <p className="text-sm font-medium text-slate-400 uppercase tracking-widest">{selectedGaugeForQR?.part_number}</p>
            </div>
            <div className="flex gap-3 w-full pt-2">
              <Button className="flex-1 h-12 rounded-xl gap-2 font-bold" variant="outline">
                <Printer className="w-4 h-4" />
                Печать
              </Button>
              <Button className="flex-1 h-12 rounded-xl font-bold bg-slate-900 hover:bg-slate-800 text-white" onClick={() => setSelectedGaugeForQR(null)}>
                Закрыть
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Диалог возврата просроченного манометра */}
      <Dialog open={!!returnDialogGauge} onOpenChange={(open) => !open && setReturnDialogGauge(null)}>
        <DialogContent className="sm:max-w-[450px] rounded-3xl p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="p-8 pb-4 bg-red-50">
            <DialogTitle className="text-xl font-black text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-6 h-6" />
              Срок поверки истёк!
            </DialogTitle>
            <DialogDescription className="text-red-600">
              Манометр <span className="font-bold">{returnDialogGauge?.serial_number}</span> просрочен.
              Выберите действие:
            </DialogDescription>
          </DialogHeader>
          <div className="p-8 pt-4 bg-white space-y-3">
            <Button
              className="w-full h-14 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black text-base shadow-lg shadow-amber-100 transition-all active:scale-95"
              onClick={() => handleReturnExpired('verification')}
              disabled={updateMutation.isPending}
            >
              Отправить на поверку
            </Button>
            <Button
              variant="outline"
              className="w-full h-14 rounded-xl font-bold text-base border-slate-200"
              onClick={() => handleReturnExpired('warehouse')}
              disabled={updateMutation.isPending}
            >
              Вернуть на склад (как есть)
            </Button>
            <Button
              variant="outline"
              className="w-full h-14 rounded-xl font-bold text-base text-red-600 border-red-200 hover:bg-red-50"
              onClick={() => handleReturnExpired('decommission')}
              disabled={updateMutation.isPending}
            >
              Списать
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* QR Сканер */}
      <Dialog open={isScannerOpen} onOpenChange={(open) => { if (!open) { stopScanner(); setIsScannerOpen(false); setScanResult(null); } }}>
        <DialogContent className="sm:max-w-[450px] rounded-3xl p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="p-6 pb-2 bg-emerald-50">
            <DialogTitle className="text-xl font-black text-emerald-800 flex items-center gap-2">
              <ScanLine className="w-6 h-6" />
              Сканирование QR
            </DialogTitle>
            <DialogDescription className="text-emerald-600">
              Наведите камеру на QR-код манометра
            </DialogDescription>
          </DialogHeader>
          <div className="p-6 pt-3 bg-white space-y-4">
            <div className="rounded-2xl overflow-hidden bg-black aspect-square relative">
              <div id={scannerContainerId} className="w-full h-full" />
              {!scanResult && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-64 h-64 border-2 border-emerald-400/50 rounded-2xl" />
                </div>
              )}
            </div>
            <Button
              variant="outline"
              className="w-full h-12 rounded-xl font-bold"
              onClick={() => { stopScanner(); setIsScannerOpen(false); setScanResult(null); }}
            >
              <X className="w-4 h-4 mr-2" />
              Закрыть
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default Gauges
