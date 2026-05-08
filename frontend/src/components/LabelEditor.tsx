import { useState, useRef, useCallback, useEffect } from "react";
import { GripVertical, Trash2, Type, QrCode, Plus, RotateCcw, LayoutTemplate, Upload, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import QRCodeLib from "qrcode";
import type { LabelElement, LabelLayout } from "@/types/labelLayout";
import { createTextElement, DEFAULT_LAYOUT } from "@/types/labelLayout";
import { LABEL_PRESETS } from "@/utils/labelPresets";
import {
  exportLayoutToJson,
  importTemplateFromFile,
} from "@/utils/templateStorage";
import { toast } from "sonner";

interface LabelEditorProps {
  layout: LabelLayout;
  onChange: (layout: LabelLayout) => void;
  columns: string[];
  qrColumn: string;
  sampleRow: Record<string, string>;
  labelWidthMm?: number;
  labelHeightMm?: number;
}

const MAX_CANVAS_WIDTH = 400;
const MAX_CANVAS_HEIGHT = 350;

const LabelEditor = ({ layout, onChange, columns, qrColumn, sampleRow, labelWidthMm = 58, labelHeightMm = 40 }: LabelEditorProps) => {
  const aspectRatio = labelWidthMm / labelHeightMm;
  let canvasWidth: number;
  let canvasHeight: number;
  if (aspectRatio >= 1) {
    canvasWidth = MAX_CANVAS_WIDTH;
    canvasHeight = Math.round(MAX_CANVAS_WIDTH / aspectRatio);
  } else {
    canvasHeight = MAX_CANVAS_HEIGHT;
    canvasWidth = Math.round(MAX_CANVAS_HEIGHT * aspectRatio);
  }
  const containerRef = useRef<HTMLDivElement>(null);
  const elementRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const dragRef = useRef<{
    elementId: string;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);
  const resizeRef = useRef<{
    elementId: string;
    startX: number;
    startY: number;
    origW: number;
    origH: number;
  } | null>(null);
  const rafRef = useRef<number | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [qrDataUrls, setQrDataUrls] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const qrElementIds = layout.elements.filter(el => el.type === "qr").map(el => el.id).join(",");
  useEffect(() => {
    const generateQRs = async () => {
      const urls: Record<string, string> = {};
      for (const id of qrElementIds.split(",").filter(Boolean)) {
        try {
          urls[id] = await QRCodeLib.toDataURL(sampleRow[qrColumn] || "SAMPLE", {
            width: 256,
            margin: 1,
            color: { dark: "#1a1a2e", light: "#ffffff" },
          });
        } catch { /* skip */ }
      }
      setQrDataUrls(urls);
    };
    generateQRs();
  }, [qrElementIds, qrColumn, sampleRow]);

  const updateElement = useCallback(
    (id: string, updates: Partial<LabelElement>) => {
      onChange({
        elements: layout.elements.map((el) =>
          el.id === id ? { ...el, ...updates } : el
        ),
      });
    },
    [layout, onChange]
  );

  const removeElement = (id: string) => {
    onChange({ elements: layout.elements.filter((el) => el.id !== id) });
    if (selectedId === id) setSelectedId(null);
  };

  const addTextElement = (column: string) => {
    const totalElements = layout.elements.length;
    onChange({
      elements: [...layout.elements, createTextElement(column, totalElements)],
    });
  };

  const resetLayout = () => {
    onChange({ ...DEFAULT_LAYOUT });
    setSelectedId(null);
  };

  const handleExport = () => {
    exportLayoutToJson("Мой шаблон", layout);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const template = await importTemplateFromFile(file);
      onChange(JSON.parse(JSON.stringify(template.layout)));
      toast.success(`Шаблон «${template.name}» импортирован`);
    } catch (err: any) {
      toast.error(err.message || "Ошибка импорта");
    }
    e.target.value = "";
  };

  // Direct DOM manipulation during drag — no React re-renders until mouseUp
  const onMouseDown = (e: React.MouseEvent, elementId: string) => {
    e.stopPropagation();
    e.preventDefault();
    const el = layout.elements.find((el) => el.id === elementId);
    if (!el) return;
    setSelectedId(elementId);
    dragRef.current = {
      elementId,
      startX: e.clientX,
      startY: e.clientY,
      origX: el.x,
      origY: el.y,
    };
  };

  const onResizeMouseDown = (e: React.MouseEvent, elementId: string) => {
    e.stopPropagation();
    e.preventDefault();
    const el = layout.elements.find((el) => el.id === elementId);
    if (!el) return;
    setSelectedId(elementId);
    resizeRef.current = {
      elementId,
      startX: e.clientX,
      startY: e.clientY,
      origW: el.width,
      origH: el.height,
    };
  };

  useEffect(() => {
    let lastEvent: MouseEvent | null = null;

    const processFrame = () => {
      rafRef.current = null;
      const e = lastEvent;
      if (!e) return;

      if (dragRef.current) {
        const d = dragRef.current;
        const dx = ((e.clientX - d.startX) / canvasWidth) * 100;
        const dy = ((e.clientY - d.startY) / canvasHeight) * 100;
        const newX = Math.max(0, Math.min(90, d.origX + dx));
        const newY = Math.max(0, Math.min(90, d.origY + dy));
        const node = elementRefs.current[d.elementId];
        if (node) {
          node.style.left = `${newX}%`;
          node.style.top = `${newY}%`;
          (node as any).__finalX = newX;
          (node as any).__finalY = newY;
        }
      }

      if (resizeRef.current) {
        const r = resizeRef.current;
        const dx = ((e.clientX - r.startX) / canvasWidth) * 100;
        const dy = ((e.clientY - r.startY) / canvasHeight) * 100;
        const newW = Math.max(10, Math.min(100, r.origW + dx));
        const newH = Math.max(8, Math.min(100, r.origH + dy));
        const node = elementRefs.current[r.elementId];
        if (node) {
          node.style.width = `${newW}%`;
          node.style.height = `${newH}%`;
          (node as any).__finalW = newW;
          (node as any).__finalH = newH;
        }
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!dragRef.current && !resizeRef.current) return;
      lastEvent = e;
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(processFrame);
      }
    };

    const onMouseUp = () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (dragRef.current) {
        const node = elementRefs.current[dragRef.current.elementId];
        if (node && (node as any).__finalX !== undefined) {
          updateElement(dragRef.current.elementId, {
            x: (node as any).__finalX,
            y: (node as any).__finalY,
          });
          delete (node as any).__finalX;
          delete (node as any).__finalY;
        }
        dragRef.current = null;
      }
      if (resizeRef.current) {
        const node = elementRefs.current[resizeRef.current.elementId];
        if (node && (node as any).__finalW !== undefined) {
          updateElement(resizeRef.current.elementId, {
            width: (node as any).__finalW,
            height: (node as any).__finalH,
          });
          delete (node as any).__finalW;
          delete (node as any).__finalH;
        }
        resizeRef.current = null;
      }
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [canvasWidth, canvasHeight, updateElement]);

  const selectedElement = layout.elements.find((el) => el.id === selectedId);
  const usedTextColumns = layout.elements
    .filter((el) => el.type === "text" && el.column)
    .map((el) => el.column!);
  const availableColumns = columns.filter((c) => !usedTextColumns.includes(c));

  return (
    <div className="rounded-lg border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <GripVertical className="h-4 w-4 text-primary" />
          Редактор шаблона
        </h3>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={handleExport} className="text-xs" title="Экспорт в JSON">
            <Download className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()} className="text-xs" title="Импорт из JSON">
            <Upload className="h-3 w-3" />
          </Button>
          <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
          <Button variant="ghost" size="sm" onClick={resetLayout} className="text-xs">
            <RotateCcw className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Preset templates */}
      <div className="space-y-1.5">
        <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
          <LayoutTemplate className="h-3 w-3" />
          Готовые шаблоны (58×40)
        </Label>
        <div className="flex gap-2">
          {LABEL_PRESETS.map((preset: any) => (
            <Button
              key={preset.id}
              variant="outline"
              size="sm"
              className="text-xs flex-1"
              onClick={() => {
                onChange(preset.generate(columns));
                setSelectedId(null);
              }}
            >
              {preset.name}
            </Button>
          ))}
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="relative border-2 border-dashed border-border rounded-lg bg-background overflow-hidden select-none"
        style={{ width: canvasWidth, height: canvasHeight }}
        onClick={() => setSelectedId(null)}
      >
        {/* Size label */}
        <span className="absolute bottom-1 right-2 text-[10px] font-mono text-muted-foreground/60 pointer-events-none select-none z-30">
          {labelWidthMm}×{labelHeightMm} мм
        </span>
        {/* Grid lines */}
        <svg className="absolute inset-0 pointer-events-none opacity-20" width="100%" height="100%">
          {[25, 50, 75].map((p) => (
            <line key={`v${p}`} x1={`${p}%`} y1="0" x2={`${p}%`} y2="100%" stroke="hsl(var(--border))" strokeDasharray="4" />
          ))}
          {[25, 50, 75].map((p) => (
            <line key={`h${p}`} x1="0" y1={`${p}%`} x2="100%" y2={`${p}%`} stroke="hsl(var(--border))" strokeDasharray="4" />
          ))}
        </svg>

        {layout.elements.map((el) => {
          const isSelected = el.id === selectedId;
          return (
            <div
              key={el.id}
              ref={(node) => { elementRefs.current[el.id] = node; }}
              className={`absolute cursor-move rounded ${
                isSelected
                  ? "ring-2 ring-primary shadow-md z-20"
                  : "ring-1 ring-border hover:ring-primary/50 z-10"
              }`}
              style={{
                left: `${el.x}%`,
                top: `${el.y}%`,
                width: `${el.width}%`,
                height: `${el.height}%`,
              }}
              onMouseDown={(e) => onMouseDown(e, el.id)}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedId(el.id);
              }}
            >
              <div className="w-full h-full overflow-hidden rounded bg-card/80 flex items-center justify-center p-1">
                {el.type === "qr" ? (
                  qrDataUrls[el.id] ? (
                    <img src={qrDataUrls[el.id]} alt="QR" className="max-w-full max-h-full object-contain" />
                  ) : null
                ) : (
                  <div className="w-full h-full overflow-hidden px-1 pt-0.5 flex flex-col justify-start">
                    {el.showLabel && (
                      <span className="uppercase tracking-wider text-muted-foreground block leading-tight"
                        style={{ fontSize: Math.max(6, (el.fontSize || 12) * 0.65) }}
                      >
                        {el.column}
                      </span>
                    )}
                    <p
                      className={`font-mono text-foreground leading-tight ${el.wordWrap ? "whitespace-normal break-words" : "truncate"}`}
                      style={{
                        fontSize: el.fontSize || 12,
                        fontWeight: el.fontWeight || "normal",
                        marginTop: 1,
                      }}
                    >
                      {sampleRow[el.column || ""] || "—"}
                    </p>
                  </div>
                )}
              </div>

              {/* Resize handle */}
              {isSelected && (
                <div
                  className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-primary rounded-sm cursor-se-resize"
                  onMouseDown={(e) => onResizeMouseDown(e, el.id)}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Add elements */}
      <div className="flex gap-2 flex-wrap">
        {!layout.elements.some((el) => el.type === "qr") && (
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              onChange({
                elements: [
                  ...layout.elements,
                  { id: `qr-${Date.now()}`, type: "qr", x: 3, y: 10, width: 35, height: 80 },
                ],
              })
            }
          >
            <QrCode className="h-3.5 w-3.5 mr-1" />
            QR-код
          </Button>
        )}
        {availableColumns.length > 0 && (
          <Select onValueChange={addTextElement}>
            <SelectTrigger className="w-auto h-8 text-xs gap-1">
              <Plus className="h-3.5 w-3.5" />
              <SelectValue placeholder="Добавить поле" />
            </SelectTrigger>
            <SelectContent className="bg-card border z-50">
              {availableColumns.map((col) => (
                <SelectItem key={col} value={col} className="font-mono text-xs">
                  <Type className="h-3 w-3 mr-1 inline" />
                  {col}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Selected element properties */}
      {selectedElement && (
        <div className="border-t pt-4 space-y-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">
              {selectedElement.type === "qr" ? "QR-код" : selectedElement.column}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-destructive hover:text-destructive"
              onClick={() => removeElement(selectedElement.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>

          {selectedElement.type === "text" && (
            <>
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground">Размер шрифта: {selectedElement.fontSize}px</Label>
                <Slider
                  value={[selectedElement.fontSize || 12]}
                  onValueChange={([v]) => updateElement(selectedElement.id, { fontSize: v })}
                  min={8}
                  max={32}
                  step={1}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-[11px] text-muted-foreground">Жирный</Label>
                <Switch
                  checked={selectedElement.fontWeight === "bold"}
                  onCheckedChange={(c: boolean) =>
                    updateElement(selectedElement.id, { fontWeight: c ? "bold" : "normal" })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-[11px] text-muted-foreground">Показать заголовок</Label>
                <Switch
                  checked={selectedElement.showLabel ?? true}
                  onCheckedChange={(c: boolean) => updateElement(selectedElement.id, { showLabel: c })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-[11px] text-muted-foreground">Перенос текста</Label>
                <Switch
                  checked={selectedElement.wordWrap ?? false}
                  onCheckedChange={(c: boolean) => updateElement(selectedElement.id, { wordWrap: c })}
                />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default LabelEditor;
