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

    priceInput.style.display = "block";
    statusSelect.style.display = "block";
    urlInput.style.height = "60px"; 
    urlInput.style.textAlign = "left"; 
    urlInput.placeholder = "URL Link";

    if (key === 'ID_RANDOM_LOCKED') {
        modalTitle.innerText = "Edit Daftar Link Acak";
        priceInput.style.display = "none";
        statusSelect.style.display = "none";
        urlInput.style.height = "300px"; 
        urlInput.placeholder = ""; 
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
    if(!container) return;
    
    container.innerHTML = "";
    const isAdmin = !!userAdmin;

    // --- 1. KARTU MENU ACAK (LOCKED) ---
    let randomCardData = shopeeDataCache['ID_RANDOM_LOCKED'];
    
    if (randomCardData || isAdmin) {
        const wrapRandom = document.createElement('div');
        // Desain Kartu Khusus Acak (Minimalis Elegan dengan Aksen Emas)
        wrapRandom.style.cssText = 'display:flex; align-items:center; background:#fffbf0; border:1px solid #f1c40f; border-radius:10px; padding:12px; margin-bottom:10px; box-shadow:0 2px 4px rgba(0,0,0,0.02); transition:all 0.2s;';

        if (randomCardData) {
            let adminBtns = isAdmin ? `
            <div style="display:flex; margin-left:10px;">
                <button onclick="openShopeeModal('ID_RANDOM_LOCKED')" style="background:#fef5d9; border:none; color:#d4ac0d; cursor:pointer; width:32px; height:32px; border-radius:6px; display:flex; align-items:center; justify-content:center;" title="Edit"><i class="fa-solid fa-pen" style="font-size:12px;"></i></button>
            </div>` : '';

            wrapRandom.innerHTML = `
                <button onclick="actionRandomLink(event, 'ID_RANDOM_LOCKED', 'copy', this)" style="background:#fff; border:1px solid #f1c40f; width:40px; height:40px; border-radius:8px; display:flex; align-items:center; justify-content:center; color:#d4ac0d; cursor:pointer; margin-right:12px; flex-shrink:0;" title="Salin 1 Link Acak">
                    <i class="fa-regular fa-copy"></i>
                </button>
                <div onclick="actionRandomLink(event, 'ID_RANDOM_LOCKED', 'open')" style="flex:1; cursor:pointer; overflow:hidden;">
                    <div style="font-weight:800; color:#1c1e21; font-size:14px; display:flex; align-items:center;"><i class="fa-solid fa-lock" style="color:#f1c40f; margin-right:6px; font-size:12px;"></i> ${randomCardData.title}</div>
                    <div style="font-size:11px; color:#8a8d91; margin-top:3px;">Sistem Daftar Link Acak</div>
                </div>
                ${adminBtns}
            `;
        } else {
            wrapRandom.innerHTML = `
                <div style="flex:1; cursor:pointer; text-align:center; padding:5px;" onclick="openShopeeModal('ID_RANDOM_LOCKED')">
                    <span style="color:#d4ac0d; font-weight:800;"><i class="fa-solid fa-plus"></i> Setup Kartu Link Acak</span>
                </div>
            `;
        }
        container.appendChild(wrapRandom);
    }

    // --- 2. LINK REGULER (Desain Minimalis Putih) ---
    let orderedShopee = Object.keys(shopeeDataCache)
        .filter(k => k !== 'ID_RANDOM_LOCKED')
        .map(k => ({ key: k, ...shopeeDataCache[k] }));
        
    orderedShopee.sort((a, b) => b.key.localeCompare(a.key));

    orderedShopee.forEach((data) => {
        const wrapper = document.createElement('div');
        // Desain Kartu Reguler (Putih bersih)
        wrapper.style.cssText = 'display:flex; align-items:center; background:#fff; border:1px solid #e4e6eb; border-radius:10px; padding:12px; margin-bottom:10px; box-shadow:0 2px 4px rgba(0,0,0,0.02); transition:all 0.2s;';
        
        let st = data.status ? `<span style="background:#fce8e6; color:#e41e3f; padding:3px 6px; border-radius:4px; font-size:10px; font-weight:800; letter-spacing:0.5px;">${data.status}</span>` : ''; 
        let pr = data.price ? `<span style="background:#e7f3ff; color:#1877f2; padding:3px 6px; border-radius:4px; font-size:10px; font-weight:800;">${data.price}</span>` : '';
        let tagsHTML = (st || pr) ? `<div style="display:flex; gap:6px; margin-top:5px;">${st}${pr}</div>` : '';

        let adminBtns = isAdmin ? `
            <div style="display:flex; gap:6px; margin-left:10px;">
                <button onclick="openShopeeModal('${data.key}')" style="background:#f0f2f5; border:none; color:#65676b; cursor:pointer; width:32px; height:32px; border-radius:6px; display:flex; align-items:center; justify-content:center;"><i class="fa-solid fa-pen" style="font-size:12px;"></i></button>
                <button onclick="deleteShopee('${data.key}')" style="background:#fce8e6; border:none; color:#e41e3f; cursor:pointer; width:32px; height:32px; border-radius:6px; display:flex; align-items:center; justify-content:center;"><i class="fa-solid fa-trash" style="font-size:12px;"></i></button>
            </div>` : '';

        wrapper.innerHTML = `
            <button onclick="copyShopeeLink(event, '${data.url}', this)" style="background:#f0f2f5; border:none; width:40px; height:40px; border-radius:8px; display:flex; align-items:center; justify-content:center; color:#65676b; cursor:pointer; margin-right:12px; flex-shrink:0;">
                <i class="fa-regular fa-copy"></i>
            </button>
            <div onclick="window.open('${data.url}', '_blank')" style="flex:1; cursor:pointer; overflow:hidden;">
                <div style="font-weight:800; color:#1c1e21; font-size:14px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${data.title}</div>
                ${tagsHTML}
            </div>
            ${adminBtns}
        `;
        container.appendChild(wrapper);
    });
}

export function copyShopeeLink(event, url, btnElement) {
    event.preventDefault(); event.stopPropagation();
    navigator.clipboard.writeText(url).then(() => {
        const originalIcon = btnElement.innerHTML; 
        btnElement.innerHTML = '<i class="fa-solid fa-check" style="color:var(--fb-green);"></i>';
        setTimeout(() => { btnElement.innerHTML = originalIcon; }, 1500);
    });
}

export function actionRandomLink(event, key, action = 'open', btnElement = null) {
    event.preventDefault(); event.stopPropagation();
    
    let cardData = shopeeDataCache[key];
    if(!cardData || !cardData.url) return;

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
        window.open(randomLink, '_blank');
    }
}

export function openShopeeList() {
    document.getElementById('modal-shopee-list').classList.add('active');
}
