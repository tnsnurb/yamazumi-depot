const express = require('express');
const supabase = require('../../db');
const { requireAuth } = require('../middlewares/auth');

const router = express.Router();

// Get all locations
router.get('/', requireAuth, async (req, res) => {
    const { data, error } = await supabase
        .from('locations')
        .select('*')
        .order('id');
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// Create new location
router.post('/', requireAuth, async (req, res) => {
    if (!req.session.user.is_global_admin) {
        return res.status(403).json({ error: 'Только Главный Админ может создавать депо' });
    }
    const { name, track_count, slot_count, gate_position, track_config } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Название обязательно' });

    const insertData = { name: name.trim() };
    if (track_count !== undefined) insertData.track_count = parseInt(track_count) || 6;
    if (slot_count !== undefined) insertData.slot_count = parseInt(slot_count) || 6;
    if (gate_position !== undefined) insertData.gate_position = gate_position;
    if (track_config !== undefined) insertData.track_config = track_config;

    const { data, error } = await supabase.from('locations').insert([insertData]).select().maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// Update location
router.put('/:id', requireAuth, async (req, res) => {
    if (!req.session.user.is_global_admin) {
        return res.status(403).json({ error: 'Только Главный Админ может изменять депо' });
    }
    const { id } = req.params;
    const { name, is_active, track_count, slot_count, gate_position, track_config } = req.body;

    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (is_active !== undefined) updateData.is_active = is_active;
    if (track_count !== undefined) updateData.track_count = parseInt(track_count) || 6;
    if (slot_count !== undefined) updateData.slot_count = parseInt(slot_count) || 6;
    if (gate_position !== undefined) updateData.gate_position = gate_position;
    if (track_config !== undefined) updateData.track_config = track_config;

    console.log(`\n=== UPDATE LOCATION ATTEMPT (ID: ${id}) ===`);
    console.log("Payload:", JSON.stringify(updateData, null, 2));

    if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ error: 'Нет данных для обновления' });
    }

    const { data, error } = await supabase
        .from('locations')
        .update(updateData)
        .eq('id', id)
        .select()
        .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'Локация не найдена' });
    res.json(data);
});

module.exports = router;
