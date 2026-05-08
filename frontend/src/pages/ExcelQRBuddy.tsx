import { useState, useCallback } from "react";
import { Printer, QrCode, FileSpreadsheet, RotateCcw, LayoutTemplate, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import FileUpload from "@/components/FileUpload";
import DataTable from "@/components/DataTable";
import ColumnSelector from "@/components/ColumnSelector";
import LabelPreview from "@/components/LabelPreview";
import LabelEditor from "@/components/LabelEditor";
import PrintSettingsPanel, { LABEL_SIZES, type PrintSettings } from "@/components/PrintSettingsPanel";
import { generateLabelsPdf } from "@/utils/generatePdf";
import type { LabelLayout } from "@/types/labelLayout";
import { DEFAULT_LAYOUT, createTextElement } from "@/types/labelLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { saveCurrentLayout, loadCurrentLayout } from "@/utils/templateStorage";

const ExcelQRBuddy = () => {
  const [data, setData] = useState<Record<string, string>[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [qrColumn, setQrColumn] = useState("");
  const [displayColumns, setDisplayColumns] = useState<string[]>([]);
  const [printSettings, setPrintSettings] = useState<PrintSettings>({
    labelSize: "58x40",
    orientation: "portrait",
    columns: 2,
  });
  const [layout, setLayout] = useState<LabelLayout>(() => loadCurrentLayout() || { ...DEFAULT_LAYOUT });

  // Auto-save layout to localStorage
  const handleLayoutChange = useCallback((newLayout: LabelLayout) => {
    setLayout(newLayout);
    saveCurrentLayout(newLayout);
  }, []);

  const onFileLoaded = useCallback(
    (rows: Record<string, string>[], cols: string[]) => {
      setData(rows);
      setColumns(cols);
      setQrColumn(cols[0] || "");
      const displayCols = cols.slice(0, Math.min(3, cols.length));
      setDisplayColumns(displayCols);
      // Auto-add text elements for display columns
      handleLayoutChange({
        elements: [
          ...DEFAULT_LAYOUT.elements,
          ...displayCols.map((col, i) => createTextElement(col, i)),
        ],
      });
    },
    []
  );

  const reset = () => {
    setData([]);
    setColumns([]);
    setQrColumn("");
    setDisplayColumns([]);
    handleLayoutChange({ ...DEFAULT_LAYOUT });
  };

  const handlePrint = () => {
    const size = LABEL_SIZES[printSettings.labelSize];
    const style = document.createElement("style");
    style.id = "print-label-style";
    const w = printSettings.orientation === "landscape" ? size.height : size.width;
    const h = printSettings.orientation === "landscape" ? size.width : size.height;
    const isA4 = printSettings.labelSize === "a4";
    style.textContent = `
      @page {
        size: ${isA4 ? "A4" : `${w} ${h}`};
        margin: ${isA4 ? "10mm" : "2mm"};
      }
      .print-area {
        ${isA4 ? `grid-template-columns: repeat(${printSettings.columns}, 1fr) !important;` : `grid-template-columns: 1fr !important;`}
      }
      .label-card {
        ${!isA4 ? `width: 100% !important; max-width: none !important;` : ""}
      }
    `;
    document.head.appendChild(style);
    window.print();
    document.getElementById("print-label-style")?.remove();
  };

  const hasData = data.length > 0;

  return (
    <div className="bg-background">
      <div className="mx-auto max-w-7xl px-6 py-6">
        {hasData && (
          <div className="flex items-center gap-2 mb-6">
            <Button variant="outline" size="sm" onClick={reset}>
              <RotateCcw className="mr-1.5 h-4 w-4" />
              Сбросить
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const size = LABEL_SIZES[printSettings.labelSize];
                const wMm = parseFloat(size.width);
                const hMm = parseFloat(size.height);
                const lw = printSettings.orientation === "landscape" ? hMm : wMm;
                const lh = printSettings.orientation === "landscape" ? wMm : hMm;
                generateLabelsPdf({ data, layout, qrColumn, labelWidthMm: lw, labelHeightMm: lh });
              }}
              disabled={!qrColumn}
            >
              <Download className="mr-1.5 h-4 w-4" />
              Скачать PDF
            </Button>
            <Button size="sm" onClick={handlePrint} disabled={!qrColumn}>
              <Printer className="mr-1.5 h-4 w-4" />
              Печать
            </Button>
          </div>
        )}
        {!hasData ? (
          <div className="mx-auto max-w-xl pt-20">
            <div className="mb-8 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                <FileSpreadsheet className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold text-foreground">
                Загрузите данные
              </h2>
              <p className="mt-2 text-muted-foreground">
                Загрузите Excel файл с данными для создания этикеток
              </p>
            </div>
            <FileUpload onFileLoaded={onFileLoaded} />
          </div>
        ) : (
          <div className="space-y-8 animate-fade-in">
            {/* Stats */}
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 rounded-full bg-brand-light px-4 py-1.5">
                <FileSpreadsheet className="h-4 w-4 text-primary" />
                <span className="font-mono text-sm font-medium text-primary">
                  {data.length} строк
                </span>
              </div>
              <div className="flex items-center gap-2 rounded-full bg-brand-light px-4 py-1.5">
                <QrCode className="h-4 w-4 text-primary" />
                <span className="font-mono text-sm font-medium text-primary">
                  {columns.length} колонок
                </span>
              </div>
            </div>

            <Tabs defaultValue="editor" className="space-y-6">
              <TabsList>
                <TabsTrigger value="editor">
                  <LayoutTemplate className="h-4 w-4 mr-1.5" />
                  Шаблон
                </TabsTrigger>
                <TabsTrigger value="data">
                  <FileSpreadsheet className="h-4 w-4 mr-1.5" />
                  Данные
                </TabsTrigger>
              </TabsList>

              <TabsContent value="editor">
                <div className="grid gap-6 lg:grid-cols-[460px_1fr]">
                  {(() => {
                    const size = LABEL_SIZES[printSettings.labelSize];
                    const wMm = parseFloat(size.width);
                    const hMm = parseFloat(size.height);
                    const lw = printSettings.orientation === "landscape" ? hMm : wMm;
                    const lh = printSettings.orientation === "landscape" ? wMm : hMm;
                    return (
                      <LabelEditor
                        layout={layout}
                        onChange={handleLayoutChange}
                        columns={columns}
                        qrColumn={qrColumn}
                        sampleRow={data[0] || {}}
                        labelWidthMm={lw}
                        labelHeightMm={lh}
                      />
                    );
                  })()}
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <ColumnSelector
                        columns={columns}
                        qrColumn={qrColumn}
                        displayColumns={displayColumns}
                        onQrColumnChange={setQrColumn}
                        onDisplayColumnsChange={setDisplayColumns}
                      />
                      <PrintSettingsPanel
                        settings={printSettings}
                        onChange={setPrintSettings}
                      />
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="data">
                <DataTable data={data} columns={columns} />
              </TabsContent>
            </Tabs>

            {/* Label preview */}
            <div>
              <h3 className="mb-4 text-lg font-semibold text-foreground">
                Предпросмотр этикеток
              </h3>
              <div className="print-area label-grid">
                {data.map((row, i) => (
                  <LabelPreview
                    key={i}
                    qrValue={String(row[qrColumn] ?? "")}
                    row={row}
                    layout={layout}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExcelQRBuddy;
