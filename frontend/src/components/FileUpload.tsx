import { useCallback, useRef } from "react";
import { Upload } from "lucide-react";

interface FileUploadProps {
  onFileLoaded: (data: Record<string, string>[], columns: string[]) => void;
}

const FileUpload = ({ onFileLoaded }: FileUploadProps) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
        defval: "",
        raw: false,
      });
      if (json.length > 0) {
        const columns = Object.keys(json[0]);
        onFileLoaded(json, columns);
      }
    },
    [onFileLoaded]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <div
      onDrop={onDrop}
      onDragOver={(e) => e.preventDefault()}
      onClick={() => inputRef.current?.click()}
      className="flex flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed border-primary/30 bg-brand-light/50 p-12 cursor-pointer transition-colors hover:border-primary/60 hover:bg-brand-light"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
        <Upload className="h-7 w-7 text-primary" />
      </div>
      <div className="text-center">
        <p className="text-lg font-semibold text-foreground">
          Загрузите Excel файл
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Перетащите .xlsx / .xls сюда или нажмите для выбора
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
    </div>
  );
};

export default FileUpload;
