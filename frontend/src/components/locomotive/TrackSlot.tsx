import React from "react";
import { Plus } from "lucide-react";
import { LocoCard } from "./LocoCard";
import type { Locomotive } from "../../types/locomotive";

interface TrackSlotProps {
    track: number;
    pos: number;
    loco?: Locomotive;
    isHighlighted: boolean;
    canMove: boolean;
    canEdit: boolean;
    draggedId: number | null;
    isInside: (pos: number) => boolean;
    onDrop: (e: React.DragEvent<HTMLDivElement>, track: number, pos: number) => void;
    onDragStart: (e: React.DragEvent<HTMLDivElement>, id: number) => void;
    onSlotClick: (track: number, pos: number) => void;
    onLocoClick: (loco: Locomotive) => void;
}

export const TrackSlot = React.memo(({
    track,
    pos,
    loco,
    isHighlighted,
    canMove,
    canEdit,
    draggedId,
    isInside,
    onDrop,
    onDragStart,
    onSlotClick,
    onLocoClick
}: TrackSlotProps) => {
    return (
        <div
            className={`relative w-32 h-16 border rounded-md flex items-center justify-center transition-colors
                ${draggedId ? 'border-dashed border-2 border-slate-300 hover:border-slate-500 hover:bg-slate-50' : 'border-slate-200'}
                ${!loco && !draggedId ? 'cursor-pointer hover:bg-indigo-50 hover:border-indigo-300 group' : ''}
                ${!isInside(pos) ? 'bg-slate-100/50' : 'bg-white shadow-sm'}
            `}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => onDrop(e, track, pos)}
            onClick={() => { if (!loco && !draggedId && canEdit) onSlotClick(track, pos) }}
        >
            <div className="absolute top-1 left-2 text-xs text-slate-400 font-mono">{pos}</div>

            {loco ? (
                <LocoCard
                    loco={loco}
                    isHighlighted={isHighlighted}
                    canMove={canMove}
                    onDragStart={onDragStart}
                    onClick={onLocoClick}
                />
            ) : (
                <Plus className="w-5 h-5 text-indigo-300 opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
        </div>
    );
});
