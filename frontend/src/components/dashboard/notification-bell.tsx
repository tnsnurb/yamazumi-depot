"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import { Bell, AlertTriangle, Clock, ChevronRight } from "lucide-react"
import { gaugeService, type GaugeAlert } from "@/api/gaugeService"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export function NotificationBell() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  const { data: alerts } = useQuery({
    queryKey: ['gauge-alerts'],
    queryFn: gaugeService.getAlerts,
    refetchInterval: 5 * 60 * 1000, // Обновлять каждые 5 минут
  })

  const totalAlerts = alerts?.total || 0
  const criticalCount = alerts?.critical || 0

  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-50 border-red-100 text-red-700'
      case 'urgent': return 'bg-amber-50 border-amber-100 text-amber-700'
      default: return 'bg-slate-50 border-slate-100 text-slate-600'
    }
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <AlertTriangle className="w-4 h-4 text-red-500" />
      case 'urgent': return <AlertTriangle className="w-4 h-4 text-amber-500" />
      default: return <Clock className="w-4 h-4 text-slate-400" />
    }
  }

  const getSeverityLabel = (alert: GaugeAlert) => {
    if (alert.days_left < 0) return `Просрочен ${Math.abs(alert.days_left)} дн`
    if (alert.days_left === 0) return 'Истекает сегодня!'
    return `Через ${alert.days_left} дн`
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-8 w-8">
          <Bell className="h-4 w-4" />
          {totalAlerts > 0 && (
            <span className={cn(
              "absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full text-[10px] font-bold flex items-center justify-center px-1 border-2 border-background",
              criticalCount > 0 
                ? "bg-red-500 text-white animate-pulse" 
                : "bg-amber-500 text-white"
            )}>
              {totalAlerts > 99 ? '99+' : totalAlerts}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[380px] p-0 rounded-2xl border-none shadow-2xl" align="end">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-slate-900">Метрология</h3>
            <p className="text-xs text-slate-400 mt-0.5">Контроль сроков поверки</p>
          </div>
          <div className="flex gap-1.5">
            {criticalCount > 0 && (
              <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px] font-bold">
                {criticalCount} просроч.
              </Badge>
            )}
            {(alerts?.urgent || 0) > 0 && (
              <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px] font-bold">
                {alerts?.urgent} срочн.
              </Badge>
            )}
          </div>
        </div>

        {/* Alert List */}
        <div className="max-h-[320px] overflow-y-auto">
          {totalAlerts === 0 ? (
            <div className="p-8 text-center">
              <div className="w-12 h-12 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-3">
                <Bell className="w-5 h-5" />
              </div>
              <p className="text-sm font-semibold text-slate-700">Всё в порядке!</p>
              <p className="text-xs text-slate-400 mt-1">Нет приборов с истекающей поверкой</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {(alerts?.items || []).slice(0, 15).map((alert) => (
                <button
                  key={alert.id}
                  className={cn(
                    "w-full text-left p-3 hover:bg-slate-50/50 transition-colors flex items-center gap-3",
                    alert.severity === 'critical' && "bg-red-50/30"
                  )}
                  onClick={() => {
                    setOpen(false)
                    navigate('/gauges')
                  }}
                >
                  <div className={cn(
                    "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border",
                    getSeverityStyles(alert.severity)
                  )}>
                    {getSeverityIcon(alert.severity)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-slate-800 truncate">{alert.serial_number}</span>
                      {alert.part_number && (
                        <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">{alert.part_number}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={cn(
                        "text-xs font-semibold",
                        alert.severity === 'critical' ? 'text-red-600' : 
                        alert.severity === 'urgent' ? 'text-amber-600' : 'text-slate-500'
                      )}>
                        {getSeverityLabel(alert)}
                      </span>
                      {alert.locomotive && (
                        <span className="text-[10px] text-blue-500 font-medium bg-blue-50 px-1.5 rounded">
                          {alert.locomotive.series} {alert.locomotive.number}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {totalAlerts > 0 && (
          <div className="p-3 border-t border-slate-100 bg-slate-50/50">
            <Button 
              variant="ghost" 
              className="w-full h-9 text-sm font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-xl"
              onClick={() => { setOpen(false); navigate('/gauges'); }}
            >
              Открыть журнал метрологии
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
