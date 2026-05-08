import { useEffect, useState } from "react";
import QRCode from "qrcode";
import type { LabelLayout } from "@/types/labelLayout";

interface LabelPreviewProps {
  qrValue: string;
  row: Record<string, string>;
  layout: LabelLayout;
}

const LabelPreview = ({ qrValue, row, layout }: LabelPreviewProps) => {
  const [qrDataUrls, setQrDataUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    const generateQRs = async () => {
      const urls: Record<string, string> = {};
      for (const el of layout.elements) {
        if (el.type === "qr" && qrValue) {
          try {
            urls[el.id] = await QRCode.toDataURL(qrValue, {
              width: 256,
              margin: 1,
              color: { dark: "#1a1a2e", light: "#ffffff" },
            });
          } catch { /* skip */ }
        }
      }
      setQrDataUrls(urls);
    };
    generateQRs();
  }, [qrValue, layout]);

  return (
    <div className="label-card relative rounded-lg border bg-card shadow-sm overflow-hidden" style={{ aspectRatio: "10 / 7", minHeight: 180 }}>
      {layout.elements.map((el) => (
        <div
          key={el.id}
          className="absolute overflow-hidden"
          style={{
            left: `${el.x}%`,
            top: `${el.y}%`,
            width: `${el.width}%`,
            height: `${el.height}%`,
          }}
        >
          {el.type === "qr" ? (
            qrDataUrls[el.id] ? (
              <img src={qrDataUrls[el.id]} alt="QR" className="w-full h-full object-contain" />
            ) : null
          ) : (
            <div className="w-full h-full flex flex-col justify-start px-1 pt-0.5 overflow-hidden">
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
                {row[el.column || ""] || "—"}
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default LabelPreview;
