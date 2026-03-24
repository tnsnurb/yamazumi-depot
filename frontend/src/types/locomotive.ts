export type LocoStatus = 'active' | 'repair' | 'waiting' | 'completed';

export interface Locomotive {
    id: number;
    series: string | null;
    number: string;
    status: LocoStatus;
    track: number | null;
    position: number | null;
    created_at: string;
    repair_type: string | null;
    planned_release: string | null;
    acceptance_time: string | null;
    is_on_map?: boolean;
}

export interface Location {
    id: number;
    name: string;
    track_count: number;
    slot_count: number;
    gate_position: string | number | null;
    track_config: string | null;
}

export interface CreateLocoDTO {
    series?: string;
    number: string;
    status: string;
    track: number | null;
    position: number | null;
    repair_type: string | null;
    planned_release: string | null;
    acceptance_time: string | null;
}

export interface MoveLocoDTO {
    track: number | null;
    position: number | null;
    reason?: string;
}

export interface UpdateLocoDTO {
    status?: LocoStatus;
    number?: string;
    series?: string;
    repair_type?: string | null;
    planned_release?: string | null;
    acceptance_time?: string | null;
}

export const statusColors: Record<string, string> = {
    active: 'bg-slate-900',
    repair: 'bg-rose-500',
    waiting: 'bg-amber-500',
    completed: 'bg-blue-600',
};

export const statusLabels: Record<string, string> = {
    active: 'Рабочий',
    repair: 'Ремонт',
    waiting: 'Ожидание',
    completed: 'Готов',
};

export const formatToDateTimeLocal = (dateStr: string | null) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "";

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${year}-${month}-${day}T${hours}:${minutes}`;
};
