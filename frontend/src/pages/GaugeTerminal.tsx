import { useState, useCallback, useEffect, useRef } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { gaugeService, type Gauge } from "@/api/gaugeService"
import { locomotiveApi } from "@/api/locomotiveService"
import { Html5Qrcode } from "html5-qrcode"
import { 
  ScanLine, 
  ArrowLeft, 
  CheckCircle2, 
  AlertCircle, 
  PackageCheck,
  PackageMinus,
  Search,
  Wrench,
  AlertTriangle,
  History,
  Check,
  X,
  Package
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { useNavigate } from "react-router-dom"

type Step = 'home' | 'scanning-gauge' | 'select-loco' | 'select-side' | 'select-reason' | 'success'
type Mode = 'issue' | 'return' | null

const GaugeTerminal = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [step, setStep] = useState<Step>('home')
  const [mode, setMode] = useState<Mode>(null)
  const [selectedGauge, setSelectedGauge] = useState<Gauge | null>(null)
  const [selectedLoco, setSelectedLoco] = useState<any>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [showManualInput, setShowManualInput] = useState(false)
  const [manualSerial, setManualSerial] = useState("")
  const [showConfirmation, setShowConfirmation] = useState(false)
  
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const scannerContainerId = "terminal-scanner-container"

  // Queries
  const { data: gauges = [] } = useQuery({
    queryKey: ['gauges'],
    queryFn: gaugeService.getAll
  })

  const { data: locomotives = [] } = useQuery({
    queryKey: ['locomotives-list'],
    queryFn: () => locomotiveApi.getAll().then(res => res || [])
  })

  // Mutations
  const updateMutation = useMutation({
    mutationFn: (updates: any) => gaugeService.update(updates.id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gauges'] })
      queryClient.invalidateQueries({ queryKey: ['locomotives'] })
      setStep('success')
    },
    onError: (err: any) => {
      toast.error(`Ошибка: ${err.message}`)
    }
  })

  // Scanner logic
  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === 2) await scannerRef.current.stop();
      } catch (e) { /* ignore */ }
      scannerRef.current = null;
    }
  }, []);

  const startScanner = useCallback(async () => {
    const timer = setTimeout(async () => {
      const container = document.getElementById(scannerContainerId);
      if (!container) return;
      
      try {
        const scanner = new Html5Qrcode(scannerContainerId);
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 15, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            handleScanSuccess(decodedText);
          },
          () => {}
        );
      } catch (err) {
        toast.error('Ошибка камеры');
        setStep('home');
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [step]);

  useEffect(() => {
    if (step === 'scanning-gauge') {
      startScanner();
    } else {
      stopScanner();
    }
    return () => { stopScanner(); }
  }, [step, startScanner, stopScanner]);

  const handleScanSuccess = (text: string) => {
    const serial = text.startsWith('gauge:') ? text.replace('gauge:', '').trim() : text.trim();
    const found = gauges.find((g: Gauge) => g.serial_number.toLowerCase() === serial.toLowerCase());
    
    if (!found) {
      toast.error(`Прибор ${serial} не найден`);
      return;
    }

    setSelectedGauge(found);
    stopScanner();
    setShowManualInput(false);
    setManualSerial("");
    setShowConfirmation(true);
  };

  const handleConfirmGauge = () => {
    if (!selectedGauge) return;
    setShowConfirmation(false);
    
    if (mode === 'issue') {
      if (selectedGauge.status !== 'На складе') {
        toast.error(`Прибор уже ${selectedGauge.status}`);
        return;
      }
      setStep('select-loco');
    } else {
      if (selectedGauge.status !== 'На локомотиве') {
        toast.error(`Прибор не на локомотиве (текущий статус: ${selectedGauge.status})`);
        return;
      }
      setStep('select-reason');
    }
  };

  const handleIssue = (side: 'K1' | 'K2') => {
    if (!selectedGauge || !selectedLoco) return;
    updateMutation.mutate({
      id: selectedGauge.id,
      status: 'На локомотиве',
      locomotive_id: selectedLoco.id,
      installation_side: side
    });
  };

  const handleReturn = (reason: 'warehouse' | 'verification' | 'decommission') => {
    if (!selectedGauge) return;
    const updates: any = {
      id: selectedGauge.id,
      locomotive_id: null,
      installation_side: null
    };
    
    if (reason === 'verification') updates.status = 'На поверке';
    else if (reason === 'decommission') { updates.status = 'Списан'; updates.is_defective = true; }
    else updates.status = 'На складе';

    updateMutation.mutate(updates);
  };

  const reset = () => {
    setStep('home');
    setMode(null);
    setSelectedGauge(null);
    setSelectedLoco(null);
    setSearchTerm("");
    setShowManualInput(false);
    setManualSerial("");
    setShowConfirmation(false);
  };

  const filteredLocos = locomotives.filter((l: any) => 
    l.number.includes(searchTerm) || l.series.toLowerCase().includes(searchTerm.toLowerCase())
  ).slice(0, 10);

  // Render helpers
  const Header = ({ title, showBack = true }: { title: string, showBack?: boolean }) => (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-3">
        {showBack && (
          <Button variant="ghost" size="icon" onClick={() => setStep('home')} className="rounded-full">
            <ArrowLeft className="w-6 h-6" />
          </Button>
        )}
        <h1 className="text-xl font-black text-slate-900">{title}</h1>
      </div>
      <Badge variant="outline" className="text-blue-600 border-blue-200">Терминал</Badge>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 p-4 pb-24 font-sans select-none">
      {step === 'home' && (
        <div className="space-y-6 pt-4">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200 mb-4">
              <ScanLine className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-black text-slate-900">Терминал Метролога</h1>
            <p className="text-slate-500">Быстрые операции с манометрами</p>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <Card 
              className="bg-emerald-500 border-none shadow-xl shadow-emerald-100 active:scale-95 transition-all cursor-pointer overflow-hidden p-0"
              onClick={() => { setMode('issue'); setStep('scanning-gauge'); }}
            >
              <CardContent className="p-8 flex items-center justify-between text-white">
                <div className="space-y-1">
                  <h2 className="text-3xl font-black">ВЫДАЧА</h2>
                  <p className="text-emerald-50/80 font-medium">На локомотив</p>
                </div>
                <PackageCheck className="w-16 h-16 opacity-30" />
              </CardContent>
            </Card>

            <Card 
              className="bg-blue-500 border-none shadow-xl shadow-blue-100 active:scale-95 transition-all cursor-pointer overflow-hidden p-0"
              onClick={() => { setMode('return'); setStep('scanning-gauge'); }}
            >
              <CardContent className="p-8 flex items-center justify-between text-white">
                <div className="space-y-1">
                  <h2 className="text-3xl font-black">СНЯТИЕ</h2>
                  <p className="text-blue-50/80 font-medium">С локомотива</p>
                </div>
                <PackageMinus className="w-16 h-16 opacity-30" />
              </CardContent>
            </Card>

            <Card 
              className="bg-white border-slate-200 shadow-sm active:scale-95 transition-all cursor-pointer mt-4"
              onClick={() => navigate('/gauges')}
            >
              <CardContent className="p-6 flex items-center gap-4 text-slate-600 font-bold justify-center">
                <History className="w-6 h-6" />
                Журнал и контроль
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {step === 'scanning-gauge' && (
        <div className="space-y-6">
          <Header title={mode === 'issue' ? 'Сканируйте манометр' : 'Сканируйте манометр'} />
          
          {!showManualInput ? (
            <>
              <div className="rounded-3xl overflow-hidden bg-black aspect-square shadow-2xl relative border-4 border-white">
                <div id={scannerContainerId} className="w-full h-full" />
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                   <div className="w-64 h-64 border-2 border-white/50 rounded-2xl animate-pulse" />
                   <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.8)] animate-scan" />
                </div>
              </div>
              <div className="text-center p-4 space-y-4">
                 <p className="text-slate-400 font-medium">Наведите камеру на QR манометра</p>
                 <Button 
                   variant="outline" 
                   className="w-full h-14 rounded-2xl border-2 border-slate-200 text-slate-600 font-bold"
                   onClick={() => setShowManualInput(true)}
                 >
                   <Search className="w-5 h-5 mr-2" />
                   Ввести вручную
                 </Button>
              </div>
            </>
          ) : (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl shadow-slate-100/50">
                <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6 mx-auto">
                    <History className="w-8 h-8" />
                </div>
                <h3 className="text-center text-xl font-black text-slate-800 mb-2">Ручной ввод</h3>
                <p className="text-center text-slate-500 text-sm mb-8">Введите серийный номер манометра с корпуса устройства</p>
                
                <div className="space-y-4">
                  <Input 
                    value={manualSerial}
                    onChange={(e) => setManualSerial(e.target.value)}
                    placeholder="S/N: 000000"
                    className="h-16 text-center text-2xl font-black rounded-2xl border-2 border-slate-200 focus:border-blue-500 bg-slate-50 shadow-inner"
                    autoFocus
                  />
                  <Button 
                    className="w-full h-16 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-lg shadow-lg shadow-blue-100"
                    onClick={() => handleScanSuccess(manualSerial)}
                    disabled={!manualSerial.trim()}
                  >
                    Найти прибор
                  </Button>
                  <Button 
                    variant="ghost" 
                    className="w-full h-12 rounded-xl text-slate-400 font-bold"
                    onClick={() => setShowManualInput(false)}
                  >
                    Вернуться к сканеру
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Модальное окно подтверждения найденного прибора */}
      {showConfirmation && selectedGauge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-10 duration-500">
            <div className="relative aspect-video bg-slate-100 flex items-center justify-center overflow-hidden">
              {(selectedGauge.photo_url || (selectedGauge as any).model_image_url) ? (
                <img 
                  src={selectedGauge.photo_url || (selectedGauge as any).model_image_url} 
                  alt={selectedGauge.serial_number}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-20 h-20 bg-blue-50 text-blue-400 rounded-full flex items-center justify-center">
                  <Package className="w-10 h-10" />
                </div>
              )}
              <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-md px-3 py-1 rounded-full shadow-sm border border-white/20">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Прибор найден</span>
              </div>
            </div>
            
            <div className="p-8 space-y-6 text-center">
              <div>
                <h2 className="text-3xl font-black text-slate-800 mb-1">{selectedGauge.serial_number}</h2>
                <p className="text-slate-500 font-medium">{(selectedGauge as any).description || 'Манометр технический'}</p>
              </div>
              
              <div className="flex items-center justify-center gap-2 py-3 px-6 bg-slate-50 rounded-2xl border border-slate-100">
                <div className={`w-2 h-2 rounded-full ${
                  selectedGauge.status === 'На складе' ? 'bg-emerald-500' : 'bg-blue-500'
                }`} />
                <span className="text-sm font-bold text-slate-600 font-mono tracking-tight uppercase">{selectedGauge.status}</span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <Button 
                  variant="outline" 
                  className="h-14 rounded-2xl border-2 border-slate-100 text-slate-500 font-bold"
                  onClick={() => {
                    setShowConfirmation(false);
                    setSelectedGauge(null);
                  }}
                >
                  <X className="w-5 h-5 mr-1" />
                  Отмена
                </Button>
                <Button 
                  className="h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black shadow-lg shadow-blue-200"
                  onClick={handleConfirmGauge}
                >
                  <Check className="w-5 h-5 mr-1" />
                  Далее
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {step === 'select-loco' && (
        <div className="space-y-6">
          <Header title="Куда выдаем?" />
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <Input 
              placeholder="Номер локомотива..." 
              className="h-14 pl-12 rounded-2xl bg-white border-slate-200 shadow-sm text-lg font-bold"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              autoFocus
            />
          </div>
          <div className="grid grid-cols-1 gap-3">
            {filteredLocos.map((loco: any) => (
              <Card 
                key={loco.id}
                className="active:scale-95 transition-all cursor-pointer hover:border-blue-400"
                onClick={() => { setSelectedLoco(loco); setStep('select-side'); }}
              >
                <CardContent className="p-5 flex items-center justify-between">
                  <span className="text-xl font-black text-slate-800">{loco.series} {loco.number}</span>
                  <Badge className="bg-slate-100 text-slate-500 hover:bg-slate-100">{loco.status}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {step === 'select-side' && (
        <div className="space-y-6">
          <Header title="Выберите сторону" />
          <div className="p-4 bg-white rounded-3xl border border-slate-100 shadow-sm mb-6">
            <div className="flex items-center gap-4 mb-2">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                <Wrench className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase font-bold tracking-wider">Прибор готов к выдаче</p>
                <p className="text-lg font-black text-slate-800">{selectedGauge?.serial_number}</p>
              </div>
            </div>
            <div className="text-slate-500 font-medium border-t border-slate-50 pt-2 flex justify-between items-center text-sm">
               <span>Локомотив:</span>
               <span className="font-bold text-slate-900">{selectedLoco?.series} {selectedLoco?.number}</span>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <Button 
              className="h-32 rounded-3xl text-4xl font-black bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-100"
              onClick={() => handleIssue('K1')}
            >
              K1
            </Button>
            <Button 
              className="h-32 rounded-3xl text-4xl font-black bg-slate-900 hover:bg-slate-800 shadow-xl shadow-slate-100 text-white"
              onClick={() => handleIssue('K2')}
            >
              K2
            </Button>
          </div>
        </div>
      )}

      {step === 'select-reason' && (
        <div className="space-y-6">
          <Header title="Куда возвращаем?" />
          <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm mb-6 text-center">
            <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Снимаем прибор</p>
            <p className="text-2xl font-black text-slate-900 mb-2">{selectedGauge?.serial_number}</p>
            {selectedGauge?.locomotive && (
              <Badge variant="outline" className="bg-slate-50 border-slate-200 text-slate-500 py-1 px-3">
                Был на {selectedGauge.locomotive.series} {selectedGauge.locomotive.number}
              </Badge>
            )}
          </div>

          <div className="space-y-4">
            <Button
              className="w-full h-16 rounded-2xl bg-white border-2 border-slate-200 text-slate-700 font-black text-lg justify-start px-6 shadow-sm active:bg-slate-50"
              onClick={() => handleReturn('warehouse')}
            >
              <PackageCheck className="w-6 h-6 mr-4 text-emerald-500" />
              На склад (исправен)
            </Button>
            <Button
              className="w-full h-16 rounded-2xl bg-white border-2 border-amber-200 text-slate-700 font-black text-lg justify-start px-6 shadow-sm active:bg-amber-50"
              onClick={() => handleReturn('verification')}
            >
              <AlertCircle className="w-6 h-6 mr-4 text-amber-500" />
              Отправить на поверку
            </Button>
            <Button
              className="w-full h-16 rounded-2xl bg-white border-2 border-red-200 text-red-600 font-black text-lg justify-start px-6 shadow-sm active:bg-red-50"
              onClick={() => handleReturn('decommission')}
            >
              <AlertTriangle className="w-6 h-6 mr-4 text-red-500" />
              Списать (брак)
            </Button>
          </div>
        </div>
      )}

      {step === 'success' && (
        <div className="flex flex-col items-center justify-center min-h-[70vh] text-center space-y-6">
          <div className="w-32 h-32 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center shadow-lg shadow-emerald-50 animate-bounce">
            <CheckCircle2 className="w-16 h-16" />
          </div>
          <div className="space-y-2">
            <h2 className="text-3xl font-black text-slate-900">Готово!</h2>
            <p className="text-slate-500 font-medium">Операция успешно завершена</p>
          </div>
          <Button 
            className="h-16 px-10 rounded-2xl bg-slate-900 text-white font-black text-lg shadow-xl shadow-slate-200 mt-8"
            onClick={reset}
          >
            К следующему прибору
          </Button>
        </div>
      )}

      {/* Анимация сканера */}
      <style>{`
        @keyframes scan {
          0%, 100% { top: 10%; }
          50% { top: 90%; }
        }
        .animate-scan {
          animation: scan 2.5s infinite ease-in-out;
        }
      `}</style>
    </div>
  )
}

export default GaugeTerminal 
