import type { Remark } from '../types/remark';
import type { Locomotive } from '../types/locomotive';

/**
 * Exports remarks to an Excel file using exceljs
 */
export const exportRemarksToExcel = async (
    data: Remark[],
    locomotive: Locomotive,
    filter: 'all' | 'completed' | 'incomplete'
) => {
    const ExcelJS = await import("exceljs");
    
    let filteredData = data;
    if (filter === 'completed') filteredData = data.filter(r => r.is_completed);
    if (filter === 'incomplete') filteredData = data.filter(r => !r.is_completed);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Замечания');

    worksheet.columns = [
        { header: '№', key: 'index', width: 5 },
        { header: 'Замечание', key: 'text', width: 50 },
        { header: 'Статус', key: 'status', width: 15 },
        { header: 'Выполнил', key: 'user', width: 20 },
        { header: 'Дата выполнения', key: 'date', width: 25 }
    ];

    filteredData.forEach((r, i) => {
        worksheet.addRow({
            index: i + 1,
            text: r.text,
            status: r.is_completed ? 'Выполнено' : 'Не выполнено',
            user: r.is_completed && r.completed_by ? r.completed_by.full_name : '',
            date: r.completed_at ? new Date(r.completed_at).toLocaleString('ru-RU') : ''
        });
    });

    // Styling headers
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'F1F5F9' }
    };

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    const filterLabel = filter === 'all' ? '' : filter === 'completed' ? '_выполненные' : '_невыполненные';
    const fileName = `Замечания_${locomotive?.number || 'лок'}${filterLabel}.xlsx`;
    
    a.download = fileName;
    a.click();
    window.URL.revokeObjectURL(url);
    
    return filteredData.length;
};

/**
 * Exports remarks to a PDF report by generating an HTML printable page
 */
export const exportRemarksToPDF = (
    data: Remark[],
    locomotive: Locomotive,
    filter: 'all' | 'completed' | 'incomplete'
) => {
    let filteredData = data;
    if (filter === 'completed') filteredData = data.filter(r => r.is_completed);
    if (filter === 'incomplete') filteredData = data.filter(r => !r.is_completed);

    const filterTitle = filter === 'all' ? 'Все замечания' : filter === 'completed' ? 'Выполненные' : 'Невыполненные';
    const locoNum = locomotive?.number || '';

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Замечания ${locoNum}</title>
<style>
  body { font-family: Arial, sans-serif; padding: 30px; color: #333; }
  h1 { font-size: 18px; margin-bottom: 4px; }
  .subtitle { font-size: 13px; color: #666; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { background: #f1f5f9; text-align: left; padding: 8px 10px; border: 1px solid #e2e8f0; font-weight: 600; }
  td { padding: 8px 10px; border: 1px solid #e2e8f0; vertical-align: top; }
  tr:nth-child(even) { background: #f8fafc; }
  .completed { color: #94a3b8; text-decoration: line-through; }
  .status-done { color: #16a34a; font-weight: 600; }
  .status-open { color: #d97706; font-weight: 600; }
  .priority { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; }
  .priority-high { background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5; }
  .priority-medium { background: #fef3c7; color: #b45309; border: 1px solid #fde68a; }
  .priority-low { background: #dcfce3; color: #15803d; border: 1px solid #86efac; }
  .category { font-size: 11px; color: #64748b; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; display: inline-block; }
  .footer { margin-top: 20px; font-size: 11px; color: #94a3b8; }
  @media print { body { padding: 10px; } }
</style></head><body>
<h1>Наряд-Задание (Замечания) — Локомотив #${locoNum}</h1>
<div class="subtitle">${filterTitle} • ${new Date().toLocaleDateString('ru-RU')} • Всего: ${filteredData.length}</div>
<table>
  <thead><tr>
    <th style="width:30px">№</th>
    <th style="width:70px">Приоритет</th>
    <th>Замечание</th>
    <th style="width:90px">Категория</th>
    <th style="width:90px">Статус</th>
    <th style="width:120px">Выполнил</th>
    <th style="width:90px">Дата</th>
  </tr></thead>
  <tbody>
    ${filteredData.map((r, i) => `<tr>
      <td>${i + 1}</td>
      <td>
        <span class="priority priority-${r.priority || 'medium'}">
          ${r.priority === 'high' ? 'Высокий' : r.priority === 'low' ? 'Низкий' : 'Средний'}
        </span>
      </td>
      <td class="${r.is_completed ? 'completed' : ''}">${r.text}</td>
      <td><span class="category">${r.category || 'Без категории'}</span></td>
      <td class="${r.is_completed ? 'status-done' : 'status-open'}">${r.is_completed ? '✓ Выполнено' : '○ Открыто'}</td>
      <td>${r.is_completed && r.completed_by ? r.completed_by.full_name : '—'}</td>
      <td>${r.completed_at ? new Date(r.completed_at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
    </tr>`).join('')}
  </tbody>
</table>
<div class="footer">Yamazumi Depot • Сформировано ${new Date().toLocaleString('ru-RU')}</div>
<script>window.onload = () => window.print();</script>
</body></html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    
    return filteredData.length;
};
