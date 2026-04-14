import { db } from './firebase.js';
import { showModal, closeModal } from './ui.js';

let selectedNoteKey = null; let currentNoteRaw = ""; let isEditingNote = false;
let userAdmin = null;

window.addEventListener('authStateChanged', (e) => { 
    userAdmin = e.detail; 
});

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
    
    // Default nyimpan ke public karena fitur tab privat sudah dihilangkan di UI
    const path = 'notes/public';
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
        showModal("Sukses", "Catatan berhasil disimpan.", "alert");
    }).catch(() => showModal("Gagal", "Akses Ditolak.", "alert"));
}
