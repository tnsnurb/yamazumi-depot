/**
 * Base API Client for Yamazumi Depot
 * Handles common headers, error parsing, and standardized fetch calls.
 */

interface RequestOptions extends RequestInit {
    params?: Record<string, string | number | undefined>;
}

export class ApiError extends Error {
    public status: number;
    public data?: any;

    constructor(message: string, status: number, data?: any) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.data = data;
    }
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { params, headers, ...customConfig } = options;

    // Construct URL with query params
    let url = endpoint;
    if (params) {
        const queryParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined) queryParams.append(key, value.toString());
        });
        url += `?${queryParams.toString()}`;
    }

    const config: RequestInit = {
        method: customConfig.method || 'GET',
        headers: {
            'Content-Type': 'application/json',
            ...headers,
        },
        ...customConfig,
    };

    try {
        const response = await fetch(url, config);
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new ApiError(data.error || response.statusText, response.status, data);
        }

        return data as T;
    } catch (error) {
        if (error instanceof ApiError) throw error;
        throw new Error(error instanceof Error ? error.message : 'Unknown network error');
    }
}

export const apiClient = {
    get: <T>(url: string, params?: Record<string, any>) => request<T>(url, { method: 'GET', params }),
    post: <T>(url: string, data: any) => request<T>(url, { method: 'POST', body: JSON.stringify(data) }),
    put: <T>(url: string, data: any) => request<T>(url, { method: 'PUT', body: JSON.stringify(data) }),
    delete: <T>(url: string) => request<T>(url, { method: 'DELETE' }),
};
