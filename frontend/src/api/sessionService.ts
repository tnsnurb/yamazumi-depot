import { apiClient } from './apiClient';
import type { RepairSession } from '../types/session';

export const sessionService = {
    getActiveSessions: async (locomotiveId?: number) => {
        const params: Record<string, string | number> = {};
        if (locomotiveId !== undefined) params.locomotive_id = locomotiveId;
        return await apiClient.get<RepairSession[]>('/api/sessions/active', params);
    },
    getHistory: async (locomotiveId?: number) => {
        const params: Record<string, string | number> = {};
        if (locomotiveId !== undefined) params.locomotive_id = locomotiveId;
        return await apiClient.get<RepairSession[]>('/api/sessions/history', params);
    }
};
