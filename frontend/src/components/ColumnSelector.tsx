import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface ColumnSelectorProps {
  columns: string[];
  qrColumn: string;
  displayColumns: string[];
  onQrColumnChange: (col: string) => void;
  onDisplayColumnsChange: (cols: string[]) => void;
}

const ColumnSelector = ({
  columns,
  qrColumn,
  displayColumns,
  onQrColumnChange,
  onDisplayColumnsChange,
}: ColumnSelectorProps) => {
  const toggleDisplay = (col: string) => {
    if (displayColumns.includes(col)) {
      onDisplayColumnsChange(displayColumns.filter((c) => c !== col));
    } else {
      onDisplayColumnsChange([...displayColumns, col]);
    }
  };

  return (
    <div className="rounded-lg border bg-card p-5 space-y-5">
      <div className="space-y-2">
        <Label className="text-sm font-semibold text-foreground">
          Колонка для QR-кода
        </Label>
        <Select value={qrColumn} onValueChange={onQrColumnChange}>
          <SelectTrigger className="font-mono">
            <SelectValue placeholder="Выберите колонку" />
          </SelectTrigger>
          <SelectContent>
            {columns.map((col) => (
              <SelectItem key={col} value={col} className="font-mono">
                {col}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        <Label className="text-sm font-semibold text-foreground">
          Поля на этикетке
        </Label>
        <div className="grid grid-cols-2 gap-2">
          {columns.map((col) => (
            <label
              key={col}
              className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors"
            >
              <Checkbox
                checked={displayColumns.includes(col)}
                onCheckedChange={() => toggleDisplay(col)}
              />
              <span className="font-mono text-sm truncate">{col}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ColumnSelector;
