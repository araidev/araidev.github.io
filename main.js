import { showModal, closeModal, toggleMainMenu } from './ui.js';
import { masukSistem, keluarSistem, auth } from './firebase.js';
import { generateName } from './randomName.js';
import { openShopeeModal, saveShopee } from './shopee.js';
import { openNoteModal, saveNote } from './notes.js';
import { toggleSmsLock, changeSmsServer, buySms, copyPhoneNumber, actSms } from './sms.js';

// Daftarkan ke Window
window.showModal = showModal;
window.closeModal = closeModal;
window.toggleMainMenu = toggleMainMenu;
window.masukSistem = masukSistem;
window.keluarSistem = keluarSistem;

window.generateName = generateName;
window.openShopeeModal = openShopeeModal;
window.saveShopee = saveShopee;

window.openNoteModal = openNoteModal;
window.saveNote = saveNote;

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
// KONTROL LOGIN & TAMPILAN
// ==========================================
auth.onAuthStateChanged(user => {
    const isAdmin = !!user;
    document.getElementById('login-form').classList.toggle('hidden', isAdmin);
    document.getElementById('logout-form').classList.toggle('hidden', !isAdmin);
    
    // Tampilkan tombol Edit Shopee hanya jika login
    const btnShopee = document.getElementById('btn-edit-shopee');
    const msgShopee = document.getElementById('shopee-login-msg');
    if(btnShopee) btnShopee.style.display = isAdmin ? 'block' : 'none';
    if(msgShopee) msgShopee.style.display = isAdmin ? 'none' : 'block';
    
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
