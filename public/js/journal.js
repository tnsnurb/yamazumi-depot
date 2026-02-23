// Journal JS
let allMovements = [];
let filteredMovements = [];
let currentPage = 0;
const PAGE_SIZE = 20;

document.addEventListener('DOMContentLoaded', async () => {
    const me = await fetch('/api/me').then(r => r.json());
    if (!me.authenticated) {
        window.location.href = '/';
        return;
    }
    document.getElementById('userName').textContent = me.user.full_name || me.user.username;
    await loadMovements();
});

async function loadMovements() {
    try {
        const res = await fetch('/api/movements?limit=1000');
        const data = await res.json();
        allMovements = data.movements || [];
        currentPage = 0;
        applyFilters();
    } catch (err) {
        document.getElementById('journalBody').innerHTML =
            '<tr><td colspan="7" class="loading-cell">Ошибка загрузки</td></tr>';
    }
}

function applyFilters() {
    const locoFilter = document.getElementById('filterLoco').value.trim().toLowerCase();
    const actionFilter = document.getElementById('filterAction').value;

    filteredMovements = allMovements.filter(m => {
        if (locoFilter && !m.locomotive_number.toLowerCase().includes(locoFilter)) return false;
        if (actionFilter && m.action !== actionFilter) return false;
        return true;
    });

    currentPage = 0;
    renderPage();
}

function renderPage() {
    const tbody = document.getElementById('journalBody');
    const start = currentPage * PAGE_SIZE;
    const page = filteredMovements.slice(start, start + PAGE_SIZE);

    if (page.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="loading-cell">Нет записей</td></tr>';
    } else {
        tbody.innerHTML = page.map((m, i) => `
      <tr>
        <td>${start + i + 1}</td>
        <td>${formatDate(m.moved_at)}</td>
        <td><strong>${m.locomotive_number}</strong></td>
        <td><span class="action-badge action-${m.action}">${getActionLabel(m.action)}</span></td>
        <td>${formatLocation(m.from_track, m.from_position)}</td>
        <td>${formatLocation(m.to_track, m.to_position)}</td>
        <td>${m.moved_by || '—'}</td>
      </tr>
    `).join('');
    }

    // Pagination
    const totalPages = Math.ceil(filteredMovements.length / PAGE_SIZE);
    document.getElementById('pageInfo').textContent = `Страница ${currentPage + 1} из ${totalPages || 1}`;
    document.getElementById('prevBtn').disabled = currentPage === 0;
    document.getElementById('nextBtn').disabled = currentPage >= totalPages - 1;
}

function prevPage() { if (currentPage > 0) { currentPage--; renderPage(); } }
function nextPage() {
    const totalPages = Math.ceil(filteredMovements.length / PAGE_SIZE);
    if (currentPage < totalPages - 1) { currentPage++; renderPage(); }
}

function getActionLabel(action) {
    const labels = { add: '➕ Добавлен', move: '🔄 Перемещён', remove: '🗑 Удалён' };
    return labels[action] || action;
}

function formatLocation(track, position) {
    if (!track && !position) return '—';
    return `Track ${track}, Slot ${position}`;
}

function formatDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleString('ru-RU', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
}

function exportJournal() {
    const csvRows = ['№,Дата,Локомотив,Действие,Откуда,Куда,Пользователь'];
    filteredMovements.forEach((m, i) => {
        csvRows.push(`${i + 1},"${formatDate(m.moved_at)}",${m.locomotive_number},${m.action},"${formatLocation(m.from_track, m.from_position)}","${formatLocation(m.to_track, m.to_position)}",${m.moved_by || ''}`);
    });
    const blob = new Blob(['\uFEFF' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `journal_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

async function logout() {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/';
}
