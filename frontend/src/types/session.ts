import type { Remark } from './remark';

export interface RepairSession {
    id: number | string;
    locomotive_id: number;
    start_date: string;
    end_date?: string | null;
    status: 'active' | 'completed' | 'waiting';
    type?: string; 
    created_at?: string;
    remarks?: Partial<Remark>[];
    checklists?: { id: number | string; status: string }[];
    created_by_user?: { full_name: string; username: string };
    locomotive?: { id: number; number: string; series: string; location_id: number; repair_type: string };
}
