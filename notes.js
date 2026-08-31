function syncNotes() {
    const path = getNotesPath(); 
    db.ref(path).off();
    db.ref(path).orderByChild('timestamp').on('value', snap => {
        statsData.total = snap.numChildren();
        updateStatsUI();
        
        const grid = document.getElementById('notes-grid'); 
        if(!grid) return;
        
        grid.style.display = 'flex';
        grid.style.flexDirection = 'column';
        grid.style.gap = '8px'; 
        grid.style.overscrollBehavior = 'contain'; 
        grid.innerHTML = ''; 
        
        let items = [];
        snap.forEach(child => { items.push({ key: child.key, ...child.val() }); });
        
        // 1. Siapkan daftar warna untuk border tepi
        const borderColors = ['#1877F2', '#2ECC71', '#E74C3C', '#F1C40F', '#9B59B6', '#E67E22'];

        items.reverse().forEach((d, index) => {
            const card = document.createElement('div'); 
            card.className = 'note-card'; 
            
            // 2. Pilih warna secara bergantian berdasarkan index
            const cardColor = borderColors[index % borderColors.length];
            
            card.style.cssText = `
                background: #ffffff;
                border: 1px solid #cdd0d4; 
                border-left: 5px solid ${cardColor}; /* Border warna-warni di sisi kiri */
                border-radius: 6px;
                padding: 10px;
                display: flex;
                flex-direction: column;
                cursor: pointer;
                box-shadow: 0 1px 2px rgba(0,0,0,0.04);
                transition: transform 0.2s ease, box-shadow 0.2s ease;
                height: 100px; 
                flex-shrink: 0;
            `;

            // Modifikasi sedikit event hover agar tidak menimpa border warna-warni
            card.onmouseover = () => {
                card.style.transform = 'translateY(-2px)';
                card.style.boxShadow = '0 4px 8px rgba(0,0,0,0.08)';
                card.style.borderTopColor = '#aeb1b5'; 
                card.style.borderRightColor = '#aeb1b5';
                card.style.borderBottomColor = '#aeb1b5';
            };
            card.onmouseout = () => {
                card.style.transform = 'translateY(0)';
                card.style.boxShadow = '0 1px 2px rgba(0,0,0,0.04)';
                card.style.borderTopColor = '#cdd0d4'; 
                card.style.borderRightColor = '#cdd0d4';
                card.style.borderBottomColor = '#cdd0d4';
            };

            card.onclick = () => {
                selectedNoteKey = d.key; currentNoteRaw = d.content;
                document.getElementById('view-tag').innerText = "PUB | " + formatDate(d.timestamp);
                document.getElementById('view-title').innerText = d.title;
                document.getElementById('view-content').innerHTML = autoLinkText(escapeHTML(d.content));
                document.getElementById('modal-note-view').classList.add('active');
                
                document.documentElement.style.overflow = 'hidden';
                document.body.style.overflow = 'hidden'; 
            };

            const titleStr = escapeHTML(d.title) || 'Untitled';
            const previewStr = escapeHTML(d.content);

            // 3. Modifikasi struktur HTML untuk menyelipkan tombol copy di kanan atas
            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px;">
                    <div style="font-weight: 600; color: #1c1e21; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-right: 10px;">
                        ${titleStr}
                    </div>
                    <button class="btn-copy-card" style="border: none; background: transparent; cursor: pointer; color: #65676B; padding: 2px;" title="Copy Teks">
                        <i class="far fa-copy"></i>
                    </button>
                </div>
                <div style="color: #65676B; font-size: 11px; line-height: 1.4; flex-grow: 1; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">
                    ${previewStr}
                </div>
                <div style="font-size: 9px; color: #8a8d91; text-align: right; border-top: 1px solid #e4e6eb; padding-top: 6px; margin-top: 6px;">
                    <i class="far fa-clock" style="margin-right: 3px;"></i>${formatDate(d.timestamp)}
                </div>
            `;
            
            // 4. Logika klik tombol copy
            const copyBtn = card.querySelector('.btn-copy-card');
            copyBtn.onclick = (e) => {
                e.stopPropagation(); // PENTING: Mencegah modal view terbuka saat mengklik tombol ini
                navigator.clipboard.writeText(d.content).then(() => {
                    const icon = copyBtn.querySelector('i');
                    icon.className = 'fas fa-check';
                    icon.style.color = '#2ecc71'; // Ubah warna jadi hijau saat berhasil
                    setTimeout(() => {
                        icon.className = 'far fa-copy';
                        icon.style.color = '#65676B'; // Kembalikan ke asal setelah 1.5 detik
                    }, 1500);
                });
            };

            grid.appendChild(card);
        });
    });
}
