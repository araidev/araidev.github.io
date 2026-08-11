export function showModal(title, msg, type='confirm') {
    return new Promise(resolve => {
        const ov = document.getElementById('universal-modal');
        document.getElementById('u-modal-title').innerText = title;
        document.getElementById('u-modal-msg').innerText = msg;
        const actions = document.getElementById('u-modal-actions');
        actions.innerHTML = '';
        
        // Kunci HTML dan BODY untuk HP
        document.documentElement.style.overflow = 'hidden';
        document.body.style.overflow = 'hidden';
        
        const closeThisModal = (result) => {
            ov.classList.remove('active');
            document.documentElement.style.overflow = ''; 
            document.body.style.overflow = ''; 
            
            // Bersihkan event listener agar tidak bocor saat dipanggil ulang
            ov.onclick = null; 
            resolve(result);
        };
        
        // FITUR BARU: Tutup modal (Batal) jika user mengklik area gelap (luar popup)
        ov.onclick = (e) => {
            if (e.target === ov) {
                closeThisModal(false);
            }
        };
        
        // Tambahkan 'info' ke dalam syarat agar memunculkan tombol BATAL juga
        if (type === 'confirm' || type === 'danger' || type === 'info') {
            const btnCancel = document.createElement('button');
            btnCancel.className = 'm-btn'; 
            btnCancel.style.background = 'var(--fb-hover)'; 
            btnCancel.style.color = 'var(--fb-text)';
            btnCancel.innerText = 'BATAL';
            btnCancel.onclick = () => closeThisModal(false);
            
            const btnOk = document.createElement('button');
            btnOk.className = 'm-btn ' + (type === 'danger' ? 'btn-danger' : 'btn-primary'); 
            btnOk.innerText = 'OKE';
            btnOk.onclick = () => closeThisModal(true);
            
            actions.appendChild(btnCancel);
            actions.appendChild(btnOk);
        } else {
            // Untuk type lain (seperti 'alert' peringatan link kosong), hanya muncul tombol OKE
            const btnOk = document.createElement('button');
            btnOk.className = 'm-btn btn-primary'; 
            btnOk.innerText = 'OKE';
            btnOk.onclick = () => closeThisModal(true);
            actions.appendChild(btnOk);
        }
        
        ov.classList.add('active');
    });
}

export function closeModal(id) { 
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove('active'); 
    document.documentElement.style.overflow = ''; 
    document.body.style.overflow = ''; 
}

export function toggleMainMenu() { 
    const menu = document.getElementById('main-menu-popup');
    const isActive = menu.classList.toggle('active'); 
    
    document.documentElement.style.overflow = isActive ? 'hidden' : '';
    document.body.style.overflow = isActive ? 'hidden' : '';
}
