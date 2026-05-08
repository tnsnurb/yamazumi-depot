export interface LabelElement {
  id: string;
  type: "qr" | "text";
  column?: string; // for text elements - which column to show
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  width: number; // percentage
  height: number; // percentage
  fontSize?: number; // px
  fontWeight?: "normal" | "bold";
  showLabel?: boolean; // show column name above value
  wordWrap?: boolean; // wrap long text to next line
}

export interface LabelLayout {
  elements: LabelElement[];
}

export const DEFAULT_LAYOUT: LabelLayout = {
  elements: [
    {
      id: "qr-1",
      type: "qr",
      x: 3,
      y: 10,
      width: 35,
      height: 80,
    },
  ],
};

export function createTextElement(column: string, index: number): LabelElement {
  const ROWS_PER_COL = 5;
  const ROW_HEIGHT = 18;
  const COL_WIDTH = 30;
  const START_X = 35;
  const START_Y = 5;

  const col = Math.floor(index / ROWS_PER_COL);
  const row = index % ROWS_PER_COL;

  return {
    id: `text-${column}-${Date.now()}`,
    type: "text",
    column,
    x: Math.min(START_X + col * COL_WIDTH, 70),
    y: START_Y + row * ROW_HEIGHT,
    width: Math.min(COL_WIDTH, 100 - (START_X + col * COL_WIDTH)),
    height: ROW_HEIGHT,
    fontSize: 12,
    fontWeight: "normal",
    showLabel: true,
  };
}
