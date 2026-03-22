import { apiClient } from "./apiClient";

export interface Gauge {
  id: string;
  serial_number: string;
  type_id: string;
  part_number?: string;
  description?: string;
  last_verification: string;
  next_verification: string;
  is_defective: boolean;
  status: 'На складе' | 'На локомотиве' | 'На поверке' | 'Списан';
  locomotive_id: number | null;
  photo_url?: string;
  model_image_url?: string;
  installation_side?: 'K1' | 'K2' | null;
  locomotive?: {
    number: string;
    series: string;
  };
  created_at: string;
}

export const gaugeService = {
  // Получение всех манометров
  getAll: async (): Promise<Gauge[]> => {
    return apiClient.get('/api/gauges');
  },

  // Получение по серийному номеру
  getBySerial: async (serial: string): Promise<Gauge> => {
    return apiClient.get(`/api/gauges/serial/${serial}`);
  },

  // Создание
  create: async (gauge: Partial<Gauge>): Promise<Gauge> => {
    return apiClient.post('/api/gauges', gauge);
  },

  // Обновление
  update: async (id: string, updates: Partial<Gauge>): Promise<Gauge> => {
    return apiClient.put(`/api/gauges/${id}`, updates);
  },

  // Получение по ID локомотива
  getByLocomotive: async (locomotiveId: string | number): Promise<Gauge[]> => {
    return apiClient.get(`/api/gauges/locomotive/${locomotiveId}`);
  },

  // Получение истории манометров локомотива
  getHistoryByLocomotive: async (locomotiveId: string | number): Promise<any[]> => {
    return apiClient.get(`/api/gauges/locomotive/${locomotiveId}/history`);
  },

  // Удаление
  delete: async (id: string): Promise<void> => {
    return apiClient.delete(`/api/gauges/${id}`);
  },

  // Загрузка фото
  uploadPhoto: async (id: string, formData: FormData): Promise<Gauge> => {
    return apiClient.post(`/api/gauges/${id}/photo`, formData);
  }
};
