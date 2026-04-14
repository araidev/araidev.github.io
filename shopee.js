import { db } from './firebase.js';
import { showModal, closeModal } from './ui.js';

let shopeeDataCache = {}; 
let userAdmin = null;

window.addEventListener('authStateChanged', (e) => { 
    userAdmin = e.detail; 
    renderShopee(); 
});

db.ref('linkshopee').on('value', snap => { 
    shopeeDataCache = snap.val() || {}; 
    renderShopee(); 
});

export function formatRupiah(el) {
    let angka = el.value.replace(/[^,\d]/g, '').toString(); let split = angka.split(','); let sisa = split[0].length % 3;
    let rupiah = split[0].substr(0, sisa); let ribuan = split[0].substr(sisa).match(/\d{3}/gi);
    if (ribuan) { rupiah += (sisa ? '.' : '') + ribuan.join('.'); }
    el.value = rupiah ? 'Rp ' + rupiah : '';
}

export function openShopeeModal(key = null) {
    document.getElementById('shopee-edit-key').value = key || "";
    
    const urlInput = document.getElementById('shopee-url');
    const priceInput = document.getElementById('shopee-price');
    const statusSelect = document.getElementById('shopee-status');
    const modalTitle = document.getElementById('modal-shopee-title');

    // Reset tampilan default
    priceInput.style.display = "block";
    statusSelect.style.display = "block";
    urlInput.style.height = "60px"; 
    urlInput.style.textAlign = "left"; 
    urlInput.placeholder = "URL Link";

    if (key === 'ID_RANDOM_LOCKED') {
        modalTitle.innerText = "Edit Daftar Link Acak";
        priceInput.style.display = "none";
        statusSelect.style.display = "none";
        
        // Kolom input dibuat sangat panjang & kursor di pojok kiri atas
        urlInput.style.height = "300px"; 
        urlInput.placeholder = ""; // Hilangkan semua keterangan
    } else {
        modalTitle.innerText = key ? "Edit Link Shopee" : "Tambah Link Shopee";
    }

    if (key && shopeeDataCache[key]) {
        document.getElementById('shopee-title').value = shopeeDataCache[key].title || "";
        document.getElementById('shopee-url').value = shopeeDataCache[key].url || "";
        document.getElementById('shopee-price').value = shopeeDataCache[key].price || "";
        document.getElementById('shopee-status').value = shopeeDataCache[key].status || "";
    } else {
        document.getElementById('shopee-title').value = "";
        document.getElementById('shopee-url').value = "";
        document.getElementById('shopee-price').value = "";
        document.getElementById('shopee-status').value = "";
    }
    document.getElementById('modal-shopee-form').classList.add('active');
}

export function saveShopee() {
    const key = document.getElementById('shopee-edit-key').value;
    const t = document.getElementById('shopee-title').value; 
    const u = document.getElementById('shopee-url').value;
    const p = document.getElementById('shopee-price').value; 
    const s = document.getElementById('shopee-status').value;
    
    if(t && u) {
        const data = { title: t, url: u, price: p, status: s };
        if (key) {
            db.ref('linkshopee/'+key).update(data).then(() => closeModal('modal-shopee-form'));
        } else {
            db.ref('linkshopee').push(data).then(() => closeModal('modal-shopee-form'));
        }
    } else {
        showModal("Peringatan", "Nama & Link wajib diisi!", "alert");
    }
}

export async function deleteShopee(key) { 
    if(await showModal("Hapus Link", "Yakin ingin menghapus link ini?", "danger")) {
        db.ref('linkshopee/'+key).remove(); 
    }
}

function renderShopee() {
    const container = document.getElementById('shopee-container'); 
    container.innerHTML = "";
    const colors = ['#e41e3f', '#1877f2', '#8e44ad', '#f39c12', '#2ecc71', '#1abc9c', '#d35400'];
    const isAdmin = !!userAdmin;

    // --- 1. KARTU MENU ACAK (LOCKED) DI PALING ATAS ---
    let randomCardData = shopeeDataCache['ID_RANDOM_LOCKED'];
    
    if (randomCardData || isAdmin) {
        const wrapRandom = document.createElement('div');
        wrapRandom.className = 'shopee-item-wrapper'; 
        wrapRandom.style.background = 'linear-gradient(135deg, #1e272e, #2f3640)'; 
        wrapRandom.style.border = '1px solid #f1c40f'; 

        if (randomCardData) {
            let adminBtns = isAdmin ? `
            <div class="admin-controls">
                <button class="btn-ctrl" onclick="openShopeeModal('ID_RANDOM_LOCKED')" title="Edit"><i class="fa-solid fa-pen"></i></button>
            </div>` : '';

            wrapRandom.innerHTML = `
                <div class="shopee-copy-btn" onclick="actionRandomLink(event, 'ID_RANDOM_LOCKED', 'copy', this)" title="Salin 1 Link Acak">
                    <i class="fa-solid fa-copy"></i>
                </div>
                <div class="shopee-item" onclick="actionRandomLink(event, 'ID_RANDOM_LOCKED', 'open')" style="cursor:pointer;">
                    <span><i class="fa-solid fa-lock" style="color:#f1c40f; margin-right:8px;"></i> ${randomCardData.title}</span>
                </div>
                ${adminBtns}
            `;
        } else {
            wrapRandom.innerHTML = `
                <div class="shopee-item" style="justify-content:center; cursor:pointer;" onclick="openShopeeModal('ID_RANDOM_LOCKED')">
                    <span style="color:#f1c40f;"><i class="fa-solid fa-plus"></i> Setup Kartu Acak</span>
                </div>
            `;
        }
        container.appendChild(wrapRandom);
    }

    // --- 2. LINK REGULER ---
    let orderedShopee = Object.keys(shopeeDataCache)
        .filter(k => k !== 'ID_RANDOM_LOCKED')
        .map(k => ({ key: k, ...shopeeDataCache[k] }));
        
    orderedShopee.sort((a, b) => b.key.localeCompare(a.key));

    orderedShopee.forEach((data, idx) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'shopee-item-wrapper'; 
        wrapper.style.background = colors[idx % colors.length];
        
        let st = data.status ? `<span class="badge-status">${data.status}</span>` : ''; 
        let pr = data.price ? `<span class="badge-status">${data.price}</span>` : '';
        
        let adminBtns = isAdmin ? `
            <div class="admin-controls">
                <button class="btn-ctrl" onclick="openShopeeModal('${data.key}')"><i class="fa-solid fa-pen"></i></button>
                <button class="btn-ctrl" style="color:var(--fb-red)" onclick="deleteShopee('${data.key}')"><i class="fa-solid fa-trash"></i></button>
            </div>` : '';

        wrapper.innerHTML = `
            <div class="shopee-copy-btn" onclick="copyShopeeLink(event, '${data.url}', this)"><i class="fa-solid fa-copy"></i></div>
            <a href="${data.url}" target="_blank" class="shopee-item">
                <span>${data.title}</span><div class="shopee-details">${st}${pr}</div>
            </a>
            ${adminBtns}
        `;
        container.appendChild(wrapper);
    });
}

export function copyShopeeLink(event, url, btnElement) {
    event.preventDefault(); event.stopPropagation();
    navigator.clipboard.writeText(url).then(() => {
        const originalIcon = btnElement.innerHTML; btnElement.innerHTML = '<i class="fa-solid fa-check" style="color:var(--fb-green);"></i>';
        setTimeout(() => { btnElement.innerHTML = originalIcon; }, 1500);
    });
}
export function actionRandomLink(event, key, action = 'open', btnElement = null) {
    event.preventDefault(); event.stopPropagation();
    
    let cardData = shopeeDataCache[key];
    if(!cardData || !cardData.url) return;

    // Pemisah menggunakan ENTER
    let links = cardData.url.split('\n').map(l => l.trim()).filter(l => l.startsWith('http'));

    if(links.length === 0) {
        return showModal("Peringatan", "Belum ada link valid yang dimasukkan.", "alert");
    }

    let randomLink = links[Math.floor(Math.random() * links.length)];

    if (action === 'copy' && btnElement) {
        navigator.clipboard.writeText(randomLink).then(() => {
            const originalIcon = btnElement.innerHTML; 
            btnElement.innerHTML = '<i class="fa-solid fa-check" style="color:var(--fb-green);"></i>';
            setTimeout(() => { btnElement.innerHTML = originalIcon; }, 1500);
        });
    } else {
        // Menggunakan window.open sesuai permintaan Anda
        window.open(randomLink, '_blank');
    }
}
