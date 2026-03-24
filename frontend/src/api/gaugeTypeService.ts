import { apiClient } from './apiClient';

export interface GaugeType {
    id: string;
    part_number: string;
    description: string;
    image_url?: string;
    accuracy_class?: string;
    pressure_range?: string;
    thread_type?: string;
    created_at?: string;
}

export const gaugeTypeService = {
    getAll: async (): Promise<GaugeType[]> => {
        return apiClient.get('/api/gauge-types');
    },

    create: async (data: Partial<GaugeType>): Promise<GaugeType> => {
        return apiClient.post('/api/gauge-types', data);
    },

    update: async (id: string, data: Partial<GaugeType>): Promise<GaugeType> => {
        return apiClient.put(`/api/gauge-types/${id}`, data);
    },

    delete: async (id: string): Promise<void> => {
        await apiClient.delete(`/api/gauge-types/${id}`);
    },
    
    // Загрузка фото модели
    uploadPhoto: async (id: string, formData: FormData): Promise<GaugeType> => {
        return apiClient.post(`/api/gauge-types/${id}/photo`, formData);
    }
};
