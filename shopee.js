import { db } from './firebase.js';
import { showModal, closeModal } from './ui.js';

let shopeeDataCache = {}; 
let userAdmin = null;

window.addEventListener('authStateChanged', (e) => { 
    userAdmin = e.detail; 
});

db.ref('linkshopee').on('value', snap => { 
    shopeeDataCache = snap.val() || {}; 
});

export function formatRupiah(el) {
    let angka = el.value.replace(/[^,\d]/g, '').toString(); let split = angka.split(','); let sisa = split[0].length % 3;
    let rupiah = split[0].substr(0, sisa); let ribuan = split[0].substr(sisa).match(/\d{3}/gi);
    if (ribuan) { rupiah += (sisa ? '.' : '') + ribuan.join('.'); }
    el.value = rupiah ? 'Rp ' + rupiah : '';
}

export function openShopeeModal(key = null) {
    document.getElementById('shopee-edit-key').value = key || "";
    
    if (key && shopeeDataCache[key]) {
        document.getElementById('shopee-title').value = shopeeDataCache[key].title || "";
        document.getElementById('shopee-url').value = shopeeDataCache[key].url || "";
    } else {
        document.getElementById('shopee-title').value = "";
        document.getElementById('shopee-url').value = "";
    }
    document.getElementById('modal-shopee-form').classList.add('active');
}

export function saveShopee() {
    const key = document.getElementById('shopee-edit-key').value;
    const t = document.getElementById('shopee-title').value; 
    const u = document.getElementById('shopee-url').value;
    
    if(t && u) {
        const data = { title: t, url: u };
        if (key) {
            db.ref('linkshopee/'+key).update(data).then(() => {
                closeModal('modal-shopee-form');
                showModal("Sukses", "Link berhasil diupdate.", "alert");
            });
        } else {
            db.ref('linkshopee').push(data).then(() => closeModal('modal-shopee-form'));
        }
    } else {
        showModal("Peringatan", "Nama & Link wajib diisi!", "alert");
    }
}

// Tambahkan fungsi ini di baris paling bawah shopee.js
export function openShopeeList() {
    document.getElementById('modal-shopee-list').classList.add('active');
}
