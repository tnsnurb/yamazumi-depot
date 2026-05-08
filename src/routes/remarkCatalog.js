const express = require('express');
const supabase = require('../../db');
const { requireAuth } = require('../middlewares/auth');

const router = express.Router();

/**
 * GET /api/remark-catalog
 * Returns all active catalog items grouped by category
 */
router.get('/', requireAuth, async (req, res) => {
    try {
        let allData = [];
        let start = 0;
        const limit = 1000;
        let hasMore = true;

        while (hasMore) {
            const { data, error } = await supabase
                .from('remark_catalog')
                .select('id, code, category, section, description_ru, description_en, has_placeholder')
                .eq('is_active', true)
                .order('code', { ascending: true })
                .range(start, start + limit - 1);

            if (error) throw error;
            
            allData = allData.concat(data);
            
            if (data.length < limit) {
                hasMore = false;
            } else {
                start += limit;
            }
        }

        res.json(allData || []);
    } catch (err) {
        console.error('API Error (remark-catalog):', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/remark-catalog/categories
 * Returns distinct category names with item counts
 */
router.get('/categories', requireAuth, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('remark_catalog')
            .select('category')
            .eq('is_active', true);

        if (error) throw error;

        const counts = {};
        (data || []).forEach(item => {
            counts[item.category] = (counts[item.category] || 0) + 1;
        });

        const categories = Object.entries(counts)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);

        res.json(categories);
    } catch (err) {
        console.error('API Error (remark-catalog/categories):', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
