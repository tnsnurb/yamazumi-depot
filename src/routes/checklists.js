const express = require('express');
const multer = require('multer');
const ExcelJS = require('exceljs');
const supabase = require('../../db');
const { requireAuth } = require('../middlewares/auth');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// --- TEMPLATES (Admin) ---

// 1. Get all templates (with item counts)
router.get('/templates', requireAuth, async (req, res) => {
    try {
        const { data: templates, error } = await supabase
            .from('checklist_templates')
            .select(`
                id, series, name, created_at,
                repair_type:repair_type_id (id, name),
                items:checklist_template_items (count)
            `)
            .order('series', { ascending: true })
            .order('repair_type_id', { ascending: true });

        if (error) throw error;
        res.json(templates);
    } catch (err) {
        console.error('Error fetching templates:', err);
        res.status(500).json({ error: 'Failed to fetch templates' });
    }
});

// 2. Get specific template + items
router.get('/templates/:id', requireAuth, async (req, res) => {
    try {
        const { data: template, error: templateError } = await supabase
            .from('checklist_templates')
            .select('*, repair_type:repair_type_id(id, name)')
            .eq('id', req.params.id)
            .single();

        if (templateError) throw templateError;

        const { data: items, error: itemsError } = await supabase
            .from('checklist_template_items')
            .select('*')
            .eq('template_id', req.params.id)
            .order('sort_order', { ascending: true });

        if (itemsError) throw itemsError;

        res.json({ ...template, items });
    } catch (err) {
        console.error('Error fetching template:', err);
        res.status(500).json({ error: 'Failed to fetch template' });
    }
});

// 3. Create a new template
router.post('/templates', requireAuth, async (req, res) => {
    // Requires admin privileges - assuming checking in frontend, but could add middleware
    if (!req.session.user?.is_global_admin) {
        // Allowing for now, adapt if needed
    }

    const { series, repair_type_id } = req.body;

    if (!series || !repair_type_id) {
        return res.status(400).json({ error: 'Series and Repair Type are required' });
    }

    try {
        // Fetch repair type name for the template name
        const { data: rt } = await supabase.from('repair_types').select('name').eq('id', repair_type_id).single();
        const rtName = rt ? rt.name : `Type ${repair_type_id}`;
        const name = `${series} — ${rtName}`;

        const { data: template, error } = await supabase
            .from('checklist_templates')
            .insert([{ series, repair_type_id, name }])
            .select()
            .single();

        if (error) {
            if (error.code === '23505') { // Unique violation
                return res.status(400).json({ error: 'Шаблон для этой серии и типа ремонта уже существует' });
            }
            throw error;
        }

        res.status(201).json(template);
    } catch (err) {
        console.error('Error creating template:', err);
        res.status(500).json({ error: 'Failed to create template' });
    }
});

// 4. Update template items manually
router.put('/templates/:id/items', requireAuth, async (req, res) => {
    const templateId = req.params.id;
    const items = req.body.items; // Array of items

    try {
        // Simple approach: delete existing and re-insert to handle re-ordering and deletions easily
        const { error: deleteError } = await supabase
            .from('checklist_template_items')
            .delete()
            .eq('template_id', templateId);

        if (deleteError) throw deleteError;

        if (items && items.length > 0) {
            const itemsToInsert = items.map((item, index) => ({
                template_id: templateId,
                sort_order: index + 1,
                group_name: item.group_name || null,
                short_description: item.short_description,
                full_description: item.full_description || null,
                executor_role: item.executor_role || null,
                controller_role: item.controller_role || null,
                required: item.required !== undefined ? item.required : true
            }));

            const { error: insertError } = await supabase
                .from('checklist_template_items')
                .insert(itemsToInsert);

            if (insertError) throw insertError;
        }

        res.json({ success: true });
    } catch (err) {
        console.error('Error updating template items:', err);
        res.status(500).json({ error: 'Failed to update items' });
    }
});

// 5. Import from Excel
router.post('/templates/:id/import', requireAuth, upload.single('file'), async (req, res) => {
    const templateId = req.params.id;
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(req.file.buffer);
        const worksheet = workbook.getWorksheet(1);

        const data = [];
        worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
            // ExcelJS row.values is 1-indexed, values[0] is empty. We map to 0-indexed for consistency with original logic.
            const rowValues = [];
            if (Array.isArray(row.values)) {
                for (let i = 1; i < row.values.length; i++) {
                    rowValues.push(row.values[i]);
                }
            }
            data.push(rowValues);
        });

        if (data.length <= 1) {
            return res.status(400).json({ error: 'Excel file is empty or only contains headers' });
        }

        // Identify columns (robust parsing by header names if possible, or fallback to fixed indices)
        const headers = data[0].map(h => typeof h === 'string' ? h.toLowerCase().trim() : '');

        // Find indices
        let colGroup = headers.findIndex(h => h.includes('группа'));
        let colShortDesc = headers.findIndex(h => h.includes('краткое') || h === 'описание');
        let colFullDesc = headers.findIndex(h => h === 'описание' && headers.indexOf(h) !== colShortDesc);
        let colExec = headers.findIndex(h => h.includes('исполнитель'));
        let colCtrl = headers.findIndex(h => h.includes('контроль'));

        // Fallbacks based on user screenshot if headers don't strictly match
        if (colGroup === -1) colGroup = 0;
        if (colShortDesc === -1) colShortDesc = 1;
        if (colFullDesc === -1) colFullDesc = 2;
        if (colExec === -1) colExec = 3;
        if (colCtrl === -1) colCtrl = 4;

        const itemsToInsert = [];
        let sortOrder = 1;

        for (let i = 1; i < data.length; i++) {
            const row = data[i];

            // Skip empty rows (must have at least a short description)
            if (!row[colShortDesc] && !row[colFullDesc]) continue;

            itemsToInsert.push({
                template_id: templateId,
                sort_order: sortOrder++,
                group_name: row[colGroup] ? String(row[colGroup]).trim() : null,
                short_description: row[colShortDesc] ? String(row[colShortDesc]).trim() : String(row[colFullDesc]).substring(0, 100).trim(),
                full_description: row[colFullDesc] ? String(row[colFullDesc]).trim() : null,
                executor_role: row[colExec] ? String(row[colExec]).trim() : null,
                controller_role: row[colCtrl] ? String(row[colCtrl]).trim() : null,
                required: true
            });
        }

        // Delete existing items
        await supabase.from('checklist_template_items').delete().eq('template_id', templateId);

        // Insert new ones
        if (itemsToInsert.length > 0) {
            const { error: insertError } = await supabase.from('checklist_template_items').insert(itemsToInsert);
            if (insertError) throw insertError;
        }

        res.json({ success: true, count: itemsToInsert.length });
    } catch (err) {
        console.error('Error importing Excel:', err);
        res.status(500).json({ error: 'Failed to process Excel file' });
    }
});

// 6. Delete template
router.delete('/templates/:id', requireAuth, async (req, res) => {
    try {
        const { error } = await supabase
            .from('checklist_templates')
            .delete()
            .eq('id', req.params.id);

        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting template:', err);
        res.status(500).json({ error: 'Failed to delete template' });
    }
});


// --- INSTANCES (Workers / Masters) ---

// Get specific checklist instance and its items by ID
router.get('/instances/:id', requireAuth, async (req, res) => {
    try {
        const instanceId = req.params.id;

        const { data: instance, error: instanceError } = await supabase
            .from('checklist_instances')
            .select('*, template:template_id(name)')
            .eq('id', instanceId)
            .single();

        if (instanceError) throw instanceError;
        if (!instance) return res.status(404).json({ error: 'Checklist instance not found' });

        const { data: items, error: itemsError } = await supabase
            .from('checklist_instance_items')
            .select(`
                *,
                template_item:template_item_id(*),
                completed_by_user:completed_by(full_name),
                verified_by_user:verified_by(full_name)
            `)
            .eq('instance_id', instanceId)
            .order('sort_order', { ascending: true });

        if (itemsError) throw itemsError;

        res.json({ instance, items });
    } catch (err) {
        console.error('Error fetching checklist instance:', err);
        res.status(500).json({ error: 'Failed to fetch checklist instance' });
    }
});

// Get all active checklist instances with item counts
router.get('/active', requireAuth, async (req, res) => {
    console.log(`[CHECKLISTS] Fetching active checklists for user ${req.session?.user?.username}`);
    try {
        const locationId = req.session.user.active_location_id;

        // 1. Get all active instances linked to an active repair session
        const { data: instances, error: instancesError } = await supabase
            .from('checklist_instances')
            .select(`
                id, 
                status, 
                created_at,
                locomotive:locomotive_id (id, number, series, location_id),
                template:template_id (name),
                repair_sessions!inner(status)
            `)
            .neq('status', 'completed')
            .eq('repair_sessions.status', 'active')
            .order('created_at', { ascending: false });

        if (instancesError) throw instancesError;

        if (!instances || instances.length === 0) return res.json([]);

        // 2. Filter by location in Node.js
        const filteredInstances = instances.filter(i => !locationId || i.locomotive?.location_id === locationId);

        if (filteredInstances.length === 0) return res.json([]);

        // 3. Fetch pre-calculated progress from view for ONLY the filtered IDs
        const instanceIds = filteredInstances.map(i => i.id);
        const { data: progressData, error: progressError } = await supabase
            .from('view_active_checklist_progress')
            .select('*')
            .in('instance_id', instanceIds);

        // If view doesn't exist yet or has error, handle gracefully
        const progressMap = (progressData || []).reduce((acc, p) => {
            acc[p.instance_id] = p;
            return acc;
        }, {});

        // 4. Combine results
        const result = filteredInstances.map(i => ({
            id: i.id,
            status: i.status,
            created_at: i.created_at,
            locomotive: i.locomotive,
            template: i.template,
            total_items: parseInt(progressMap[i.id]?.total_items || 0),
            completed_items: parseInt(progressMap[i.id]?.completed_items || 0)
        }));

        res.json(result);
    } catch (err) {
        console.error('Error fetching active checklists:', err);
        res.status(500).json({ error: 'Failed to fetch active checklists' });
    }
});

// Get active checklist for locomotive
router.get('/locomotive/:locomotiveId', requireAuth, async (req, res) => {
    try {
        const locomotiveId = req.params.locomotiveId;

        // Find the active instance for this locomotive in the current active session
        const { data: instance, error: instanceError } = await supabase
            .from('checklist_instances')
            .select('*, template:template_id(name), repair_sessions!inner(status)')
            .eq('locomotive_id', locomotiveId)
            .eq('repair_sessions.status', 'active')
            // Just get the most recent one if multiple exist
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (instanceError) throw instanceError;

        if (!instance) {
            return res.json({ instance: null, items: [] });
        }

        // Fetch items
        const { data: items, error: itemsError } = await supabase
            .from('checklist_instance_items')
            .select(`
                *,
                template_item:template_item_id(*),
                completed_by_user:completed_by(full_name),
                verified_by_user:verified_by(full_name)
            `)
            .eq('instance_id', instance.id)
            .order('sort_order', { ascending: true });

        if (itemsError) throw itemsError;

        res.json({ instance, items });
    } catch (err) {
        console.error('Error fetching locomotive checklist:', err);
        res.status(500).json({ error: 'Failed to fetch checklist' });
    }
});

// Bulk complete multiple checklist instances
router.post('/instances/bulk-complete', requireAuth, async (req, res) => {
    const { instanceIds } = req.body;
    const userId = req.session.user.id;

    if (!instanceIds || !Array.isArray(instanceIds) || instanceIds.length === 0) {
        return res.status(400).json({ error: 'No instance IDs provided' });
    }

    try {
        // 1. Get all incomplete items for these instances
        const { data: items, error: fetchError } = await supabase
            .from('checklist_instance_items')
            .select('id, instance_id, template_item:template_item_id(points)')
            .in('instance_id', instanceIds)
            .eq('is_completed', false);

        if (fetchError) throw fetchError;

        if (items && items.length > 0) {
            const itemIds = items.map(it => it.id);
            const totalPoints = items.reduce((sum, it) => sum + (it.template_item?.points || 5), 0);

            // 2. Update items
            const { error: updateError } = await supabase
                .from('checklist_instance_items')
                .update({
                    is_completed: true,
                    completed_by: userId,
                    completed_at: new Date().toISOString()
                })
                .in('id', itemIds);

            if (updateError) throw updateError;

            // 3. Award points
            await supabase.rpc('increment_user_points', { user_id: userId, amount: totalPoints });

            // 4. Log history (batch insert)
            const historyToInsert = items.map(it => ({
                item_id: it.id,
                user_id: userId,
                action: 'completed',
                details: `Массовое выполнение (+${it.template_item?.points || 5} б.)`
            }));
            await supabase.from('checklist_item_history').insert(historyToInsert);
        }

        // 5. Update instance statuses
        for (const instanceId of instanceIds) {
            await checkInstanceCompletion(instanceId, userId);
        }

        res.json({ success: true, count: items?.length || 0 });
    } catch (err) {
        console.error('Error in bulk complete:', err);
        res.status(500).json({ error: 'Failed to complete checklists' });
    }
});

// Mark item completed/uncompleted
router.patch('/items/:id/complete', requireAuth, async (req, res) => {
    try {
        const itemId = req.params.id;
        const { is_completed, notes } = req.body;

        // Fetch current item to get point value
        const { data: item, error: fetchErr } = await supabase
            .from('checklist_instance_items')
            .select('*, template_item:template_item_id(points)')
            .eq('id', itemId)
            .single();

        if (fetchErr) throw fetchErr;

        const updates = {
            is_completed,
            notes: notes !== undefined ? notes : null,
            completed_by: is_completed ? req.session.user.id : null,
            completed_at: is_completed ? new Date().toISOString() : null
        };

        const { data, error } = await supabase
            .from('checklist_instance_items')
            .update(updates)
            .eq('id', itemId)
            .select(`
                *,
                template_item:template_item_id(*),
                completed_by_user:completed_by(full_name),
                verified_by_user:verified_by(full_name)
            `)
            .single();

        if (error) throw error;

        // --- POINT SYSTEM & HISTORY ---
        const pointsToAward = data.template_item?.points || 5;
        const userId = req.session.user.id;

        if (is_completed) {
            await supabase.rpc('increment_user_points', { user_id: userId, amount: pointsToAward });
        } else {
            await supabase.rpc('increment_user_points', { user_id: userId, amount: -pointsToAward });
        }

        await supabase.from('checklist_item_history').insert({
            item_id: itemId,
            user_id: userId,
            action: is_completed ? 'completed' : 'reopened',
            details: is_completed ? `Выполнено (+${pointsToAward} б.)` : `Отметка снята (-${pointsToAward} б.)`
        });

        // Auto-update instance status if all complete
        await checkInstanceCompletion(data.instance_id, userId);

        res.json(data);
    } catch (err) {
        console.error('Error completing item:', err);
        res.status(500).json({ error: 'Failed to update item' });
    }
});

// Verify item (Master role usually)
router.patch('/items/:id/verify', requireAuth, async (req, res) => {
    try {
        const itemId = req.params.id;
        const { is_verified } = req.body;
        const updates = {
            verified_by: is_verified ? req.session.user.id : null,
            verified_at: is_verified ? new Date().toISOString() : null
        };

        const { data, error } = await supabase
            .from('checklist_instance_items')
            .update(updates)
            .eq('id', itemId)
            .select(`
                *,
                template_item:template_item_id(*),
                completed_by_user:completed_by(full_name),
                verified_by_user:verified_by(full_name)
            `)
            .single();

        if (error) throw error;

        // Log history
        await supabase.from('checklist_item_history').insert({
            item_id: itemId,
            user_id: req.session.user.id,
            action: is_verified ? 'verified' : 'unverified',
            details: is_verified ? 'Проверено и принято' : 'Отметка проверки снята'
        });

        res.json(data);
    } catch (err) {
        console.error('Error verifying item:', err);
        res.status(500).json({ error: 'Failed to verify item' });
    }
});

// Reject item (Master returns to worker)
router.put('/items/:id/reject', requireAuth, async (req, res) => {
    try {
        const itemId = req.params.id;
        const { comment } = req.body;

        const updates = {
            is_completed: false,
            completed_by: null,
            completed_at: null,
            verified_by: null,
            verified_at: null,
            notes: comment || null
        };

        // Fetch item to get point value for subtraction
        const { data: oldItem } = await supabase
            .from('checklist_instance_items')
            .select('*, template_item:template_item_id(points)')
            .eq('id', itemId)
            .single();

        const { data, error } = await supabase
            .from('checklist_instance_items')
            .update(updates)
            .eq('id', itemId)
            .select(`
                *,
                template_item:template_item_id(*),
                completed_by_user:completed_by(full_name),
                verified_by_user:verified_by(full_name)
            `)
            .single();

        if (error) throw error;

        // Subtract points if it was completed
        if (oldItem && oldItem.is_completed) {
            const pointsToSubtract = oldItem.template_item?.points || 5;
            await supabase.rpc('increment_user_points', {
                user_id: oldItem.completed_by,
                amount: -pointsToSubtract
            });
        }

        // Log history
        await supabase.from('checklist_item_history').insert({
            item_id: itemId,
            user_id: req.session.user.id,
            action: 'rejected',
            details: `Отклонено. Причина: ${comment || 'не указана'}`
        });

        res.json(data);
    } catch (err) {
        console.error('Error rejecting item:', err);
        res.status(500).json({ error: 'Failed to reject item' });
    }
});

// --- ITEM COMMENTS, PHOTOS, HISTORY ---

router.get('/items/:id/history', requireAuth, async (req, res) => {
    const { data, error } = await supabase
        .from('checklist_item_history')
        .select(`
            id, action, details, created_at,
            user_id:users(full_name, username)
        `)
        .eq('item_id', req.params.id)
        .order('created_at', { ascending: true });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
});

router.get('/items/:id/comments', requireAuth, async (req, res) => {
    const { data, error } = await supabase
        .from('checklist_item_comments')
        .select(`
            id, text, created_at,
            user_id:users(full_name, username)
        `)
        .eq('item_id', req.params.id)
        .order('created_at', { ascending: true });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
});

router.post('/items/:id/comments', requireAuth, async (req, res) => {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'Text required' });

    const { data, error } = await supabase
        .from('checklist_item_comments')
        .insert({
            item_id: req.params.id,
            user_id: req.session.user.id,
            text
        })
        .select(`
            id, text, created_at,
            user_id:users(full_name, username)
        `)
        .single();

    if (error) return res.status(500).json({ error: error.message });

    // Log history
    await supabase.from('checklist_item_history').insert({
        item_id: req.params.id,
        user_id: req.session.user.id,
        action: 'comment_added',
        details: 'Добавлен комментарий'
    });

    res.json(data);
});

router.get('/items/:id/photos', requireAuth, async (req, res) => {
    const { data, error } = await supabase
        .from('checklist_item_photos')
        .select(`
            id, photo_url, created_at,
            user_id:users(full_name, username)
        `)
        .eq('item_id', req.params.id)
        .order('created_at', { ascending: true });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
});

router.post('/items/:id/photos', requireAuth, upload.single('photo'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file' });

    try {
        const fileExt = req.file.originalname.split('.').pop();
        const fileName = `${Date.now()}_${Math.random()}.${fileExt}`;
        const filePath = `checklists/${req.params.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('remark_attachments') // Reusing same bucket
            .upload(filePath, req.file.buffer, { contentType: req.file.mimetype });

        if (uploadError) throw uploadError;

        const { data: publicData } = supabase.storage
            .from('remark_attachments')
            .getPublicUrl(filePath);

        const { data, error } = await supabase
            .from('checklist_item_photos')
            .insert({
                item_id: req.params.id,
                user_id: req.session.user.id,
                photo_url: publicData.publicUrl
            })
            .select(`
                id, photo_url, created_at,
                user_id:users(full_name, username)
            `)
            .single();

        if (error) throw error;

        // Log history
        await supabase.from('checklist_item_history').insert({
            item_id: req.params.id,
            user_id: req.session.user.id,
            action: 'photo_added',
            details: 'Добавлено фото'
        });

        res.json(data);
    } catch (err) {
        console.error('Photo upload error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Helper function to check if all items are completed
async function checkInstanceCompletion(instanceId, userId) {
    try {
        // Find total items 
        const { count: total, error: tErr } = await supabase
            .from('checklist_instance_items')
            .select('id', { count: 'exact', head: true })
            .eq('instance_id', instanceId);

        // Find completed items
        const { count: completed, error: cErr } = await supabase
            .from('checklist_instance_items')
            .select('id', { count: 'exact', head: true })
            .eq('instance_id', instanceId)
            .eq('is_completed', true);

        if (!tErr && !cErr && total > 0) {
            const status = total === completed ? 'completed' : 'in_progress';
            const completed_at = status === 'completed' ? new Date().toISOString() : null;
            const completed_by = status === 'completed' ? userId : null;

            await supabase
                .from('checklist_instances')
                .update({ status, completed_at, completed_by })
                .eq('id', instanceId);
        }
    } catch (e) {
        console.error("Error updating instance completetion status", e);
    }
}

module.exports = router;
