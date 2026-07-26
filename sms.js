import { showModal } from './ui.js';
import { db } from './firebase.js'; 

// ==========================================
// IMPORT FIRESTORE (Pastikan Anda menggunakan Firebase v9+)
// Jika Anda menggunakan Realtime Database (RTDB), bagian ini perlu diubah.
// ==========================================
import { doc, setDoc, getDoc } from "firebase/firestore"; 

// ==========================================
// 1. KONFIGURASI PROVIDER & STATE
// ==========================================
const PROVIDERS = {
    "smscode": { name: "COD", url: "https://sms.aam-zip.workers.dev" },
    "herosms": { name: "HER", url: "https://hero.aam-zip.workers.dev" },
    "otpcepat": { name: "OTC", url: "https://cepat.aam-zip.workers.dev" },
    "svco": { name: "SVC", url: "https://svco.aam-zip.workers.dev" }
};

let activeProviderKey = localStorage.getItem('xurel_provider') || "smscode";
let BASE_URL = PROVIDERS[activeProviderKey].url;

let currentServerName = ""; 
let smsInitialized = false; 
let isSmsLocked = false;
let pollingInterval = null;
let timerInterval = null;
let isPolling = false;

let activeOrders = [];
let orderStates = {};

let cachedSvcoData = null; 
let cachedProductsData = []; 

// ==========================================
// FUNGSI HELPER FIREBASE (ISOLASI HP & TIMER)
// ==========================================
const fbOrderCache = {}; // Cache lokal agar tidak bolak-balik baca Firebase

async function syncToFirebase(orderId, data) {
    try {
        const orderRef = doc(db, "active_orders", String(orderId));
        await setDoc(orderRef, data, { merge: true });
        fbOrderCache[orderId] = data; // Simpan ke cache
    } catch (err) {
        console.error("Gagal sinkron ke Firebase:", err);
    }
}

async function getFromFirebase(orderId) {
    if (fbOrderCache[orderId]) return fbOrderCache[orderId];
    try {
        const orderRef = doc(db, "active_orders", String(orderId));
        const snap = await getDoc(orderRef);
        if (snap.exists()) {
            fbOrderCache[orderId] = snap.data();
            return snap.data();
        }
    } catch (err) {
        console.error("Gagal ambil dari Firebase:", err);
    }
    return null;
}

// Setup Suara Notifikasi
let audioCtx;
function playSimpleSound(type) {
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        if (type === 'otp') {
            osc.type = 'sine'; osc.frequency.setValueAtTime(1200, audioCtx.currentTime); 
            gain.gain.setValueAtTime(0.1, audioCtx.currentTime); osc.start(); osc.stop(audioCtx.currentTime + 0.15); 
        } else if (type === 'recycled') {
            osc.type = 'square'; osc.frequency.setValueAtTime(300, audioCtx.currentTime); 
            gain.gain.setValueAtTime(0.05, audioCtx.currentTime); osc.start(); osc.stop(audioCtx.currentTime + 0.2); 
        }
    } catch (e) {}
}

function tryInitSms() { if (!smsInitialized) initSms(); }
if (document.readyState === "loading") { document.addEventListener('DOMContentLoaded', tryInitSms); } else { tryInitSms(); }

function formatPrice(price) {
    if (activeProviderKey === "herosms") return `${price}`;
    if (activeProviderKey === "smsbower") return `$ ${price}`;
    if (activeProviderKey === "svco") return `${price}`; 
    return `Rp ${parseInt(price || 0).toLocaleString('id-ID')}`; 
}

function getOperatorBadge(provider, opCode, rank) {
    if ((provider === "herosms" || provider === "otpcepat" || provider === "svco" || provider === "nixpoin" || provider === "smscode") && opCode && opCode !== "any") {
        const opMap = { "telkomsel": "TL", "indosat": "ST", "axis": "XS", "three": "TR", "xl": "XL", "smartfren": "SM" };
        let initial = opMap[opCode.toLowerCase()] || opCode.substring(0, 2).toUpperCase();
        return `<span style="font-size:11px; font-family:sans-serif; font-weight:900; color:#fff; margin-left:8px; background:var(--fb-blue); padding:2px 6px; border-radius:4px; box-shadow:0 1px 2px rgba(0,0,0,0.2);">${initial}</span>`;
    } return "";
}

async function initSms() {
    smsInitialized = true;
    const selectHp = document.getElementById('sms-server');

    if (!document.getElementById('sms-provider')) {
        const provSelect = document.createElement('select');
        provSelect.id = 'sms-provider'; provSelect.className = selectHp.className;
        provSelect.style.marginRight = "10px"; provSelect.style.fontWeight = "900"; provSelect.style.color = "var(--fb-blue)";
        provSelect.onchange = changeSmsProvider;
        provSelect.innerHTML = Object.keys(PROVIDERS).map(k => `<option value="${k}">${PROVIDERS[k].name}</option>`).join('');
        provSelect.value = activeProviderKey;
        selectHp.parentNode.insertBefore(provSelect, selectHp);
    }

    isSmsLocked = localStorage.getItem('xurel_locked') === 'true';
    await loadServersList();
    applySmsLockUI(); refreshSms();

    if(pollingInterval) clearInterval(pollingInterval); if(timerInterval) clearInterval(timerInterval);
    pollingInterval = setInterval(pollSms, 5000); timerInterval = setInterval(updateSmsTimers, 1000);
}

export async function changeSmsProvider() {
    if(isSmsLocked) return;
    activeProviderKey = document.getElementById('sms-provider').value;
    BASE_URL = PROVIDERS[activeProviderKey].url;
    localStorage.setItem('xurel_provider', activeProviderKey);
    activeOrders = []; orderStates = {}; cachedSvcoData = null; cachedProductsData = [];
    document.getElementById('sms-active-orders').innerHTML = ''; 
    await loadServersList(); refreshSms();
}
window.changeSmsProvider = changeSmsProvider;

async function loadServersList() {
    const select = document.getElementById('sms-server');
    if(!select) return;
    select.innerHTML = '<option>Memuat...</option>';
    try {
        const res = await apiCall('/api/servers');
        if(res.success && res.servers) select.innerHTML = res.servers.map(k => `<option value="${k}">${k}</option>`).join('');
        else throw new Error("Kosong");
    } catch (e) {
        select.innerHTML = ["HP1", "HP2", "HP3"].map(k => `<option value="${k}">${k}</option>`).join('');
    }
    const saved = localStorage.getItem(`xurel_hp_${activeProviderKey}`);
    currentServerName = (saved && Array.from(select.options).some(o => o.value === saved)) ? saved : select.options[0].value;
    select.value = currentServerName;
}

export function changeSmsServer() {
    if(isSmsLocked) return;
    currentServerName = document.getElementById('sms-server').value;
    localStorage.setItem(`xurel_hp_${activeProviderKey}`, currentServerName);
    activeOrders = []; orderStates = {}; document.getElementById('sms-active-orders').innerHTML = ''; refreshSms();
}
window.changeSmsServer = changeSmsServer;

export function toggleSmsLock() {
    isSmsLocked = !isSmsLocked; localStorage.setItem('xurel_locked', isSmsLocked); applySmsLockUI();
}
window.toggleSmsLock = toggleSmsLock;

function applySmsLockUI() {
    const sHp = document.getElementById('sms-server'); const sProv = document.getElementById('sms-provider'); const icon = document.getElementById('sms-lock-icon');
    if(sHp) sHp.disabled = isSmsLocked; if(sProv) sProv.disabled = isSmsLocked;
    if(icon) { icon.className = isSmsLocked ? 'fa-solid fa-lock' : 'fa-solid fa-unlock'; icon.style.color = isSmsLocked ? 'var(--fb-red)' : 'var(--fb-muted)'; }
}

export function refreshSms() {
    const box = document.getElementById('sms-prices');
    if(box) box.innerHTML = '<div style="padding:30px; text-align:center; color:#888;">Mengambil Data...</div>';
    updateSmsBal(); loadSmsPrices(); pollSms();
}
window.refreshSms = refreshSms;

async function apiCall(endpoint, method = "GET", body = null) {
    const options = { method, headers: { "Content-Type": "application/json", "X-Server-Name": currentServerName } };
    if (body) options.body = JSON.stringify(body);
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); 
        options.signal = controller.signal;
        const res = await fetch(`${BASE_URL}${endpoint}`, options);
        clearTimeout(timeoutId); 
        const text = await res.text(); 
        try { return JSON.parse(text); } catch(e) { return { success: res.ok, status: res.ok ? "success" : "failed", error: { message: text || "Format server tidak sesuai" } }; }
    } catch(err) {
        if (err.name === 'AbortError') return { success: false, error: { message: "Koneksi Timeout" } };
        return { success: false, error: { message: "Jaringan terputus / Server Sibuk" } };
    }
}

async function updateSmsBal() {
    const json = await apiCall('/get-balance');
    const elBal = document.getElementById('sms-balance');
    if(!elBal) return;
    if((json.success === true || json.status === "success") && json.data) elBal.innerText = formatPrice(json.data.balance); else elBal.innerText = "Offline";
}

// --- FUNGSI RENDER HARGA (KODE LAMA ANDA TETAP SAMA) ---
// (Bagian renderSvcoOperatorListFirst, renderSvcoPricesForOperator, renderOperatorListFirst, renderPricesForOperator, loadSmsPrices disembunyikan untuk menyingkat pesan, silakan GABUNGKAN dari kode Anda sebelumnya, tidak ada yang berubah di bagian harga).

// ==========================================
// SISTEM PEMBELIAN & KARTU (CARD) UI
// ==========================================
function createCardHTML(oId, phone, priceDisplay, resendState, cancelState, replaceState, otpDisplay, isDone = false, isRecycled = false, expireTime = 0) {
    const doneStyle = isDone ? 'style="background:#e6f4ea; color:var(--fb-green); border-color:var(--fb-green);"' : 'disabled';
    let borderColor = "#95a5a6"; 
    if (activeProviderKey === "herosms") borderColor = "#8e44ad"; if (activeProviderKey === "otpcepat") borderColor = "#e74c3c"; if (activeProviderKey === "svco") borderColor = "#007bff"; 

    let displayId = "#" + String(oId).slice(-2);
    const phoneColorStyle = isRecycled ? 'color: red;' : '';

    return `<div class="order-card" id="order-${activeProviderKey}-${oId}" style="border: 2px solid ${borderColor};">
        <div style="display:flex; justify-content:space-between; margin-bottom:15px; border-bottom:1px dashed var(--fb-border); padding-bottom:15px; align-items:center;">
            <div style="display:flex; align-items:center; gap:8px;">
                <span style="color:var(--fb-blue); font-weight:900; font-family:monospace; font-size:15px;">${displayId}</span>
                <span class="badge-status" style="font-size:10px; color:#fff; background:${borderColor}; padding:3px 6px; border-radius:4px; font-weight:900;">ACTIVE</span>
                <span class="price-box" style="font-size:16px; font-weight:900; color:var(--fb-red); font-family:monospace;">${priceDisplay}</span>
            </div>
            <div style="display:flex; align-items:center; gap:10px;">
                <i class="fa-regular fa-eye-slash hide-btn-icon" onclick="hideSmsCard('${oId}')" style="color: var(--fb-muted); cursor:pointer; font-size:14px; padding: 5px;"></i>
                <span class="sms-timer" data-id="${oId}" data-expire="${expireTime}" style="font-family:monospace; font-weight:900; color:var(--fb-blue);">--:--</span>
            </div>
        </div>
        <div style="font-size:11px; color:var(--fb-muted); margin-bottom:5px; text-transform:uppercase; font-weight:900;">Nomor HP:</div>
        <div class="phone-box" onclick="copyPhoneNumber('${phone}', 'copy-icon-${oId}')" style="font-weight: 900;">
            <span class="phone-text-span" style="${phoneColorStyle}">${phone}</span><i id="copy-icon-${oId}" class="fa-regular fa-copy" style="color: var(--fb-muted);"></i>
        </div>
        <div style="text-align: center; margin: 10px 0 15px 0; padding: 15px 0; background: #fafafa; border-radius: 8px;">
            <div style="font-size:11px; color:var(--fb-muted); font-weight:900; letter-spacing:1px; margin-bottom:5px;">KODE OTP</div>
            <div class="otp-container" style="min-height:35px; display:flex; align-items:center; justify-content:center; font-weight: 900;">${otpDisplay}</div>
        </div>
        <div class="btn-grid-4">
            <button class="sms-btn btn-done" onclick="actSms('finish', '${oId}')" ${doneStyle} style="font-weight: 900;">✓ DONE</button>
            <button class="sms-btn btn-resend" onclick="actSms('resend', '${oId}')" ${resendState} style="font-weight: 900;">↻ RESEND</button>
            <button class="sms-btn btn-cancel" onclick="actSms('cancel', '${oId}')" ${cancelState} style="font-weight: 900;">✕ CANCEL</button>
            <button class="sms-btn btn-replace" onclick="actSms('replace', '${oId}')" ${replaceState} style="font-weight: 900;">⇄ REPLACE</button>
        </div>
    </div>`;
}

export async function buySms(pid, price, name, extra = "~", rank = "S") { executeBuySms(pid, price, name, extra === "~" ? "any" : extra, rank); }
window.buySms = buySms;

export async function executeBuySms(pid, price, name, operator, rank = "") {
    try { if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); if (audioCtx.state === 'suspended') audioCtx.resume(); } catch (e) {}

    const pText = formatPrice(price);
    let opText = ["herosms", "otpcepat", "svco", "nixpoin", "smscode"].includes(activeProviderKey) && operator !== "any" ? ` (Prov: ${operator.toUpperCase()})` : "";
    if(!await showModal("Konfirmasi", `Beli nomor untuk ${name}${opText} seharga ${pText}?`, "confirm")) return;

    let payload;
    if (activeProviderKey === "svco") payload = { product_id: parseInt(pid), price: Number(price), operator: operator, country: parseInt(rank) || 1 };
    else if (activeProviderKey === "smscode" && operator !== "any") payload = { type: "catalog", catalog_product_id: parseInt(pid), operator_id: parseInt(rank), max_price: parseInt(price) };
    else if (activeProviderKey === "smscode") payload = { type: "product", product_id: parseInt(pid) };
    else payload = { product_id: String(pid), price: price, operator: operator };

    const j = await apiCall('/create-order', 'POST', payload);
    if((j.success || j.status === "success") && j.data) {
        const o = j.data.orders[0];
        const newPhone = o.phone || o.phone_number || o.phoneNumber || 'Mencari Nomor...';
        
        // 1. BUAT PATOKAN WAKTU ASLI LALU SIMPAN KE FIREBASE
        const orderTime = Date.now(); 
        const expire = orderTime + 600000; 

        // 2. SINKRONISASI IDENTITAS HP KE FIREBASE 
        syncToFirebase(o.id, {
            server: currentServerName, // Hanya HP ini yang berhak melihat pesanan ini!
            created_at: orderTime,
            provider: activeProviderKey
        });

        localStorage.setItem(`pid_${activeProviderKey}_${o.id}`, pid); localStorage.setItem(`price_${activeProviderKey}_${o.id}`, price);
        if (operator) localStorage.setItem(`op_${activeProviderKey}_${o.id}`, operator);

        const extraBadge = getOperatorBadge(activeProviderKey, operator, rank);
        const container = document.getElementById('sms-active-orders');
        
        const cardHTML = createCardHTML(o.id, newPhone, formatPrice(price) + extraBadge, 'disabled', 'disabled', 'disabled', `<div class="loader-bars"><span></span><span></span><span></span></div>`, false, o.is_recycled, expire);
        container.insertAdjacentHTML('afterbegin', cardHTML);
        
        if(o.is_recycled) playSimpleSound('recycled');
        pollSms(); updateSmsBal(); window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
        showModal("Gagal", j.error?.message || "Stok Sedang Kosong.", "alert");
    }
}
window.executeBuySms = executeBuySms;

// ==========================================
// MANAJEMEN KARTU AKTIF & FIREBASE FILTER
// ==========================================
async function pollSms() {
    if (isPolling) return;
    isPolling = true;
    try {
        const j = await apiCall('/get-active', 'GET');
        if((j.success || j.status === "success") && j.data) {
            
            let filteredOrders = [];

            // FILTER FIREBASE: Isolasi dan Timer
            for (let o of j.data) {
                // Ambil data metadata pesanan dari Firebase
                let fbMeta = await getFromFirebase(o.id);
                
                if (fbMeta) {
                    // JIKA BUKAN MILIK HP YANG SEDANG AKTIF, HAPUS DARI DAFTAR!
                    if (fbMeta.server && fbMeta.server !== currentServerName) {
                        continue; 
                    }
                    // TIMING REALTIME ASLI DARI FIREBASE
                    if (fbMeta.created_at) {
                        o.created_at = fbMeta.created_at;
                    }
                } else {
                    // Jika pesanan ada di API tapi blm ada di Firebase (mungkin error jaringan saat beli)
                    // Amankan pesanan ini dengan menyimpannya menggunakan waktu & HP saat ini.
                    syncToFirebase(o.id, { server: currentServerName, created_at: Date.now(), provider: activeProviderKey });
                    o.created_at = Date.now();
                }
                
                filteredOrders.push(o);
            }

            activeOrders = filteredOrders; 
            renderSmsOrders(filteredOrders);
        }
    } catch (e) {} finally { isPolling = false; }
}

export function hideSmsCard(id) {
    if (!orderStates[id]) orderStates[id] = {}; orderStates[id].isHidden = true; 
    const card = document.getElementById(`order-${activeProviderKey}-${id}`); if (card) card.remove(); 
} window.hideSmsCard = hideSmsCard;

export function copyPhoneNumber(txt, iconId) { /* sama seperti sebelumnya */ } window.copyPhoneNumber = copyPhoneNumber;
export function copyOtpCode(otp, element) { /* sama seperti sebelumnya */ } window.copyOtpCode = copyOtpCode;

function renderSmsOrders(orders) {
    const container = document.getElementById('sms-active-orders');
    if(!container) return;
    
    const activeIds = orders.map(o => String(o.id));
    const currentCards = container.querySelectorAll('.order-card');
    
    currentCards.forEach(card => {
        const cardId = card.id.replace(`order-${activeProviderKey}-`, '');
        if (!activeIds.includes(cardId)) {
            const otpBox = card.querySelector('.otp-container');
            const hasOtp = otpBox && !otpBox.innerHTML.includes('loader-bars');
            
            if (!hasOtp) card.remove(); 
            else {
                const bDone = card.querySelector('.btn-done'); if(bDone) { bDone.disabled = false; bDone.style.background = "#e6f4ea"; bDone.style.color = "var(--fb-green)"; }
                const bCancel = card.querySelector('.btn-cancel'); if(bCancel) bCancel.disabled = true;
                const bReplace = card.querySelector('.btn-replace'); if(bReplace) bReplace.disabled = true;
                const bResend = card.querySelector('.btn-resend'); if(bResend) bResend.disabled = true;
            }
        }
    });

    orders.forEach(o => {
        if (orderStates[o.id]?.isHidden) return;
        const phone = o.phone || o.phone_number || o.phoneNumber || '...';
        const price = o.price || 0;
        const savedOp = o.operator || "any";
        const extraBadge = getOperatorBadge(activeProviderKey, savedOp, "");
        
        // DI SINI WAKTU SUDAH PASTI REALTIME 100% KARENA DITIMPA OLEH FIREBASE (Lihat fungsi pollSms)
        const orderTime = o.created_at || Date.now();
        const expire = orderTime + 600000; // Timer jalan 10 menit
        const passed2Mins = (Date.now() - orderTime) >= 120000; 

        let otpDisplay = o.otp_code ? `<span onclick="copyOtpCode('${o.otp_code}', this)" style="cursor:pointer; color:#00897B; letter-spacing:6px; font-size:32px; font-weight:900; display: inline-flex; align-items: center;">${o.otp_code.replace(/(\d{3})(?=\d)/g, '$1 ')}</span>` : `<div class="loader-bars"><span></span><span></span><span></span></div>`;
        const resendState = o.otp_code ? '' : 'disabled';
        const cancelState = (passed2Mins || ["smsbower", "otpcepat", "nixpoin"].includes(activeProviderKey)) && !o.otp_code ? '' : 'disabled';
        const replaceState = (passed2Mins && !["smsbower", "otpcepat", "svco", "nixpoin"].includes(activeProviderKey)) && !o.otp_code ? '' : 'disabled';

        const existingCard = document.getElementById(`order-${activeProviderKey}-${o.id}`);
        if (existingCard) {
            const timerSpan = existingCard.querySelector('.sms-timer');
            if (timerSpan) timerSpan.dataset.expire = expire;

            const phoneTextSpan = existingCard.querySelector('.phone-text-span');
            if (phoneTextSpan && phoneTextSpan.innerText.includes('Mencari') && !phone.includes('Mencari')) phoneTextSpan.innerText = phone;

            const otpBox = existingCard.querySelector('.otp-container');
            if (otpBox && otpBox.innerHTML.trim() !== otpDisplay.trim()) { otpBox.innerHTML = otpDisplay; if(o.otp_code) playSimpleSound('otp'); }
            
            const bCancel = existingCard.querySelector('.btn-cancel'); if(bCancel && cancelState === '') bCancel.disabled = false;
            const bReplace = existingCard.querySelector('.btn-replace'); if(bReplace && replaceState === '') bReplace.disabled = false;
            if(o.otp_code) { const bDone = existingCard.querySelector('.btn-done'); if(bDone) { bDone.disabled = false; bDone.style.background = "#e6f4ea"; bDone.style.color = "var(--fb-green)"; } }
        } else {
            container.insertAdjacentHTML('afterbegin', createCardHTML(o.id, phone, formatPrice(price) + extraBadge, resendState, cancelState, replaceState, otpDisplay, !!o.otp_code, o.is_recycled, expire));
        }
    });
}

function updateSmsTimers() {
    const now = Date.now();
    document.querySelectorAll('.sms-timer').forEach(el => {
        let end = parseInt(el.dataset.expire); 
        if(end && !isNaN(end)) {
            const diff = Math.max(0, Math.floor((end - now)/1000));
            el.innerText = `${Math.floor(diff/60)}:${(diff%60).toString().padStart(2,'0')}`;
            el.style.color = diff < 600 ? "var(--fb-red)" : "var(--fb-blue)"; 
        }
    });
}

export async function actSms(action, id) { /* sama seperti sebelumnya */ } window.actSms = actSms;
