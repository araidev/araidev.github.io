const STORAGE_BASE_EMAIL = 'xurel_base_email';
const STORAGE_EMAIL_INDEX = 'xurel_email_index';

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

function formatEmail(baseEmail, index) {
    if (!baseEmail) return "";
    if (index === 0) return baseEmail;
    const parts = baseEmail.split('@');
    if (parts.length === 2) return `${parts[0]}${index}@${parts[1]}`;
    return `${baseEmail}${index}`;
}

export async function generateName() {
    try {
        const fakerObj = window.faker;
        if(!fakerObj) {
            alert("Faker.js gagal dimuat.");
            return;
        }
        fakerObj.locale = "id_ID";
        const hariIni = new Date().toDateString(); 
        let namaTerpakai = JSON.parse(localStorage.getItem('xurel_used_names') || "[]");

        if (localStorage.getItem('xurel_used_date') !== hariIni) {
            localStorage.setItem('xurel_used_date', hariIni);
            namaTerpakai = [];
        }

        let nama = "";
        let batas = 0; 
        do { nama = fakerObj.name.findName(); batas++; } while (namaTerpakai.includes(nama) && batas < 150);
        namaTerpakai.push(nama);
        localStorage.setItem('xurel_used_names', JSON.stringify(namaTerpakai));

        const prefixProvider = ['0811', '0812', '0813', '0821', '0822', '0852', '0815', '0857', '0817', '0896', '0881'];
        const prefix = prefixProvider[Math.floor(Math.random() * prefixProvider.length)];
        const noHp = prefix + Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
        
        const daerah = [{ prov: "DKI JAKARTA", zip: "1", weight: 30, kota: ["JAKARTA SELATAN"] }, { prov: "JAWA BARAT", zip: "4", weight: 35, kota: ["BANDUNG"] }];
        let pilihDaerah = daerah[Math.floor(Math.random() * daerah.length)];

        const hasilLengkap = `${nama}, ${noHp}, ${pilihDaerah.prov}, ${pilihDaerah.kota[0]}, ${pilihDaerah.zip}${Math.floor(Math.random()*9000)+1000}, JL. MERDEKA NO. ${Math.floor(Math.random()*100)+1} (SAMPING MASJID)`;
        await copyToClipboard(hasilLengkap);
        
        const btnGen = document.getElementById('btn-gen');
        if(btnGen) {
            const old = btnGen.innerHTML;
            btnGen.innerHTML = '<i class="fa-solid fa-check"></i> Disalin';
            setTimeout(() => { btnGen.innerHTML = old; }, 1000);
        }
    } catch (err) { console.error(err); }
}
