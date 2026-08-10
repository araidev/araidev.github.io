// ==========================================
// LOGIKA SIDEBAR KIRI & AKSI SWAP (SWIPE)
// ==========================================
window.toggleSidebar = function() {
    const sidebar = document.getElementById('left-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    
    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
    
    // Kunci scroll utama saat sidebar terbuka agar background tidak ikut ter-scroll
    if (sidebar.classList.contains('active')) {
        document.body.style.overflow = 'hidden';
    } else {
        document.body.style.overflow = '';
    }
};

// Deteksi Swap (Geser) Layar untuk Membuka/Menutup
let touchstartX = 0;
let touchendX = 0;

document.addEventListener('touchstart', e => {
    touchstartX = e.changedTouches[0].screenX;
}, {passive: true});

document.addEventListener('touchend', e => {
    touchendX = e.changedTouches[0].screenX;
    handleSwipe();
}, {passive: true});

function handleSwipe() {
    const sidebar = document.getElementById('left-sidebar');
    if (!sidebar) return;
    
    const isOpen = sidebar.classList.contains('active');
    const swipeDistance = touchendX - touchstartX;
    
    // Swipe dari ujung kiri layar ke kanan untuk MEMBUKA panel (> 60px dan harus dimulai dari bibir layar)
    if (swipeDistance > 60 && !isOpen && touchstartX < 40) {
        window.toggleSidebar();
    }
    
    // Swipe ke arah kiri untuk MENUTUP panel (< -60px)
    if (swipeDistance < -60 && isOpen) {
        window.toggleSidebar();
    }
}
