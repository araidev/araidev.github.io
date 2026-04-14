import { showModal, closeModal, toggleMainMenu, switchApp } from './modules/ui.js';
import { masukSistem, keluarSistem, auth } from './modules/firebase.js';
import { generateName } from './modules/randomName.js';
// DI BAWAH INI SAYA TAMBAHKAN 'actionRandomLink'
import { formatRupiah, openShopeeModal, saveShopee, deleteShopee, copyShopeeLink, actionRandomLink } from './modules/shopee.js';
import { switchNoteTab, openNoteModal, saveNote, editNote, deleteNote, copyNoteContent } from './modules/notes.js';
import { toggleSmsLock, changeSmsServer, buySms, copyPhoneNumber, actSms } from './modules/sms.js';

// Catatan: Jika Anda sudah mengubah nama filenya menjadi bow.js, 
// silakan ubah kata 'fiturBaru.js' di bawah ini menjadi 'bow.js'
import { jalankanFiturBaru } from './modules/fiturBaru.js';

// ========================================================
// DAFTARKAN FUNGSI KE WINDOW (Agar onclick di HTML berfungsi)
// ========================================================
window.showModal = showModal;
window.closeModal = closeModal;
window.toggleMainMenu = toggleMainMenu;
window.switchApp = switchApp;

window.masukSistem = masukSistem;
window.keluarSistem = keluarSistem;

window.generateName = generateName;

window.formatRupiah = formatRupiah;
window.openShopeeModal = openShopeeModal;
window.saveShopee = saveShopee;
window.deleteShopee = deleteShopee;
window.copyShopeeLink = copyShopeeLink;
window.actionRandomLink = actionRandomLink; // <--- INI TAMBAHANNYA AGAR KARTU ACAK BERFUNGSI

window.switchNoteTab = switchNoteTab;
window.openNoteModal = openNoteModal;
window.saveNote = saveNote;
window.editNote = editNote;
window.deleteNote = deleteNote;
window.copyNoteContent = copyNoteContent;

window.toggleSmsLock = toggleSmsLock;
window.changeSmsServer = changeSmsServer;
window.buySms = buySms;
window.copyPhoneNumber = copyPhoneNumber;
window.actSms = actSms;

window.jalankanFiturBaru = jalankanFiturBaru;

// ========================================================
// PENGENDALI STATUS LOGIN & TAMPILAN
// ========================================================
auth.onAuthStateChanged(user => {
    const isAdmin = !!user;
    document.getElementById('login-form').classList.toggle('hidden', isAdmin);
    document.getElementById('logout-form').classList.toggle('hidden', !isAdmin);
    
    // Tampilkan tombol Plus (+) Shopee hanya jika login & sedang di tab Shopee
    const fabShopee = document.getElementById('fab-shopee');
    const isShopeeActive = document.getElementById('app-shopee').classList.contains('active');
    if (fabShopee) fabShopee.style.display = (isAdmin && isShopeeActive) ? 'flex' : 'none';
    
    window.dispatchEvent(new CustomEvent('authStateChanged', { detail: user }));
});

// Menutup menu pop-up utama saat klik di luar area
document.addEventListener('click', function(e) {
    const popup = document.getElementById('main-menu-popup');
    const btn = document.querySelector('.menu-btn');
    if(popup && popup.classList.contains('active') && !popup.contains(e.target) && !btn.contains(e.target)) {
        popup.classList.remove('active');
    }
});

// ========================================================
// LOGIKA SWIPE (GESER LAYAR) UNTUK PINDAH MENU
// ========================================================
let touchStartX = 0;
let touchEndX = 0;
const minSwipeDistance = 70; // Minimal jarak geser jari agar tidak terpencet tidak sengaja

document.addEventListener('touchstart', e => {
    touchStartX = e.changedTouches[0].screenX;
}, {passive: true});

document.addEventListener('touchend', e => {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
}, {passive: true});

function handleSwipe() {
    // Matikan fitur swipe jika sedang ada Modal (Pop-up) yang terbuka
    if(document.querySelector('.modal-overlay.active')) return;

    // Urutan tab menu Anda
    const appsOrder = ['shopee', 'notes', 'sms', 'baru'];
    const currentActiveApp = document.querySelector('.app-section.active');
    
    if(!currentActiveApp) return;
    
    const currentAppId = currentActiveApp.id.replace('app-', '');
    let currentIndex = appsOrder.indexOf(currentAppId);

    // Geser ke Kiri (Membuka menu sebelah Kanan)
    if (touchStartX - touchEndX > minSwipeDistance) {
        if (currentIndex < appsOrder.length - 1) {
            const nextBtn = document.querySelectorAll('.nav-btn')[currentIndex + 1];
            window.switchApp(appsOrder[currentIndex + 1], nextBtn);
        }
    } 
    // Geser ke Kanan (Membuka menu sebelah Kiri)
    else if (touchEndX - touchStartX > minSwipeDistance) {
        if (currentIndex > 0) {
            const prevBtn = document.querySelectorAll('.nav-btn')[currentIndex - 1];
            window.switchApp(appsOrder[currentIndex - 1], prevBtn);
        }
    }
}
