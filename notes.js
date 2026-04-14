import { db } from './firebase.js';
import { showModal, closeModal } from './ui.js';

let selectedNoteKey = null; 
let currentNoteRaw = ""; 
let isEditingNote = false;

// ==========================================
// FITUR STATISTIK HARIAN & TOTAL
// ==========================================
let currentStatsRef = null;
let statsData = { total: 0, saved: 0, deleted: 0 }; 

function getTodayWIB() {
    const d = new Date();
    const wibTime = new Date(d.getTime() + (d.getTimezoneOffset() * 60000) + (3600000 * 7));
    return `${wibTime.getFullYear()}-${String(wibTime.getMonth() + 1).padStart(2, '0')}-${String(wibTime.getDate()).padStart(2, '0')}`;
}

function getStatsPath() {
    return `notes_stats/public/${getTodayWIB()}`;
}

function incrementStat(type) {
    try {
        const path = getStatsPath();
        db.ref(path).child(type).transaction((val) => (val || 0) + 1);
    } catch (e) {}
}

async function resetStatsManual() {
    if (await showModal("Reset Statistik", "Hapus data simpan & hapus hari ini menjadi 0?", "danger")) {
        try { await db.ref(getStatsPath()).update({ saved: 0, deleted: 0 }); } catch (e) {}
    }
}

function syncStats() {
    try {
        const path = getStatsPath();
        if (currentStatsRef) currentStatsRef.off();
        currentStatsRef = db.ref(path);
        currentStatsRef.on('value', snap => {
            const d = snap.val() || { saved: 0, deleted: 0 };
            statsData.saved = d.saved || 0;
            statsData.deleted = d.deleted || 0;
            updateStatsUI(); 
        });
    } catch (e) {}
}

function updateStatsUI() {
    const statsContainer = document.getElementById('note-stats-container');
    if (!statsContainer) return;

    // Tampilan Wrapper yang Rapi dan Profesional
    statsContainer.style.cssText = `
        background: #f8f9fa;
        border: 1px solid #e4e6eb;
        border-radius: 8px;
        padding: 12px 15px;
        display: flex;
        align-items: center;
        justify-content: space-around;
        box-shadow: 0 2px 4px rgba(0,0,0,0.02);
        margin-bottom: 15px;
    `;
    
    statsContainer.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; color:#65676B;">
            <div style="display:flex; align-items:center; gap:6px; font-weight:900; color:#1877f2; font-size:15px;">
                <i class="fa-solid fa-folder"></i> <span>${statsData.total}</span>
            </div>
            <span style="font-size:10px; font-weight:bold; opacity:0.7; text-transform:uppercase; margin-top:2px;">Total</span>
        </div>
        
        <div style="width: 1px; height: 28px; background: #ccd0d5;"></div>

        <div style="display:flex; flex-direction:column; align-items:center; color:#65676B;">
            <div style="display:flex; align-items:center; gap:6px; font-weight:900; color:#2ecc71; font-size:15px;">
                <i class="fa-solid fa-floppy-disk"></i> <span>${statsData.saved}</span>
            </div>
            <span style="font-size:10px; font-weight:bold; opacity:0.7; text-transform:uppercase; margin-top:2px;">Disimpan</span>
        </div>

        <div style="width: 1px; height: 28px; background: #ccd0d5;"></div>

        <div style="display:flex; flex-direction:column; align-items:center; color:#65676B;">
            <div style="display:flex; align-items:center; gap:6px; font-weight:900; color:#e74c3c; font-size:15px;">
                <i class="fa-solid fa-trash"></i> <span>${statsData.deleted}</span>
            </div>
            <span style="font-size:10px; font-weight:bold; opacity:0.7; text-transform:uppercase; margin-top:2px;">Dihapus</span>
        </div>

        <div style="width: 1px; height: 28px; background: #ccd0d5;"></div>

        <button id="btn-reset-stat" style="
            width: 32px; 
            height: 32px; 
            border: none; 
            background: #e4e6eb; 
            border-radius: 50%; 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            cursor: pointer; 
            transition: 0.2s;
        " title="Reset Hari Ini">
            <i class="fas fa-sync-alt" style="font-size: 13px; color: #65676B;"></i>
        </button>
    `;

    const btnReset = statsContainer.querySelector('#btn-reset-stat');
    btnReset.onclick = (e) => { 
        e.preventDefault(); 
        e.stopPropagation(); 
        resetStatsManual(); 
    };
    btnReset.onmouseover = () => { btnReset.style.background = '#d8dadf'; btnReset.querySelector('i').style.color = '#1877f2'; };
    btnReset.onmouseout = () => { btnReset.style.background = '#e4e6eb'; btnReset.querySelector('i').style.color = '#65676B'; };
}

// ==========================================
// CORE FUNCTIONS
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    syncNotes();
    syncStats();
});

function getNotesPath() { return 'notes/public'; }

function formatDate(ts) {
    if(!ts) return "---"; const d = new Date(ts);
    return `${['Ming', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'][d.getDay()]}, ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(-2)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function autoLinkText(text) { return text.replace(/(https?:\/\/[^\s]+)/g, url => `<a href="${url}" target="_blank" class="text-link" onclick="event.stopPropagation()">${url}</a>`); }
function escapeHTML(str) { return !str ? "" : str.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m])); }

function syncNotes() {
    const path = getNotesPath(); 
    db.ref(path).off();
    db.ref(path).orderByChild('timestamp').on('value', snap => {
        statsData.total = snap.numChildren();
        updateStatsUI();
        
        const grid = document.getElementById('notes-grid'); 
        if(!grid) return;
        
        grid.innerHTML = ''; let items = [];
        snap.forEach(child => { items.push({ key: child.key, ...child.val() }); });
        
        items.reverse().forEach(d => {
            const card = document.createElement('div'); card.className = 'note-card'; 
            card.onclick = () => {
                selectedNoteKey = d.key; currentNoteRaw = d.content;
                document.getElementById('view-tag').innerText = "PUB | " + formatDate(d.timestamp);
                document.getElementById('view-title').innerText = d.title;
                document.getElementById('view-content').innerHTML = autoLinkText(escapeHTML(d.content));
                document.getElementById('modal-note-view').classList.add('active');
            };
            card.innerHTML = `<div class="note-title">${escapeHTML(d.title) || 'Untitled'}</div><div class="note-preview">${escapeHTML(d.content)}</div><div class="note-date">${formatDate(d.timestamp)}</div>`;
            grid.appendChild(card);
        });
    });
}

export function openNoteList() {
    document.getElementById('modal-note-list').classList.add('active');
}

export function openNoteModal() {
    isEditingNote = false; 
    document.getElementById('note-title').value = ""; 
    document.getElementById('note-content').value = "";
    document.getElementById('modal-note-form').classList.add('active');
}

export async function saveNote() {
    let t = document.getElementById('note-title').value.trim(); 
    const c = document.getElementById('note-content').value;
    if(!c) return showModal("Peringatan", "Konten tidak boleh kosong!", "alert");
    
    const path = getNotesPath();
    try {
        const snapshot = await db.ref(path).once('value');
        let usedNumbers = new Set();
        let isDuplicate = false;

        snapshot.forEach(child => {
            if (isEditingNote && child.key === selectedNoteKey) return; 
            if (child.val().content === c) isDuplicate = true;
            let titleStr = child.val().title;
            if (titleStr && /^\d+$/.test(titleStr.toString().trim())) usedNumbers.add(parseInt(titleStr.toString().trim()));
        });

        if (isDuplicate) {
            const confirm = await showModal("Teks Duplikat", "Catatan dengan teks yang sama persis sudah ada. Tetap simpan?", "confirm");
            if (!confirm) return;
        }

        if(!t) {
            let nextNum = 1; while (usedNumbers.has(nextNum)) { nextNum++; }
            t = nextNum.toString();
        }
        executeNoteSave(t, c, path);
    } catch (e) { 
        showModal("Gagal", "Gagal menghubungi database.", "alert"); 
    }
}

function executeNoteSave(title, content, path) {
    const data = { title: title, content: content, timestamp: Date.now() };
    const req = (isEditingNote && selectedNoteKey) ? db.ref(`${path}/${selectedNoteKey}`).update(data) : db.ref(path).push(data);
    req.then(() => {
        closeModal('modal-note-form');
        if (!isEditingNote) incrementStat('saved');
    }).catch(() => showModal("Gagal", "Akses Ditolak.", "alert"));
}

export function editNote() {
    closeModal('modal-note-view'); isEditingNote = true;
    document.getElementById('note-title').value = document.getElementById('view-title').innerText;
    document.getElementById('note-content').value = currentNoteRaw;
    document.getElementById('modal-note-form').classList.add('active');
}

export async function deleteNote() {
    if(await showModal("Hapus Catatan", "Yakin ingin menghapus catatan ini?", "danger")) {
        db.ref(`${getNotesPath()}/${selectedNoteKey}`).remove().then(() => {
            incrementStat('deleted');
            closeModal('modal-note-view');
        });
    }
}

export function copyNoteContent(btn) {
    navigator.clipboard.writeText(currentNoteRaw); const originalHTML = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-check"></i> Tersalin'; setTimeout(() => { btn.innerHTML = originalHTML; }, 1500);
}
