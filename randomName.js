const STORAGE_BASE_EMAIL = 'xurel_base_email';
const STORAGE_EMAIL_INDEX = 'xurel_email_index';

// === DATA KONFIGURASI DARI SCRIPT PERTAMA ===
const CONFIG = {
    JSON_URL: "./kota.json", 
    HP_PREFIX: ['0811','0812','0813','0821','0822','0852','0815','0816','0857','0858','0817','0818','0819','0859','0877','0878','0895','0896','0897','0898'],
    BIG_CITIES: ["JAKARTA", "SURABAYA", "BANDUNG", "MEDAN", "SEMARANG", "MAKASSAR", "PALEMBANG", "DENPASAR", "BOGOR", "DEPOK", "TANGERANG", "BEKASI", "SIDOARJO", "MALANG", "SURAKARTA", "YOGYAKARTA"],
    HEROES: ["Soekarno", "Hatta", "Sudirman", "Diponegoro", "Pattimura", "Imam Bonjol", "Teuku Umar", "Cut Nyak Dien", "Kartini", "Ki Hajar Dewantara", "Ahmad Yani", "Bung Tomo", "Sisingamangaraja", "Hasanuddin", "Antasari", "Agus Salim", "Hayam Wuruk", "Gajah Mada", "Raden Fatah", "Mulawarman", "Purnawarman", "Hasyim Asyari", "Wahid Hasyim", "Ahmad Dahlan", "Samanhudi", "Nuku", "Sultan Ageng Tirtayasa", "Sultan Syahrir", "Tan Malaka", "Mohammad Natsir", "Tjokroaminoto", "Sam Ratulangi", "Soetomo", "Cipto Mangunkusumo", "Dewi Sartika", "Nyi Ageng Serang", "Rasuna Said", "Fatmawati", "Yos Sudarso", "R.E. Martadinata", "Suprapto", "M.T. Haryono", "S. Parman", "D.I. Panjaitan", "Sutoyo Siswomiharjo", "Pierre Tendean", "Katamso", "Halim Perdanakusuma", "Iswahyudi", "Abdul Muis", "Ir. Juanda", "Slamet Riyadi", "Urip Sumohardjo", "Teuku Cik Ditiro", "Mahmud Badaruddin", "Raden Intan", "Sultan Thaha", "Iskandar Muda", "Teuku Nyak Arif", "Frans Kaisiepo", "Silas Papare", "Marthen Indey", "Johannes Dimara", "Opo Daeng Risaju", "Maria Walanda Maramis", "W.R. Supratman", "Ismail Marzuki", "Chairil Anwar", "Raden Saleh", "Affandi", "Zainal Mustofa", "Mas Mansyur", "Tirtayasa", "Nuruddin Ar-Raniry", "Hamzah Fansuri", "Syaikh Abdurrauf", "Syaikh Yusuf", "Syaikh Nawawi", "Ranggawarsita", "Suriyadi", "Dirgantara", "Soepeno", "Sutomo", "Suharto", "Gatot Subroto", "Veteran", "Pemuda", "Perintis Kemerdekaan", "Bahari", "Angkasa", "Bumi", "Nusantara"],
    PATOKAN: ["Dekat Pos Kamling", "Pagar Hitam", "Cat Putih Pagar Hijau", "Depan Masjid", "Samping Indomaret", "Sebelah Warung Madura", "Depan SD", "Samping Bengkel Motor", "Ada Pohon Mangga di depan", "Pagar Biru", "Dekat Lapangan Voli", "Samping Bidan Desa", "Pintu Gerbang Coklat", "Dekat Gardu Listrik", "Depan Konter Pulsa", "Samping Cucian Motor", "Cat Rumah Kuning", "Pagar Kayu", "Sebelah Warung Kopi", "Depan TK", "Dekat Puskesmas", "Samping Toko Bangunan", "Pagar Stainless", "Depan Warung Makan", "Dekat Pertamini", "Ada Pohon Rambutan", "Cat Rumah Hijau", "Samping Alfamart", "Depan Apotek", "Dekat Jembatan", "Pagar Merah", "Samping Warnet", "Depan Fotokopi", "Dekat Kantor Desa", "Samping Kios Sayur", "Cat Rumah Abu-abu", "Pagar Bata Expose", "Sebelah Rumah Pak RT", "Depan Klinik", "Dekat Perempatan", "Samping Tukang Jahit", "Ada Warung Sembako", "Cat Rumah Biru", "Pagar Bambu", "Sebelah Kios Buah", "Depan Posyandu", "Dekat Pertigaan", "Samping Toko Plastik", "Rumah Tingkat Cat Putih", "Pagar Tembok Tinggi", "Sebelah Tukang Cukur", "Depan Lapangan Futsal", "Dekat Tower Telkomsel", "Samping Toko Elektronik", "Cat Rumah Pink", "Pagar Besi Bunga", "Sebelah Kios Galon", "Depan Bakso Budi", "Dekat Balai RT", "Samping Toko Roti", "Ada Kanopi Hitam", "Pagar Hijau Tua", "Sebelah Laundry", "Depan Toko Perabot", "Dekat Pangkalan Ojek", "Samping Grosir Beras", "Rumah Cat Cream", "Pagar Kuning", "Sebelah Kios Burung", "Depan Tukang Gigi", "Dekat Gudang", "Samping Toko Besi", "Ada Spanduk Jual Pulsa", "Pagar Coklat Tua", "Sebelah Toko Cat", "Depan Warung Sate", "Dekat Gapura Masuk", "Samping Toko Obat", "Cat Rumah Orange", "Pagar Kawat Harmonika", "Sebelah Toko Kosmetik", "Depan Rumah Bidan", "Dekat Lapangan Bola", "Samping Toko Ban", "Ada Jemuran Baju", "Pagar Besi Minimalis", "Sebelah Kios Ikan", "Depan Toko Sepatu", "Dekat Pos Ronda", "Samping Toko Baju", "Cat Rumah Ungu", "Pagar Batu Alam", "Sebelah Toko Oleh-oleh", "Depan Warung Pecel", "Dekat Halte", "Samping Kios Es", "Ada Rak Kayu di Depan", "Pagar Lisplang", "Sebelah Toko Kasur", "Depan Gudang Beras"]
};

// State global untuk data wilayah
let dbWilayah = [];

// Fungsi Helper Capitalize
function toTitleCase(str) {
    if (!str) return "";
    return str.toLowerCase().replace(/(?:^|\s|-)\w/g, match => match.toUpperCase());
}

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

// Fungsi utama generate
export async function generateName() {
    try {
        // === 1. PASTIKAN DATA WILAYAH SUDAH DIMUAT (LAZY LOAD) ===
        if (dbWilayah.length === 0) {
            try {
                const response = await fetch(CONFIG.JSON_URL);
                if (!response.ok) throw new Error("JSON tidak ditemukan");
                const data = await response.json();
                
                let flatData = [];
                for (const prov in data) {
                    if (prov.toUpperCase().includes("PAPUA")) continue; 
                    for (const kota in data[prov]) {
                        for (const kec in data[prov][kota]) {
                            for (const desa in data[prov][kota][kec]) {
                                flatData.push({ provinsi: prov, kota: kota, kecamatan: kec, desa: desa, kodepos: data[prov][kota][kec][desa] });
                            }
                        }
                    }
                }
                dbWilayah = flatData;
            } catch (e) {
                console.error("Gagal memuat kota.json, menggunakan data fallback:", e);
                dbWilayah = [{ provinsi: "Jawa Timur", kota: "Surabaya", kecamatan: "Krembangan", desa: "Kemayoran", kodepos: "60111" }];
            }
        }

        const fakerObj = window.faker;
        if(!fakerObj) {
            alert("Faker.js gagal dimuat.");
            return;
        }
        fakerObj.locale = "id_ID";
        
        // === 2. LOGIKA ANTI-DUPLIKAT (EXPIRED 12 JAM) ===
        const TWELVE_HOURS = 12 * 60 * 60 * 1000;
        const now = Date.now();
        let rawData = JSON.parse(localStorage.getItem('xurel_used_names') || "[]");

        let namaTerpakai = rawData.filter(item => {
            if (typeof item !== 'object' || !item.timestamp) return false;
            return (now - item.timestamp) <= TWELVE_HOURS;
        });

        const daftarNamaSaja = namaTerpakai.map(item => item.name);

        let namaRaw = "";
        let batas = 0; 
        do { 
            namaRaw = fakerObj.name.findName(); 
            batas++; 
        } while (daftarNamaSaja.includes(namaRaw) && batas < 150);
        
        namaTerpakai.push({ name: namaRaw, timestamp: now });
        localStorage.setItem('xurel_used_names', JSON.stringify(namaTerpakai));

        // === 3. LOGIKA PENGACAKAN DATA LENGKAP (DARI SCRIPT PERTAMA) ===
        
        // Acak No HP
        const prx = CONFIG.HP_PREFIX[Math.floor(Math.random() * CONFIG.HP_PREFIX.length)];
        const noHp = prx + Math.floor(Math.random() * 100000000).toString().padStart(8, '0');

        // Acak Wilayah (30% Kota Besar, 70% Kota Kecil/Kabupaten)
        let wTarget = [];
        if(Math.random() < 0.30) {
            wTarget = dbWilayah.filter(w => CONFIG.BIG_CITIES.some(kb => (w.kota||"").toUpperCase().includes(kb)));
            if(wTarget.length === 0) wTarget = dbWilayah;
        } else {
            wTarget = dbWilayah.filter(w => !CONFIG.BIG_CITIES.some(kb => (w.kota||"").toUpperCase().includes(kb)));
            if(wTarget.length === 0) wTarget = dbWilayah;
        }
        const dataW = wTarget[Math.floor(Math.random() * wTarget.length)];

        // Acak Nama Jalan (50% Nama Pahlawan, 50% Nama Desa asli JSON)
        let jalanRaw = "";
        if(Math.random() < 0.5) {
            const hero = CONFIG.HEROES[Math.floor(Math.random() * CONFIG.HEROES.length)];
            jalanRaw = `Jl. ${hero} No. ${Math.floor(Math.random()*150)+1}`;
        } else {
            jalanRaw = dataW.jalan ? dataW.jalan : `Desa ${dataW.desa || dataW.kecamatan}`;
        }

        // Acak Patokan (Probabilitas 40% muncul)
        let patokan = "";
        if (Math.random() < 0.4) {
            patokan = ` (${CONFIG.PATOKAN[Math.floor(Math.random() * CONFIG.PATOKAN.length)]})`;
        }

        // Finalisasi & Merapikan Teks (Title Case)
        const nama = toTitleCase(namaRaw);
        const prov = toTitleCase(dataW.provinsi || "");
        const kota = toTitleCase(dataW.kota || "").replace(/,\s*Kabupaten/gi, "").replace(/Kota Adm\.\s*/gi, "").replace(/Kota\s+/gi, "").replace(/Kabupaten\s+/gi, "Kab. ");
        const kec = toTitleCase(dataW.kecamatan || "");
        const jalan = toTitleCase(jalanRaw).replace(/Jl\./gi, "Jl.").replace(/No\./gi, "No.") + patokan; 

        // Gabungkan seluruh data
        const hasilLengkap = `${nama}, ${noHp}, ${prov}, ${kota}, ${dataW.kodepos || "60111"}, ${jalan}, Kec. ${kec}`;
        
        // Eksekusi Copy & Ubah UI Tombol
        await copyToClipboard(hasilLengkap);
        
        const btnGen = document.getElementById('btn-gen');
        if(btnGen) {
            const old = btnGen.innerHTML;
            btnGen.innerHTML = '<i class="fa-solid fa-check"></i> Disalin';
            setTimeout(() => { btnGen.innerHTML = old; }, 1000);
        }
    } catch (err) { 
        console.error(err); 
    }
}
