const supabase = require('../../db');

const gaugeController = {
  // Получение всех манометров
  getAllGauges: async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('gauges')
        .select(`
          *,
          locomotive:locomotives(number, series),
          type:gauge_types(part_number, description, image_url, accuracy_class, pressure_range, thread_type)
        `)
        .order('next_verification', { ascending: true });

      if (error) throw error;
      
      const mappedData = data.map(g => ({
        ...g,
        part_number: g.type?.part_number,
        description: g.type?.description,
        accuracy_class: g.type?.accuracy_class,
        pressure_range: g.type?.pressure_range,
        thread_type: g.type?.thread_type,
        type: undefined // remove the nested object after mapping
      }));
      
      res.json(mappedData);
    } catch (error) {
      console.error('Error fetching gauges:', error);
      res.status(500).json({ error: 'Ошибка при получении списка манометров' });
    }
  },

  // Получение манометра по серийному номеру (для QR)
  getGaugeBySerial: async (req, res) => {
    try {
      const { serial } = req.params;
      const { data, error } = await supabase
        .from('gauges')
        .select(`
          *,
          locomotive:locomotives(number, series),
          type:gauge_types(part_number, description, image_url, accuracy_class, pressure_range, thread_type)
        `)
        .eq('serial_number', serial)
        .single();

      if (error) throw error;
      
      const mappedData = {
        ...data,
        part_number: data.type?.part_number,
        description: data.type?.description,
        accuracy_class: data.type?.accuracy_class,
        pressure_range: data.type?.pressure_range,
        thread_type: data.type?.thread_type,
        type: undefined
      };
      
      res.json(mappedData);
    } catch (error) {
      console.error('Error fetching gauge by serial:', error);
      res.status(404).json({ error: 'Манометр не найден' });
    }
  },

  // Создание нового манометра
  createGauge: async (req, res) => {
    try {
      const { 
        serial_number, 
        type_id, 
        last_verification, 
        next_verification, 
        is_defective, 
        status, 
        locomotive_id,
        photo_url
      } = req.body;

      const { data, error } = await supabase
        .from('gauges')
        .insert([{
          serial_number,
          type_id,
          last_verification,
          next_verification,
          is_defective,
          status,
          locomotive_id,
          photo_url,
          certificate_url
        }])
        .select()
        .single();

      if (error) throw error;
      
      // Логируем создание в историю
      if (req.user && req.user.id) {
        await supabase.from('gauge_history').insert([{
          gauge_id: data.id,
          locomotive_id: data.locomotive_id,
          action: 'Добавлен в систему',
          details: `Серийный номер: ${data.serial_number}`,
          created_by: req.user.id
        }]);
      }

      res.status(201).json(data);
    } catch (error) {
      console.error('Error creating gauge:', error);
      res.status(400).json({ error: error.message });
    }
  },

  // Обновление данных манометра
  updateGauge: async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      // Получаем предыдущее состояние для истории
      const { data: previousGauge } = await supabase
        .from('gauges')
        .select('locomotive_id, status')
        .eq('id', id)
        .single();

      const { data, error } = await supabase
        .from('gauges')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Логируем обновление в историю
      if (req.user && req.user.id) {
        let action = 'Данные обновлены';
        let details = [];
        let historyLocoId = data.locomotive_id || (previousGauge ? previousGauge.locomotive_id : null);
        
        if (updates.status) details.push(`Статус: ${updates.status}`);
        if (updates.locomotive_id !== undefined) {
          if (updates.locomotive_id === null) {
            action = 'Снят с локомотива';
            details.push(`Перемещен на склад`);
          } else {
            action = 'Установлен на локомотив';
            details.push(`Локомотив ID: ${updates.locomotive_id}`);
          }
        }
        if (updates.is_defective !== undefined) details.push(updates.is_defective ? 'Отмечен как брак' : 'Брак снят');
        if (updates.next_verification) details.push(`Новая поверка: ${updates.next_verification}`);

        if (details.length > 0 || updates.locomotive_id !== undefined) {
          await supabase.from('gauge_history').insert([{
            gauge_id: data.id,
            locomotive_id: historyLocoId,
            action,
            details: details.join(', '),
            created_by: req.user.id
          }]);
        }
      }

      res.json(data);
    } catch (error) {
      console.error('Error updating gauge:', error);
      res.status(400).json({ error: error.message });
    }
  },

  // Удаление манометра
  deleteGauge: async (req, res) => {
    try {
      const { id } = req.params;
      const { error } = await supabase
        .from('gauges')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Удаление каскадно удалит историю, дополнительно логировать не нужно, но можно логировать само действие, если хранить историю глобально. 
      // Поскольку gauge_id UUID удаляется, история тоже каскадно удаляется. Мы пропустим логирование удаления.

      res.json({ message: 'Манометр успешно удален' });
    } catch (error) {
      console.error('Error deleting gauge:', error);
      res.status(500).json({ error: 'Ошибка при удалении манометра' });
    }
  },

  // Получение манометров по ID локомотива
  getGaugesByLocomotive: async (req, res) => {
    try {
      const { locomotiveId } = req.params;
      const { data, error } = await supabase
        .from('gauges')
        .select(`
          *,
          type:gauge_types(part_number, description)
        `)
        .eq('locomotive_id', locomotiveId)
        .order('next_verification', { ascending: true });

      if (error) throw error;
      
      const mappedData = data.map(g => ({
        ...g,
        part_number: g.type?.part_number,
        description: g.type?.description,
        type: undefined
      }));
      
      res.json(mappedData);
    } catch (error) {
      console.error('Error fetching gauges by locomotive:', error);
      res.status(500).json({ error: 'Ошибка при получении манометров локомотива' });
    }
  },

  // Получение истории всех манометров локомотива
  getGaugeHistoryByLocomotive: async (req, res) => {
    try {
      const { locomotiveId } = req.params;
      const { data, error } = await supabase
        .from('gauge_history')
        .select(`
          *,
          user:users!gauge_history_created_by_fkey(username, full_name),
          gauge:gauges(serial_number, type:gauge_types(part_number))
        `)
        .eq('locomotive_id', locomotiveId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      res.json(data);
    } catch (error) {
      console.error('Error fetching locomotive gauge history:', error);
      res.status(500).json({ error: 'Ошибка при получении истории манометров локомотива' });
    }
  },

  // Получение истории конкретного манометра
  getGaugeHistory: async (req, res) => {
    try {
      const { id } = req.params;
      const { data, error } = await supabase
        .from('gauge_history')
        .select(`
          *,
          user:users!gauge_history_created_by_fkey(username, full_name),
          locomotive:locomotives(number, series)
        `)
        .eq('gauge_id', id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      res.json(data);
    } catch (error) {
      console.error('Error fetching gauge history:', error);
      res.status(500).json({ error: 'Ошибка при получении истории манометра' });
    }
  },

  // Загрузка сертификата поверки (PDF или Image)
  uploadCertificate: async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Нет файла' });
    const { id } = req.params;

    try {
      const fileExt = req.file.originalname.split('.').pop();
      const fileName = `${Date.now()}_cert.${fileExt}`;
      const filePath = `gauge_certificates/${id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('remark_attachments')
        .upload(filePath, req.file.buffer, { contentType: req.file.mimetype });

      if (uploadError) throw uploadError;

      const { data: publicData } = supabase.storage.from('remark_attachments').getPublicUrl(filePath);

      const { data, error } = await supabase
        .from('gauges')
        .update({ certificate_url: publicData.publicUrl })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      res.json(data);
    } catch (error) {
      console.error('Error uploading certificate:', error);
      res.status(500).json({ error: error.message });
    }
  },

  // Загрузка фотографии манометра
  uploadPhoto: async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Нет файла' });
    const { id } = req.params;

    try {
      const fileExt = req.file.originalname.split('.').pop();
      const fileName = `${Date.now()}_${Math.random()}.${fileExt}`;
      const filePath = `gauges/${id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('remark_attachments')
        .upload(filePath, req.file.buffer, { contentType: req.file.mimetype });

      if (uploadError) throw uploadError;

      const { data: publicData } = supabase.storage.from('remark_attachments').getPublicUrl(filePath);

      const { data, error } = await supabase
        .from('gauges')
        .update({ photo_url: publicData.publicUrl })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      res.json(data);
    } catch (error) {
      console.error('Error uploading gauge photo:', error);
      res.status(500).json({ error: error.message });
    }
  }
};

module.exports = gaugeController;
