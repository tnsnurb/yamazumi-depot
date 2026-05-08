import type { LabelLayout, LabelElement } from "@/types/labelLayout";

export interface LabelPreset {
  id: string;
  name: string;
  description: string;
  columnCount: number;
  generate: (columns: string[]) => LabelLayout;
}

function makeQr(): LabelElement {
  return { id: "qr-1", type: "qr", x: 2, y: 5, width: 30, height: 90 };
}

function makeText(
  column: string,
  x: number,
  y: number,
  width: number,
  height: number,
  fontSize = 10,
  fontWeight: "normal" | "bold" = "normal",
  showLabel = true
): LabelElement {
  return {
    id: `text-${column}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: "text",
    column,
    x,
    y,
    width,
    height,
    fontSize,
    fontWeight,
    showLabel,
  };
}

// 3 columns: QR left, 3 text fields stacked vertically on the right
function generate3(columns: string[]): LabelLayout {
  const cols = columns.slice(0, 3);
  const rowH = Math.floor(90 / Math.max(cols.length, 1));
  return {
    elements: [
      makeQr(),
      ...cols.map((col, i) =>
        makeText(col, 34, 5 + i * rowH, 64, rowH - 2, 10, i === 0 ? "bold" : "normal")
      ),
    ],
  };
}

// 4 columns: QR left, 4 text fields stacked vertically
function generate4(columns: string[]): LabelLayout {
  const cols = columns.slice(0, 4);
  const rowH = Math.floor(90 / Math.max(cols.length, 1));
  return {
    elements: [
      makeQr(),
      ...cols.map((col, i) =>
        makeText(col, 34, 5 + i * rowH, 64, rowH - 2, 9, i === 0 ? "bold" : "normal")
      ),
    ],
  };
}

// 6 columns: QR left, 6 fields in 2 columns x 3 rows
function generate6(columns: string[]): LabelLayout {
  const cols = columns.slice(0, 6);
  const colWidth = 32;
  const rowH = 28;
  return {
    elements: [
      { ...makeQr(), width: 24, height: 85 },
      ...cols.map((col, i) => {
        const gridCol = Math.floor(i / 3);
        const gridRow = i % 3;
        return makeText(
          col,
          27 + gridCol * colWidth,
          5 + gridRow * rowH,
          colWidth - 1,
          rowH - 2,
          8,
          "normal"
        );
      }),
    ],
  };
}

export const LABEL_PRESETS: LabelPreset[] = [
  {
    id: "3col",
    name: "3 поля",
    description: "QR + 3 поля справа",
    columnCount: 3,
    generate: generate3,
  },
  {
    id: "4col",
    name: "4 поля",
    description: "QR + 4 поля справа",
    columnCount: 4,
    generate: generate4,
  },
  {
    id: "6col",
    name: "6 полей",
    description: "QR + 6 полей (2×3)",
    columnCount: 6,
    generate: generate6,
  },
];
