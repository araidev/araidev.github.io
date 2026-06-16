export function showModal(title, msg, type='confirm') {
    return new Promise(resolve => {
        const ov = document.getElementById('universal-modal');
        document.getElementById('u-modal-title').innerText = title;
        document.getElementById('u-modal-msg').innerText = msg;
        const actions = document.getElementById('u-modal-actions');
        actions.innerHTML = '';
        
        // Kunci background agar tidak ikut ter-scroll saat modal konfirmasi muncul
        document.body.style.overflow = 'hidden';
        
        // Fungsi bantuan agar tidak menulis ulang kode penutup modal
        const closeThisModal = (result) => {
            ov.classList.remove('active');
            document.body.style.overflow = ''; // Buka kembali kunci scroll
            resolve(result);
        };
        
        if (type === 'confirm' || type === 'danger') {
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
    document.getElementById(id).classList.remove('active'); 
    
    // Pastikan background bisa di-scroll kembali setelah modal apa pun ditutup
    document.body.style.overflow = ''; 
}

export function toggleMainMenu() { 
    const menu = document.getElementById('main-menu-popup');
    const isActive = menu.classList.toggle('active'); 
    
    // Jika menu aktif, kunci scroll. Jika tertutup, buka kembali.
    document.body.style.overflow = isActive ? 'hidden' : '';
}
