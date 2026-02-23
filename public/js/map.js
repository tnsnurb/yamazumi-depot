// =============== MAP.JS — Shop Map Logic ===============

let currentUser = null;
let locomotives = [];
let selectedLoco = null;

document.addEventListener('DOMContentLoaded', async () => {
    // Check auth
    const me = await fetch('/api/me').then(r => r.json());
    if (!me.authenticated) {
        window.location.href = '/';
        return;
    }
    currentUser = me.user;
    document.getElementById('userName').textContent = currentUser.full_name || currentUser.username;

    // Build slots
    buildTrackSlots();

    // Load locomotives
    await refreshMap();

    // Add form handler
    document.getElementById('addForm').addEventListener('submit', handleAddLoco);
});

// =============== BUILD TRACK SLOTS ===============
function buildTrackSlots() {
    for (let track = 1; track <= 6; track++) {
        const container = document.querySelector(`.track-slots[data-track="${track}"]`);
        if (!container) continue;
        container.innerHTML = '';

        for (let pos = 1; pos <= 6; pos++) {
            const slot = document.createElement('div');
            slot.className = 'slot';
            slot.dataset.track = track;
            slot.dataset.position = pos;
            slot.innerHTML = `<span class="slot-number">${pos}</span>`;

            // Drop zone events
            slot.addEventListener('dragover', handleDragOver);
            slot.addEventListener('dragenter', handleDragEnter);
            slot.addEventListener('dragleave', handleDragLeave);
            slot.addEventListener('drop', handleDrop);

            container.appendChild(slot);
        }

        // Add arrow indicators between slots
        const arrow = document.createElement('div');
        arrow.className = 'track-arrow';
        arrow.innerHTML = '◄──';
        container.appendChild(arrow);
    }
}

// =============== RENDER LOCOMOTIVES ===============
async function refreshMap() {
    try {
        const res = await fetch('/api/locomotives');
        locomotives = await res.json();
        renderLocomotives();
    } catch (err) {
        showToast('Ошибка загрузки данных', 'error');
    }
}

function renderLocomotives() {
    // Clear all existing locomotive elements
    document.querySelectorAll('.loco-block').forEach(el => el.remove());

    // Reset slot occupied state
    document.querySelectorAll('.slot').forEach(slot => {
        slot.classList.remove('occupied');
    });

    // Place each locomotive
    locomotives.forEach(loco => {
        if (loco.track && loco.position) {
            const slot = document.querySelector(
                `.slot[data-track="${loco.track}"][data-position="${loco.position}"]`
            );
            if (slot) {
                slot.classList.add('occupied');
                const block = createLocoBlock(loco);
                slot.appendChild(block);
            }
        }
    });
}

function createLocoBlock(loco) {
    const block = document.createElement('div');
    block.className = `loco-block status-${loco.status || 'active'}`;
    block.draggable = true;
    block.dataset.id = loco.id;
    block.dataset.number = loco.number;

    // Status indicator
    const indicator = document.createElement('span');
    indicator.className = 'loco-indicator';
    block.appendChild(indicator);

    // Number label
    const numLabel = document.createElement('span');
    numLabel.className = 'loco-number';
    numLabel.textContent = loco.number;
    block.appendChild(numLabel);

    // Drag events
    block.addEventListener('dragstart', handleDragStart);
    block.addEventListener('dragend', handleDragEnd);

    // Click to show info
    block.addEventListener('click', (e) => {
        e.stopPropagation();
        showInfoModal(loco);
    });

    return block;
}

// =============== DRAG AND DROP ===============
let draggedLocoId = null;
let draggedElement = null;

function handleDragStart(e) {
    draggedLocoId = e.target.dataset.id;
    draggedElement = e.target;
    e.target.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', draggedLocoId);

    // Highlight available slots
    setTimeout(() => {
        document.querySelectorAll('.slot:not(.occupied)').forEach(slot => {
            slot.classList.add('drop-available');
        });
        // Also highlight the current slot (so it can be dropped back)
        const currentSlot = e.target.closest('.slot');
        if (currentSlot) currentSlot.classList.add('drop-available');
    }, 0);
}

function handleDragEnd(e) {
    e.target.classList.remove('dragging');
    document.querySelectorAll('.slot').forEach(slot => {
        slot.classList.remove('drag-over', 'drop-available');
    });
    draggedLocoId = null;
    draggedElement = null;
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

function handleDragEnter(e) {
    e.preventDefault();
    const slot = e.target.closest('.slot');
    if (slot && !slot.classList.contains('occupied')) {
        slot.classList.add('drag-over');
    }
}

function handleDragLeave(e) {
    const slot = e.target.closest('.slot');
    if (slot) {
        slot.classList.remove('drag-over');
    }
}

async function handleDrop(e) {
    e.preventDefault();
    const slot = e.target.closest('.slot');
    if (!slot) return;

    slot.classList.remove('drag-over', 'drop-available');

    const locoId = e.dataTransfer.getData('text/plain');
    if (!locoId) return;

    const targetTrack = parseInt(slot.dataset.track);
    const targetPosition = parseInt(slot.dataset.position);

    // Check if slot is already occupied (by a different loco)
    const occupant = locomotives.find(l => l.track === targetTrack && l.position === targetPosition);
    if (occupant && occupant.id !== parseInt(locoId)) {
        showToast('Позиция уже занята!', 'error');
        return;
    }

    try {
        const res = await fetch(`/api/locomotives/${locoId}/move`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ track: targetTrack, position: targetPosition })
        });

        const data = await res.json();
        if (res.ok) {
            showToast(`Локомотив ${data.number} перемещён → Track ${targetTrack}, Slot ${targetPosition}`, 'success');
            await refreshMap();
        } else {
            showToast(data.error || 'Ошибка перемещения', 'error');
        }
    } catch (err) {
        showToast('Ошибка сети', 'error');
    }
}

// =============== ADD LOCOMOTIVE ===============
function showAddModal() {
    document.getElementById('addModal').style.display = 'flex';
    document.getElementById('locoNumber').focus();
    document.getElementById('addError').style.display = 'none';
}

function closeAddModal() {
    document.getElementById('addModal').style.display = 'none';
    document.getElementById('addForm').reset();
}

async function handleAddLoco(e) {
    e.preventDefault();
    const errorEl = document.getElementById('addError');
    errorEl.style.display = 'none';

    const number = document.getElementById('locoNumber').value.trim();
    const status = document.getElementById('locoStatus').value;
    const track = document.getElementById('locoTrack').value ? parseInt(document.getElementById('locoTrack').value) : null;
    const position = document.getElementById('locoPosition').value ? parseInt(document.getElementById('locoPosition').value) : null;

    if (!number) {
        errorEl.textContent = 'Введите номер локомотива';
        errorEl.style.display = 'block';
        return;
    }

    try {
        const res = await fetch('/api/locomotives', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ number, status, track, position })
        });

        const data = await res.json();
        if (res.ok) {
            showToast(`Локомотив ${number} добавлен`, 'success');
            closeAddModal();
            await refreshMap();
        } else {
            errorEl.textContent = data.error;
            errorEl.style.display = 'block';
        }
    } catch (err) {
        errorEl.textContent = 'Ошибка сети';
        errorEl.style.display = 'block';
    }
}

// =============== INFO MODAL ===============
function showInfoModal(loco) {
    selectedLoco = loco;
    document.getElementById('infoLocoNum').textContent = `#${loco.number}`;
    document.getElementById('infoNumber').textContent = loco.number;
    document.getElementById('infoStatus').textContent = getStatusLabel(loco.status);
    document.getElementById('infoTrack').textContent = loco.track || '—';
    document.getElementById('infoPosition').textContent = loco.position || '—';
    document.getElementById('infoCreated').textContent = loco.created_at || '—';
    document.getElementById('infoModal').style.display = 'flex';
}

function closeInfoModal() {
    document.getElementById('infoModal').style.display = 'none';
    selectedLoco = null;
}

function getStatusLabel(status) {
    const labels = {
        active: '🟢 Активный',
        repair: '🔴 Ремонт',
        waiting: '🟡 Ожидание',
        completed: '🟢 Завершён'
    };
    return labels[status] || status;
}

// =============== DELETE LOCOMOTIVE ===============
async function deleteLoco() {
    if (!selectedLoco) return;
    if (!confirm(`Удалить локомотив #${selectedLoco.number}?`)) return;

    try {
        const res = await fetch(`/api/locomotives/${selectedLoco.id}`, { method: 'DELETE' });
        if (res.ok) {
            showToast(`Локомотив #${selectedLoco.number} удалён`, 'success');
            closeInfoModal();
            await refreshMap();
        } else {
            const data = await res.json();
            showToast(data.error || 'Ошибка удаления', 'error');
        }
    } catch (err) {
        showToast('Ошибка сети', 'error');
    }
}

// =============== REMOVE FROM TRACK ===============
async function removeFromTrack() {
    if (!selectedLoco) return;

    try {
        const res = await fetch(`/api/locomotives/${selectedLoco.id}/move`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ track: null, position: null })
        });

        if (res.ok) {
            showToast(`Локомотив #${selectedLoco.number} убран с пути`, 'success');
            closeInfoModal();
            await refreshMap();
        }
    } catch (err) {
        showToast('Ошибка сети', 'error');
    }
}

// =============== SEARCH ===============
function searchLoco() {
    const query = document.getElementById('searchInput').value.trim().toLowerCase();
    if (!query) {
        document.querySelectorAll('.loco-block').forEach(el => el.classList.remove('highlighted'));
        return;
    }

    document.querySelectorAll('.loco-block').forEach(el => {
        if (el.dataset.number.toLowerCase().includes(query)) {
            el.classList.add('highlighted');
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
            el.classList.remove('highlighted');
        }
    });
}

// =============== EXPORT ===============
function exportData() {
    const csvRows = ['Номер,Статус,Путь,Позиция,Дата добавления'];
    locomotives.forEach(l => {
        csvRows.push(`${l.number},${l.status},${l.track || ''},${l.position || ''},${l.created_at || ''}`);
    });
    const blob = new Blob(['\uFEFF' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `locomotives_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Экспорт завершён', 'success');
}

// =============== LOGOUT ===============
async function logout() {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/';
}

// =============== TOAST ===============
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast toast-${type}`;
    toast.style.display = 'block';
    setTimeout(() => {
        toast.style.display = 'none';
    }, 3000);
}
