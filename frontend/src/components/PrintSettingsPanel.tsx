import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Printer } from "lucide-react";

export interface PrintSettings {
  labelSize: string;
  orientation: "portrait" | "landscape";
  columns: number;
}

const LABEL_SIZES: Record<string, { name: string; width: string; height: string }> = {
  "58x40": { name: "58 × 40 мм", width: "58mm", height: "40mm" },
  "58x30": { name: "58 × 30 мм", width: "58mm", height: "30mm" },
  "40x30": { name: "40 × 30 мм", width: "40mm", height: "30mm" },
  "80x50": { name: "80 × 50 мм", width: "80mm", height: "50mm" },
  "100x70": { name: "100 × 70 мм", width: "100mm", height: "70mm" },
  "100x150": { name: "100 × 150 мм (транспортная)", width: "100mm", height: "150mm" },
  a4: { name: "A4 (несколько на листе)", width: "210mm", height: "297mm" },
};

const COLUMN_OPTIONS = [1, 2, 3, 4];

interface PrintSettingsPanelProps {
  settings: PrintSettings;
  onChange: (settings: PrintSettings) => void;
}

const PrintSettingsPanel = ({ settings, onChange }: PrintSettingsPanelProps) => {
  return (
    <div className="rounded-lg border bg-card p-5 space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <Printer className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold text-foreground">Настройки печати</span>
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Размер этикетки</Label>
        <Select
          value={settings.labelSize}
          onValueChange={(v) => onChange({ ...settings, labelSize: v })}
        >
          <SelectTrigger className="font-mono text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-card border z-50">
            {Object.entries(LABEL_SIZES).map(([key, val]) => (
              <SelectItem key={key} value={key} className="font-mono text-sm">
                {val.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Ориентация</Label>
        <Select
          value={settings.orientation}
          onValueChange={(v) =>
            onChange({ ...settings, orientation: v as "portrait" | "landscape" })
          }
        >
          <SelectTrigger className="font-mono text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-card border z-50">
            <SelectItem value="portrait" className="font-mono text-sm">Книжная</SelectItem>
            <SelectItem value="landscape" className="font-mono text-sm">Альбомная</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {settings.labelSize === "a4" && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Колонок на листе</Label>
          <Select
            value={String(settings.columns)}
            onValueChange={(v) => onChange({ ...settings, columns: Number(v) })}
          >
            <SelectTrigger className="font-mono text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-card border z-50">
              {COLUMN_OPTIONS.map((n) => (
                <SelectItem key={n} value={String(n)} className="font-mono text-sm">
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground leading-relaxed pt-1">
        При нажатии «Печать» откроется системный диалог, где можно выбрать принтер (термопринтер, обычный и т.д.)
      </p>
    </div>
  );
};

export { LABEL_SIZES };
export default PrintSettingsPanel;
