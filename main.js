import { showModal, closeModal, toggleMainMenu } from './ui.js';
import { db, masukSistem, keluarSistem, auth } from './firebase.js';
import { generateName } from './randomName.js';
import { formatRupiah, openShopeeModal, saveShopee, deleteShopee, copyShopeeLink, actionRandomLink, openShopeeList } from './shopee.js';
import { openNoteList, openNoteModal, saveNote, editNote, deleteNote, copyNoteContent } from './notes.js';
import { toggleSmsLock, changeSmsServer, buySms, copyPhoneNumber, actSms } from './sms.js';

// Daftarkan ke Window
window.showModal = showModal;
window.closeModal = closeModal;
window.toggleMainMenu = toggleMainMenu;
window.masukSistem = masukSistem;
window.keluarSistem = keluarSistem;
window.generateName = generateName;

// Shopee
window.openShopeeList = openShopeeList;
window.formatRupiah = formatRupiah;
window.openShopeeModal = openShopeeModal;
window.saveShopee = saveShopee;
window.deleteShopee = deleteShopee;
window.copyShopeeLink = copyShopeeLink;
window.actionRandomLink = actionRandomLink;

// Notes
window.openNoteList = openNoteList;
window.openNoteModal = openNoteModal;
window.saveNote = saveNote;
window.editNote = editNote;
window.deleteNote = deleteNote;
window.copyNoteContent = copyNoteContent;

// SMS
window.toggleSmsLock = toggleSmsLock;
window.changeSmsServer = changeSmsServer;
window.buySms = buySms;
window.copyPhoneNumber = copyPhoneNumber;
window.actSms = actSms;

// ==========================================
// KONFIGURASI & COUNTER EMAIL
// ==========================================
window.openEmailConfig = function() {
    document.getElementById('cfg-email').value = localStorage.getItem('xurel_base_email') || "";
    document.getElementById('cfg-start').value = localStorage.getItem('xurel_email_start') || "1";
    document.getElementById('cfg-end').value = localStorage.getItem('xurel_email_end') || "100";
    document.getElementById('modal-email-config').classList.add('active');
};

window.saveEmailConfig = function() {
    localStorage.setItem('xurel_base_email', document.getElementById('cfg-email').value);
    localStorage.setItem('xurel_email_start', document.getElementById('cfg-start').value);
    localStorage.setItem('xurel_email_end', document.getElementById('cfg-end').value);
    
    let startVal = parseInt(document.getElementById('cfg-start').value) || 1;
    localStorage.setItem('xurel_email_index', (startVal - 1).toString()); 
    closeModal('modal-email-config');
};

// ==========================================
// LOGIKA CEK & SIMPAN IP (AUTO CLEAN 7 HARI)
// ==========================================
let currentFetchedIP = "";

window.checkMyIP = async function() {
    const ipInput = document.getElementById('ip-result');
    const btnCek = document.getElementById('btn-cek-ip');
    const btnSave = document.getElementById('btn-save-ip');
    
    // Mencegah klik ganda
    if(btnCek.disabled) return; 

    ipInput.value = "Mengecek...";
    ipInput.style.color = "var(--fb-text)";
    btnCek.disabled = true;
    btnCek.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    btnSave.style.display = "none"; // Sembunyikan tombol simpan awal
    currentFetchedIP = "";

    try {
        const now = Date.now();
        const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
        let isUsed = false;
        const updates = {};

        // 1. Dapatkan IP Asli
        const response = await fetch('https://api.ipify.org?format=json');
        if (!response.ok) throw new Error("Gagal API");
        const data = await response.json();
        const myIP = data.ip;
        currentFetchedIP = myIP;

        // 2. Baca Database Firebase ("Tukang Sapu" Aktif)
        const snap = await db.ref('ip_logs').once('value');
        if (snap.exists()) {
            snap.forEach(child => {
                const logTime = child.val().timestamp;
                // Jika umur IP sudah lewat 7 hari, tandai untuk dihapus
                if (now - logTime > sevenDaysMs) {
                    updates[child.key] = null; 
                } 
                // Jika belum 7 hari dan IP sama dengan sekarang
                else if (child.val().ip === myIP) {
                    isUsed = true;
                }
            });

            // Eksekusi Hapus Masal untuk IP kedaluwarsa
            if (Object.keys(updates).length > 0) {
                db.ref('ip_logs').update(updates);
            }
        }

        // 3. Tampilkan Hasil ke Layar
        if (isUsed) {
            ipInput.value = `${myIP} - TERPAKAI`;
            ipInput.style.color = "var(--fb-red)"; // Warna Merah Bahaya
        } else {
            ipInput.value = `${myIP} - BERSIH`;
            ipInput.style.color = "var(--fb-green)"; // Warna Hijau Aman
            btnSave.style.display = "block"; // Tampilkan Tombol Konfirmasi Simpan
        }

    } catch (error) {
        ipInput.value = "Gagal memuat IP";
        ipInput.style.color = "var(--fb-red)";
    } finally {
        btnCek.disabled = false;
        btnCek.innerHTML = 'Cek';
    }
};

// Tombol yang hanya muncul saat IP "Bersih" ditekan
window.saveMyIP = async function() {
    if (!currentFetchedIP) return;
    
    const btnSave = document.getElementById('btn-save-ip');
    const ipInput = document.getElementById('ip-result');
    
    btnSave.disabled = true;
    btnSave.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

    try {
        await db.ref('ip_logs').push({
            ip: currentFetchedIP,
            timestamp: Date.now()
        });
        
        ipInput.value = `${currentFetchedIP} - TERCATAT`;
        ipInput.style.color = "var(--fb-blue)"; // IP Sah jadi milik Anda (Biru)
        
        setTimeout(() => {
            btnSave.style.display = "none";
            btnSave.disabled = false;
            btnSave.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Catat';
        }, 1000);
        
    } catch(e) {
        showModal("Gagal", "Gagal menghubungi database IP.", "alert");
        btnSave.disabled = false;
        btnSave.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Catat';
    }
};


// ==========================================
// KONTROL LOGIN & TAMPILAN
// ==========================================
auth.onAuthStateChanged(user => {
    const isAdmin = !!user;
    document.getElementById('login-form').classList.toggle('hidden', isAdmin);
    document.getElementById('logout-form').classList.toggle('hidden', !isAdmin);
    
    window.dispatchEvent(new CustomEvent('authStateChanged', { detail: user }));
});

// Tutup menu saat klik di luar
document.addEventListener('click', function(e) {
    const popup = document.getElementById('main-menu-popup');
    const btn = document.querySelector('.menu-btn');
    if(popup && popup.classList.contains('active') && !popup.contains(e.target) && !btn.contains(e.target)) {
        popup.classList.remove('active');
    }
});

// ==========================================
// LOGIKA TOMBOL 'NEXT' EMAIL
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const btnNext = document.getElementById('btn-next-custom');
    
    btnNext?.addEventListener('click', async () => {
        let base = localStorage.getItem('xurel_base_email');
        if (!base) return showModal("Peringatan", "Silakan setting Base Email melalui tombol Edit terlebih dahulu.", "alert");

        let index = parseInt(localStorage.getItem('xurel_email_index') || 0);
        let endCount = parseInt(localStorage.getItem('xurel_email_end') || 100);
        let startCount = parseInt(localStorage.getItem('xurel_email_start') || 1);

        index++;
        if(index > endCount) index = startCount; // Ulangi dari start jika melebihi batas

        localStorage.setItem('xurel_email_index', index.toString());
        
        const parts = base.split('@');
        let newEmail = parts.length === 2 ? `${parts[0]}${index}@${parts[1]}` : `${base}${index}`;
        
        try {
            if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(newEmail);
            else throw new Error("Fallback");
        } catch (err) {
            const textArea = document.createElement("textarea");
            textArea.value = newEmail;
            textArea.style.position = "fixed";
            textArea.style.left = "-9999px";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
        }
        
        const originalHTML = btnNext.innerHTML;
        btnNext.innerHTML = '<i class="fa-solid fa-check"></i> Disalin';
        setTimeout(() => { btnNext.innerHTML = originalHTML; }, 1000);
    });
});
