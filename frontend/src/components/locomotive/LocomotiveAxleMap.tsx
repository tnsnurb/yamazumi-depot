import React from 'react';
import { cn } from "@/lib/utils";
import { validateWheelMeasures, type Status } from "@/utils/wheelsetValidation";

interface Measurement {
    axle_number: number;
    side: 'Left' | 'Right';
    tire_thickness?: number;
    wear?: number;
    flange_thickness?: number;
    flange_steepness?: number;
    diameter?: number;
}

interface LocomotiveAxleMapProps {
    measurements: Measurement[];
    selectedWheelId: string | null;
    onSelect: (id: string) => void;
    className?: string;
}

/**
 * LocomotiveAxleMap Component
 * Visualizes a Co-Co locomotive axle scheme vertically.
 */
export const LocomotiveAxleMap: React.FC<LocomotiveAxleMapProps> = ({
    measurements,
    selectedWheelId,
    onSelect,
    className
}) => {

    const getWheelStatus = (axleNumber: number, side: 'Left' | 'Right'): Status => {
        const m = measurements.find(m => m.axle_number === axleNumber && m.side === side);
        if (!m) return 'none';
        return validateWheelMeasures(m).overallStatus;
    };

    const getAxleDiff = (axleNumber: number): number => {
        const left = measurements.find(m => m.axle_number === axleNumber && m.side === 'Left')?.diameter || 0;
        const right = measurements.find(m => m.axle_number === axleNumber && m.side === 'Right')?.diameter || 0;
        if (!left || !right) return 0;
        return Math.abs(left - right);
    };

    const Wheel = ({ axle, side }: { axle: number, side: 'Left' | 'Right' }) => {
        const id = `${axle}${side === 'Left' ? 'L' : 'R'}`;
        const isSelected = selectedWheelId === id;
        const status = getWheelStatus(axle, side);

        return (
            <button
                onClick={() => onSelect(id)}
                className={cn(
                    "w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all duration-300 relative group",
                    isSelected
                        ? "border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.5)] scale-110 z-10 bg-blue-500/10"
                        : "border-slate-700 bg-slate-800 hover:border-slate-500",
                    status === 'error' && "border-red-500 bg-red-500/10",
                    status === 'warning' && "border-amber-400 bg-amber-400/10",
                    status === 'ok' && "border-emerald-500 bg-emerald-500/10"
                )}
            >
                <span className={cn(
                    "text-xs font-black tracking-tighter",
                    isSelected ? "text-blue-400" : "text-slate-400",
                    status === 'error' && "text-red-400",
                    status === 'warning' && "text-amber-400",
                    status === 'ok' && "text-emerald-400"
                )}>
                    {id}
                </span>

                {isSelected && (
                    <div className="absolute inset-0 rounded-full animate-ping bg-blue-500/20" />
                )}
            </button>
        );
    };

    return (
        <div className={cn("bg-slate-900 p-6 rounded-3xl shadow-2xl flex flex-col gap-6 select-none border border-slate-800", className)}>
            <div className="flex justify-between items-center">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">СХЕМА (CO-CO)</span>
            </div>

            {/* Vertical Axle Layout */}
            <div className="flex flex-col gap-6 py-2 px-8 relative">
                {/* Visual Connection (Chassis Link) */}
                <div className="absolute left-1/2 top-0 bottom-0 w-24 -translate-x-1/2 border-x-2 border-slate-800/50 rounded-xl" />

                {[1, 2, 3, 4, 5, 6].map(axle => (
                    <div key={axle} className="flex justify-between items-center relative z-10">
                        <Wheel axle={axle} side="Left" />

                        {/* Connecting Axle Line */}
                        <div className="flex-1 h-0.5 bg-slate-800 mx-4 relative">
                            {getAxleDiff(axle) > 0 && (
                                <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-[8px] font-bold text-slate-500 bg-slate-900 px-1">
                                    Δ {getAxleDiff(axle).toFixed(1)}
                                </div>
                            )}
                        </div>

                        <Wheel axle={axle} side="Right" />
                    </div>
                ))}
            </div>
        </div>
    );
};
