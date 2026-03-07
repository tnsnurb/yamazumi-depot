import { supabase } from './supabase'

const originalFetch = window.fetch;

window.fetch = async (...args) => {
    const resource = args[0];
    let config = args[1];

    // Only intercept relative /api calls
    const url = resource.toString();
    if (url.startsWith('/api') && !url.includes('/api/login')) {
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.access_token) {
            config = config || {};
            config.headers = {
                ...(config.headers || {}),
                'Authorization': `Bearer ${session.access_token}`
            };
        }
    }

    return originalFetch(resource, config);
};
