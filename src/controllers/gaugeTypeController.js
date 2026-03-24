const supabase = require('../../db'); // Correct reference to the main db module

// Function to handle Supabase query execution identically to other controllers
async function executeQuery(query, res, errorMessage) {
    try {
        const { data, error } = await query;
        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error(`❌ [GaugeType] Error:`, err.message);
        res.status(500).json({ error: errorMessage, details: err.message });
    }
}

const gaugeTypeController = {
    getAll: async (req, res) => {
        const query = supabase
            .from('gauge_types')
            .select('*')
            .order('part_number', { ascending: true });
        await executeQuery(query, res, 'Failed to fetch gauge types');
    },

    create: async (req, res) => {
        const { part_number, description, image_url, accuracy_class, pressure_range, thread_type } = req.body;
        const query = supabase
            .from('gauge_types')
            .insert([{ part_number, description, image_url, accuracy_class, pressure_range, thread_type }])
            .select()
            .single();
        await executeQuery(query, res, 'Failed to create gauge type');
    },

    update: async (req, res) => {
        const { id } = req.params;
        const { part_number, description, image_url, accuracy_class, pressure_range, thread_type } = req.body;
        const query = supabase
            .from('gauge_types')
            .update({ part_number, description, image_url, accuracy_class, pressure_range, thread_type })
            .eq('id', id)
            .select()
            .single();
        await executeQuery(query, res, 'Failed to update gauge type');
    },

    delete: async (req, res) => {
        const { id } = req.params;
        
        // Check if type is in use
        const { data: usage, error: usageError } = await supabase
            .from('gauges')
            .select('id')
            .eq('type_id', id)
            .limit(1);
            
        if (usageError) {
             console.error(`❌ [GaugeType] Error checking usage:`, usageError.message);
             return res.status(500).json({ error: 'Failed to verify usage', details: usageError.message });
        }
        
        if (usage && usage.length > 0) {
            return res.status(400).json({ error: 'Нельзя удалить тип манометра, так как он уже используется (прикреплен к манометрам).' });
        }

        const query = supabase
            .from('gauge_types')
            .delete()
            .eq('id', id);
        
        try {
            const { error } = await query;
            if (error) throw error;
            res.json({ success: true });
        } catch (err) {
            console.error(`❌ [GaugeType] Error deleting:`, err.message);
            res.status(500).json({ error: 'Failed to delete gauge type', details: err.message });
        }
    },

    uploadPhoto: async (req, res) => {
        if (!req.file) return res.status(400).json({ error: 'Нет файла' });
        const { id } = req.params;

        try {
            const fileExt = req.file.originalname.split('.').pop();
            const fileName = `${Date.now()}_${Math.random()}.${fileExt}`;
            const filePath = `gauge_types/${id}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('remark_attachments')
                .upload(filePath, req.file.buffer, { contentType: req.file.mimetype });

            if (uploadError) throw uploadError;

            const { data: publicData } = supabase.storage.from('remark_attachments').getPublicUrl(filePath);

            const { data, error } = await supabase
                .from('gauge_types')
                .update({ image_url: publicData.publicUrl })
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            res.json(data);
        } catch (error) {
            console.error('Error uploading gauge type image:', error);
            res.status(500).json({ error: error.message });
        }
    }
};

module.exports = gaugeTypeController;
