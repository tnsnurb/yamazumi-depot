const supabase = require('../../db');
const ExcelJS = require('exceljs');

const gaugeController = {
  // Получение всех манометров (с пагинацией и сортировкой)
  getAllGauges: async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;
      const sortBy = req.query.sort || 'next_verification';
      const sortOrder = req.query.order === 'desc' ? false : true;
      const offset = (page - 1) * limit;

      // Count query
      let countQuery = supabase
        .from('gauges')
        .select('*', { count: 'exact', head: true });

      let query = supabase
        .from('gauges')
        .select(`
          *,
          locomotive:locomotives(number, series, location_id),
          type:gauge_types(part_number, description, image_url, accuracy_class, pressure_range, thread_type)
        `)
        .order(sortBy, { ascending: sortOrder })
        .range(offset, offset + limit - 1);

      // Фильтрация по активной локации пользователя
      if (req.session && req.session.user && req.session.user.active_location_id) {
        const activeLocId = req.session.user.active_location_id;
        query = query.eq('location_id', activeLocId);
        countQuery = countQuery.eq('location_id', activeLocId);
      }

      const [{ data, error }, { count }] = await Promise.all([query, countQuery]);

      if (error) throw error;
      
      const mappedData = (data || []).map(g => ({
        ...g,
        part_number: g.type?.part_number,
        description: g.type?.description,
        accuracy_class: g.type?.accuracy_class,
        pressure_range: g.type?.pressure_range,
        thread_type: g.type?.thread_type,
        type: undefined
      }));
      
      res.json({
        data: mappedData,
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit)
        }
      });
    } catch (error) {
      console.error('Error fetching gauges:', error);
      res.status(500).json({ error: 'Ошибка при получении списка манометров' });
    }
  },

  // Уведомления — приборы с истекающей/просроченной поверкой
  getAlerts: async (req, res) => {
    try {
      const now = new Date();
      const in30Days = new Date();
      in30Days.setDate(in30Days.getDate() + 30);

      let query = supabase
        .from('gauges')
        .select(`
          id, serial_number, next_verification, status, type_id, locomotive_id,
          locomotive:locomotives(number, series),
          type:gauge_types(part_number, description)
        `)
        .lt('next_verification', in30Days.toISOString().split('T')[0])
        .neq('status', 'Списан')
        .order('next_verification', { ascending: true });

      if (req.session?.user?.active_location_id) {
        query = query.eq('location_id', req.session.user.active_location_id);
      }

      const { data, error } = await query;
      if (error) throw error;

      const alerts = (data || []).map(g => {
        const nextDate = new Date(g.next_verification);
        const daysLeft = Math.ceil((nextDate - now) / (1000 * 60 * 60 * 24));
        let severity = 'warning'; // 1-30 days
        if (daysLeft < 0) severity = 'critical';
        else if (daysLeft <= 7) severity = 'urgent';

        return {
          id: g.id,
          serial_number: g.serial_number,
          next_verification: g.next_verification,
          days_left: daysLeft,
          severity,
          status: g.status,
          part_number: g.type?.part_number,
          description: g.type?.description,
          locomotive: g.locomotive
        };
      });

      res.json({
        total: alerts.length,
        critical: alerts.filter(a => a.severity === 'critical').length,
        urgent: alerts.filter(a => a.severity === 'urgent').length,
        warning: alerts.filter(a => a.severity === 'warning').length,
        items: alerts
      });
    } catch (error) {
      console.error('Error fetching gauge alerts:', error);
      res.status(500).json({ error: 'Ошибка загрузки уведомлений' });
    }
  },

  // Массовый импорт из Excel
  bulkImport: async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Нет файла' });

    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(req.file.buffer);
      const worksheet = workbook.worksheets[0];

      if (!worksheet) {
        return res.status(400).json({ error: 'Файл не содержит листов' });
      }

      // Найти заголовки (первая строка)
      const headerRow = worksheet.getRow(1);
      const headers = {};
      headerRow.eachCell((cell, colNumber) => {
        const val = String(cell.value || '').toLowerCase().trim();
        if (val.includes('серийн') || val.includes('serial') || val.includes('s/n')) headers.serial = colNumber;
        if (val.includes('парт') || val.includes('part') || val.includes('модел')) headers.part_number = colNumber;
        if (val.includes('послед') || val.includes('last') || val.includes('дата пов')) headers.last_verification = colNumber;
        if (val.includes('следу') || val.includes('next')) headers.next_verification = colNumber;
      });

      if (!headers.serial) {
        return res.status(400).json({ 
          error: 'Не найден столбец с серийным номером. Убедитесь, что в первой строке есть заголовок "Серийный номер" или "Serial".' 
        });
      }

      // Загрузить справочник моделей для маппинга
      const { data: gaugeTypes } = await supabase.from('gauge_types').select('id, part_number');
      const typeMap = {};
      (gaugeTypes || []).forEach(t => { typeMap[t.part_number?.toLowerCase()] = t.id; });

      const locationId = req.body.location_id || req.session?.user?.active_location_id;
      const rows = [];
      const errors = [];

      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // skip header

        const serial = String(row.getCell(headers.serial).value || '').trim();
        if (!serial) return;

        const partNumber = headers.part_number ? String(row.getCell(headers.part_number).value || '').trim() : '';
        const typeId = typeMap[partNumber.toLowerCase()] || null;

        let lastVerification = null;
        let nextVerification = null;

        if (headers.last_verification) {
          const cellVal = row.getCell(headers.last_verification).value;
          if (cellVal instanceof Date) lastVerification = cellVal.toISOString().split('T')[0];
          else if (typeof cellVal === 'string') lastVerification = cellVal.trim();
        }

        if (headers.next_verification) {
          const cellVal = row.getCell(headers.next_verification).value;
          if (cellVal instanceof Date) nextVerification = cellVal.toISOString().split('T')[0];
          else if (typeof cellVal === 'string') nextVerification = cellVal.trim();
        }

        // Auto-calculate next_verification if not provided
        if (lastVerification && !nextVerification) {
          const d = new Date(lastVerification);
          d.setFullYear(d.getFullYear() + 1);
          nextVerification = d.toISOString().split('T')[0];
        }

        if (!lastVerification) {
          lastVerification = new Date().toISOString().split('T')[0];
        }
        if (!nextVerification) {
          const d = new Date();
          d.setFullYear(d.getFullYear() + 1);
          nextVerification = d.toISOString().split('T')[0];
        }

        rows.push({
          serial_number: serial,
          type_id: typeId,
          last_verification: lastVerification,
          next_verification: nextVerification,
          status: 'На складе',
          location_id: locationId
        });
      });

      if (rows.length === 0) {
        return res.status(400).json({ error: 'Файл не содержит данных для импорта' });
      }

      // Insert in batches of 50
      let imported = 0;
      let skipped = 0;
      for (let i = 0; i < rows.length; i += 50) {
        const batch = rows.slice(i, i + 50);
        const { data, error } = await supabase.from('gauges').upsert(batch, { 
          onConflict: 'serial_number',
          ignoreDuplicates: true 
        }).select();

        if (error) {
          errors.push(`Строки ${i + 2}-${i + batch.length + 1}: ${error.message}`);
          skipped += batch.length;
        } else {
          imported += (data || []).length;
        }
      }

      res.json({
        message: `Импорт завершён`,
        imported,
        skipped,
        total: rows.length,
        errors: errors.length > 0 ? errors : undefined
      });
    } catch (error) {
      console.error('Error importing gauges:', error);
      res.status(500).json({ error: `Ошибка импорта: ${error.message}` });
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
        photo_url,
        certificate_url
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
          location_id: req.body.location_id || req.session?.user?.active_location_id, 
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
      
      // Whitelist: только разрешённые поля (защита от Mass Assignment)
      const { serial_number, type_id, last_verification, next_verification, 
              is_defective, status, locomotive_id, photo_url, certificate_url, location_id } = req.body;
      
      const updates = {};
      if (serial_number !== undefined) updates.serial_number = serial_number;
      if (type_id !== undefined) updates.type_id = type_id;
      if (last_verification !== undefined) updates.last_verification = last_verification;
      if (next_verification !== undefined) updates.next_verification = next_verification;
      if (is_defective !== undefined) updates.is_defective = is_defective;
      if (status !== undefined) updates.status = status;
      if (locomotive_id !== undefined) updates.locomotive_id = locomotive_id;
      if (photo_url !== undefined) updates.photo_url = photo_url;
      if (certificate_url !== undefined) updates.certificate_url = certificate_url;
      if (location_id !== undefined) updates.location_id = location_id;

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'Нет данных для обновления' });
      }

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
            // При снятии привязываем к текущей активной локации пользователя
            if (req.session?.user?.active_location_id) {
              updates.location_id = req.session.user.active_location_id;
            }
          } else {
            action = 'Установлен на локомотив';
            details.push(`Локомотив ID: ${updates.locomotive_id}`);
            // При установке закрепляем манометр за текущим депо установщика
            if (req.session?.user?.active_location_id) {
              updates.location_id = req.session.user.active_location_id;
            }
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
