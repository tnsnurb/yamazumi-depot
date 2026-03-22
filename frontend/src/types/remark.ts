export interface RemarkUser {
    id: number;
    full_name: string;
    username: string;
    specialization?: string | null;
}

export interface RemarkComment {
    id: string;
    text: string;
    created_at: string;
    user_id: RemarkUser | null;
}

export interface RemarkPhoto {
    id: string;
    photo_url: string;
    created_at: string;
    user_id: RemarkUser | null;
}

export interface RemarkHistory {
    id: string;
    action: string;
    details: string;
    created_at: string;
    user_id: RemarkUser | null;
}

export interface Remark {
    id: string;
    text: string;
    priority: "low" | "medium" | "high";
    category: string | null;
    is_completed: boolean;
    completed_at: string | null;
    created_at: string;
    completed_by: RemarkUser | null;
    created_by?: RemarkUser | null;
    is_verified?: boolean;
    verified_at?: string | null;
    verified_by?: RemarkUser | null;
    assigned_to?: number | null;
    assigned_user?: RemarkUser | null;
    session_id?: number | string | null;
}

export interface CreateRemarkDTO {
    text: string;
    priority?: string;
    category?: string;
}

export interface RemarkTemplate {
    id: number;
    text: string;
    category: string | null;
}
