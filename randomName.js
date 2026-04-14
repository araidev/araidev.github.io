// ==========================================
// KONFIGURASI STORAGE & DATA
// ==========================================
const STORAGE_BASE_EMAIL = 'xurel_base_email';
const STORAGE_EMAIL_INDEX = 'xurel_email_index';

// Fungsi senyap untuk menyalin teks
async function copyToClipboard(text) {
    if (!text) return;
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
        } else {
            throw new Error("Fallback");
        }
    } catch (err) {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
    }
}

// Fungsi format iterasi email (aku@upil.com -> aku1@upil.com)
function formatEmail(baseEmail, index) {
    if (!baseEmail) return "";
    if (index === 0) return baseEmail;
    
    const parts = baseEmail.split('@');
    if (parts.length === 2) {
        return `${parts[0]}${index}@${parts[1]}`;
    }
    return `${baseEmail}${index}`; // Fallback jika tidak ada karakter @
}

// ==========================================
// FUNGSI UTAMA ACAK DATA PROFIL LENGKAP
// ==========================================
export async function generateName() {
    try {
        const fakerObj = window.faker;
        if(!fakerObj) {
            alert("Sistem pengacak data sedang dimuat, silakan coba lagi.");
            return;
        }
        fakerObj.locale = "id_ID";

        const hariIni = new Date().toDateString(); 
        let tanggalTersimpan = localStorage.getItem('xurel_used_date');
        let namaTerpakai = [];

        if (tanggalTersimpan !== hariIni) {
            localStorage.setItem('xurel_used_date', hariIni);
            localStorage.setItem('xurel_used_names', JSON.stringify([]));
        } else {
            const memoriNama = localStorage.getItem('xurel_used_names');
            if (memoriNama) namaTerpakai = JSON.parse(memoriNama);
        }

        let nama = "";
        let batasMaksimal = 0; 
        do {
            nama = fakerObj.name.findName();
            batasMaksimal++;
        } while (namaTerpakai.includes(nama) && batasMaksimal < 150);

        namaTerpakai.push(nama);
        localStorage.setItem('xurel_used_names', JSON.stringify(namaTerpakai));

        const prefixProvider = [
            '0811', '0812', '0813', '0821', '0822', '0852', 
            '0815', '0816', '0857', '0858',                 
            '0817', '0818', '0819', '0859', '0877', '0878', 
            '0895', '0896', '0897', '0898',                 
            '0881', '0882', '0887', '0888'                  
        ];
        const prefix = prefixProvider[Math.floor(Math.random() * prefixProvider.length)];
        const sisaDigit = Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
        const noHp = prefix + sisaDigit;
        
        const daerah = [
            { prov: "DKI JAKARTA", zip: "1", weight: 30, kota: ["JAKARTA SELATAN", "JAKARTA PUSAT", "JAKARTA BARAT", "JAKARTA TIMUR"] },
            { prov: "JAWA BARAT", zip: "4", weight: 35, kota: ["BANDUNG", "BOGOR", "BEKASI", "DEPOK", "CIREBON", "GARUT"] },
            { prov: "JAWA TENGAH", zip: "5", weight: 30, kota: ["SEMARANG", "SURAKARTA", "MAGELANG", "CILACAP", "KUDUS"] },
            { prov: "JAWA TIMUR", zip: "6", weight: 35, kota: ["SURABAYA", "MALANG", "SIDOARJO", "GRESIK", "JEMBER"] },
            { prov: "BALI", zip: "8", weight: 15, kota: ["DENPASAR", "BADUNG", "GIANYAR"] },
            { prov: "SUMATERA UTARA", zip: "2", weight: 15, kota: ["MEDAN", "BINJAI", "DELI SERDANG"] },
            { prov: "SULAWESI SELATAN", zip: "9", weight: 12, kota: ["MAKASSAR", "GOWA", "MAROS"] }
        ];

        let totalWeight = daerah.reduce((sum, item) => sum + item.weight, 0);
        let randomNum = Math.random() * totalWeight;
        let pilihDaerah = daerah[0];
        for (let d of daerah) {
            if (randomNum < d.weight) { pilihDaerah = d; break; }
            randomNum -= d.weight;
        }

        const provinsi = pilihDaerah.prov;
        const kota = pilihDaerah.kota[Math.floor(Math.random() * pilihDaerah.kota.length)];
        const kodePos = `${pilihDaerah.zip}${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;

        const jalanList = ["JL. JENDERAL SUDIRMAN", "JL. GATOT SUBROTO", "JL. AHMAD YANI", "JL. MERDEKA", "JL. DIPONEGORO", "JL. PAHLAWAN", "JL. MELATI", "JL. ANGGREK", "JL. NUSA INDAH"];
        const namaJalan = jalanList[Math.floor(Math.random() * jalanList.length)];
        const nomorRumah = Math.floor(Math.random() * 200) + 1;
        const jalan = `${namaJalan} NO. ${nomorRumah}`;
        
        const patokanList = ["Samping Masjid", "Depan Indomaret", "Sebelah SD", "Belakang Pasar", "Samping Apotek", "Pas Tikungan", "Rumah Pagar Hitam"];
        const patokanAcak = patokanList[Math.floor(Math.random() * patokanList.length)].toUpperCase();

        const hasilLengkap = `${nama}, ${noHp}, ${provinsi}, ${kota}, ${kodePos}, ${jalan} (${patokanAcak})`;
        
        // Salin DATA LENGKAP secara senyap (tanpa animasi)
        await copyToClipboard(hasilLengkap);

    } catch (err) {
        console.error("Error Detail:", err);
    }
}

// ==========================================
// EVENT LISTENERS: EMAIL INPUT, NEXT & PREV
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');
    const outputEl = document.getElementById('genNameOutput');

    // Load email terakhir saat web direfresh
    const savedBase = localStorage.getItem(STORAGE_BASE_EMAIL);
    const savedIndex = localStorage.getItem(STORAGE_EMAIL_INDEX);
    if (savedBase && outputEl) {
        outputEl.value = formatEmail(savedBase, parseInt(savedIndex || 0));
    }

    // Tangkap ketikan manual user untuk mengatur email dasar baru
    outputEl?.addEventListener('input', (e) => {
        const newVal = e.target.value.trim();
        localStorage.setItem(STORAGE_BASE_EMAIL, newVal);
        localStorage.setItem(STORAGE_EMAIL_INDEX, "0"); // Reset hitungan ke 0
    });

    // Fungsi klik NEXT (Tanpa Animasi)
    btnNext?.addEventListener('click', async () => {
        let base = localStorage.getItem(STORAGE_BASE_EMAIL);
        let index = parseInt(localStorage.getItem(STORAGE_EMAIL_INDEX) || 0);

        if (!base) return; 
        index++;
        localStorage.setItem(STORAGE_EMAIL_INDEX, index.toString());
        
        const newEmail = formatEmail(base, index);
        if (outputEl) outputEl.value = newEmail;
        await copyToClipboard(newEmail); // Salin email ke clipboard secara senyap
    });

    // Fungsi klik PREV (Tanpa Animasi)
    btnPrev?.addEventListener('click', async () => {
        let base = localStorage.getItem(STORAGE_BASE_EMAIL);
        let index = parseInt(localStorage.getItem(STORAGE_EMAIL_INDEX) || 0);

        if (!base || index <= 0) return; // Cegah index minus
        index--;
        localStorage.setItem(STORAGE_EMAIL_INDEX, index.toString());
        
        const newEmail = formatEmail(base, index);
        if (outputEl) outputEl.value = newEmail;
        await copyToClipboard(newEmail); // Salin email ke clipboard secara senyap
    });
});
