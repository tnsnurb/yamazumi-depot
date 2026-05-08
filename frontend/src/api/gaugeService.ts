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
  certificate_url?: string;
  model_image_url?: string;
  location_id?: number;
  installation_side?: 'K1' | 'K2' | null;
  locomotive?: {
    number: string;
    series: string;
  };
  created_at: string;
  updated_at?: string;
  certificate_number?: string;
  verification_notes?: string;
  verified_by?: string;
}

export interface GaugePagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface GaugesResponse {
  data: Gauge[];
  pagination: GaugePagination;
}

export interface GaugeAlert {
  id: string;
  serial_number: string;
  next_verification: string;
  days_left: number;
  severity: 'critical' | 'urgent' | 'warning';
  status: string;
  part_number?: string;
  description?: string;
  locomotive?: { number: string; series: string };
}

export interface GaugeAlertsResponse {
  total: number;
  critical: number;
  urgent: number;
  warning: number;
  items: GaugeAlert[];
}

export const gaugeService = {
  // Получение всех манометров (с пагинацией)
  getAll: async (params?: { page?: number; limit?: number; sort?: string; order?: string }): Promise<GaugesResponse> => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.sort) query.set('sort', params.sort);
    if (params?.order) query.set('order', params.order);
    const qs = query.toString();
    return apiClient.get(`/api/gauges${qs ? `?${qs}` : ''}`);
  },

  // Получение всех манометров как плоский массив (для терминала, без пагинации)
  getAllFlat: async (): Promise<Gauge[]> => {
    const res: GaugesResponse = await apiClient.get('/api/gauges?limit=9999');
    return res.data || [];
  },

  // Получение уведомлений о просрочках
  getAlerts: async (): Promise<GaugeAlertsResponse> => {
    return apiClient.get('/api/gauges/alerts');
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

  // Получение истории конкретного манометра
  getHistory: async (id: string): Promise<any[]> => {
    return apiClient.get(`/api/gauges/${id}/history`);
  },

  // Удаление
  delete: async (id: string): Promise<void> => {
    return apiClient.delete(`/api/gauges/${id}`);
  },

  // Загрузка фото
  uploadPhoto: async (id: string, formData: FormData): Promise<Gauge> => {
    return apiClient.post(`/api/gauges/${id}/photo`, formData);
  },

  // Загрузка сертификата
  uploadCertificate: async (id: string, formData: FormData): Promise<Gauge> => {
    return apiClient.post(`/api/gauges/${id}/certificate`, formData);
  },

  // Массовый импорт из Excel
  importFromExcel: async (formData: FormData): Promise<{ imported: number; skipped: number; total: number; errors?: string[] }> => {
    return apiClient.post('/api/gauges/import', formData);
  }
};
