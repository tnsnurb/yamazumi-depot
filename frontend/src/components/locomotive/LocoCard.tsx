import React from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { Locomotive } from "../../types/locomotive";
import { statusColors, statusLabels } from "../../types/locomotive";
import { TimeCounter } from "./TimeCounter";

interface LocoCardProps {
    loco: Locomotive;
    isHighlighted: boolean;
    canMove: boolean;
    onDragStart: (e: React.DragEvent<HTMLDivElement>, id: number) => void;
    onClick: (loco: Locomotive) => void;
}

export const LocoCard = React.memo(({
    loco,
    isHighlighted,
    canMove,
    onDragStart,
    onClick
}: LocoCardProps) => {
    return (
        <TooltipProvider delayDuration={200}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div
                        draggable={canMove}
                        onDragStart={(e) => {
                            if (canMove) {
                                onDragStart(e, loco.id);
                            }
                        }}
                        onClick={(e) => {
                            e.stopPropagation();
                            onClick(loco);
                        }}
                        className={`relative w-[92%] h-[65%] mt-3 rounded-sm shadow-md cursor-pointer transition-all flex flex-row border border-slate-800 group/loco
                            ${isHighlighted ? 'ring-4 ring-blue-500 ring-offset-1 z-10 scale-105' : 'hover:scale-105 hover:z-10 z-0'}
                        `}
                    >
                        <div className="w-1/4 h-full bg-slate-700 relative border-r border-slate-900 flex items-center justify-center overflow-hidden rounded-l-sm">
                            <div className="absolute inset-y-1 right-1 w-1/3 bg-blue-200/30 rounded-sm" />
                            <div className={`w-2.5 h-2.5 rounded-full ${statusColors[loco.status]} border border-slate-900 shadow-sm relative z-10 ring-1 ring-black/20`} />
                        </div>
                        <div className="flex-1 h-full bg-gradient-to-r from-red-700 to-red-500 relative flex items-center justify-center overflow-hidden group-hover/loco:brightness-110 transition-all">
                            <div className="absolute top-[20%] w-full h-[2px] bg-yellow-400 opacity-90" />
                            <div className="absolute bottom-[20%] w-full h-[2px] bg-yellow-400 opacity-90" />
                            <div className="bg-slate-900 px-2 py-0.5 rounded-sm text-white font-mono font-semibold text-[10px] leading-tight z-10 shadow-inner border border-slate-700/80 drop-shadow-md flex flex-col items-center min-w-[32px]">
                                {loco.series && <span className="text-[7px] text-slate-400 -mb-0.5">{loco.series}</span>}
                                <span>{loco.number}</span>
                                {loco.repair_type && (
                                    <span className="text-[7px] text-amber-400 border-t border-slate-800 w-full text-center mt-0.5 pt-0.5 font-semibold uppercase tracking-tighter">
                                        {loco.repair_type}
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="w-[6px] h-full bg-slate-800 rounded-r-sm flex flex-col justify-between py-1 border-l border-slate-900/50">
                            <div className="w-full h-[2px] bg-yellow-200 shadow-[0_0_2px_1px_rgba(253,230,138,0.5)]" />
                            <div className="w-full h-[2px] bg-yellow-200 shadow-[0_0_2px_1px_rgba(253,230,138,0.5)]" />
                        </div>
                    </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs space-y-0.5">
                    <p className="font-semibold">{loco.number}</p>
                    <p>{statusLabels[loco.status]}{loco.repair_type ? ` • ${loco.repair_type}` : ''}</p>
                    <TimeCounter date={loco.created_at} variant="days" />
                    {loco.planned_release && (
                        <p>Выпуск: {new Date(loco.planned_release).toLocaleDateString('ru-RU')}</p>
                    )}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
});
