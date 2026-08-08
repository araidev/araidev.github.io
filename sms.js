import { showModal } from './ui.js';
import { db } from './firebase.js'; 

// ==========================================
// 1. KONFIGURASI PROVIDER & STATE
// ==========================================
const PROVIDERS = {
    "smscode": { name: "COD", url: "https://sms.aam-zip.workers.dev" },
    "herosms": { name: "HER", url: "https://hero.aam-zip.workers.dev" },
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
let localHiddenOrders = JSON.parse(localStorage.getItem('sms_hidden_orders') || "[]");
let favoriteOperators = JSON.parse(localStorage.getItem('sms_fav_ops') || "[]");

// ==========================================
// 2. SETUP AUDIO (OTP & RECYCLED)
// ==========================================
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
            osc.type = 'sine';
            osc.frequency.setValueAtTime(1200, audioCtx.currentTime); 
            gain.gain.setValueAtTime(0.1, audioCtx.currentTime); 
            osc.start();
            osc.stop(audioCtx.currentTime + 0.15); 
        } else if (type === 'recycled') {
            // Suara alarm cepat untuk nomor daur ulang
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(400, audioCtx.currentTime); 
            osc.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.2);
            gain.gain.setValueAtTime(0.05, audioCtx.currentTime); 
            osc.start();
            osc.stop(audioCtx.currentTime + 0.3); 
        }
    } catch (e) { console.log("Audio tidak didukung", e); }
}

function tryInitSms() {
    if (!smsInitialized) initSms();
}
if (document.readyState === "loading") {
    document.addEventListener('DOMContentLoaded', tryInitSms);
} else {
    tryInitSms();
}

function formatPrice(price) {
    if (activeProviderKey === "herosms" || activeProviderKey === "svco") return `${price}`;
    return `Rp ${parseInt(price || 0).toLocaleString('id-ID')}`; 
}

// ==========================================
// 3. INISIALISASI & KONTROL SERVER UI
// ==========================================
async function initSms() {
    smsInitialized = true;
    const selectHp = document.getElementById('sms-server');

    if (!document.getElementById('sms-provider')) {
        const provSelect = document.createElement('select');
        provSelect.id = 'sms-provider';
        provSelect.className = selectHp.className;
        provSelect.style.marginRight = "10px";
        provSelect.style.fontWeight = "900";
        provSelect.style.color = "var(--fb-blue)";
        provSelect.onchange = changeSmsProvider;
        provSelect.innerHTML = Object.keys(PROVIDERS).map(k => `<option value="${k}">${PROVIDERS[k].name}</option>`).join('');
        provSelect.value = activeProviderKey;
        selectHp.parentNode.insertBefore(provSelect, selectHp);
    }

    // Buat Wadah Pesanan Aktif & Tersembunyi jika belum ada
    const container = document.getElementById('sms-active-orders');
    if (container && !document.getElementById('wrapper-active-orders')) {
        container.innerHTML = `
            <div id="wrapper-active-orders"></div>
            <details id="wrapper-hidden-orders" style="margin-top: 15px; padding: 10px; background: #f8f9fa; border-radius: 8px; border: 1px dashed #ced4da;">
                <summary style="font-weight: 900; cursor: pointer; color: var(--fb-muted); outline: none;">
                    <i class="fa-solid fa-eye-slash" style="margin-right: 5px;"></i> Pesanan Disembunyikan
                </summary>
                <div id="inner-hidden-orders" style="margin-top: 15px;"></div>
            </details>
        `;
    }

    isSmsLocked = localStorage.getItem('xurel_locked') === 'true';
    await loadServersList();
    applySmsLockUI();
    refreshSms();

    if(pollingInterval) clearInterval(pollingInterval);
    if(timerInterval) clearInterval(timerInterval);
    
    pollingInterval = setInterval(pollSms, 4000);
    timerInterval = setInterval(updateSmsTimers, 1000);
}

export async function changeSmsProvider() {
    if(isSmsLocked) return;
    activeProviderKey = document.getElementById('sms-provider').value;
    BASE_URL = PROVIDERS[activeProviderKey].url;
    localStorage.setItem('xurel_provider', activeProviderKey);
    activeOrders = []; localHiddenOrders = [];
    localStorage.setItem('sms_hidden_orders', "[]");
    document.getElementById('wrapper-active-orders').innerHTML = ''; 
    document.getElementById('inner-hidden-orders').innerHTML = ''; 
    await loadServersList();
    refreshSms();
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
        select.innerHTML = ["HP1", "HP2"].map(k => `<option value="${k}">${k}</option>`).join('');
    }
    const saved = localStorage.getItem(`xurel_hp_${activeProviderKey}`);
    currentServerName = (saved && Array.from(select.options).some(o => o.value === saved)) ? saved : select.options[0].value;
    select.value = currentServerName;
}

export function changeSmsServer() {
    if(isSmsLocked) return;
    currentServerName = document.getElementById('sms-server').value;
    localStorage.setItem(`xurel_hp_${activeProviderKey}`, currentServerName);
    activeOrders = [];
    document.getElementById('wrapper-active-orders').innerHTML = '';
    document.getElementById('inner-hidden-orders').innerHTML = ''; 
    refreshSms();
}
window.changeSmsServer = changeSmsServer;

export function toggleSmsLock() {
    isSmsLocked = !isSmsLocked; localStorage.setItem('xurel_locked', isSmsLocked); applySmsLockUI();
}
window.toggleSmsLock = toggleSmsLock;

function applySmsLockUI() {
    const sHp = document.getElementById('sms-server');
    const sProv = document.getElementById('sms-provider');
    const icon = document.getElementById('sms-lock-icon');
    if(sHp) sHp.disabled = isSmsLocked;
    if(sProv) sProv.disabled = isSmsLocked;
    if(icon) {
        icon.className = isSmsLocked ? 'fa-solid fa-lock' : 'fa-solid fa-unlock';
        icon.style.color = isSmsLocked ? 'var(--fb-red)' : 'var(--fb-muted)';
    }
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
        try { return JSON.parse(text); } 
        catch(e) { return { success: res.ok, status: res.ok ? "success" : "failed", error: { message: text || "Format server tidak sesuai" } }; }
    } catch(err) {
        if (err.name === 'AbortError') return { success: false, error: { message: "Koneksi Timeout" } };
        return { success: false, error: { message: "Jaringan terputus / Server Sibuk" } };
    }
}

async function updateSmsBal() {
    const json = await apiCall('/get-balance');
    const elBal = document.getElementById('sms-balance');
    if(!elBal) return;
    if(json.success && json.data) elBal.innerText = formatPrice(json.data.balance);
    else elBal.innerText = "Offline";
}

// ==========================================
// 4. RENDER HARGA CERDAS & FAVORIT
// ==========================================
export function toggleFavorite(opKey) {
    if (favoriteOperators.includes(opKey)) {
        favoriteOperators = favoriteOperators.filter(x => x !== opKey);
    } else {
        favoriteOperators.push(opKey);
    }
    localStorage.setItem('sms_fav_ops', JSON.stringify(favoriteOperators));
    loadSmsPrices(); // Re-render langsung
}
window.toggleFavorite = toggleFavorite;

async function loadSmsPrices() {
    const box = document.getElementById('sms-prices');
    if(!box) return;

    // Ambil data jika belum cache, atau re-render jika cuma toggle fav
    const json = await apiCall('/get-prices');
    if (!json.success || !json.data || json.data.length === 0) {
        box.innerHTML = `<div style="padding:30px; text-align:center; color:var(--fb-red); font-weight:900;">Stok Kosong / Gagal Memuat</div>`;
        return;
    }

    let normalizedPrices = [];
    
    // Normalisasi Data Mentah dari ke-3 Provider
    if (activeProviderKey === "smscode") {
        json.data.forEach(i => normalizedPrices.push({ pid: i.id, price: i.price, opCode: i.injected_operator_id || 'any', opName: i.operator || 'ANY (ACAK)' }));
    } else if (activeProviderKey === "herosms") {
        json.data.forEach(i => {
             normalizedPrices.push({ pid: i.id, price: i.price, opCode: 'any', opName: 'ANY (ACAK)' });
             if (i.operatorStock) {
                 for (let op in i.operatorStock) normalizedPrices.push({ pid: i.id, price: i.price, opCode: op, opName: op.toUpperCase() });
             }
        });
    } else if (activeProviderKey === "svco") {
        json.data.forEach(i => normalizedPrices.push({ pid: i.id, price: i.price, opCode: i.operator || 'any', opName: i.operatorName || 'ANY (ACAK)', country: i.country }));
    }

    // Ambil harga TERMURAH per Operator
    let bestPrices = {};
    normalizedPrices.forEach(p => {
        let key = p.opName.toUpperCase();
        if (!bestPrices[key] || p.price < bestPrices[key].price) bestPrices[key] = p;
    });

    let finalArray = Object.values(bestPrices);

    // Sorting: Favorit di atas, lalu urutkan harga termurah
    finalArray.sort((a, b) => {
        let aFav = favoriteOperators.includes(a.opName.toUpperCase());
        let bFav = favoriteOperators.includes(b.opName.toUpperCase());
        if (aFav && !bFav) return -1;
        if (!aFav && bFav) return 1;
        return a.price - b.price;
    });

    // Render ke HTML
    box.innerHTML = finalArray.map(item => {
        let isFav = favoriteOperators.includes(item.opName.toUpperCase());
        let starStyle = isFav ? "color: #f1c40f;" : "color: #bdc3c7;";
        
        return `<div class="price-item" style="display:flex; justify-content:space-between; align-items:center;">
                    <div style="flex: 1; display:flex; align-items:center; cursor: pointer;" onclick="executeBuySms('${item.pid}', ${item.price}, '${item.opName}', '${item.opCode}', '${item.country || ""}')">
                        <div style="font-weight:900; color:var(--fb-text); font-size: 14px;">${item.opName.toUpperCase()}</div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <div style="text-align: right; color:var(--fb-red); font-family:monospace; font-size:15px; font-weight: 900;" onclick="executeBuySms('${item.pid}', ${item.price}, '${item.opName}', '${item.opCode}', '${item.country || ""}')">${formatPrice(item.price)}</div>
                        <i class="fa-solid fa-star" onclick="toggleFavorite('${item.opName.toUpperCase()}')" style="${starStyle} font-size:18px; cursor:pointer;" title="Jadikan Favorit"></i>
                    </div>
                </div>`;
    }).join('');
}

// ==========================================
// 5. SISTEM PEMBELIAN & RENDER KARTU (CARD)
// ==========================================
function createCardHTML(oId, phone, priceDisplay, resendState, cancelState, replaceState, otpDisplay, isDone = false, isRecycled = false, expireTime = 0, operatorName = "UNKNOWN") {
    const doneStyle = isDone ? 'style="background:#e6f4ea; color:var(--fb-green); border-color:var(--fb-green);"' : 'disabled';
    
    // Warna tema bergantung provider untuk membedakan asal nomor (Web Sync)
    let bColor = activeProviderKey === "herosms" ? "#8e44ad" : activeProviderKey === "svco" ? "#007bff" : "#95a5a6"; 
    
    // UI Nomor Merah jika Recycled (Daur Ulang)
    const phoneColorStyle = isRecycled ? 'color: var(--fb-red); font-style: italic; text-decoration: line-through;' : '';
    const recycledBadge = isRecycled ? `<span style="font-size:10px; color:#fff; background:var(--fb-red); padding:2px 5px; border-radius:4px; margin-left:8px;">DAUR ULANG</span>` : '';

    return `<div class="order-card" id="order-${activeProviderKey}-${oId}" style="border: 2px solid ${bColor};">
        <div style="display:flex; justify-content:space-between; margin-bottom:15px; border-bottom:1px dashed var(--fb-border); padding-bottom:15px; align-items:center;">
            <div style="display:flex; align-items:center; gap:8px;">
                <span style="font-size:16px; font-weight:900; color:var(--fb-text); text-transform:uppercase;">${operatorName.toUpperCase()}</span>
                <span class="price-box" style="font-size:14px; font-weight:900; color:var(--fb-red); font-family:monospace; background: #fff; padding: 2px 6px; border-radius: 4px; border: 1px solid #ddd;">${priceDisplay}</span>
            </div>
            <div style="display:flex; align-items:center; gap:10px;">
                <i class="fa-solid fa-eye-slash hide-btn-icon" onclick="localHideSmsCard('${oId}')" style="color: var(--fb-muted); cursor:pointer; font-size:14px; padding: 5px;" title="Sembunyikan"></i>
                <span class="sms-timer" data-id="${oId}" data-expire="${expireTime}" style="font-family:monospace; font-weight:900; color:var(--fb-blue);">--:--</span>
            </div>
        </div>
        <div style="font-size:11px; color:var(--fb-muted); margin-bottom:5px; text-transform:uppercase; font-weight:900;">Nomor HP: ${recycledBadge}</div>
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

export async function executeBuySms(pid, price, name, operator, countryRank = "") {
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
    } catch (e) {}

    const pText = formatPrice(price);
    if(!await showModal("Konfirmasi", `Beli nomor untuk ${name.toUpperCase()} seharga ${pText}?`, "confirm")) return;

    let payload;
    if (activeProviderKey === "svco") {
        payload = { product_id: parseInt(pid), price: Number(price), operator: operator, country: parseInt(countryRank) || 1 };
    } else if (activeProviderKey === "herosms") {
        payload = { product_id: String(pid), price: price, operator: operator };
    } else if (activeProviderKey === "smscode") {
        if (operator !== "any") payload = { type: "catalog", catalog_product_id: parseInt(pid), operator_id: parseInt(operator), max_price: parseInt(price) };
        else payload = { type: "product", product_id: parseInt(pid) };
    }

    const j = await apiCall('/create-order', 'POST', payload);
    if(j.success && j.data) {
        // Simpan memory pid untuk replace
        localStorage.setItem(`pid_${activeProviderKey}_${j.data.orders[0].id}`, pid);
        localStorage.setItem(`price_${activeProviderKey}_${j.data.orders[0].id}`, price);
        if (operator) localStorage.setItem(`op_${activeProviderKey}_${j.data.orders[0].id}`, operator);

        if(j.data.orders[0].is_recycled) playSimpleSound('recycled');
        
        pollSms(); updateSmsBal();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
        showModal("Gagal", j.error?.message || "Stok Sedang Kosong.", "alert");
    }
}
window.executeBuySms = executeBuySms;

// ==========================================
// 6. POLLING & MANAJEMEN UI CERDAS
// ==========================================
async function pollSms() {
    if (isPolling) return;
    isPolling = true;
    try {
        const j = await apiCall('/get-active', 'GET');
        if(j.success && j.data) {
            activeOrders = j.data; 
            renderSmsOrders(j.data);
        }
    } catch (e) {} finally { isPolling = false; }
}

export function localHideSmsCard(id) {
    if (!localHiddenOrders.includes(id)) {
        localHiddenOrders.push(id);
        localStorage.setItem('sms_hidden_orders', JSON.stringify(localHiddenOrders));
    }
    renderSmsOrders(activeOrders); // Re-render instantly to move it down
}
window.localHideSmsCard = localHideSmsCard;

export function copyPhoneNumber(txt, iconId) {
    if(txt.includes('Mencari')) return;
    navigator.clipboard.writeText(txt);
    const icon = document.getElementById(iconId);
    if(icon) {
        icon.className = "fa-solid fa-circle-check"; icon.style.color = "var(--fb-green)";
        setTimeout(() => { icon.className = "fa-regular fa-copy"; icon.style.color = "var(--fb-muted)"; }, 1500);
    }
}
window.copyPhoneNumber = copyPhoneNumber;

export function copyOtpCode(otp, element) {
    if (!otp) return;
    navigator.clipboard.writeText(otp);
    if (element.querySelector('.otp-copied-icon')) return;
    const originalHTML = element.innerHTML;
    element.innerHTML = originalHTML + '<i class="fa-solid fa-circle-check otp-copied-icon" style="color: var(--fb-green); font-size: 24px; margin-left: 12px; letter-spacing: normal;"></i>';
    setTimeout(() => { element.innerHTML = originalHTML; }, 1500);
}
window.copyOtpCode = copyOtpCode;

function renderSmsOrders(orders) {
    const wrapActive = document.getElementById('wrapper-active-orders');
    const wrapHidden = document.getElementById('inner-hidden-orders');
    if(!wrapActive || !wrapHidden) return;
    
    // Kumpulkan HTML untuk masing-masing keranjang
    let activeHTML = '';
    let hiddenHTML = '';

    orders.forEach(o => {
        const phone = o.phone || o.phone_number || '...';
        const price = o.price || 0;
        const opName = o.operator || "ANY";
        const isHidden = localHiddenOrders.includes(String(o.id));
        
        let orderTime = o.created_at || Date.now();
        const expire = orderTime + 900000; // Timer 15 menit menyesuaikan Cloudflare
        const passed2Mins = (Date.now() - orderTime) >= 120000; 

        let otpDisplay = o.otp_code ? `<span onclick="copyOtpCode('${o.otp_code}', this)" style="cursor:pointer; color:#00897B; letter-spacing:6px; font-size:32px; font-weight:900; display: inline-flex; align-items: center;" title="Klik untuk menyalin">${o.otp_code.replace(/(\d{3})(?=\d)/g, '$1 ')}</span>` : `<div class="loader-bars"><span></span><span></span><span></span></div>`;
        const resendState = o.otp_code ? '' : 'disabled';
        const cancelState = (passed2Mins || activeProviderKey === "svco") && !o.otp_code ? '' : 'disabled';
        const replaceState = passed2Mins && !o.otp_code && activeProviderKey !== "svco" ? '' : 'disabled';

        // Peringatan Audio OTP
        const oldCard = document.getElementById(`order-${activeProviderKey}-${o.id}`);
        if (o.otp_code && oldCard && !oldCard.innerHTML.includes(o.otp_code)) playSimpleSound('otp');

        const htmlStr = createCardHTML(o.id, phone, formatPrice(price), resendState, cancelState, replaceState, otpDisplay, !!o.otp_code, o.is_recycled, expire, opName);

        if (isHidden) hiddenHTML += htmlStr;
        else activeHTML += htmlStr;
    });

    wrapActive.innerHTML = activeHTML;
    wrapHidden.innerHTML = hiddenHTML;
}

function updateSmsTimers() {
    const now = Date.now();
    document.querySelectorAll('.sms-timer').forEach(el => {
        let end = parseInt(el.dataset.expire); 
        if(end && !isNaN(end)) {
            const diff = Math.max(0, Math.floor((end - now)/1000));
            el.innerText = `${Math.floor(diff/60)}:${(diff%60).toString().padStart(2,'0')}`;
            el.style.color = diff < 600 ? "var(--fb-red)" : "var(--fb-blue)"; // Merah jika sisa < 10 Menit
        }
    });
}

export async function actSms(action, id) {
    if (!await showModal("Konfirmasi", "Lanjutkan aksi ini?", "confirm")) return;

    if (action === 'replace') {
        const jCancel = await apiCall('/order-action', 'POST', { id, action: 'cancel' });
        if (jCancel.success) {
            localHideSmsCard(id); // Auto hide nomor lama yang diganti
            const oldPid = localStorage.getItem(`pid_${activeProviderKey}_${id}`);
            const oldPrice = localStorage.getItem(`price_${activeProviderKey}_${id}`);
            const oldOp = localStorage.getItem(`op_${activeProviderKey}_${id}`) || "any";
            
            if (oldPid && oldPrice) await executeBuySms(oldPid, oldPrice, oldOp, oldOp, "");
            else showModal("Info", "Nomor berhasil dibatalkan, silakan pilih produk ulang.", "alert");
        } else {
            showModal("Gagal Replace", jCancel.error?.message || "Gagal membatalkan dari server.", "alert");
        }
        return; 
    }

    const j = await apiCall('/order-action', 'POST', { id, action });
    if (j.success) {
        pollSms(); updateSmsBal();
    } else {
        showModal("Gagal", j.error?.message || "Aksi ditolak server.", "alert");
    }
}
window.actSms = actSms;
