import { apiClient } from './apiClient';
import type { Locomotive, Location, CreateLocoDTO, MoveLocoDTO, UpdateLocoDTO, LocoStatus } from '../types/locomotive';

export const locomotiveApi = {
    /**
     * Get all locomotives, optional location filter
     */
    getAll: (locationId?: number) =>
        apiClient.get<Locomotive[]>('/api/locomotives', locationId ? { location_id: locationId } : {}),

    /**
     * Get single locomotive by ID or number
     */
    getById: (id: number | string) =>
        apiClient.get<Locomotive>(`/api/locomotives/${encodeURIComponent(id)}`),

    /**
     * Create or reactivate a locomotive
     */
    create: (data: CreateLocoDTO) =>
        apiClient.post<Locomotive>('/api/locomotives', data),

    /**
     * Move locomotive to a different track/position
     */
    move: (id: number | string, data: MoveLocoDTO) =>
        apiClient.put<Locomotive>(`/api/locomotives/${id}/move`, data),

    /**
     * Delete a locomotive record
     */
    delete: (id: number) =>
        apiClient.delete<{ success: boolean }>(`/api/locomotives/${id}`),

    /**
     * Generic update for locomotive fields
     */
    update: (id: number, data: UpdateLocoDTO) =>
        apiClient.put<Locomotive>(`/api/locomotives/${id}`, data),

    // Specialized partial updates (as requested)
    updateStatus: (id: number, status: LocoStatus) =>
        apiClient.put<Locomotive>(`/api/locomotives/${id}`, { status }),

    updateAcceptanceTime: (id: number, acceptanceTime: string | null) =>
        apiClient.put<Locomotive>(`/api/locomotives/${id}`, { acceptance_time: acceptanceTime }),

    updateRepairType: (id: number, repairType: string | null) =>
        apiClient.put<Locomotive>(`/api/locomotives/${id}`, { repair_type: repairType }),

    updatePlannedRelease: (id: number, plannedRelease: string | null) =>
        apiClient.put<Locomotive>(`/api/locomotives/${id}`, { planned_release: plannedRelease }),

    /**
     * Get remarks for a locomotive
     */
    getRemarks: (id: number | string) =>
        apiClient.get<any[]>(`/api/locomotives/${id}/remarks`),

    /**
     * Get history for a locomotive number
     */
    getHistory: (number: string) =>
        apiClient.get<any[]>(`/api/movements/by-locomotive/${encodeURIComponent(number)}`),

    /**
     * Non-locomotive lookups helper (reused in MapPage)
     */
    getLocations: () => apiClient.get<Location[]>('/api/locations'),
    getCatalog: () => apiClient.get<any[]>('/api/catalog'),
    getRepairTypes: () => apiClient.get<any[]>('/api/repair-types').then(data => data.map(rt => rt.name)),

    /**
     * Get locomotives for the journal (movements API)
     */
    getJournalLocomotives: (locationId?: number) =>
        apiClient.get<Locomotive[]>('/api/movements/locomotives', locationId ? { location_id: locationId } : {}),

    /**
     * Get all system users
     */
    getUsers: () => apiClient.get<any[]>('/api/public/users'),
};
