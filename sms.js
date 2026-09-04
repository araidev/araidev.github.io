import { showModal } from './ui.js';
import { db, auth } from './firebase.js'; 

// ==========================================
// 1. KONFIGURASI PROVIDER & HARGA SPESIFIK
// ==========================================
const PROVIDERS = {
    "herosms": { name: "HER", url: "https://hero.aam-zip.workers.dev", currency: "USD", minPrice: 0, maxPrice: 1500 },
    "hwa":     { name: "HWA", url: "https://hwa.aam-zip.workers.dev", currency: "USD", minPrice: 1000, maxPrice: 3500 },
    "smsvirtual": { name: "SVC", url: "https://svco.aam-zip.workers.dev", currency: "USD", minPrice: 1000, maxPrice: 1500 },
    "smscode": { name: "COD", url: "https://sms.aam-zip.workers.dev", currency: "IDR", minPrice: 1310, maxPrice: 1400 },
    "otpcepat": { name: "CEP", url: "https://cepat.aam-zip.workers.dev", currency: "IDR", minPrice: 0, maxPrice: 2000 } // <-- OtpCepat Ditambahkan
};

let activeProviderKey = localStorage.getItem('xurel_provider') || "herosms";
if (!PROVIDERS[activeProviderKey]) activeProviderKey = "herosms";
let BASE_URL = PROVIDERS[activeProviderKey].url;

let currentServerName = ""; 
let currentUsdRate = 16000; 

let smsInitialized = false; 
let pollingInterval = null;
let timerInterval = null;
let isPolling = false;

let globalOrders = {}; 

let favoritePrices = [];
let notifiedOtps = JSON.parse(localStorage.getItem('sms_notified_otps') || "[]"); 
let cachedPriceGroups = {}; 

// ==========================================
// 1B. SINKRONISASI MURNI FIREBASE (LISTENER)
// ==========================================
function attachGlobalOrderListener() {
    if (!currentServerName) return;
    
    const path = `OTP/${activeProviderKey}/${currentServerName}`;
    
    if (window.ordersRef) window.ordersRef.off();
    window.ordersRef = db.ref(path);
    window.ordersRef.on('value', snap => {
        globalOrders = snap.val() || {};
        renderSmsOrders(); 
    });
}

function attachPrivateListeners(uid) {
    const favKey = `sms_fav_prices_${activeProviderKey}`;
    if (window.favRef) window.favRef.off();
    window.favRef = db.ref(`users/${uid}/${favKey}`);
    window.favRef.on('value', snap => {
        favoritePrices = snap.val() || [];
        if (Object.keys(cachedPriceGroups).length > 0) renderPriceGroups();
    });
}

auth.onAuthStateChanged(user => {
    if (user) {
        attachPrivateListeners(user.uid);
    } else {
        favoritePrices = JSON.parse(localStorage.getItem(`sms_fav_prices_${activeProviderKey}`) || "[]");
        if (Object.keys(cachedPriceGroups).length > 0) renderPriceGroups();
    }
});

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
            osc.frequency.setValueAtTime(880, audioCtx.currentTime); 
            osc.frequency.exponentialRampToValueAtTime(1760, audioCtx.currentTime + 0.1); 
            gain.gain.setValueAtTime(0, audioCtx.currentTime); 
            gain.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.5); 
        } else if (type === 'recycled') {
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

// ==========================================
// 3. KURS OTOMATIS & FORMAT HARGA
// ==========================================
async function updateUsdRate() {
    const today = new Date().toDateString();
    const cachedRate = localStorage.getItem('usd_to_idr_rate');
    const cachedDate = localStorage.getItem('usd_to_idr_date');

    if (cachedRate && cachedDate === today) {
        currentUsdRate = parseFloat(cachedRate);
        return;
    }

    try {
        const res = await fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json');
        const data = await res.json();
        currentUsdRate = data.usd.idr;
        localStorage.setItem('usd_to_idr_rate', currentUsdRate);
        localStorage.setItem('usd_to_idr_date', today);
    } catch (e) {
        currentUsdRate = 16000; 
    }
}

function formatDisplayPrice(price, currency) {
    if (currency === "USD") {
        return `$${price}`; 
    }
    return `Rp ${parseInt(price || 0).toLocaleString('id-ID')}`; 
}

function cleanOpName(name) {
    if (!name || name === "any") return "ANY (ACAK)";
    return String(name).toUpperCase().replace(" OOREDOO", "").trim();
}

// ==========================================
// 4. INISIALISASI & KONTROL SERVER UI
// ==========================================
async function initSms() {
    smsInitialized = true;
    await updateUsdRate();

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

    // =============================================================
    // INJEKSI TOMBOL REFRESH DI SEBELAH KIRI SALDO
    // =============================================================
    const elBal = document.getElementById('sms-balance');
    if (elBal && !document.getElementById('btn-refresh-sms')) {
        const balContainer = document.createElement('div');
        balContainer.style.display = 'flex';
        balContainer.style.alignItems = 'center';
        balContainer.style.gap = '10px';

        elBal.parentNode.insertBefore(balContainer, elBal);
        
        const refreshBtn = document.createElement('button');
        refreshBtn.id = 'btn-refresh-sms';
        refreshBtn.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i>';
        refreshBtn.style.background = 'none';
        refreshBtn.style.border = 'none';
        refreshBtn.style.cursor = 'pointer';
        refreshBtn.style.fontSize = '18px';
        refreshBtn.style.color = 'var(--fb-blue)';
        refreshBtn.title = 'Refresh Saldo & Harga';
        
        refreshBtn.onclick = () => {
            const icon = refreshBtn.querySelector('i');
            icon.classList.add('fa-spin');
            refreshSms();
            setTimeout(() => icon.classList.remove('fa-spin'), 1000);
        };

        balContainer.appendChild(refreshBtn);
        balContainer.appendChild(elBal); 
    }
    // =============================================================

    const container = document.getElementById('sms-active-orders');
    if (container && !document.getElementById('wrapper-active-orders')) {
        container.innerHTML = `
            <style>
                #wrapper-hidden-orders summary::-webkit-details-marker { display: none; }
                #wrapper-hidden-orders summary { list-style: none; }
            </style>
            <div id="wrapper-active-orders"></div>
            <details id="wrapper-hidden-orders" style="margin-top: 15px; padding: 10px; background: #f8f9fa; border-radius: 8px; border: 1px dashed #ced4da;">
                <summary style="cursor: pointer; outline: none; display: flex; align-items: center; justify-content: flex-start;">
                    <span id="hidden-toggle-text" style="background:#e9ecef; padding:6px 12px; border-radius:6px; font-size: 10px; font-weight:900; color:var(--fb-muted); letter-spacing:0.5px; border: 1px solid #ddd;">SHOW</span>
                </summary>
                <div id="inner-hidden-orders" style="margin-top: 15px;"></div>
            </details>
        `;

        const detailsWrapper = document.getElementById('wrapper-hidden-orders');
        const toggleText = document.getElementById('hidden-toggle-text');
        detailsWrapper.addEventListener('toggle', function() {
            if (this.open) {
                toggleText.innerText = "HIDE";
                toggleText.style.color = "var(--fb-blue)";
                toggleText.style.borderColor = "var(--fb-blue)";
            } else {
                toggleText.innerText = "SHOW";
                toggleText.style.color = "var(--fb-muted)";
                toggleText.style.borderColor = "#ddd";
            }
        });
    }

    applySmsLock();
    
    await loadServersList();
    
    attachGlobalOrderListener(); 
    refreshSms();

    if(pollingInterval) clearInterval(pollingInterval);
    if(timerInterval) clearInterval(timerInterval);
    
    pollingInterval = setInterval(pollSms, 15000); 
    timerInterval = setInterval(updateSmsTimers, 1000);
}

export async function changeSmsProvider() {
    activeProviderKey = document.getElementById('sms-provider').value;
    BASE_URL = PROVIDERS[activeProviderKey].url;
    localStorage.setItem('xurel_provider', activeProviderKey);
    
    globalOrders = {};
    document.getElementById('wrapper-active-orders').innerHTML = ''; 
    document.getElementById('inner-hidden-orders').innerHTML = ''; 
    
    await loadServersList();
    attachGlobalOrderListener(); 
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
        select.innerHTML = ["A", "B", "C", "D", "E"].map(k => `<option value="${k}">${k}</option>`).join('');
    }
    const saved = localStorage.getItem(`xurel_hp_${activeProviderKey}`);
    currentServerName = (saved && Array.from(select.options).some(o => o.value === saved)) ? saved : select.options[0].value;
    select.value = currentServerName;
}

export function changeSmsServer() {
    currentServerName = document.getElementById('sms-server').value;
    localStorage.setItem(`xurel_hp_${activeProviderKey}`, currentServerName);
    
    globalOrders = {};
    document.getElementById('wrapper-active-orders').innerHTML = '';
    document.getElementById('inner-hidden-orders').innerHTML = ''; 
    
    attachGlobalOrderListener(); 
    refreshSms();
}
window.changeSmsServer = changeSmsServer;

export function refreshSms() {
    const box = document.getElementById('sms-prices');
    if(box) box.innerHTML = '<div style="padding:30px; text-align:center; color:#888;">Mengambil Data...</div>';
    
    updateSmsBal(); 
    loadSmsPrices(); 
    pollSms(); 
}
window.refreshSms = refreshSms;

// ==========================================
// 4B. SISTEM PENGUNCI LAYAR (GEMBOK)
// ==========================================
export function toggleSmsLock() {
    let isLocked = localStorage.getItem('sms_ui_locked') === 'true';
    localStorage.setItem('sms_ui_locked', !isLocked);
    applySmsLock();
}
window.toggleSmsLock = toggleSmsLock;

export function applySmsLock() {
    let isLocked = localStorage.getItem('sms_ui_locked') === 'true';
    let prov = document.getElementById('sms-provider');
    let srv = document.getElementById('sms-server');
    
    if(prov) prov.disabled = isLocked;
    if(srv) srv.disabled = isLocked;

    let lockIcon = document.getElementById('global-sms-lock-icon') || document.querySelector('.fa-lock, .fa-lock-open, .fa-unlock');
    if (lockIcon) {
        if (!lockIcon.id) lockIcon.id = 'global-sms-lock-icon'; 
        lockIcon.className = isLocked ? "fa-solid fa-lock" : "fa-solid fa-lock-open";
        lockIcon.style.color = isLocked ? "var(--fb-red)" : "var(--fb-muted)";
    }
}
window.applySmsLock = applySmsLock;

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
    if(json.success && json.data) elBal.innerHTML = formatDisplayPrice(json.data.balance, PROVIDERS[activeProviderKey].currency);
    else elBal.innerText = "Offline";
}

// ==========================================
// 5. RENDER HARGA CERDAS & FAVORIT
// ==========================================
export function toggleFavoritePrice(priceStr) {
    if (favoritePrices.includes(priceStr)) {
        favoritePrices = favoritePrices.filter(x => x !== priceStr);
    } else {
        favoritePrices.push(priceStr);
    }
    
    if (auth && auth.currentUser) {
        db.ref(`users/${auth.currentUser.uid}/sms_fav_prices_${activeProviderKey}`).set(favoritePrices);
    } else {
        localStorage.setItem(`sms_fav_prices_${activeProviderKey}`, JSON.stringify(favoritePrices));
    }
    renderPriceGroups();
}
window.toggleFavoritePrice = toggleFavoritePrice;

async function loadSmsPrices() {
    const box = document.getElementById('sms-prices');
    if(!box) return;

    const json = await apiCall('/get-prices');
    if (!json.success || !json.data || json.data.length === 0) {
        box.innerHTML = `<div style="padding:30px; text-align:center; color:var(--fb-red); font-weight:900;">Stok Kosong / Gagal Memuat</div>`;
        return;
    }

    let normalizedPrices = [];
    
    let currentMinPrice = PROVIDERS[activeProviderKey].minPrice;
    let currentMaxPrice = PROVIDERS[activeProviderKey].maxPrice;
    
    // --> OtpCepat ditambahkan ke filter langsung mata uang IDR
    if (activeProviderKey === "smscode" || activeProviderKey === "otpcepat") {
        json.data
            .filter(i => i.price >= currentMinPrice && i.price <= currentMaxPrice)
            .forEach(i => normalizedPrices.push({ pid: i.id, price: i.price, opCode: i.injected_operator_id || i.operator || 'any', opName: cleanOpName(i.operator) }));
            
    } else if (activeProviderKey === "herosms" || activeProviderKey === "hwa") {
        json.data
            .filter(i => {
                let idrPrice = parseFloat(i.price) * currentUsdRate;
                return idrPrice >= currentMinPrice && idrPrice <= currentMaxPrice;
            })
            .forEach(i => {
                 normalizedPrices.push({ pid: i.id, price: i.price, opCode: 'any', opName: 'ANY (ACAK)' });
                 if (i.operatorStock) {
                     let opList = Array.isArray(i.operatorStock) ? i.operatorStock : Object.keys(i.operatorStock);
                     opList.forEach(op => {
                         normalizedPrices.push({ pid: i.id, price: i.price, opCode: op, opName: cleanOpName(op) });
                     });
                 }
            });
            
    } else if (activeProviderKey === "smsvirtual") {
        json.data
            .filter(i => {
                let idrPrice = parseFloat(i.price) * currentUsdRate;
                return idrPrice >= currentMinPrice && idrPrice <= currentMaxPrice;
            })
            .forEach(i => normalizedPrices.push({ pid: i.id, price: i.price, opCode: i.operator || 'any', opName: cleanOpName(i.operatorName), country: i.country }));
            
    }

    cachedPriceGroups = {};
    normalizedPrices.forEach(p => {
        let pStr = String(p.price);
        if (!cachedPriceGroups[pStr]) cachedPriceGroups[pStr] = [];
        if (!cachedPriceGroups[pStr].some(existing => existing.opName === p.opName)) {
            cachedPriceGroups[pStr].push(p);
        }
    });

    renderPriceGroups();
}

export function renderPriceGroups() {
    const box = document.getElementById('sms-prices');
    if (!box) return;
    
    let sortedPrices = Object.keys(cachedPriceGroups).sort((a,b) => {
        let isFavA = favoritePrices.includes(a);
        let isFavB = favoritePrices.includes(b);
        if (isFavA && !isFavB) return -1;
        if (!isFavA && isFavB) return 1;
        return parseFloat(a) - parseFloat(b);
    });
    
    box.innerHTML = sortedPrices.map(price => {
        let isFav = favoritePrices.includes(price);
        let starStyle = isFav ? "color: #f1c40f;" : "color: #bdc3c7;";
        
        let ops = cachedPriceGroups[price];
        
        if (activeProviderKey !== "smscode" && ops.length === 1) {
            let item = ops[0];
            return `<div style="display:flex; justify-content:space-between; align-items:center; padding: 15px; background: #fff; border: 1px solid #eee; border-radius: 8px; margin-bottom: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                        <div onclick="executeBuySms('${item.pid}', ${item.price}, '${item.opName}', '${item.opCode}', '${item.country || ""}')" style="flex:1; cursor: pointer; font-weight: 900; color:var(--fb-red); font-family:monospace; font-size:14px; display:flex; align-items:center; gap:8px;">
                            ${item.opName} - ${formatDisplayPrice(price, PROVIDERS[activeProviderKey].currency)}
                            <span style="color: #fff; font-size: 9px; font-weight: 900; background: var(--fb-blue); padding: 2px 6px; border-radius: 4px;">BELI</span>
                        </div>
                        <i class="fa-solid fa-star" onclick="toggleFavoritePrice('${price}')" style="${starStyle} font-size:18px; cursor:pointer;" title="Jadikan Favorit"></i>
                    </div>`;
        }

        return `<div style="display:flex; justify-content:space-between; align-items:center; padding: 15px; background: #fff; border: 1px solid #eee; border-radius: 8px; margin-bottom: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                    <div onclick="openProviderMenu('${price}')" style="flex:1; cursor: pointer; font-weight: 900; color:var(--fb-red); font-family:monospace; font-size:15px; display:flex; align-items:center; gap:8px;">
                        ${formatDisplayPrice(price, PROVIDERS[activeProviderKey].currency)}
                        <span style="color: var(--fb-muted); font-size: 10px; font-weight: 900; background: #f1f3f5; padding: 2px 6px; border-radius: 4px; font-family: sans-serif;">
                            ${ops.length} Provider
                        </span>
                    </div>
                    <i class="fa-solid fa-star" onclick="toggleFavoritePrice('${price}')" style="${starStyle} font-size:18px; cursor:pointer;" title="Jadikan Favorit"></i>
                </div>`;
    }).join('');
}
window.renderPriceGroups = renderPriceGroups;

export function openProviderMenu(price) {
    const box = document.getElementById('sms-prices');
    if (!box || !cachedPriceGroups[price]) return;
    
    let ops = cachedPriceGroups[price];
    
    const orderWeight = { 
        "ANY": 1, "ACAK": 1, 
        "INDOSAT": 2, 
        "TELKOMSEL": 3, 
        "THREE": 4, "TRI": 4, 
        "AXIS": 5, 
        "SMARTFREN": 6 
    };
    
    ops.sort((a, b) => {
        let nameA = a.opName.toUpperCase();
        let nameB = b.opName.toUpperCase();
        
        let rankA = 99; let rankB = 99;
        
        for (let key in orderWeight) { if (nameA.includes(key)) { rankA = orderWeight[key]; break; } }
        for (let key in orderWeight) { if (nameB.includes(key)) { rankB = orderWeight[key]; break; } }
        
        if (rankA !== rankB) return rankA - rankB;
        return nameA.localeCompare(nameB);
    });

    let html = `<input type="hidden" id="current-price-context" value="${price}">`;
                
    html += ops.map(item => {
        return `<div class="price-item" style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 8px; padding: 12px 15px; background: #fff; border: 1px solid #eee; border-radius: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.03);">
                    <div style="flex: 1; cursor: pointer; font-weight:900; color:var(--fb-text); font-size: 13px;" onclick="executeBuySms('${item.pid}', ${item.price}, '${item.opName}', '${item.opCode}', '${item.country || ""}')">
                        ${item.opName.toUpperCase()}
                    </div>
                    <i class="fa-solid fa-chevron-right" style="color:var(--fb-muted); font-size: 11px;"></i>
                </div>`;
    }).join('');
    
    html += `
        <div onclick="renderPriceGroups()" style="cursor:pointer; padding: 12px; background: var(--fb-blue); color: #fff; border-radius: 8px; font-size: 13px; font-weight: 900; text-align: center; margin-top: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); transition: 0.2s;">
            <i class="fa-solid fa-arrow-left" style="margin-right:8px;"></i> KEMBALI
        </div>
    `;
    
    box.innerHTML = html;
}
window.openProviderMenu = openProviderMenu;

// ==========================================
// 6. SISTEM PEMBELIAN & RENDER KARTU
// ==========================================
function createCardHTML(oId, phone, priceDisplay, resendState, cancelState, replaceState, otpDisplay, isDone = false, isRecycled = false, expireTime = 0, operatorName = "UNKNOWN", isHidden = false) {
    const doneStyle = isDone ? 'style="background:#e6f4ea; color:var(--fb-green); border-color:var(--fb-green);"' : 'disabled';
    
    // --> Tambahkan warna Oranye khusus untuk OtpCepat
    let bColor = activeProviderKey === "herosms" ? "#8e44ad" : 
                 activeProviderKey === "hwa" ? "#25D366" : 
                 activeProviderKey === "otpcepat" ? "#fd9644" : 
                 activeProviderKey === "smsvirtual" ? "#007bff" : "#95a5a6"; 
    
    const phoneColorStyle = isRecycled ? 'color: var(--fb-red);' : '';
    const recycledBadge = isRecycled ? `<span style="font-size:9px; color:#fff; background:var(--fb-red); padding:2px 5px; border-radius:4px; margin-left:8px;">DAUR ULANG</span>` : '';

    const toggleTitle = isHidden ? 'SHOW' : 'HIDE';
    const toggleColor = isHidden ? 'var(--fb-blue)' : 'var(--fb-muted)';

    return `<div class="order-card" id="order-${activeProviderKey}-${oId}" style="border: 2px solid ${bColor};">
        <div style="display:flex; justify-content:space-between; margin-bottom:15px; border-bottom:1px dashed var(--fb-border); padding-bottom:15px; align-items:center;">
            <div style="display:flex; align-items:center; gap:8px;">
                <span class="hide-btn-text" onclick="localHideSmsCard('${oId}')" style="cursor:pointer; font-size:10px; font-weight:900; color:${toggleColor}; background:#e9ecef; padding:4px 8px; border-radius:4px; letter-spacing:0.5px;">${toggleTitle}</span>
                <span style="font-size:15px; font-weight:900; color:var(--fb-text); text-transform:uppercase;">${operatorName.toUpperCase()}</span>
                <span style="font-size:13px; font-weight:900; color:var(--fb-red); font-family:monospace;">${priceDisplay}</span>
            </div>
            <div style="display:flex; align-items:center; gap:10px;">
                <span class="sms-timer" data-id="${oId}" data-expire="${expireTime}" style="font-family:monospace; font-weight:900; color:var(--fb-blue);">--:--</span>
            </div>
        </div>
        <div style="font-size:10px; color:var(--fb-muted); margin-bottom:5px; text-transform:uppercase; font-weight:900;">Nomor HP: ${recycledBadge}</div>
        <div class="phone-box" onclick="copyPhoneNumber('${phone}', 'copy-icon-${oId}')" style="font-weight: 900;">
            <span class="phone-text-span" style="${phoneColorStyle}">${phone}</span><i id="copy-icon-${oId}" class="fa-regular fa-copy" style="color: var(--fb-muted);"></i>
        </div>
        <div style="text-align: center; margin: 10px 0 15px 0; padding: 15px 0; background: #fafafa; border-radius: 8px;">
            <div style="font-size:10px; color:var(--fb-muted); font-weight:900; letter-spacing:1px; margin-bottom:5px;">KODE OTP</div>
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

    const pText = formatDisplayPrice(price, PROVIDERS[activeProviderKey].currency);
    const plainPText = pText.replace(/<[^>]*>?/gm, ''); 
    if(!await showModal("Konfirmasi", `Beli nomor untuk ${name.toUpperCase()} seharga ${plainPText}?`, "confirm")) return;

    let payload;
    if (activeProviderKey === "smsvirtual") {
        payload = { product_id: parseInt(pid), price: Number(price), operator: operator, country: parseInt(countryRank) || 1 };
    // --> OtpCepat ditambahkan ke logika format payload ini
    } else if (activeProviderKey === "herosms" || activeProviderKey === "hwa" || activeProviderKey === "otpcepat") {
        payload = { product_id: String(pid), price: price, operator: operator };
    } else if (activeProviderKey === "smscode") {
        payload = { 
            type: "product", 
            product_id: parseInt(pid),
            price: Number(price),
            operator: name 
        };
    }

    const j = await apiCall('/create-order', 'POST', payload);
    if(j.success && j.data) {
        
        localStorage.setItem(`pid_${activeProviderKey}_${j.data.orders[0].id}`, pid);
        localStorage.setItem(`price_${activeProviderKey}_${j.data.orders[0].id}`, price);
        
        const savedOp = activeProviderKey === "smscode" ? name : operator;
        if (savedOp) localStorage.setItem(`op_${activeProviderKey}_${j.data.orders[0].id}`, savedOp);

        if(j.data.orders[0].is_recycled) playSimpleSound('recycled');
        
        pollSms(); updateSmsBal();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
        showModal("Gagal", j.error?.message || "Stok Sedang Kosong.", "alert");
    }
}
window.executeBuySms = executeBuySms;

// ==========================================
// 7. POLLING & MANAJEMEN UI CERDAS
// ==========================================
async function pollSms() {
    if (isPolling) return;
    isPolling = true;
    try {
        await apiCall('/get-active', 'GET');
    } catch (e) {} finally { isPolling = false; }
}

export function localHideSmsCard(id) {
    const strId = String(id);
    const currentHiddenStatus = globalOrders[strId] ? globalOrders[strId].hidden : false;
    db.ref(`OTP/${activeProviderKey}/${currentServerName}/${strId}/hidden`).set(!currentHiddenStatus);
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

function renderSmsOrders() {
    const wrapActive = document.getElementById('wrapper-active-orders');
    const wrapHidden = document.getElementById('inner-hidden-orders');
    if(!wrapActive || !wrapHidden) return;
    
    let activeHTML = '';
    let hiddenHTML = '';

    let ordersList = Object.keys(globalOrders).map(id => {
        return { id: id, ...globalOrders[id] };
    });

    ordersList.sort((a,b) => b.created_at - a.created_at);

    ordersList.forEach(o => {
        let phone = o.phone || o.phone_number || '...';
        
        if (phone.startsWith('62')) {
            phone = '0' + phone.substring(2);
        }
        
        const price = o.price || 0;
        
        const opName = cleanOpName(o.operator);
        
        let isHidden = !!o.hidden; 
        
        let orderTime = o.created_at || Date.now();
        const expire = orderTime + 900000; 
        
        const passed2Mins = (Date.now() - orderTime) >= 120000; 

        if (o.otp_code && !notifiedOtps.includes(String(o.id))) {
            playSimpleSound('otp');
            notifiedOtps.push(String(o.id));
            
            if (notifiedOtps.length > 50) notifiedOtps.shift();
            
            localStorage.setItem('sms_notified_otps', JSON.stringify(notifiedOtps));
        }

        let otpDisplay = o.otp_code ? `<span onclick="copyOtpCode('${o.otp_code}', this)" style="cursor:pointer; color:#00897B; letter-spacing:6px; font-size:31px; font-weight:900; display: inline-flex; align-items: center;" title="Klik untuk menyalin">${o.otp_code.replace(/(\d{3})(?=\d)/g, '$1 ')}</span>` : `<div class="loader-bars"><span></span><span></span><span></span></div>`;
        const resendState = o.otp_code ? '' : 'disabled';
        
        const cancelState = passed2Mins && !o.otp_code ? '' : 'disabled';
        const replaceState = passed2Mins && !o.otp_code ? '' : 'disabled';
        
        const displayPrice = formatDisplayPrice(price, PROVIDERS[activeProviderKey].currency);
        const htmlStr = createCardHTML(o.id, phone, displayPrice, resendState, cancelState, replaceState, otpDisplay, !!o.otp_code, o.is_recycled, expire, opName, isHidden);

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
        let oId = el.dataset.id;
        
        if(end && !isNaN(end)) {
            const diff = Math.max(0, Math.floor((end - now)/1000));
            el.innerText = `${Math.floor(diff/60)}:${(diff%60).toString().padStart(2,'0')}`;
            el.style.color = diff < 600 ? "var(--fb-red)" : "var(--fb-blue)"; 

            let orderTime = end - 900000; 
            let passed2Mins = (now - orderTime) >= 120000; 

            if (passed2Mins) {
                let hasOtp = globalOrders[oId] && globalOrders[oId].otp_code;
                
                if (!hasOtp) {
                    let card = document.getElementById(`order-${activeProviderKey}-${oId}`);
                    if (card) {
                        let btnCancel = card.querySelector('.btn-cancel');
                        let btnReplace = card.querySelector('.btn-replace');
                        
                        if (btnCancel && btnCancel.hasAttribute('disabled')) {
                            btnCancel.removeAttribute('disabled');
                        }
                        if (btnReplace && btnReplace.hasAttribute('disabled')) {
                            btnReplace.removeAttribute('disabled');
                        }
                    }
                }
            }
        }
    });
}

export async function actSms(action, id) {
    if (!await showModal("Konfirmasi", "Lanjutkan aksi ini?", "confirm")) return;

    if (action === 'replace') {
        const jCancel = await apiCall('/order-action', 'POST', { id, action: 'cancel' });
        if (jCancel.success) {
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
