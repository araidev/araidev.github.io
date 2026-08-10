import * as UI from './ui.js';
import * as FB from './firebase.js';
import * as Name from './randomName.js';
import * as Shopee from './shopee.js';
import * as SMS from './sms.js';
import * as Note from './note.js';

// ==========================================
// PENDAFTARAN WINDOW (ANTI-CRASH)
// ==========================================
// UI
window.showModal = UI.showModal; 
window.closeModal = UI.closeModal; 
window.toggleMainMenu = UI.toggleMainMenu;

// Firebase
window.masukSistem = FB.masukSistem; 
window.keluarSistem = FB.keluarSistem;

// Nama Random
window.generateName = Name.generateName;

// Shopee
window.openShopeeList = Shopee.openShopeeList; 
window.formatRupiah = Shopee.formatRupiah; 
window.openShopeeModal = Shopee.openShopeeModal; 
window.saveShopee = Shopee.saveShopee; 
window.deleteShopee = Shopee.deleteShopee; 
window.copyShopeeLink = Shopee.copyShopeeLink; 
window.actionRandomLink = Shopee.actionRandomLink; 
window.togglePinShopee = Shopee.togglePinShopee;

// SMS
window.changeSmsServer = SMS.changeSmsServer;
window.executeBuySms = SMS.executeBuySms; 
window.copyPhoneNumber = SMS.copyPhoneNumber; 
window.actSms = SMS.actSms;

// Note
window.openNoteList = Note.openNoteList; 
window.openNoteModal = Note.openNoteModal;
window.saveNote = Note.saveNote; 
window.editNote = Note.editNote; 
window.deleteNote = Note.deleteNote;
window.copyNoteContent = Note.copyNoteContent;

// ==========================================
// LOGIKA MULTI-DASHBOARD & SWIPE
// ==========================================
let currentDash = 1;

window.switchDashboard = function(dashIndex) {
    currentDash = dashIndex;
    const slider = document.getElementById('main-slider');
    const tab1 = document.getElementById('tab-1');
    const tab2 = document.getElementById('tab-2');
    const fabShopee = document.getElementById('fab-shopee');

    if (!slider) return;

    if (dashIndex === 1) {
        slider.style.transform = 'translateX(0)';
        if(tab1) tab1.classList.add('active');
        if(tab2) tab2.classList.remove('active');
        if(fabShopee) fabShopee.classList.add('hidden');
    } else {
        slider.style.transform = 'translateX(-100vw)';
        if(tab2) tab2.classList.add('active');
        if(tab1) tab1.classList.remove('active');
        if(fabShopee) fabShopee.classList.remove('hidden');
    }
};

function initSwipeLogic() {
    let touchstartX = 0;
    let touchendX = 0;
    const sliderEl = document.getElementById('main-slider');

    if(sliderEl) {
        sliderEl.addEventListener('touchstart', e => {
            touchstartX = e.changedTouches[0].screenX;
        }, {passive: true});

        sliderEl.addEventListener('touchend', e => {
            touchendX = e.changedTouches[0].screenX;
            const swipeDist = touchendX - touchstartX;
            
            if (swipeDist < -60 && currentDash === 1) window.switchDashboard(2);
            else if (swipeDist > 60 && currentDash === 2) window.switchDashboard(1);
        }, {passive: true});
    }
}

// ==========================================
// KONFIGURASI COUNTER EMAIL
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
    let endVal = parseInt(document.getElementById('cfg-end').value) || 100;
    
    let currentIndexStr = localStorage.getItem('xurel_email_index');
    if (!currentIndexStr) {
        localStorage.setItem('xurel_email_index', (startVal - 1).toString()); 
    } else {
        let currentIndex = parseInt(currentIndexStr);
        if (currentIndex < (startVal - 1) || currentIndex > endVal) {
            localStorage.setItem('xurel_email_index', (startVal - 1).toString());
        }
    }
    closeModal('modal-email-config');
};

// ==========================================
// LOGIKA NEXT & PREV EMAIL
// ==========================================
function initEmailCounter() {
    const btnNext = document.getElementById('btn-next-email');
    const btnPrev = document.getElementById('btn-prev-email');
    const ipInput = document.getElementById('ip-result');

    async function handleEmailCount(direction, btnElement) {
        let base = localStorage.getItem('xurel_base_email');
        if (!base) return UI.showModal("Peringatan", "Silakan setting Base Email (Edit) terlebih dahulu.", "alert");

        let endCount = parseInt(localStorage.getItem('xurel_email_end') || 100);
        let startCount = parseInt(localStorage.getItem('xurel_email_start') || 1);
        
        let indexStr = localStorage.getItem('xurel_email_index');
        let index = indexStr ? parseInt(indexStr) : (startCount - 1);

        if (direction === 1) { 
            if (index >= endCount) return UI.showModal("Batas Maksimal", `Batas akhir count email (${endCount}) telah tercapai!`, "alert");
            index++;
        } else if (direction === -1) { 
            if (index <= startCount) return UI.showModal("Batas Awal", `Anda sudah berada di batas awal email (${startCount})!`, "alert");
            index--;
        }

        localStorage.setItem('xurel_email_index', index.toString());
        
        const parts = base.split('@');
        let newEmail = parts.length === 2 ? `${parts[0]}${index}@${parts[1]}` : `${base}${index}`;
        
        try {
            if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(newEmail);
            else throw new Error("Fallback");
        } catch (err) {
            const textArea = document.createElement("textarea");
            textArea.value = newEmail;
            textArea.style.position = "fixed"; textArea.style.left = "-9999px";
            document.body.appendChild(textArea); textArea.focus(); textArea.select();
            document.execCommand('copy'); document.body.removeChild(textArea);
        }
        
        if (ipInput) {
            ipInput.value = newEmail;
            ipInput.style.color = "var(--fb-blue)";
        }
        
        const originalHTML = btnElement.innerHTML;
        btnElement.innerHTML = '<i class="fa-solid fa-check"></i>';
        setTimeout(() => { btnElement.innerHTML = originalHTML; }, 1000);
    }

    if (btnNext) btnNext.addEventListener('click', function() { handleEmailCount(1, this); });
    if (btnPrev) btnPrev.addEventListener('click', function() { handleEmailCount(-1, this); });
}

// ==========================================
// LOGIKA CEK & SIMPAN IP
// ==========================================
let currentFetchedIP = "";

window.checkMyIP = async function() {
    const ipInput = document.getElementById('ip-result');
    const btnCek = document.getElementById('btn-cek-ip');
    const btnSave = document.getElementById('btn-save-ip');
    
    if(btnCek.disabled) return; 

    ipInput.value = "Mengecek...";
    ipInput.style.color = "var(--fb-text)";
    btnCek.disabled = true;
    btnCek.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    btnSave.style.display = "none"; 
    currentFetchedIP = "";

    try {
        let myIP = "";
        try {
            const res = await fetch('https://api.ipify.org?format=json', { cache: "no-store" });
            const data = await res.json();
            myIP = data.ip;
        } catch (e1) {
            const res2 = await fetch('https://freeipapi.com/api/json', { cache: "no-store" });
            const data2 = await res2.json();
            myIP = data2.ipAddress;
        }

        currentFetchedIP = myIP;
        let isUsed = false;
        try {
            const now = Date.now();
            const snap = await FB.db.ref('ip_logs').once('value');
            if (snap.exists()) {
                snap.forEach(child => {
                    if (now - child.val().timestamp > 7 * 24 * 60 * 60 * 1000) FB.db.ref('ip_logs/'+child.key).remove();
                    else if (child.val().ip === myIP) isUsed = true;
                });
            }
        } catch (dbError) { console.warn("Lanjut tanpa cek histori."); }

        if (isUsed) {
            ipInput.value = `${myIP} - TERPAKAI`; ipInput.style.color = "var(--fb-red)";
        } else {
            ipInput.value = `${myIP} - BERSIH`; ipInput.style.color = "var(--fb-green)";
            btnSave.style.display = "block"; 
        }

    } catch (error) {
        ipInput.value = "Gagal memuat IP"; ipInput.style.color = "var(--fb-red)";
    } finally {
        btnCek.disabled = false; btnCek.innerHTML = 'IP';
    }
};

window.saveMyIP = async function() {
    if (!currentFetchedIP) return;
    const btnSave = document.getElementById('btn-save-ip');
    const ipInput = document.getElementById('ip-result');
    btnSave.disabled = true; btnSave.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

    try {
        await FB.db.ref('ip_logs').push({ ip: currentFetchedIP, timestamp: Date.now() });
        ipInput.value = `${currentFetchedIP} - TERCATAT`;
        ipInput.style.color = "var(--fb-blue)"; 
        setTimeout(() => { btnSave.style.display = "none"; btnSave.disabled = false; btnSave.innerHTML = '<i class="fa-solid fa-floppy-disk"></i>'; }, 1000);
    } catch(e) {
        UI.showModal("Gagal", "Gagal menyimpan. Pastikan Anda sudah Login Admin.", "alert");
        btnSave.disabled = false; btnSave.innerHTML = '<i class="fa-solid fa-floppy-disk"></i>';
    }
};

// ==========================================
// KONTROL LOGIN & AUTO CAPS
// ==========================================
if (FB.auth) {
    FB.auth.onAuthStateChanged(user => {
        const isAdmin = !!user;
        const formLogin = document.getElementById('login-form');
        const formLogout = document.getElementById('logout-form');
        if(formLogin) formLogin.classList.toggle('hidden', isAdmin);
        if(formLogout) formLogout.classList.toggle('hidden', !isAdmin);
        window.dispatchEvent(new CustomEvent('authStateChanged', { detail: user }));
    });
}

document.addEventListener('click', function(e) {
    const popup = document.getElementById('main-menu-popup');
    const btn = document.querySelector('.menu-btn');
    if(popup && popup.classList.contains('active') && !popup.contains(e.target) && (!btn || !btn.contains(e.target))) {
        popup.classList.remove('active');
    }
});

function initAutoCaps() {
    const shopeeTitleInput = document.getElementById('shopee-title');
    if (shopeeTitleInput) {
        shopeeTitleInput.addEventListener('input', function() {
            this.value = this.value.replace(/\b\w/g, char => char.toUpperCase());
        });
    }
}

// ==========================================
// INISIALISASI AMAN (ANTI STUCK)
// ==========================================
function initAllSystems() {
    initSwipeLogic();
    initEmailCounter();
    initAutoCaps();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAllSystems);
} else {
    initAllSystems();
}
