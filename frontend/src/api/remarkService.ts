import { apiClient } from './apiClient';
import type { Remark, RemarkComment, RemarkPhoto, RemarkHistory, CreateRemarkDTO } from '../types/remark';

export const remarkApi = {
    /**
     * Get all remarks for a specific locomotive
     */
    getByLocomotiveId: (locomotiveId: string | number) =>
        apiClient.get<Remark[]>(`/api/locomotives/${locomotiveId}/remarks`),

    /**
     * Assign a worker to a remark
     */
    assignWorker: (remarkId: string, userId: number | null) =>
        apiClient.put<Remark>(`/api/remarks/${remarkId}/assign`, { assigned_to: userId }),

    /**
     * Bulk create remarks from text lines
     */
    bulkCreate: (locomotiveId: string | number, texts: string[]) =>
        apiClient.post<any>(`/api/locomotives/${locomotiveId}/remarks/bulk`, { texts }),

    /**
     * Add multiple remarks from templates
     */
    addFromTemplates: (locomotiveId: string | number, templateIds: number[]) =>
        Promise.all(templateIds.map(templateId => 
            apiClient.post<any>(`/api/locomotives/${locomotiveId}/remarks/template`, { template_id: templateId })
        )),

    /**
     * Create a single manual remark
     */
    create: (locomotiveId: string | number, data: CreateRemarkDTO) =>
        apiClient.post<Remark>(`/api/locomotives/${locomotiveId}/remarks`, data),

    /**
     * Mark a remark as completed or incomplete
     */
    complete: (remarkId: string, is_completed: boolean) =>
        apiClient.put<Remark>(`/api/remarks/${remarkId}/complete`, { is_completed }),

    /**
     * Mark multiple remarks as completed
     */
    completeBatch: (remarkIds: string[]) =>
        apiClient.put<{ success: boolean }>(`/api/remarks/complete-batch`, { remark_ids: remarkIds }),

    /**
     * Verify a completed remark
     */
    verify: (remarkId: string) =>
        apiClient.put<Remark>(`/api/remarks/${remarkId}/verify`, {}),

    /**
     * Reject a remark and return it for redo
     */
    reject: (remarkId: string, comment: string) =>
        apiClient.put<Remark>(`/api/remarks/${remarkId}/reject`, { comment }),

    /**
     * Get all comments for a remark
     */
    getComments: (remarkId: string) =>
        apiClient.get<RemarkComment[]>(`/api/remarks/${remarkId}/comments`),

    /**
     * Add a comment to a remark
     */
    addComment: (remarkId: string, text: string) =>
        apiClient.post<RemarkComment>(`/api/remarks/${remarkId}/comments`, { text }),

    /**
     * Get all photos for a remark
     */
    getPhotos: (remarkId: string) =>
        apiClient.get<RemarkPhoto[]>(`/api/remarks/${remarkId}/photos`),

    /**
     * Upload a photo for a remark
     */
    uploadPhoto: (remarkId: string, formData: FormData) =>
        fetch(`/api/remarks/${remarkId}/photos`, {
            method: 'POST',
            body: formData
        }).then(res => {
            if (!res.ok) throw new Error('Photo upload failed');
            return res.json();
        }) as Promise<RemarkPhoto>,

    /**
     * Get history log for a remark
     */
    getHistory: (remarkId: string) =>
        apiClient.get<RemarkHistory[]>(`/api/remarks/${remarkId}/history`),

    /**
     * General update for remark fields
     */
    update: (remarkId: string, updates: Partial<Remark>) =>
        apiClient.put<Remark>(`/api/remarks/${remarkId}`, updates),
};
