import jsPDF from "jspdf";
import QRCode from "qrcode";
import type { LabelLayout } from "@/types/labelLayout";

interface GeneratePdfOptions {
  data: Record<string, string>[];
  layout: LabelLayout;
  qrColumn: string;
  labelWidthMm: number;
  labelHeightMm: number;
}

async function registerCyrillicFont(doc: jsPDF): Promise<void> {
  try {
    // Fetch Roboto font from local public folder (includes Cyrillic)
    const fontUrl = "/fonts/Roboto-Regular.ttf";
    const response = await fetch(fontUrl);
    const buffer = await response.arrayBuffer();

    // Convert ArrayBuffer to base64
    const bytes = new Uint8Array(buffer);
    let binary = "";
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    const base64 = btoa(binary);

    doc.addFileToVFS("Roboto-Regular.ttf", base64);
    doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");

    // Also fetch bold variant from local
    const boldUrl = "/fonts/Roboto-Bold.ttf";
    const boldResponse = await fetch(boldUrl);
    const boldBuffer = await boldResponse.arrayBuffer();
    const boldBytes = new Uint8Array(boldBuffer);
    let boldBinary = "";
    for (let i = 0; i < boldBytes.length; i += chunkSize) {
      boldBinary += String.fromCharCode(
        ...boldBytes.subarray(i, i + chunkSize)
      );
    }
    doc.addFileToVFS("Roboto-Bold.ttf", btoa(boldBinary));
    doc.addFont("Roboto-Bold.ttf", "Roboto", "bold");
  } catch (e) {
    console.warn("Failed to load Cyrillic font, falling back to helvetica", e);
  }
}

export async function generateLabelsPdf({
  data,
  layout,
  qrColumn,
  labelWidthMm,
  labelHeightMm,
}: GeneratePdfOptions): Promise<void> {
  const doc = new jsPDF({
    orientation: labelWidthMm > labelHeightMm ? "landscape" : "portrait",
    unit: "mm",
    format: [labelWidthMm, labelHeightMm],
  });

  // Register Cyrillic-capable font
  await registerCyrillicFont(doc);
  const fontFamily = "Roboto";

  // Cache QR codes to avoid regenerating duplicates
  const qrCache = new Map<string, string>();

  for (let i = 0; i < data.length; i++) {
    if (i > 0) doc.addPage();
    const row = data[i];

    for (const el of layout.elements) {
      const x = (el.x / 100) * labelWidthMm;
      const y = (el.y / 100) * labelHeightMm;
      const w = (el.width / 100) * labelWidthMm;
      const h = (el.height / 100) * labelHeightMm;

      if (el.type === "qr") {
        const qrValue = String(row[qrColumn] ?? "");
        if (qrValue) {
          try {
            let qrDataUrl = qrCache.get(qrValue);
            if (!qrDataUrl) {
              qrDataUrl = await QRCode.toDataURL(qrValue, {
                width: 128,
                margin: 0,
                color: { dark: "#000000", light: "#ffffff" },
              });
              qrCache.set(qrValue, qrDataUrl);
            }
            const size = Math.min(w, h);
            doc.addImage(qrDataUrl, "PNG", x, y, size, size);
          } catch {
            // skip invalid QR
          }
        }
      } else if (el.type === "text") {
        const value = row[el.column || ""] || "—";
        const fontSize = el.fontSize || 12;
        // Scale font size: use element height in mm as reference
        // Element height in mm -> proportional font size in pt
        const fontPtValue = Math.max(7, (fontSize / 14) * h * 2.83 * 0.35);
        // pt to mm conversion factor
        const ptToMm = 0.3528;

        let currentY = y;

        // Debug: log showLabel state
        if (i === 0) {
          console.log(`PDF element: column=${el.column}, showLabel=${el.showLabel}, x=${x.toFixed(1)}, y=${y.toFixed(1)}, w=${w.toFixed(1)}, h=${h.toFixed(1)}`);
        }

        if (el.showLabel && el.column) {
          const labelPt = Math.max(6, fontPtValue * 0.75);
          const labelHeightMm = labelPt * ptToMm;
          doc.setFontSize(labelPt);
          doc.setTextColor(80, 80, 80); // darker gray
          doc.setFont(fontFamily, "normal");
          // baseline offset: text renders from baseline, add full height
          doc.text(el.column.toUpperCase(), x + 0.3, currentY + labelHeightMm);
          currentY += labelHeightMm + 0.3;
          if (i === 0) {
            console.log(`  -> Drew label "${el.column.toUpperCase()}" at y=${(y + labelHeightMm).toFixed(1)}, labelPt=${labelPt.toFixed(1)}`);
          }
        }

        const valuePt = Math.max(7, fontPtValue);
        const valueHeightMm = valuePt * ptToMm;
        doc.setFontSize(valuePt);
        doc.setTextColor(20, 20, 20);
        doc.setFont(fontFamily, el.fontWeight === "bold" ? "bold" : "normal");
        const textOptions: any = {};
        if (el.wordWrap) {
          textOptions.maxWidth = w - 0.6;
        }
        doc.text(value, x + 0.3, currentY + valueHeightMm, textOptions);
      }
    }
  }

  doc.save(`labels-${labelWidthMm}x${labelHeightMm}mm.pdf`);
}
