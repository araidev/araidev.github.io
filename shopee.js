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
    let angka = el.value.replace(/[^,\d]/g, '').toString(); 
    let split = angka.split(','); 
    let sisa = split[0].length % 3;
    let rupiah = split[0].substr(0, sisa); 
    let ribuan = split[0].substr(sisa).match(/\d{3}/gi);
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

    if (key === 'ID_RANDOM_LOCKED') {
        modalTitle.innerText = "Edit Daftar Link Acak";
        priceInput.style.display = "none";
        statusSelect.style.display = "none";
        urlInput.style.height = "300px"; 
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
    if(await showModal("Hapus Link", "Yakin hapus?", "danger")) {
        db.ref('linkshopee/'+key).remove(); 
    }
}

function renderShopee() {
    const container = document.getElementById('shopee-container'); 
    if(!container) return;
    container.innerHTML = "";
    const isAdmin = !!userAdmin;

    let randomCardData = shopeeDataCache['ID_RANDOM_LOCKED'];
    if (randomCardData || isAdmin) {
        const wrapRandom = document.createElement('div');
        wrapRandom.style.cssText = 'display:flex; align-items:center; background:#fffbf0; border:1px solid #f1c40f; border-radius:10px; padding:12px; margin-bottom:10px;';
        if (randomCardData) {
            let adminBtns = isAdmin ? `<button onclick="openShopeeModal('ID_RANDOM_LOCKED')" style="background:none; border:none; color:#d4ac0d;"><i class="fa-solid fa-pen"></i></button>` : '';
            wrapRandom.innerHTML = `
                <button onclick="actionRandomLink(event, 'ID_RANDOM_LOCKED', 'copy', this)" style="background:none; border:none; color:#d4ac0d; margin-right:10px;"><i class="fa-regular fa-copy"></i></button>
                <div onclick="actionRandomLink(event, 'ID_RANDOM_LOCKED', 'open')" style="flex:1; cursor:pointer; font-weight:800;">${randomCardData.title}</div>
                ${adminBtns}`;
        } else {
            wrapRandom.innerHTML = `<div onclick="openShopeeModal('ID_RANDOM_LOCKED')" style="flex:1; text-align:center; color:#d4ac0d;">Setup Link Acak</div>`;
        }
        container.appendChild(wrapRandom);
    }

    Object.keys(shopeeDataCache).filter(k => k !== 'ID_RANDOM_LOCKED').forEach(key => {
        const data = shopeeDataCache[key];
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'display:flex; align-items:center; background:#fff; border:1px solid #e4e6eb; border-radius:10px; padding:12px; margin-bottom:10px;';
        wrapper.innerHTML = `
            <button onclick="copyShopeeLink(event, '${data.url}', this)" style="background:none; border:none; margin-right:10px;"><i class="fa-regular fa-copy"></i></button>
            <div onclick="window.open('${data.url}', '_blank')" style="flex:1; cursor:pointer;">${data.title}</div>`;
        container.appendChild(wrapper);
    });
}

export function copyShopeeLink(event, url, btn) {
    event.stopPropagation();
    navigator.clipboard.writeText(url).then(() => {
        const old = btn.innerHTML; btn.innerHTML = '<i class="fa-solid fa-check"></i>';
        setTimeout(() => btn.innerHTML = old, 1500);
    });
}

export function actionRandomLink(event, key, action, btn) {
    event.stopPropagation();
    const data = shopeeDataCache[key];
    if(!data || !data.url) return;
    const links = data.url.split('\n').filter(l => l.trim().startsWith('http'));
    if(links.length === 0) return;
    const randomLink = links[Math.floor(Math.random() * links.length)];
    if(action === 'copy') {
        navigator.clipboard.writeText(randomLink).then(() => {
            const old = btn.innerHTML; btn.innerHTML = '<i class="fa-solid fa-check"></i>';
            setTimeout(() => btn.innerHTML = old, 1500);
        });
    } else { window.open(randomLink, '_blank'); }
}

export function openShopeeList() {
    document.getElementById('modal-shopee-list').classList.add('active');
}
