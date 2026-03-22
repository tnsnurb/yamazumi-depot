import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { validateWheelMeasures, type Status } from '@/utils/wheelsetValidation';
import { cn } from "@/lib/utils";
import { Check, AlertTriangle, XCircle } from 'lucide-react';

interface WheelProfileSVGProps {
    thickness?: number;
    flangeWidth?: number;
    treadWear?: number;
    diameter?: number;
    onThicknessChange?: (v: number | undefined) => void;
    onFlangeWidthChange?: (v: number | undefined) => void;
    onTreadWearChange?: (v: number | undefined) => void;
    onDiameterChange?: (v: number | undefined) => void;
    className?: string;
}

const StatusBadge = ({ status, label, value, onChange, x, y, align = 'left' }: {
    status: Status,
    label: string,
    value: number | undefined,
    onChange?: (v: number | undefined) => void,
    x: number,
    y: number,
    align?: 'left' | 'right'
}) => {
    const isError = status === 'error';
    const isWarning = status === 'warning';

    return (
        <foreignObject x={align === 'left' ? x : x - 130} y={y} width="130" height="45" className="overflow-visible">
            <div className={cn(
                "flex flex-col gap-0.5",
                align === 'right' ? "items-end text-right" : "items-start text-left"
            )}>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter whitespace-nowrap">
                    {label}
                </span>
                <div className="flex items-center gap-1.5">
                    <input
                        type="number"
                        value={value ?? ""}
                        onChange={e => onChange?.(e.target.value === "" ? undefined : parseFloat(e.target.value))}
                        className={cn(
                            "w-[65px] px-2 py-0.5 rounded-md text-[13px] font-black border tabular-nums shadow-sm outline-none transition-all focus:ring-2",
                            isError ? "bg-red-50 text-red-700 border-red-200 focus:ring-red-200" :
                                isWarning ? "bg-amber-50 text-amber-700 border-amber-200 focus:ring-amber-200" :
                                    "bg-emerald-50 text-emerald-700 border-emerald-200 focus:ring-emerald-200"
                        )}
                    />
                    <div className={cn(
                        "flex items-center gap-1 px-2 py-0.5 rounded-md text-[8px] font-black uppercase text-white shadow-sm",
                        isError ? "bg-red-600" :
                            isWarning ? "bg-amber-500" :
                                "bg-emerald-600"
                    )}>
                        {isError ? <XCircle size={9} /> : isWarning ? <AlertTriangle size={9} /> : <Check size={9} />}
                        {isError ? "Критично" : isWarning ? "Внимание" : "Норма"}
                    </div>
                </div>
            </div>
        </foreignObject>
    );
};

export const WheelProfileSVG: React.FC<WheelProfileSVGProps> = ({
    thickness = 75,
    flangeWidth = 33,
    treadWear = 0,
    diameter = 1050,
    onThicknessChange,
    onFlangeWidthChange,
    onTreadWearChange,
    onDiameterChange,
    className
}) => {
    const validation = validateWheelMeasures({
        axle_number: 1,
        side: 'Left',
        tire_thickness: thickness,
        flange_thickness: flangeWidth,
        wear: treadWear,
        diameter: diameter
    });

    // SVG Coordinate System (Better proportions)
    const viewWidth = 500;
    const viewHeight = 350;

    // Ensure values are strictly numbers for safe SVG coordinate math
    const sThickness = typeof thickness === 'number' ? thickness : 75;
    const sFlangeWidth = typeof flangeWidth === 'number' ? flangeWidth : 33;
    const sTreadWear = typeof treadWear === 'number' ? treadWear : 0;
    const sDiameter = typeof diameter === 'number' ? diameter : 1050;

    // Fixed proportions
    const centerX = 250;
    const baseLine = 280;
    const scale = 2;
    const tireWidthIdx = 140 * scale;

    // Calculate vertical positions
    const treadHeight = sThickness * scale;
    const topTreadY = baseLine - treadHeight;
    const flangeHeight = 28 * scale;
    const topFlangeY = topTreadY - flangeHeight;

    // Sanity check for numbers to avoid "undefined" or "NaN" in SVG paths
    const safeNum = (n: any, fallback = 0) => (Number.isFinite(n) ? n : fallback);

    // Dynamic points based on props
    const currentPath = useMemo(() => {
        const lb = safeNum(centerX - tireWidthIdx / 2);
        const rb = safeNum(centerX + tireWidthIdx / 2);
        const fpX = safeNum(lb + sFlangeWidth * scale);
        const tStart = safeNum(fpX + 10 * scale);
        const tEnd = safeNum(rb - 10 * scale);
        const wDepth = safeNum(sTreadWear * scale * 2);
        const ty = safeNum(topTreadY);
        const fy = safeNum(topFlangeY);

        return `M ${lb} ${baseLine} L ${lb} ${ty - 5} Q ${lb + 5} ${fy} ${lb + (fpX - lb) / 2} ${fy} Q ${fpX} ${fy} ${tStart} ${ty} L ${tStart + 5} ${ty} Q ${(tStart + tEnd) / 2} ${ty + wDepth} ${tEnd} ${ty} L ${rb} ${baseLine} Z`;
    }, [sThickness, sFlangeWidth, sTreadWear, tireWidthIdx, topTreadY, topFlangeY, baseLine, scale]);

    const idealPath = useMemo(() => {
        const tireHeightIdeal = 85 * scale;
        const topTreadYIdeal = baseLine - tireHeightIdeal;
        const topFlangeYIdeal = topTreadYIdeal - 28 * scale;

        const leftBoundary = centerX - tireWidthIdx / 2;
        const rightBoundary = centerX + tireWidthIdx / 2;

        const flangePeakOffsetIdeal = 33 * scale;
        const flangePeakXIdeal = leftBoundary + flangePeakOffsetIdeal;
        const treadStartIdeal = leftBoundary + flangePeakOffsetIdeal + 10 * scale;
        const treadEndIdeal = rightBoundary - 10 * scale;

        return `
            M ${leftBoundary} ${baseLine}
            L ${leftBoundary} ${topTreadYIdeal - 5}
            Q ${leftBoundary + 5} ${topFlangeYIdeal} ${leftBoundary + flangePeakOffsetIdeal / 2} ${topFlangeYIdeal}
            Q ${flangePeakXIdeal} ${topFlangeYIdeal} ${treadStartIdeal} ${topTreadYIdeal}
            L ${treadStartIdeal} ${topTreadYIdeal}
            L ${treadEndIdeal} ${topTreadYIdeal}
            L ${rightBoundary} ${baseLine}
            Z
        `;
    }, [tireWidthIdx, baseLine, scale]);

    // Diameter Arc - make it react to diameter prop
    // Diameter base in loco is usually 1050. Let's scale the arc curvature.
    const diameterOffset = (sDiameter - 1050) * 0.5;

    return (
        <div className={cn("relative w-full max-w-[600px] aspect-[5/3.5] mx-auto", className)}>
            <svg viewBox={`0 0 ${viewWidth} ${viewHeight}`} className="w-full h-full drop-shadow-xl">
                <defs>
                    <pattern id="hatch-gray" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                        <line x1="0" y1="0" x2="0" y2="10" stroke="rgba(100,116,139,0.2)" strokeWidth="1" />
                    </pattern>
                </defs>

                {/* Ground Line */}
                <line x1="20" y1={baseLine + 10} x2={viewWidth - 20} y2={baseLine + 10} stroke="#e2e8f0" strokeWidth="2" strokeDasharray="10 5" />

                {/* Ideal Profile (Reference) */}
                <path d={idealPath} fill="none" stroke="#10b981" strokeWidth="1.5" strokeDasharray="8 4" opacity="0.3" />

                {/* Current Profile (Hatched) */}
                <motion.path
                    d={currentPath}
                    fill="url(#hatch-gray)"
                    stroke="#1e293b"
                    strokeWidth="2.5"
                    strokeLinejoin="round"
                    animate={{ d: currentPath }}
                    transition={{ type: "spring", stiffness: 50, damping: 15 }}
                />

                {/* TECHNICAL DIMENSION LINES */}
                <g className="opacity-60 text-blue-500">
                    {/* Thickness Line (Vertical) */}
                    <line x1={centerX - tireWidthIdx / 2 - 30} y1={baseLine} x2={centerX - tireWidthIdx / 2 - 30} y2={topTreadY} stroke="currentColor" strokeWidth="1.5" />
                    <path d={`M ${centerX - tireWidthIdx / 2 - 33} ${baseLine - 5} L ${centerX - tireWidthIdx / 2 - 30} ${baseLine} L ${centerX - tireWidthIdx / 2 - 27} ${baseLine - 5}`} fill="none" stroke="currentColor" />
                    <path d={`M ${centerX - tireWidthIdx / 2 - 33} ${topTreadY + 5} L ${centerX - tireWidthIdx / 2 - 30} ${topTreadY} L ${centerX - tireWidthIdx / 2 - 27} ${topTreadY + 5}`} fill="none" stroke="currentColor" />
                </g>

                <g className="opacity-60 text-indigo-400">
                    {/* Flange Thickness Line (Horizontal) */}
                    <line x1={centerX - tireWidthIdx / 2} y1={topTreadY + 20} x2={centerX - tireWidthIdx / 2 + sFlangeWidth * scale} y2={topTreadY + 20} stroke="currentColor" strokeWidth="1.5" />
                    <circle cx={centerX - tireWidthIdx / 2} cy={topTreadY + 20} r="2" fill="currentColor" />
                    <circle cx={centerX - tireWidthIdx / 2 + sFlangeWidth * scale} cy={topTreadY + 20} r="2" fill="currentColor" />
                </g>

                {/* Diameter Arc Representation (Right) */}
                <g className="opacity-60 text-red-500">
                    <motion.path
                        animate={{ 
                            d: `M ${safeNum(centerX + tireWidthIdx / 2 + 20)} ${baseLine} Q ${safeNum(centerX + tireWidthIdx / 2 + 60 + diameterOffset)} ${safeNum((baseLine + topTreadY) / 2)} ${safeNum(centerX + tireWidthIdx / 2 + 20)} ${safeNum(topTreadY)}` 
                        }}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                    />
                    <motion.circle
                        animate={{ 
                            cx: safeNum(centerX + tireWidthIdx / 2 + 35 + diameterOffset / 2), 
                            cy: safeNum((baseLine + topTreadY) / 2) 
                        }}
                        r="3.5"
                        fill="currentColor"
                    />
                </g>

                {/* BADGES */}
                <StatusBadge
                    status={validation.fields.tire_thickness}
                    label="Толщина бандажа"
                    value={thickness}
                    onChange={onThicknessChange}
                    x={20}
                    y={50}
                />
                <StatusBadge
                    status={validation.fields.wear}
                    label="Прокат (износ)"
                    value={treadWear}
                    onChange={onTreadWearChange}
                    x={viewWidth - 20}
                    y={50}
                    align="right"
                />
                <StatusBadge
                    status={validation.fields.flange_thickness}
                    label="Толщина гребня"
                    value={flangeWidth}
                    onChange={onFlangeWidthChange}
                    x={20}
                    y={viewHeight - 110}
                />
                <StatusBadge
                    status={validation.fields.diameter}
                    label="Диаметр колеса"
                    value={diameter}
                    onChange={onDiameterChange}
                    x={viewWidth - 20}
                    y={viewHeight - 110}
                    align="right"
                />

                <text x={centerX} y={25} textAnchor="middle" className="text-[10px] font-black fill-slate-300 uppercase tracking-widest">
                    Технический разрез профиля
                </text>
            </svg>
        </div>
    );
};
