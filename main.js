import { showModal, closeModal, toggleMainMenu } from './ui.js';
import { db, masukSistem, keluarSistem, auth } from './firebase.js';
import { generateName } from './randomName.js';
import { formatRupiah, openShopeeModal, saveShopee, deleteShopee, copyShopeeLink, actionRandomLink, openShopeeList, togglePinShopee } from './shopee.js';
import { changeSmsServer, executeBuySms, copyPhoneNumber, actSms } from './sms.js';
import { openNoteList, openNoteModal, saveNote, editNote, deleteNote, copyNoteContent } from './notes.js';

// Daftarkan ke Window
window.showModal = showModal; window.closeModal = closeModal; window.toggleMainMenu = toggleMainMenu;
window.keluarSistem = keluarSistem; window.generateName = generateName;
window.openShopeeList = openShopeeList; window.formatRupiah = formatRupiah; window.openShopeeModal = openShopeeModal;
window.saveShopee = saveShopee; window.deleteShopee = deleteShopee; window.copyShopeeLink = copyShopeeLink;
window.actionRandomLink = actionRandomLink; window.openNoteList = openNoteList; window.openNoteModal = openNoteModal;
window.saveNote = saveNote; window.editNote = editNote; window.deleteNote = deleteNote;
window.copyNoteContent = copyNoteContent; window.changeSmsServer = changeSmsServer;
window.executeBuySms = executeBuySms; window.copyPhoneNumber = copyPhoneNumber; window.actSms = actSms;
window.togglePinShopee = togglePinShopee;

// ==========================================
// FITUR: INGAT SAYA & OVERRIDE LOGIN
// ==========================================
window.masukSistem = function() {
    const email = document.getElementById("global-email").value;
    const pass = document.getElementById("global-pass").value;
    const rememberSwitch = document.getElementById("remember-me-switch").checked;

    if (rememberSwitch) {
        localStorage.setItem("xurel_remember_email", email);
        localStorage.setItem("xurel_remember_pass", pass);
    } else {
        localStorage.removeItem("xurel_remember_email");
        localStorage.removeItem("xurel_remember_pass");
    }
    
    // Panggil fungsi masukSistem orisinal bawaan firebase.js Anda
    masukSistem();
};

document.addEventListener("DOMContentLoaded", () => {
    // Muat preferensi Ingat Saya saat halaman dimuat
    const savedEmail = localStorage.getItem("xurel_remember_email");
    const savedPass = localStorage.getItem("xurel_remember_pass");
    const rememberSwitch = document.getElementById("remember-me-switch");
    
    if (savedEmail && savedPass) {
        document.getElementById("global-email").value = savedEmail;
        document.getElementById("global-pass").value = savedPass;
        if(rememberSwitch) rememberSwitch.checked = true;
    }

    // Render ulang pintasan di Toolbar
    renderShortcuts();
});


// ==========================================
// FITUR: SILENT COPY & MANAJEMEN PINTASAN
// ==========================================
function silentCopyToClipboard(text) {
    if (!text) return;
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).catch(err => console.error("Copy gagal", err));
    } else {
        let textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try { document.execCommand('copy'); } catch (err) {}
        document.body.removeChild(textArea);
    }
}

let myShortcuts = JSON.parse(localStorage.getItem("xurel_shortcuts")) || [];

window.renderShortcuts = function() {
    const listContainer = document.getElementById("shortcut-list-container");
    const btnAdd = document.getElementById("btn-add-shortcut");
    const tbBtn0 = document.getElementById("toolbar-shortcut-0");
    const tbBtn1 = document.getElementById("toolbar-shortcut-1");

    if(!listContainer || !tbBtn0 || !tbBtn1) return;

    listContainer.innerHTML = "";
    myShortcuts.forEach((sc, index) => {
        listContainer.innerHTML += `
            <div class="shortcut-item">
                <span class="shortcut-title">${sc.title}</span>
                <div class="shortcut-actions">
                    <button class="btn-edit-sc" onclick="showShortcutForm(${index})"><i class="fas fa-edit"></i></button>
                    <button class="btn-del-sc" onclick="deleteShortcut(${index})"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `;
    });

    if (myShortcuts.length >= 2) {
        btnAdd.style.display = "none";
    } else {
        btnAdd.style.display = "block";
    }

    tbBtn0.style.display = "none";
    tbBtn1.style.display = "none";

    if (myShortcuts[0]) {
        tbBtn0.style.display = "flex";
        tbBtn0.innerText = myShortcuts[0].title.substring(0, 2).toUpperCase();
    }
    if (myShortcuts[1]) {
        tbBtn1.style.display = "flex";
        tbBtn1.innerText = myShortcuts[1].title.substring(0, 2).toUpperCase();
    }
};

window.showShortcutForm = function(index = -1) {
    const form = document.getElementById("shortcut-form-container");
    const titleInp = document.getElementById("sc-title");
    const contentInp = document.getElementById("sc-content");
    const indexInp = document.getElementById("sc-edit-index");
    const btnAdd = document.getElementById("btn-add-shortcut");

    if (index > -1) {
        titleInp.value = myShortcuts[index].title;
        contentInp.value = myShortcuts[index].content;
        indexInp.value = index;
    } else {
        titleInp.value = "";
        contentInp.value = "";
        indexInp.value = -1;
    }

    form.style.display = "block";
    btnAdd.style.display = "none";
};

window.hideShortcutForm = function() {
    document.getElementById("shortcut-form-container").style.display = "none";
    renderShortcuts();
};

window.saveShortcut = function() {
    const title = document.getElementById("sc-title").value.trim();
    const content = document.getElementById("sc-content").value.trim();
    const index = parseInt(document.getElementById("sc-edit-index").value);

    if (!title || !content) return; // Silent return if empty

    if (index > -1) {
        myShortcuts[index] = { title, content };
    } else {
        if (myShortcuts.length < 2) myShortcuts.push({ title, content });
    }

    localStorage.setItem("xurel_shortcuts", JSON.stringify(myShortcuts));
    hideShortcutForm();
};

window.deleteShortcut = function(index) {
    if (confirm("Hapus pintasan ini?")) {
        myShortcuts.splice(index, 1);
        localStorage.setItem("xurel_shortcuts", JSON.stringify(myShortcuts));
        renderShortcuts();
    }
};

window.copyShortcut = function(index) {
    if (myShortcuts[index] && myShortcuts[index].content) {
        silentCopyToClipboard(myShortcuts[index].content);
    }
};


// ==========================================
// LOGIKA LACI (DRAWER) DI TOOLBAR
// ==========================================
window.toggleTopDrawer = function() {
    const drawer = document.getElementById('top-drawer');
    const icon = document.getElementById('drawer-icon');
    
    const isOpen = drawer.classList.toggle('active');
    
    if (isOpen) {
        icon.style.transform = "rotate(180deg)";
        icon.style.color = "var(--fb-blue)";
    } else {
        icon.style.transform = "rotate(0deg)";
        icon.style.color = "var(--fb-muted)";
    }
};

// ==========================================
// KONFIGURASI COUNTER EMAIL (AMAN REFRESH)
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
// LOGIKA NEXT & PREV EMAIL (KOLOM MULTIFUNGSI)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const btnNext = document.getElementById('btn-next-email');
    const btnPrev = document.getElementById('btn-prev-email');
    const ipInput = document.getElementById('ip-result');

    async function handleEmailCount(direction, btnElement) {
        let base = localStorage.getItem('xurel_base_email');
        if (!base) return showModal("Peringatan", "Silakan setting Base Email (Edit) terlebih dahulu.", "alert");

        let endCount = parseInt(localStorage.getItem('xurel_email_end') || 100);
        let startCount = parseInt(localStorage.getItem('xurel_email_start') || 1);
        
        let indexStr = localStorage.getItem('xurel_email_index');
        let index = indexStr ? parseInt(indexStr) : (startCount - 1);

        if (direction === 1) { 
            if (index >= endCount) return showModal("Batas Maksimal", `Batas akhir count email (${endCount}) telah tercapai!`, "alert");
            index++;
        } else if (direction === -1) { 
            if (index <= startCount) return showModal("Batas Awal", `Anda sudah berada di batas awal email (${startCount})!`, "alert");
            index--;
        }

        localStorage.setItem('xurel_email_index', index.toString());
        
        const parts = base.split('@');
        let newEmail = parts.length === 2 ? `${parts[0]}${index}@${parts[1]}` : `${base}${index}`;
        
        // Menggunakan API Clipboard Diam-Diam
        silentCopyToClipboard(newEmail);
        
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
});

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
            const snap = await db.ref('ip_logs').once('value');
            if (snap.exists()) {
                snap.forEach(child => {
                    if (now - child.val().timestamp > 7 * 24 * 60 * 60 * 1000) db.ref('ip_logs/'+child.key).remove();
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
        await db.ref('ip_logs').push({ ip: currentFetchedIP, timestamp: Date.now() });
        ipInput.value = `${currentFetchedIP} - TERCATAT`;
        ipInput.style.color = "var(--fb-blue)"; 
        setTimeout(() => { btnSave.style.display = "none"; btnSave.disabled = false; btnSave.innerHTML = '<i class="fa-solid fa-floppy-disk"></i>'; }, 1000);
    } catch(e) {
        showModal("Gagal", "Gagal menyimpan. Pastikan Anda sudah Login Admin.", "alert");
        btnSave.disabled = false; btnSave.innerHTML = '<i class="fa-solid fa-floppy-disk"></i>';
    }
};

// ==========================================
// KONTROL LOGIN & MENU
// ==========================================
auth.onAuthStateChanged(user => {
    const isAdmin = !!user;
    const loginForm = document.getElementById('login-form');
    const logoutForm = document.getElementById('logout-form');
    
    if(loginForm && logoutForm) {
        loginForm.classList.toggle('hidden', isAdmin);
        logoutForm.classList.toggle('hidden', !isAdmin);
    }
    window.dispatchEvent(new CustomEvent('authStateChanged', { detail: user }));
});

document.addEventListener('click', function(e) {
    const popup = document.getElementById('main-menu-popup');
    const btn = document.querySelector('.menu-btn');
    if(popup && popup.classList.contains('active') && !popup.contains(e.target) && !btn.contains(e.target)) {
        popup.classList.remove('active');
    }
});

// override bawaan agar bisa menggunakan efek toggle class active
window.toggleMainMenu = function() {
    const popup = document.getElementById("main-menu-popup");
    if(popup) {
        if(popup.style.display === "block" || popup.classList.contains('active')) {
            popup.style.display = "none";
            popup.classList.remove('active');
        } else {
            popup.style.display = "block";
            popup.classList.add('active');
        }
    }
};

// ==========================================
// AUTO-KAPITAL JUDUL LINK SHOPEE
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const checkForm = setInterval(() => {
        const shopeeTitleInput = document.getElementById('shopee-title');
        if (shopeeTitleInput) {
            shopeeTitleInput.addEventListener('input', function() {
                this.value = this.value.replace(/\b\w/g, char => char.toUpperCase());
            });
            clearInterval(checkForm); 
        }
    }, 500);
});

// ==========================================
// FITUR: CATATAN CLOUD OTOMATIS
// ==========================================
let cloudNoteTimeout;

// Hapus secara diam-diam tanpa konfirmasi pop-up
window.clearCloudNote = function() {
    const cloudInput = document.getElementById('cloud-quick-note');
    const statusText = document.getElementById('cloud-note-status');
    
    cloudInput.value = "";
    statusText.innerText = "Menghapus...";
    
    db.ref('admin_settings/cloud_quick_note').remove()
        .then(() => {
            statusText.innerText = "Dihapus ✓";
            setTimeout(() => { statusText.innerText = ""; }, 2000);
        })
        .catch(err => {
            console.error("Gagal menghapus:", err);
            statusText.innerText = "Gagal menghapus!";
        });
};

// Salin secara diam-diam
window.copyCloudNote = function() {
    const cloudInput = document.getElementById('cloud-quick-note');
    const statusText = document.getElementById('cloud-note-status');
    
    if (cloudInput && cloudInput.value) {
        silentCopyToClipboard(cloudInput.value);
        statusText.innerText = "Disalin ✓";
        setTimeout(() => { statusText.innerText = ""; }, 2000);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const cloudInput = document.getElementById('cloud-quick-note');
    const statusText = document.getElementById('cloud-note-status');

    if(cloudInput) {
        // Sinkronisasi realtime dari Firebase
        db.ref('admin_settings/cloud_quick_note').on('value', (snapshot) => {
            if (snapshot.exists()) {
                cloudInput.value = snapshot.val();
            } else {
                cloudInput.value = "";
            }
        });

        // Simpan otomatis saat mengetik dengan Debounce (Jeda)
        cloudInput.addEventListener('input', function() {
            statusText.innerText = "Mengetik...";
            
            clearTimeout(cloudNoteTimeout);
            cloudNoteTimeout = setTimeout(() => {
                statusText.innerText = "Menyimpan ke awan...";
                
                db.ref('admin_settings/cloud_quick_note').set(this.value.trim())
                    .then(() => {
                        statusText.innerText = "Tersimpan ✓";
                        setTimeout(() => { statusText.innerText = ""; }, 2000);
                    })
                    .catch(err => {
                        console.error("Gagal menyimpan:", err);
                        statusText.innerText = "Gagal menyimpan!";
                    });
            }, 800); // 800ms jeda setelah berhenti mengetik
        });
    }
});
