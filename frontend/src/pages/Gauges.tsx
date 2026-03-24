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
  Trash2,
  Camera,
  AlertTriangle,
  ScanLine,
  FileText,
  History,
  Download,
  Eye,
  Upload
} from "lucide-react"
import ExcelJS from 'exceljs'
import { format, differenceInDays, parseISO, addYears } from "date-fns"
import { toast } from "sonner"
import imageCompression from 'browser-image-compression'
import { cn } from "@/lib/utils"

import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
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
import { Skeleton } from "@/components/ui/skeleton"

const GaugeHistoryDialog = ({ gauge, open, onOpenChange }: { gauge: Gauge | null, open: boolean, onOpenChange: (open: boolean) => void }) => {
  const { data: history = [], isLoading } = useQuery({
    queryKey: ['gauge-history', gauge?.id],
    queryFn: () => gauge ? gaugeService.getHistory(gauge.id) : Promise.resolve([]),
    enabled: !!gauge && open
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] rounded-3xl p-0 overflow-hidden border-none shadow-2xl">
        <DialogHeader className="p-8 pb-4 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-200">
              <History className="w-6 h-6" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-semibold text-slate-900">История жизненного цикла</DialogTitle>
              <DialogDescription className="text-slate-500 font-medium">
                Манометр: <span className="text-blue-600 font-semibold">{gauge?.serial_number}</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="p-8 pt-6 bg-white">
          <div className="max-h-[400px] overflow-y-auto pr-2 space-y-4">
            {isLoading ? (
               <div className="space-y-4">
                 {[1,2,3].map(i => <div key={i} className="h-20 bg-slate-50 animate-pulse rounded-2xl" />)}
               </div>
            ) : history.length === 0 ? (
              <div className="text-center py-12 text-slate-400 italic">История перемещений пуста</div>
            ) : (
              <div className="relative border-l-2 border-slate-100 ml-3 pl-6 space-y-8">
                {history.map((item: any) => (
                  <div key={item.id} className="relative">
                    <div className="absolute -left-[31px] top-1 w-4 h-4 rounded-full border-2 border-white bg-blue-500 shadow-sm" />
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 transition-all hover:shadow-md">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-semibold text-slate-900 text-sm tracking-tight">{item.action}</span>
                        <span className="text-[10px] font-semibold text-slate-400 uppercase">{format(parseISO(item.created_at), 'dd.MM.yyyy HH:mm')}</span>
                      </div>
                      <p className="text-sm text-slate-600 leading-relaxed">{item.details}</p>
                      <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
                         <span className="text-[10px] font-semibold text-blue-600 uppercase tracking-widest">
                           {item.locomotive ? `${item.locomotive.series} ${item.locomotive.number}` : 'Склад'}
                         </span>
                         <span className="text-[10px] font-semibold text-slate-400">
                           {item.user?.full_name || item.user?.username || 'Система'}
                         </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="mt-8 flex justify-end">
            <Button 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              className="h-12 px-8 rounded-xl font-semibold border-slate-200 text-slate-600"
            >
              Закрыть
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

const Gauges = () => {
  const [searchParams] = useSearchParams()
  const initialSerial = searchParams.get('serial') || ""
  
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState(initialSerial)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [selectedGaugeForQR, setSelectedGaugeForQR] = useState<Gauge | null>(null)
  
  const [isManageTypesOpen, setIsManageTypesOpen] = useState(false)
  const [newGaugeType, setNewGaugeType] = useState({ 
    part_number: "", 
    description: "",
    accuracy_class: "",
    pressure_range: "",
    thread_type: ""
  })
  
  const [selectedGaugeForHistory, setSelectedGaugeForHistory] = useState<Gauge | null>(null)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  
  const [isInstallDialogOpen, setIsInstallDialogOpen] = useState(false)
  const [selectedGaugeForInstall, setSelectedGaugeForInstall] = useState<Gauge | null>(null)
  const [installToLocoId, setInstallToLocoId] = useState<number | null>(null)
  const [installSide, setInstallSide] = useState<'K1' | 'K2'>('K1')

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingGauge, setEditingGauge] = useState<Partial<Gauge> | null>(null)

  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [returnDialogGauge, setReturnDialogGauge] = useState<Gauge | null>(null)

  const [isScannerOpen, setIsScannerOpen] = useState(false)
  const [scanResult, setScanResult] = useState<string | null>(null)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const scannerContainerId = "qr-scanner-container"
  
  useEffect(() => {
    if (initialSerial) setSearchTerm(initialSerial)
  }, [initialSerial])

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === 2) await scannerRef.current.stop();
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
            setScanResult(decodedText);
            stopScanner();
          },
          () => { /* ignore */ }
        );
      } catch (err) {
        console.error('Ошибка камеры:', err);
        toast.error('Не удалось открыть камеру. Проверьте разрешения.');
        setIsScannerOpen(false);
      }
    }, 300);
    return () => { clearTimeout(timer); stopScanner(); };
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
    } catch (e) { setNewGauge(prev => ({...prev, last_verification: dateStr})); }
  }

  const { data: gauges = [], isLoading } = useQuery({
    queryKey: ['gauges'],
    queryFn: gaugeService.getAll
  })

  useEffect(() => {
    if (scanResult && Array.isArray(gauges)) {
      const serial = scanResult.startsWith('gauge:') ? scanResult.replace('gauge:', '').trim() : scanResult.trim();
      const found = gauges.find((g: Gauge) => g.serial_number.toLowerCase() === serial.toLowerCase());
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
    }
  }, [scanResult, gauges]);

  const { data: locomotives = [] } = useQuery({
    queryKey: ['locomotives-list'],
    queryFn: () => locomotiveApi.getAll().then(res => res || [])
  })

  const filteredLocomotivesList = useMemo(() => {
    if (!Array.isArray(locomotives)) return [];
    return locomotives
      .filter((l: any) => {
        const series = String(l.series || "").toUpperCase();
        return series.includes("ТЭ33") || series.includes("ТЭП33");
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
      setNewGaugeType({ 
        part_number: "", 
        description: "",
        accuracy_class: "",
        pressure_range: "",
        thread_type: ""
      })
      toast.success("Новая модель добавлена")
    },
    onError: (err: any) => toast.error(err.message)
  })

  const deleteTypeMutation = useMutation({
    mutationFn: (id: string) => gaugeTypeService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gauge-types'] })
      toast.success("Модель удалена")
    },
    onError: (err: any) => toast.error(err.message)
  })

  const createMutation = useMutation({
    mutationFn: (data: Partial<Gauge>) => gaugeService.create(data),
    onSuccess: (createdGauge: any) => {
      queryClient.invalidateQueries({ queryKey: ['gauges'] })
      setIsAddDialogOpen(false)
      toast.success("Манометр добавлен")
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
    onError: (err: any) => toast.error(err.message)
  })

  const updateMutation = useMutation({
    mutationFn: ({id, ...data}: Partial<Gauge> & {id: string}) => gaugeService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gauges'] })
      toast.success("Данные обновлены")
    },
    onError: (err: any) => toast.error(err.message)
  })

  const uploadTypeImageMutation = useMutation({
    mutationFn: async ({id, file}: {id: string, file: File}) => {
      const options = { maxSizeMB: 0.5, maxWidthOrHeight: 1280, useWebWorker: true }
      const compressedFile = await imageCompression(file, options)
      const formData = new FormData()
      formData.append('photo', compressedFile, compressedFile.name)
      return gaugeTypeService.uploadPhoto(id, formData)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gauge-types'] })
      queryClient.invalidateQueries({ queryKey: ['gauges'] })
      toast.success("Изображение обновлено")
    }
  })

  const uploadCertificateMutation = useMutation({
    mutationFn: async ({id, file}: {id: string, file: File}) => {
      const formData = new FormData()
      formData.append('certificate', file, file.name)
      return gaugeService.uploadCertificate(id, formData)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gauges'] })
      toast.success("Сертификат загружен")
    }
  })

  const exportToExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Журнал манометров');
    worksheet.columns = [
      { header: '№', key: 'index', width: 5 },
      { header: 'Серийный номер', key: 'serial', width: 20 },
      { header: 'Парт-номер', key: 'part', width: 15 },
      { header: 'Описание', key: 'desc', width: 25 },
      { header: 'Класс точности', key: 'class', width: 10 },
      { header: 'Диапазон', key: 'range', width: 15 },
      { header: 'Резьба', key: 'thread', width: 15 },
      { header: 'Последняя поверка', key: 'last', width: 15 },
      { header: 'Следующая поверка', key: 'next', width: 15 },
      { header: 'Статус', key: 'status', width: 15 },
      { header: 'Локомотив', key: 'loco', width: 15 },
    ];
    worksheet.getRow(1).font = { bold: true };
    filteredGauges.forEach((g, idx) => {
      worksheet.addRow({
        index: idx + 1,
        serial: g.serial_number,
        part: g.part_number || '-',
        desc: g.description || '-',
        class: g.accuracy_class || '-',
        range: g.pressure_range || '-',
        thread: g.thread_type || '-',
        last: g.last_verification ? format(parseISO(g.last_verification), 'dd.MM.yyyy') : '-',
        next: g.next_verification ? format(parseISO(g.next_verification), 'dd.MM.yyyy') : '-',
        status: g.status,
        loco: g.locomotive ? `${g.locomotive.series} ${g.locomotive.number}` : 'Склад'
      });
    });
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `Gauge_Journal_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
    anchor.click();
    window.URL.revokeObjectURL(url);
    toast.success("Журнал экспортирован");
  };

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
    }, { onSuccess: () => { setIsInstallDialogOpen(false); setSelectedGaugeForInstall(null); } });
  }

  const handleUninstall = (gauge: Gauge) => {
    const daysLeft = differenceInDays(parseISO(gauge.next_verification), new Date())
    if (daysLeft < 0) setReturnDialogGauge(gauge);
    else updateMutation.mutate({ id: gauge.id, status: 'На складе', locomotive_id: null, installation_side: null });
  }

  const handleReturnExpired = (action: 'warehouse' | 'verification' | 'decommission') => {
    if (!returnDialogGauge) return;
    const updates: any = { id: returnDialogGauge.id, locomotive_id: null, installation_side: null };
    if (action === 'verification') updates.status = 'На поверке';
    else if (action === 'decommission') { updates.status = 'Списан'; updates.is_defective = true; }
    else updates.status = 'На складе';
    updateMutation.mutate(updates, { onSuccess: () => setReturnDialogGauge(null) });
  }

  const getStatusColor = (gauge: Gauge) => {
    if (gauge.is_defective) return "bg-red-100 text-red-700 border-red-200"
    const d = differenceInDays(parseISO(gauge.next_verification), new Date())
    if (d < 0) return "bg-red-500 text-white animate-pulse"
    if (d < 30) return "bg-amber-100 text-amber-700 border-amber-200"
    return "bg-emerald-50 text-emerald-700 border-emerald-200"
  }

  const filteredGauges = useMemo(() => {
    if (!Array.isArray(gauges)) return [];
    return gauges.filter((g: Gauge) => {
      const matchS = g.serial_number.toLowerCase().includes(searchTerm.toLowerCase()) || 
                     g.part_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                     (g.locomotive?.number || "").includes(searchTerm);
      if (!matchS) return false;
      if (statusFilter === 'all') return true;
      if (statusFilter === 'expired') return differenceInDays(parseISO(g.next_verification), new Date()) < 0;
      if (statusFilter === 'expiring') {
        const d = differenceInDays(parseISO(g.next_verification), new Date());
        return d >= 0 && d < 30;
      }
      return g.status === statusFilter;
    });
  }, [gauges, searchTerm, statusFilter])

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
            Метрология
          </h1>
          <p className="text-slate-500 mt-1">Учет манометров и контроль сроков поверки</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2 bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 font-semibold" onClick={() => setIsScannerOpen(true)}>
            <ScanLine className="w-4 h-4" /> Сканировать
          </Button>
          <Button variant="outline" className="gap-2" onClick={exportToExcel}>
            <Download className="w-4 h-4" /> Экспорт
          </Button>
          <Button className="gap-2 bg-blue-600 hover:bg-blue-700 shadow-md" onClick={() => setIsAddDialogOpen(true)}>
             <Plus className="w-4 h-4" /> Добавить прибор
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Всего" value={gauges.length} color="slate" active={statusFilter === 'all'} onClick={() => setStatusFilter('all')} />
        <StatCard label="Просрочено" value={gauges.filter(g => differenceInDays(parseISO(g.next_verification), new Date()) < 0).length} color="red" active={statusFilter === 'expired'} onClick={() => setStatusFilter('expired')} />
        <StatCard label="Срок истекает" value={gauges.filter(g => { const d = differenceInDays(parseISO(g.next_verification), new Date()); return d >= 0 && d < 30; }).length} color="amber" active={statusFilter === 'expiring'} onClick={() => setStatusFilter('expiring')} />
        <StatCard label="В норме" value={gauges.filter(g => differenceInDays(parseISO(g.next_verification), new Date()) >= 30).length} color="emerald" active={false} onClick={() => setStatusFilter('all')} />
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <Input 
            placeholder="Поиск по серийному номеру, модели или локомотиву..." 
            className="pl-12 h-14 bg-white border-slate-200 rounded-2xl text-lg shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {['all', 'На складе', 'На локомотиве', 'На поверке', 'Списан'].map(f => (
            <button key={f} onClick={() => setStatusFilter(f)} className={cn(
              "px-4 py-2 rounded-xl text-xs font-semibold transition-all border",
              statusFilter === f ? "bg-blue-50 text-blue-700 border-blue-200 ring-2 ring-blue-400" : "bg-white text-slate-500 border-slate-200"
            )}>
              {f === 'all' ? 'Все' : f}
            </button>
          ))}
          <Button variant="ghost" className="h-10 rounded-xl font-semibold" onClick={() => setIsManageTypesOpen(true)}>
            <Settings2 className="w-4 h-4 mr-2" /> Справочник моделей
          </Button>
        </div>
      </div>

      <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50/50">
            <TableRow>
              <TableHead className="font-semibold pl-6">Прибор</TableHead>
              <TableHead className="font-semibold">Поверка</TableHead>
              <TableHead className="font-semibold">Характеристики</TableHead>
              <TableHead className="font-semibold">Статус</TableHead>
              <TableHead className="text-right pr-6 w-[200px]">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <GaugeTableSkeleton />
            ) : filteredGauges.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="h-32 text-center text-slate-400 italic">Приборы не найдены</TableCell></TableRow>
            ) : filteredGauges.map((gauge: Gauge) => {
              const d = differenceInDays(parseISO(gauge.next_verification), new Date())
              return (
                <TableRow key={gauge.id} className="hover:bg-slate-50/50 transition-colors">
                  <TableCell className="pl-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-slate-900 font-semibold text-lg">{gauge.serial_number}</span>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-slate-400 font-semibold text-xs uppercase">{gauge.part_number}</span>
                        {gauge.certificate_url && (
                          <a href={gauge.certificate_url} target="_blank" rel="noreferrer" className="text-blue-500 hover:text-blue-700"><FileText className="w-3.5 h-3.5" /></a>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col group">
                      <span className="text-slate-700 font-semibold tabular-nums">{format(parseISO(gauge.next_verification), 'dd.MM.yyyy')}</span>
                      <span className={cn("text-[10px] font-semibold uppercase tracking-tighter", d < 0 ? "text-red-500" : d < 30 ? "text-amber-500" : "text-emerald-500")}>
                        {d < 0 ? 'Просрочен' : d < 30 ? `Через ${d} дн` : 'В норме'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col text-[10px] font-semibold text-slate-400 uppercase tracking-widest leading-tight">
                      <span>Кл: {gauge.accuracy_class || '-'}</span>
                      <span>Диап: {gauge.pressure_range || '-'}</span>
                      <span>Резьба: {gauge.thread_type || '-'}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Badge className={cn("w-fit", getStatusColor(gauge))}>
                         {gauge.status === 'На локомотиве' ? `${gauge.locomotive?.series} ${gauge.locomotive?.number}` : gauge.status}
                      </Badge>
                      {gauge.installation_side && <span className="text-[9px] font-semibold text-blue-600 bg-blue-50 px-1.5 rounded uppercase w-fit">Cabin {gauge.installation_side}</span>}
                    </div>
                  </TableCell>
                  <TableCell className="text-right pr-6">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-green-600" onClick={() => handleVerify(gauge)} title="Поверка +1 год"><Calendar className="w-4 h-4" /></Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-blue-600" onClick={() => { setSelectedGaugeForHistory(gauge); setIsHistoryOpen(true); }} title="История"><History className="w-4 h-4" /></Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-blue-600" onClick={() => setSelectedGaugeForQR(gauge)} title="QR Код"><QrCode className="w-4 h-4" /></Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-blue-600" onClick={() => { setEditingGauge(gauge); setIsEditDialogOpen(true); }} title="Правка"><Settings2 className="w-4 h-4" /></Button>
                      
                      {gauge.status === 'На складе' ? (
                        <Button size="sm" className="h-8 bg-blue-600 font-semibold ml-2" onClick={() => { setSelectedGaugeForInstall(gauge); setIsInstallDialogOpen(true); }}>Выдать</Button>
                      ) : gauge.status === 'На локомотиве' ? (
                        <Button size="sm" variant="outline" className="h-8 text-red-600 border-red-200 font-semibold ml-2" onClick={() => { if(confirm('Снять прибор?')) handleUninstall(gauge); }}>Снять</Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </Card>

      {/* Dialogs */}
      <GaugeHistoryDialog 
        gauge={selectedGaugeForHistory} 
        open={isHistoryOpen} 
        onOpenChange={setIsHistoryOpen} 
      />

      {/* Manage Types Dialog */}
      <Dialog open={isManageTypesOpen} onOpenChange={setIsManageTypesOpen}>
        <DialogContent className="sm:max-w-[750px] rounded-3xl p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="p-8 pb-4 bg-slate-50">
            <DialogTitle className="text-2xl font-semibold">Справочник моделей</DialogTitle>
          </DialogHeader>
          <div className="p-8 space-y-6">
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1"><Label className="text-[10px] uppercase font-semibold text-slate-400">Part Number</Label><Input value={newGaugeType.part_number} onChange={e => setNewGaugeType({...newGaugeType, part_number: e.target.value})} className="h-10 rounded-xl" /></div>
                <div className="space-y-1"><Label className="text-[10px] uppercase font-semibold text-slate-400">Описание</Label><Input value={newGaugeType.description} onChange={e => setNewGaugeType({...newGaugeType, description: e.target.value})} className="h-10 rounded-xl" /></div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1"><Label className="text-[10px] uppercase font-semibold text-slate-400">Класс точности</Label><Input value={newGaugeType.accuracy_class} onChange={e => setNewGaugeType({...newGaugeType, accuracy_class: e.target.value})} className="h-10 rounded-xl" /></div>
                <div className="space-y-1"><Label className="text-[10px] uppercase font-semibold text-slate-400">Диапазон</Label><Input value={newGaugeType.pressure_range} onChange={e => setNewGaugeType({...newGaugeType, pressure_range: e.target.value})} className="h-10 rounded-xl" /></div>
                <div className="space-y-1"><Label className="text-[10px] uppercase font-semibold text-slate-400">Резьба</Label><Input value={newGaugeType.thread_type} onChange={e => setNewGaugeType({...newGaugeType, thread_type: e.target.value})} className="h-10 rounded-xl" /></div>
              </div>
              <Button className="w-full h-12 bg-slate-900 font-semibold rounded-xl" onClick={() => createTypeMutation.mutate(newGaugeType)}>Добавить модель</Button>
            </div>

            <div className="border border-slate-100 rounded-2xl overflow-hidden max-h-[300px] overflow-y-auto">
              <Table>
                <TableHeader className="bg-slate-50 sticky top-0">
                  <TableRow><TableHead className="pl-6 text-[11px] font-semibold">Модель</TableHead><TableHead className="pl-6 text-[11px] font-semibold">Характеристики</TableHead><TableHead /></TableRow>
                </TableHeader>
                <TableBody>
                  {gaugeTypes.map(t => (
                    <TableRow key={t.id}>
                      <TableCell className="pl-6 font-semibold">{t.part_number}</TableCell>
                      <TableCell className="text-[10px] text-slate-500">Кл: {t.accuracy_class} | {t.pressure_range}</TableCell>
                      <TableCell className="pr-6 text-right space-x-2">
                        <div className="inline-block relative h-8 w-8 rounded-lg overflow-hidden border border-slate-200">
                           {t.image_url ? <img src={t.image_url} className="w-full h-full object-cover" /> : <Camera className="w-4 h-4 m-2 text-slate-300" />}
                           <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => e.target.files?.[0] && uploadTypeImageMutation.mutate({id: t.id, file: e.target.files[0]})} />
                        </div>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-red-400" onClick={() => deleteTypeMutation.mutate(t.id)}><Trash2 className="w-4 h-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Gauge Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-3xl p-8 space-y-6">
           <DialogHeader><DialogTitle className="text-2xl font-semibold">Новый прибор</DialogTitle></DialogHeader>
           <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(newGauge); }} className="space-y-4">
             <div className="grid grid-cols-2 gap-4">
               <div className="space-y-1"><Label>Серийный номер</Label><Input required value={newGauge.serial_number} onChange={e => setNewGauge({...newGauge, serial_number: e.target.value})} className="h-10 rounded-xl" /></div>
               <div className="space-y-1">
                 <Label>Модель</Label>
                 <UISelect value={newGauge.type_id} onValueChange={v => setNewGauge({...newGauge, type_id: v})}>
                   <UISelectTrigger className="h-10 rounded-xl"><UISelectValue placeholder="..." /></UISelectTrigger>
                   <UISelectContent>{gaugeTypes.map(t => <UISelectItem key={t.id} value={t.id}>{t.part_number}</UISelectItem>)}</UISelectContent>
                 </UISelect>
               </div>
             </div>
             <div className="grid grid-cols-2 gap-4">
               <div className="space-y-1"><Label>Поверка от</Label><Input type="date" value={newGauge.last_verification} onChange={e => handleLastVerificationChange(e.target.value)} className="h-10 rounded-xl" /></div>
               <div className="space-y-1"><Label>Следующая</Label><Input type="date" value={newGauge.next_verification} onChange={e => setNewGauge({...newGauge, next_verification: e.target.value})} className="h-10 rounded-xl" /></div>
             </div>
             <div className="flex gap-3 pt-4">
               <Button type="button" variant="ghost" onClick={() => setIsAddDialogOpen(false)} className="flex-1">Отмена</Button>
               <Button type="submit" className="flex-1 bg-blue-600 font-semibold">Добавить</Button>
             </div>
           </form>
        </DialogContent>
      </Dialog>

      {/* Edit Gauge Dialog (includes Cert upload) */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-3xl p-8">
           <DialogHeader><DialogTitle className="text-2xl font-semibold">Редактирование</DialogTitle></DialogHeader>
           {editingGauge && (
             <div className="space-y-6 pt-4">
               <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1"><Label>Серийный номер</Label><Input value={editingGauge.serial_number} onChange={e => setEditingGauge({...editingGauge, serial_number: e.target.value})} /></div>
                 <div className="space-y-1"><Label>Статус</Label>
                   <UISelect value={editingGauge.status} onValueChange={v => setEditingGauge({...editingGauge, status: v as any})}>
                     <UISelectTrigger className="h-10 rounded-xl"><UISelectValue /></UISelectTrigger>
                     <UISelectContent><UISelectItem value="На складе">На складе</UISelectItem><UISelectItem value="На поверке">На поверке</UISelectItem><UISelectItem value="Списан">Списан</UISelectItem></UISelectContent>
                   </UISelect>
                 </div>
               </div>
               
               <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                 <Label className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Сертификат поверки (Scan/PDF)</Label>
                 <div className="flex items-center gap-3">
                   {editingGauge.certificate_url ? (
                     <div className="flex-1 flex justify-between items-center bg-white p-3 rounded-xl border border-blue-100">
                        <span className="text-xs font-semibold text-blue-600 truncate max-w-[150px]">Certificate Uploaded</span>
                        <a href={editingGauge.certificate_url} target="_blank" rel="noreferrer" className="text-blue-500 hover:scale-110"><Eye className="w-4 h-4" /></a>
                     </div>
                   ) : <div className="flex-1 text-xs text-slate-400 italic">Документ не загружен</div>}
                   <label className="h-11 px-4 bg-slate-900 text-white rounded-xl flex items-center gap-2 cursor-pointer font-semibold hover:bg-black transition-all">
                     <Upload className="w-4 h-4" /> Загрузить
                     <input type="file" className="hidden" accept=".pdf,image/*" onChange={(e) => e.target.files?.[0] && uploadCertificateMutation.mutate({id: editingGauge.id!, file: e.target.files[0]})} />
                   </label>
                 </div>
               </div>

               <div className="flex gap-3">
                 <Button variant="ghost" onClick={() => setIsEditDialogOpen(false)} className="flex-1">Отмена</Button>
                 <Button className="flex-1 bg-blue-600 font-semibold" onClick={() => { updateMutation.mutate(editingGauge as any); setIsEditDialogOpen(false); }}>Сохранить</Button>
               </div>
             </div>
           )}
        </DialogContent>
      </Dialog>

      {/* Other small dialogs (QR, Install, Return Expired, Scanner) remain simple */}
      <QRDialog gauge={selectedGaugeForQR} open={!!selectedGaugeForQR} onOpenChange={(v: boolean) => !v && setSelectedGaugeForQR(null)} />
      {/* ... keeping the rest of the UI structure ... */}
      <Dialog open={isInstallDialogOpen} onOpenChange={setIsInstallDialogOpen}>
        <DialogContent className="sm:max-w-[450px] rounded-3xl p-8 space-y-6">
           <DialogHeader><DialogTitle className="text-xl font-semibold">Выдача: {selectedGaugeForInstall?.serial_number}</DialogTitle></DialogHeader>
           <div className="space-y-4">
             <div className="space-y-2">
               <Label>Выберите локомотив</Label>
               <UISelect onValueChange={(v) => setInstallToLocoId(parseInt(v))}>
                 <UISelectTrigger><UISelectValue placeholder="..." /></UISelectTrigger>
                 <UISelectContent>{filteredLocomotivesList.map(l => <UISelectItem key={l.id} value={l.id.toString()}>{l.number}</UISelectItem>)}</UISelectContent>
               </UISelect>
             </div>
             <div className="flex gap-2">
               {['K1', 'K2'].map(s => <Button key={s} variant={installSide === s ? 'default' : 'outline'} className="flex-1 font-semibold" onClick={() => setInstallSide(s as any)}>Cabin {s}</Button>)}
             </div>
             <Button className="w-full bg-blue-600 font-semibold h-12" disabled={!installToLocoId} onClick={handleInstall}>Выдать прибор</Button>
           </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!returnDialogGauge} onOpenChange={(v) => !v && setReturnDialogGauge(null)}>
        <DialogContent className="sm:max-w-[400px] rounded-3xl p-8 space-y-4 text-center">
           <DialogHeader className="p-8 pb-4 bg-red-50 text-center">
            <DialogTitle className="text-xl font-semibold text-red-700 flex items-center justify-center gap-2">
              <AlertTriangle className="w-6 h-6" />
              Просрочен!
            </DialogTitle>
            <DialogDescription className="text-red-600">
              Манометр <span className="font-semibold">{returnDialogGauge?.serial_number}</span> требует поверки.
            </DialogDescription>
          </DialogHeader>
           <Button className="w-full bg-amber-500 font-semibold" onClick={() => handleReturnExpired('verification')}>На поверку</Button>
           <Button variant="outline" className="w-full font-semibold" onClick={() => handleReturnExpired('warehouse')}>Просто склад</Button>
           <Button variant="outline" className="w-full text-red-600 font-semibold" onClick={() => handleReturnExpired('decommission')}>Списать</Button>
        </DialogContent>
      </Dialog>

      <Dialog open={isScannerOpen} onOpenChange={setIsScannerOpen}>
        <DialogContent className="sm:max-w-[450px] rounded-[2rem] p-6 space-y-4">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Сканирование QR</DialogTitle>
            <DialogDescription>
              Наведите камеру на QR-код манометра для автоматического распознавания.
            </DialogDescription>
          </DialogHeader>
          <div id={scannerContainerId} className="w-full aspect-square bg-black rounded-2xl overflow-hidden shadow-2xl border-4 border-emerald-500/20" />
           <Button variant="outline" className="w-full rounded-xl font-semibold" onClick={() => setIsScannerOpen(false)}>Отмена</Button>
        </DialogContent>
      </Dialog>

    </div>
  )
}

const StatCard = ({ label, value, color, active, onClick }: any) => {
  const colors: any = {
    slate: "border-slate-200 bg-white",
    red: "border-red-100 bg-red-50 text-red-600",
    amber: "border-amber-100 bg-amber-50 text-amber-600",
    emerald: "border-emerald-100 bg-emerald-50 text-emerald-600"
  }
  return (
    <Card className={cn("cursor-pointer transition-all hover:shadow-md", colors[color], active && "ring-2 ring-blue-400")} onClick={onClick}>
      <CardHeader className="p-4">
        <CardDescription className="text-[10px] font-semibold uppercase tracking-widest">{label}</CardDescription>
        <CardTitle className="text-2xl font-semibold">{value}</CardTitle>
      </CardHeader>
    </Card>
  )
}

const QRDialog = ({ gauge, open, onOpenChange }: any) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-[350px] rounded-3xl p-8 flex flex-col items-center">
      <DialogHeader className="text-center w-full">
        <DialogTitle className="text-xl font-semibold mb-1">QR Код</DialogTitle>
        <DialogDescription>
          Серийный номер: {gauge?.serial_number}
        </DialogDescription>
      </DialogHeader>
      <div className="p-4 bg-white rounded-2xl border shadow-sm my-4">
        {gauge && <QRCodeSVG value={`gauge:${gauge.serial_number}`} size={200} level="H" />}
      </div>
      <p className="font-semibold text-lg">{gauge?.serial_number}</p>
      <Button className="w-full mt-4 bg-slate-900 font-semibold rounded-xl" onClick={() => onOpenChange(false)}>Закрыть</Button>
    </DialogContent>
  </Dialog>
)

const GaugeTableSkeleton = () => (
  <>
    {[1, 2, 3, 4, 5].map((i) => (
      <TableRow key={i}>
        <TableCell className="pl-6 py-4">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-24" />
          </div>
        </TableCell>
        <TableCell>
          <div className="flex flex-col gap-2">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
        </TableCell>
        <TableCell>
          <div className="flex flex-col gap-1">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
        </TableCell>
        <TableCell>
          <div className="flex flex-col gap-2">
            <Skeleton className="h-6 w-28 rounded-full" />
            <Skeleton className="h-3 w-12" />
          </div>
        </TableCell>
        <TableCell className="text-right pr-6">
          <div className="flex items-center justify-end gap-2">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-8 w-16 rounded-lg" />
          </div>
        </TableCell>
      </TableRow>
    ))}
  </>
)

export default Gauges
