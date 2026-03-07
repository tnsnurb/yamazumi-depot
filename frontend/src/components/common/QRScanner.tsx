import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { X, Camera } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

export function QRScannerModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [error, setError] = useState<string>('')
  const navigate = useNavigate()
  const scannerRef = useRef<Html5Qrcode | null>(null)

  useEffect(() => {
    if (!isOpen) {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(console.error).finally(() => {
          scannerRef.current?.clear()
          scannerRef.current = null
        })
      }
      return
    }

    const startScanner = async () => {
      try {
        const hasCamera = await Html5Qrcode.getCameras()
        if (hasCamera && hasCamera.length > 0) {
          scannerRef.current = new Html5Qrcode("qr-reader")
          await scannerRef.current.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: { width: 250, height: 250 } },
            (decodedText) => {
              // Extract ID from QR code (e.g. "loco:42" -> "42" or just "42")
              const id = decodedText.replace('loco:', '')
              if (id && !isNaN(Number(id))) {
                if (scannerRef.current) scannerRef.current.stop()
                onClose()
                navigate(`/locomotive/${id}/remarks`)
                toast.success('Локомотив найден!', { position: 'top-center' })
              }
            },
            () => {
              // Ignore scanning errors during continuous scan
            }
          )
        } else {
          setError('Камера не найдена на устройстве')
        }
      } catch (err) {
        console.error(err)
        setError('Нет доступа к камере. Разрешите доступ в настройках браузера.')
      }
    }

    // Slight delay to ensure DOM is ready
    const timer = setTimeout(startScanner, 150)

    return () => {
      clearTimeout(timer)
      if (scannerRef.current) {
        scannerRef.current.stop().catch(console.error).finally(() => {
          scannerRef.current?.clear()
          scannerRef.current = null
        })
      }
    }
  }, [isOpen, navigate, onClose])

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-black/95 border-slate-800">
        <DialogTitle className="sr-only">Сканировать QR-код локомотива</DialogTitle>
        <div className="relative w-full aspect-[3/4] sm:aspect-square bg-black flex items-center justify-center">
          <div id="qr-reader" className="w-full h-full [&>video]:object-cover" />

          {error && (
            <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 bg-red-500/90 text-white p-4 rounded-xl text-center text-sm font-medium z-50">
              {error}
            </div>
          )}

          <div className="absolute top-4 right-4 z-50">
            <button
              onClick={onClose}
              className="w-10 h-10 bg-white/10 hover:bg-white/20 backdrop-blur-md flex items-center justify-center rounded-full text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {!error && (
            <div className="absolute bottom-10 inset-x-0 flex flex-col items-center justify-center text-white/70 z-50">
              <Camera className="w-6 h-6 mb-2 opacity-50" />
              <p className="text-sm font-medium bg-black/50 px-4 py-2 rounded-full backdrop-blur-md">
                Наведите камеру на QR-код локомотива
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
