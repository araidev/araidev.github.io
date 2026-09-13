import { db } from './firebase.js';
import { showModal } from './ui.js';

let trashCache = {};

export function initTools() {
    db.ref('shopee_trash').on('value', snap => {
        trashCache = snap.val() || {};
        renderTrash();
    });
}

function renderTrash() {
    const container = document.getElementById('tools-container');
    const btnPengingat = document.getElementById('tab-btn-tools');
    if (!container) return;
    
    container.innerHTML = "";
    const now = Date.now();
    let hasExpired = false;
    const keys = Object.keys(trashCache);
    
    if (keys.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; color: var(--fb-muted); padding: 30px;">
                <i class="fa-solid fa-box-open" style="font-size: 40px; margin-bottom: 10px;"></i>
                <p>Belum ada kartu Shopee yang dihapus.</p>
            </div>
        `;
        if(btnPengingat) btnPengingat.classList.remove('red-dot');
        return;
    }

    keys.sort((a, b) => (trashCache[b].deletedAt || 0) - (trashCache[a].deletedAt || 0));

    keys.forEach(k => {
        const data = trashCache[k];
        const isExpired = (now - data.deletedAt) > 86400000; 
        if (isExpired) hasExpired = true;

        const bg = isExpired ? '#ffebee' : '#fff';
        const border = isExpired ? 'border:1px solid #e41e3f;' : 'border:1px solid #e4e6eb;';
        
        const wrapper = document.createElement('div');
        wrapper.style.cssText = `display:flex; align-items:center; background:${bg}; ${border} border-radius:10px; padding:12px; margin-bottom:10px; box-shadow:0 2px 4px rgba(0,0,0,0.02); flex-shrink:0;`;

        let pr = data.price ? `<span style="background:#e7f3ff; color:#1877f2; padding:3px 6px; border-radius:4px; font-size:10px; font-weight:800;">${data.price}</span>` : '';
        let dsc = data.desc ? `<span style="background:rgba(0,0,0,0.05); color:#65676b; padding:3px 6px; border-radius:4px; font-size:10px; font-weight:700;">${data.desc}</span>` : '';
        let tagsHTML = (dsc || pr) ? `<div style="display:flex; gap:6px; margin-top:5px; flex-wrap:wrap;">${dsc}${pr}</div>` : '';

        let delDate = new Date(data.deletedAt).toLocaleString('id-ID', {day: 'numeric', month: 'short', hour: '2-digit', minute:'2-digit'});

        wrapper.innerHTML = `
            <div style="flex:1; overflow:hidden;">
                <div style="font-weight:800; color:#1c1e21; font-size:14px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                    <i class="fa-solid fa-clock-rotate-left" style="color:#8a8d91; margin-right:5px; font-size:12px;"></i> ${data.title}
                </div>
                ${tagsHTML}
                <div style="font-size:9px; color:${isExpired ? '#e41e3f' : '#8a8d91'}; font-weight:bold; margin-top:6px;">
                    Dihapus: ${delDate} ${isExpired ? '(> 24 Jam)' : ''}
                </div>
            </div>
            
            <div style="display:flex; margin-left:10px;">
                <button onclick="deleteTrashPermanent('${k}')" style="background:#fce8e6; border:none; color:#e41e3f; cursor:pointer; width:36px; height:36px; border-radius:6px; display:flex; align-items:center; justify-content:center;" title="Hapus Permanen">
                    <i class="fa-solid fa-trash" style="font-size:14px;"></i>
                </button>
            </div>
        `;
        container.appendChild(wrapper);
    });

    if(btnPengingat) {
        if(hasExpired) btnPengingat.classList.add('red-dot');
        else btnPengingat.classList.remove('red-dot');
    }
}

window.deleteTrashPermanent = async function(key) {
    if(await showModal("Hapus Permanen", "Yakin ingin menghapus kartu ini secara permanen dari database?", "danger")) {
        db.ref('shopee_trash/'+key).remove();
    }
};
