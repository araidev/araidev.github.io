export function showModal(title, msg, type='confirm') {
    return new Promise(resolve => {
        const ov = document.getElementById('universal-modal');
        document.getElementById('u-modal-title').innerText = title;
        document.getElementById('u-modal-msg').innerText = msg;
        const actions = document.getElementById('u-modal-actions');
        actions.innerHTML = '';
        
        if (type === 'confirm' || type === 'danger') {
            const btnCancel = document.createElement('button');
            btnCancel.className = 'm-btn'; 
            btnCancel.style.background = 'var(--fb-hover)'; btnCancel.style.color = 'var(--fb-text)';
            btnCancel.innerText = 'BATAL';
            btnCancel.onclick = () => { ov.classList.remove('active'); resolve(false); };
            
            const btnOk = document.createElement('button');
            btnOk.className = 'm-btn ' + (type === 'danger' ? 'btn-danger' : 'btn-primary'); 
            btnOk.innerText = 'OKE';
            btnOk.onclick = () => { ov.classList.remove('active'); resolve(true); };
            
            actions.appendChild(btnCancel);
            actions.appendChild(btnOk);
        } else {
            const btnOk = document.createElement('button');
            btnOk.className = 'm-btn btn-primary'; 
            btnOk.innerText = 'OKE';
            btnOk.onclick = () => { ov.classList.remove('active'); resolve(true); };
            actions.appendChild(btnOk);
        }
        ov.classList.add('active');
    });
}

export function closeModal(id) { document.getElementById(id).classList.remove('active'); }
export function toggleMainMenu() { document.getElementById('main-menu-popup').classList.toggle('active'); }

export function switchApp(appId, btnElement) {
    document.querySelectorAll('.app-section').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
    
    document.getElementById('app-' + appId).classList.add('active');
    btnElement.classList.add('active');
    
    const fabNote = document.getElementById('fab-note');
    const fabShopee = document.getElementById('fab-shopee');
    
    // Logika Tombol Plus Notes
    if(fabNote) {
        fabNote.style.display = (appId === 'notes' && document.getElementById('note-lock-section').classList.contains('hidden')) ? 'flex' : 'none';
    }
    
    // Logika Tombol Plus Shopee
    if(fabShopee) {
        const isAdmin = !document.getElementById('logout-form').classList.contains('hidden');
        fabShopee.style.display = (appId === 'shopee' && isAdmin) ? 'flex' : 'none';
    }
    
    window.dispatchEvent(new CustomEvent('appSwitched', { detail: appId }));
}
